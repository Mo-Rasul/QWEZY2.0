// app/api/master/companies/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-app'
import { verifyMasterToken } from '../auth/route'

export async function GET(req: NextRequest) {
  if (!verifyMasterToken(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: companies } = await supabaseAdmin
    .from('companies')
    .select('id,name,plan,created_at,api_token')
    .order('created_at', { ascending: false })

  if (!companies) return NextResponse.json({ companies: [] })

  // Enrich with user count, query usage, connection status
  const enriched = await Promise.all(companies.map(async c => {
    const [users, usage, connections, onboarding] = await Promise.all([
      supabaseAdmin.from('users').select('id,email,name,role,status,last_seen').eq('company_id', c.id),
      supabaseAdmin.from('query_usage').select('query_count,month').eq('company_id', c.id).order('month', { ascending: false }).limit(3),
      supabaseAdmin.from('db_connections').select('id,nickname,is_active,last_tested,test_ok').eq('company_id', c.id),
      supabaseAdmin.from('onboarding_progress').select('*').eq('company_id', c.id).single(),
    ])
    const thisMonth = usage.data?.[0]?.query_count || 0
    const lastMonth = usage.data?.[1]?.query_count || 0
    return {
      ...c,
      users: users.data || [],
      queriesThisMonth: thisMonth,
      queriesLastMonth: lastMonth,
      connections: connections.data || [],
      onboarding: onboarding.data,
      activeUsers: users.data?.filter(u=>u.status==='active').length || 0,
    }
  }))

  return NextResponse.json({ companies: enriched })
}

export async function POST(req: NextRequest) {
  if (!verifyMasterToken(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()

  if (body.action === 'create_company') {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .insert({ name: body.name, plan: body.plan || 'starter' })
      .select('id,name,plan')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabaseAdmin.from('onboarding_progress').insert({ company_id: data.id })
    await supabaseAdmin.from('audit_log').insert({ actor:'master', action:'create_company', target_company: data.id, details:{name:body.name,plan:body.plan} }).catch(()=>{})
    return NextResponse.json({ company: data })
  }

  if (body.action === 'create_user') {
    // Create auth user
    const pass = body.password || (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2))
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: body.email, password: pass, email_confirm: true,
      user_metadata: { name: body.name }
    })
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })

    const { error: userErr } = await supabaseAdmin.from('users').insert({
      id: authData.user.id, company_id: body.companyId,
      email: body.email, name: body.name, role: body.role || 'admin', status: 'active'
    })
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 })

    await supabaseAdmin.from('audit_log').insert({ actor:'master', action:'create_user', target_company:body.companyId, details:{email:body.email,role:body.role} }).catch(()=>{})
    return NextResponse.json({ ok: true, userId: authData.user.id })
  }

  if (body.action === 'update_plan') {
    await supabaseAdmin.from('companies').update({ plan: body.plan }).eq('id', body.companyId)
    await supabaseAdmin.from('audit_log').insert({ actor:'master', action:'update_plan', target_company:body.companyId, details:{plan:body.plan} }).catch(()=>{})
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'impersonate') {
    // Set impersonation cookie — dashboard reads this and loads that company
    await supabaseAdmin.from('audit_log').insert({ actor:'master', action:'impersonate', target_company:body.companyId, details:{companyName:body.companyName} }).catch(()=>{})
    const res = NextResponse.json({ ok: true })
    res.cookies.set('qwezy_impersonate', body.companyId, { httpOnly:true, sameSite:'lax', maxAge:3600, path:'/' })
    return res
  }

  if (body.action === 'delete_company') {
    await supabaseAdmin.from('audit_log').insert({ actor:'master', action:'delete_company', target_company:body.companyId, details:{name:body.name} }).catch(()=>{})
    await supabaseAdmin.from('companies').delete().eq('id', body.companyId)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
