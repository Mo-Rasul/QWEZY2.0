// app/api/auth/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const { email, password, action } = await req.json()

  // ── Master admin ────────────────────────────────────────────────────────────
  if (action === 'signin' &&
      email === process.env.MASTER_EMAIL &&
      password === process.env.MASTER_PASSWORD) {
    try {
      await supabaseAdmin.from('audit_log').insert({
        actor: 'master', action: 'master_login', details: { email }
      })
    } catch {}
    const res = NextResponse.json({ ok: true, master: true, redirect: '/master' })
    res.cookies.set('qwezy_master_session', btoa(`${email}:${Date.now()}`), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8,
      path: '/',
    })
    return res
  }

  // ── Sign in ─────────────────────────────────────────────────────────────────
  if (action === 'signin') {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return NextResponse.json({ error: error.message }, { status: 401 })

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('id,company_id,name,role,status')
      .eq('id', data.user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'User profile not found. Contact your admin.' }, { status: 403 })
    if (profile.status === 'inactive') return NextResponse.json({ error: 'Account inactive.' }, { status: 403 })

    // Get company name + plan
    let companyPlan = 'starter'
    let companyName = ''
    let dbConnected = false
    if (profile.company_id) {
      const { data: company } = await supabaseAdmin
        .from('companies')
        .select('plan,name,db_connection_string')
        .eq('id', profile.company_id)
        .single()
      if (company) {
        companyPlan = company.plan || 'starter'
        companyName = company.name || ''
        dbConnected = !!company.db_connection_string
      }
    }

    try {
      await supabaseAdmin.from('users')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', data.user.id)
    } catch {}

    // Flat response — company_id at top level so page.tsx can read it directly
    const res = NextResponse.json({
      id: profile.id,
      company_id: profile.company_id,
      company_name: companyName,
      name: profile.name,
      email: data.user.email,
      role: profile.role,
      plan: companyPlan,
      db_connected: dbConnected,
    })
    res.cookies.set('qwezy_session', data.session?.access_token || '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    res.cookies.set('qwezy_company', profile.company_id || '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    return res
  }

  // ── Sign up (used when admin invites a new user) ────────────────────────────
  if (action === 'signup') {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ userId: data.user?.id })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

export async function DELETE() {
  await supabase.auth.signOut()
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('qwezy_session')
  res.cookies.delete('qwezy_company')
  return res
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('qwezy_session')?.value
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id,company_id,name,role,status')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Get company info fresh from DB every time — never trust the cookie
  let companyName = ''
  let companyPlan = 'starter'
  let dbConnected = false
  if (profile.company_id) {
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('name,plan,db_connection_string')
      .eq('id', profile.company_id)
      .single()
    if (company) {
      companyName = company.name || ''
      companyPlan = company.plan || 'starter'
      dbConnected = !!company.db_connection_string
    }
  }

  // Flat response — everything at top level, no nesting
  return NextResponse.json({
    id: profile.id,
    company_id: profile.company_id,
    company_name: companyName,
    name: profile.name,
    email: user.email,
    role: profile.role,
    plan: companyPlan,
    db_connected: dbConnected,
  })
}
