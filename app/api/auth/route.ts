// app/api/auth/route.ts
// Real Supabase Auth — replaces the hardcoded Qwezy2026 password

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const { email, password, action } = await req.json()

  // Master admin detection — check before regular auth
  if (action === 'signin' &&
      email === process.env.MASTER_EMAIL &&
      password === process.env.MASTER_PASSWORD) {
    // Log it
  try {
    await supabaseAdmin.from('audit_log').insert({
      actor: 'master', action: 'master_login', details: { email }
    })
  } catch {}
    // Set master session cookie
    const res = NextResponse.json({ ok: true, master: true, redirect: '/master' })
    res.cookies.set('qwezy_master_session',
      btoa(`${email}:${Date.now()}`), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 8,
        path: '/',
      })
    return res
  }

  if (action === 'signin') {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return NextResponse.json({ error: error.message }, { status: 401 })

    // Load user profile (role, company)
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('id,company_id,name,role,status')
      .eq('id', data.user.id)
      .single()

    // Get company plan
    let companyPlan = 'starter'
    if (profile?.company_id) {
      const { data: company } = await supabaseAdmin.from('companies').select('plan').eq('id', profile.company_id).single()
      if (company?.plan) companyPlan = company.plan
    }

    if (!profile) return NextResponse.json({ error: 'User profile not found. Contact your admin.' }, { status: 403 })
    if (profile.status === 'inactive') return NextResponse.json({ error: 'Account inactive.' }, { status: 403 })

    // Update last_seen
    try { await supabaseAdmin.from('users').update({ last_seen: new Date().toISOString() }).eq('id', data.user.id) } catch {}

    const cookieOpts = {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const, maxAge: 60 * 60 * 24 * 7, path: '/'
    }
    const res = NextResponse.json({ user: { ...profile, email: data.user.email, plan: companyPlan }, token: data.session?.access_token })
    res.cookies.set('qwezy_session', data.session?.access_token || '', cookieOpts)
    res.cookies.set('qwezy_refresh', data.session?.refresh_token || '', cookieOpts)
    res.cookies.set('qwezy_company', profile.company_id, cookieOpts)
    return res
  }

  if (action === 'signup') {
    // Used during onboarding when admin invites a new user
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ userId: data.user?.id })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

export async function DELETE() {
  // Sign out
  await supabase.auth.signOut()
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('qwezy_session')
  res.cookies.delete('qwezy_refresh')
  res.cookies.delete('qwezy_company')
  return res
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('qwezy_session')?.value
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let authUser = null

  // Try the access token first
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (!error && user) {
    authUser = user
  } else {
    // Access token expired — try to refresh using the refresh token cookie
    const refreshToken = req.cookies.get('qwezy_refresh')?.value
    if (!refreshToken) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession({ refresh_token: refreshToken })
    if (refreshError || !refreshed.session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

    authUser = refreshed.user

    // Build response with refreshed tokens — fetch profile below then return
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('id,company_id,name,role,status')
      .eq('id', authUser!.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    // Get company info
    let companyName = '', companyPlan = 'starter', dbConnected = false
    if (profile.company_id) {
      const { data: company } = await supabaseAdmin
        .from('companies').select('name,plan,db_connection_string').eq('id', profile.company_id).single()
      if (company) { companyName = company.name || ''; companyPlan = company.plan || 'starter'; dbConnected = !!company.db_connection_string }
    }

    const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 60 * 60 * 24 * 7, path: '/' }
    const { data: rCo } = await supabaseAdmin.from('companies').select('tables_config').eq('id', profile.company_id).single()
    const rAiConfigured = !!(rCo?.tables_config?.system_prompt)
    const res = NextResponse.json({ id: profile.id, company_id: profile.company_id, company_name: companyName, name: profile.name, email: authUser!.email, role: profile.role, plan: companyPlan, db_connected: dbConnected, ai_configured: rAiConfigured })
    res.cookies.set('qwezy_session', refreshed.session.access_token, cookieOpts)
    res.cookies.set('qwezy_refresh', refreshed.session.refresh_token, cookieOpts)
    return res
  }

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id,company_id,name,role,status')
    .eq('id', authUser.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  let companyName = '', companyPlan = 'starter', dbConnected = false
  if (profile.company_id) {
    const { data: company } = await supabaseAdmin
      .from('companies').select('name,plan,db_connection_string').eq('id', profile.company_id).single()
    if (company) { companyName = company.name || ''; companyPlan = company.plan || 'starter'; dbConnected = !!company.db_connection_string }
  }

  let aiConfigured = false
  if (profile.company_id) {
    const { data: co } = await supabaseAdmin.from('companies').select('tables_config').eq('id', profile.company_id).single()
    aiConfigured = !!(co?.tables_config?.system_prompt)
  }
  return NextResponse.json({ id: profile.id, company_id: profile.company_id, company_name: companyName, name: profile.name, email: authUser.email, role: profile.role, plan: companyPlan, db_connected: dbConnected, ai_configured: aiConfigured })
}