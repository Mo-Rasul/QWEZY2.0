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

    if (!profile) return NextResponse.json({ error: 'User profile not found. Contact your admin.' }, { status: 403 })
    if (profile.status === 'inactive') return NextResponse.json({ error: 'Account inactive.' }, { status: 403 })

    const res = NextResponse.json({ user: { ...profile, email: data.user.email }, token: data.session?.access_token })
    res.cookies.set('qwezy_session', data.session?.access_token || '', {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/'
    })
    res.cookies.set('qwezy_company', profile.company_id, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/'
    })
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
  res.cookies.delete('qwezy_company')
  return res
}

export async function GET(req: NextRequest) {
  // Return current user profile from session cookie
  const token = req.cookies.get('qwezy_session')?.value
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id,company_id,name,role,status')
    .eq('id', user.id)
    .single()

  return NextResponse.json({ user: { ...profile, email: user.email } })
}
