// app/api/demo-access/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'

const DEMO_COMPANY_ID = '4dd68cdf-b52f-4a91-aae1-51ffbc9423db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, name, email, company, role, teamSize, industry, useCase, code } = body

  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  // ── STEP 2: Verify the OTP code ──────────────────────────────────────────
  if (action === 'verify') {
    if (!code) return NextResponse.json({ error: 'Code is required' }, { status: 400 })

    const supabasePublic = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Verify OTP with Supabase
    const { data, error } = await supabasePublic.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    })

    if (error || !data.session) {
      return NextResponse.json({ error: 'Invalid or expired code. Please try again.' }, { status: 400 })
    }

    // Ensure user is assigned to Velo demo company
    await supabaseAdmin.from('users').upsert({
      id: data.user!.id,
      company_id: DEMO_COMPANY_ID,
      email,
      name: name || email.split('@')[0],
      role: 'analyst',
      status: 'active',
    }, { onConflict: 'id' })

    // Set session cookies
    const res = NextResponse.json({ ok: true, name: name || email.split('@')[0] })
    const opts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    }
    res.cookies.set('qwezy_session', data.session.access_token, opts)
    res.cookies.set('qwezy_company', DEMO_COMPANY_ID, opts)
    return res
  }

  // ── STEP 1: Submit form, send OTP code ───────────────────────────────────
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  try {
    // Save lead
    try {
      await supabaseAdmin.from('leads' as any).insert({
        name, email, company, role,
        team_size: teamSize, industry, use_case: useCase,
      })
    } catch {}

    // Ensure auth user exists
    const { data: existingUser } = await supabaseAdmin
      .from('users').select('id').eq('email', email).single()

    if (!existingUser) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email, email_confirm: true,
        user_metadata: { name, company },
      })
      if (!authError && authData.user) {
        await supabaseAdmin.from('users').upsert({
          id: authData.user.id, company_id: DEMO_COMPANY_ID,
          email, name, role: 'analyst', status: 'active',
        }, { onConflict: 'id' })
      }
    }

    // Send OTP via Supabase (6-digit code to their email)
    const supabasePublic = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { error: otpError } = await supabasePublic.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })

    if (otpError) {
      return NextResponse.json({ error: 'Could not send code. Please try again.' }, { status: 500 })
    }

    // Admin notification
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qwezy.io'
    const RESEND_API_KEY = process.env.RESEND_API_KEY
    if (RESEND_API_KEY) {
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Qwezy <admin@qwezy.io>', to: 'admin@qwezy.io',
          subject: `New demo signup: ${name} from ${company || 'unknown'}`,
          html: `<p><strong>${name}</strong> (${email})<br>Company: ${company || '—'} | Role: ${role || '—'} | Team: ${teamSize || '—'}<br>Use case: ${useCase || '—'}</p><p><a href="${siteUrl}/master">View in master admin</a></p>`
        })
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, codeSent: true })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
