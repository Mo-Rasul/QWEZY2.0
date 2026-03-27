// app/api/demo-access/route.ts
// Step 1: Generate our own 6-digit code, store in Supabase, send via Resend
// Step 2: Verify code, create session, set cookies

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'

const DEMO_COMPANY_ID = '4dd68cdf-b52f-4a91-aae1-51ffbc9423db'
const DEMO_PASSWORD   = process.env.DEMO_USER_PASSWORD || 'QwezyDemo2026!'
const RESEND_KEY      = process.env.RESEND_API_KEY

// ── Send email via Resend ─────────────────────────────────────────────────────
async function sendCodeEmail(to: string, firstName: string, code: string) {
  if (!RESEND_KEY) { console.log(`[EMAIL STUB] Code ${code} to ${to}`); return }
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Qwezy <admin@qwezy.io>',
      to,
      subject: `${code} is your Qwezy verification code`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto">
          <div style="background:#022c22;padding:20px 28px;border-radius:12px 12px 0 0;display:flex;align-items:center;gap:10px">
            <div style="width:32px;height:32px;background:linear-gradient(135deg,#10B981,#059669);border-radius:7px;color:#fff;font-family:monospace;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center">{ }</div>
            <span style="color:#fff;font-weight:800;font-size:18px;letter-spacing:-0.3px">Qwezy</span>
          </div>
          <div style="background:#fff;padding:32px 28px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 12px 12px">
            <p style="font-size:15px;color:#4B5563;margin:0 0 8px">Hi ${firstName},</p>
            <p style="font-size:15px;color:#4B5563;margin:0 0 28px;line-height:1.6">Enter this code to access your live Qwezy demo:</p>
            <div style="background:#F9FAFB;border:2px solid #059669;border-radius:10px;padding:20px;text-align:center;margin-bottom:28px">
              <div style="font-family:'Courier New',monospace;font-size:38px;font-weight:800;color:#059669;letter-spacing:10px">${code}</div>
              <div style="font-size:12px;color:#9CA3AF;margin-top:8px">Expires in 10 minutes</div>
            </div>
            <p style="font-size:13px;color:#9CA3AF;margin:0">If you did not request this, you can safely ignore this email.</p>
          </div>
        </div>
      `
    })
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, name, email, company, role, teamSize, industry, useCase, code } = body
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  // ── VERIFY code ───────────────────────────────────────────────────────────
  if (action === 'verify') {
    if (!code) return NextResponse.json({ error: 'Code is required' }, { status: 400 })

    // Check code in our otp_codes table
    const { data: stored, error: fetchErr } = await supabaseAdmin
      .from('otp_codes' as any)
      .select('code, expires_at, used')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (fetchErr || !stored) {
      return NextResponse.json({ error: 'No code found. Please request a new one.' }, { status: 400 })
    }
    if (stored.used) {
      return NextResponse.json({ error: 'Code already used. Please request a new one.' }, { status: 400 })
    }
    if (new Date(stored.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Code expired. Please request a new one.' }, { status: 400 })
    }
    if (stored.code !== code) {
      return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 400 })
    }

    // Mark code as used
    await supabaseAdmin.from('otp_codes' as any).update({ used: true }).eq('email', email)

    // Find user in auth
    const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers()
    const authUser = authUsers.find((u: any) => u.email === email)

    if (!authUser) {
      return NextResponse.json({ error: 'Account not found. Please sign up again.' }, { status: 400 })
    }

    // Generate a magic link and extract the token — no password needed
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

    if (linkError || !linkData?.properties?.hashed_token) {
      return NextResponse.json({ error: 'Could not create session. Please try again.' }, { status: 500 })
    }

    // Exchange the token for a session using the public client
    const supabasePublic = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: sessionData, error: sessionError } = await supabasePublic.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
    })

    if (sessionError || !sessionData.session) {
      return NextResponse.json({ error: 'Could not create session. Please try again.' }, { status: 500 })
    }

    // Ensure user assigned to Velo demo company
    await supabaseAdmin.from('users').upsert({
      id: authUser.id, company_id: DEMO_COMPANY_ID,
      email, name: name || email.split('@')[0],
      role: 'analyst', status: 'active',
    }, { onConflict: 'id' })

    // Set session cookies
    const res = NextResponse.json({ ok: true, name: name || email.split('@')[0] })
    const opts = {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const, maxAge: 60 * 60 * 24 * 7, path: '/',
    }
    res.cookies.set('qwezy_session', sessionData.session.access_token, opts)
    res.cookies.set('qwezy_company', DEMO_COMPANY_ID, opts)
    return res
  }

  // ── SEND code ─────────────────────────────────────────────────────────────
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  try {
    // Save lead
    try {
      await supabaseAdmin.from('leads' as any).insert({
        name, email, company, role,
        team_size: teamSize, industry, use_case: useCase,
      })
    } catch {}

    // Create auth user if doesn't exist
    const { data: existingUser } = await supabaseAdmin
      .from('users').select('id').eq('email', email).single()

    if (!existingUser) {
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email, password: DEMO_PASSWORD, email_confirm: true,
        user_metadata: { name, company },
      })
      if (!authErr && authData.user) {
        await supabaseAdmin.from('users').upsert({
          id: authData.user.id, company_id: DEMO_COMPANY_ID,
          email, name, role: 'analyst', status: 'active',
        }, { onConflict: 'id' })
      }
    } else {
      // Update password to ensure sign-in works
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password: DEMO_PASSWORD })
    }

    // Generate 6-digit code
    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    // Store code
    await supabaseAdmin.from('otp_codes' as any).upsert({
      email, code: otp, expires_at: expiresAt, used: false,
    }, { onConflict: 'email' })

    // Send via Resend
    await sendCodeEmail(email, name.split(' ')[0], otp)

    // Admin notification
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qwezy.io'
    if (RESEND_KEY) {
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Qwezy <admin@qwezy.io>', to: 'admin@qwezy.io',
          subject: `New demo signup: ${name} from ${company || 'unknown'}`,
          html: `<p><strong>${name}</strong> (${email})<br>Company: ${company || '—'} | Role: ${role || '—'} | Team: ${teamSize || '—'}<br>Use case: ${useCase || '—'}</p><p><a href="${siteUrl}/master">View in master admin</a></p>`
        })
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, codeSent: true })

  } catch (err: any) {
    console.error('demo-access error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
