// app/api/auth/callback/route.ts
// Receives the magic link token from the frontend,
// looks up the user's company, and sets session cookies

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'

export async function POST(req: NextRequest) {
  const { token, email } = await req.json()
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 400 })

  try {
    // Verify the token is valid
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Look up their company
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('company_id, status')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Set session cookies
    const res = NextResponse.json({ ok: true })
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    }
    res.cookies.set('qwezy_session', token, cookieOpts)
    res.cookies.set('qwezy_company', profile.company_id, cookieOpts)

    // Update last_seen
    supabaseAdmin.from('users').update({ last_seen: new Date().toISOString() }).eq('id', user.id).then(() => {}).catch(() => {})

    return res
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
