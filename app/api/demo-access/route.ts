import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-app'

const NORTHWIND_COMPANY_ID = '68065cb1-48d7-4488-bd78-9e354e6fb53f'

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, email, name, company, role, teamSize, industry, useCase, code } = body

  if (action === 'send_otp') {
    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const { data: existingProfile } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', normalizedEmail)
      .maybeSingle()

    const { data: existingLead } = await supabaseAdmin
      .from('leads')
      .select('email, name, company')
      .eq('email', normalizedEmail)
      .maybeSingle()

    const knownEmail = !!existingProfile || !!existingLead

    // Unknown email: require survey first
    if (!knownEmail && (!name?.trim() || !company?.trim())) {
      return NextResponse.json({
        ok: true,
        returning: false,
        needsForm: true,
      })
    }

    // Known returning visitor: allow direct access if they have already verified before
    const { data: previousOTP } = await supabaseAdmin
      .from('otp_codes')
      .select('email')
      .eq('email', normalizedEmail)
      .eq('used', true)
      .limit(1)
      .maybeSingle()

    if (knownEmail && previousOTP) {
      const session = await createDemoSession(normalizedEmail)
      if (session.error) {
        return NextResponse.json({ error: session.error }, { status: 500 })
      }

      const res = NextResponse.json({
        ok: true,
        returning: true,
        skipOTP: true,
      })
      setSessionCookies(res, session.token!, session.refreshToken)
      return res
    }

    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    await supabaseAdmin.from('otp_codes').delete().eq('email', normalizedEmail)

    await supabaseAdmin.from('otp_codes').insert({
      email: normalizedEmail,
      code: otp,
      expires_at: expiresAt,
      used: false,
    })

    await supabaseAdmin.from('leads').upsert(
      {
        email: normalizedEmail,
        name: name?.trim() || null,
        company: company?.trim() || null,
        role: role || null,
        team_size: teamSize || null,
        industry: industry || null,
        use_case: useCase || null,
        source: 'demo',
      },
      { onConflict: 'email' }
    )

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Mo at Qwezy <mo@qwezy.io>',
        to: normalizedEmail,
        subject: 'Your Qwezy demo code',
        html: `
          <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;color:#1a1a1a;">
            <div style="margin-bottom:28px;">
              <span style="font-size:22px;font-weight:800;color:#059669;">Qwezy</span>
            </div>
            <h2 style="font-size:22px;font-weight:700;margin-bottom:10px;">Hi ${name?.trim() || 'there'}, here's your code</h2>
            <p style="color:#6b7280;font-size:15px;line-height:1.7;margin-bottom:28px;">
              Use this code to access the Qwezy demo. It expires in 15 minutes.
            </p>
            <div style="background:#F0FDF4;border:1px solid #A7F3D0;border-radius:10px;padding:24px;text-align:center;margin-bottom:28px;">
              <div style="font-family:'JetBrains Mono',monospace;font-size:36px;font-weight:800;color:#059669;letter-spacing:8px;">${otp}</div>
            </div>
            <p style="color:#9ca3af;font-size:13px;line-height:1.6;">
              If you didn't request this, you can ignore this email.<br>
              — Mo, Qwezy
            </p>
          </div>
        `,
      }),
    })

    if (!emailRes.ok) {
      console.error('Resend error:', await emailRes.text())
      return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, returning: false, needsForm: false })
  }

  if (action === 'verify_otp') {
    if (!email?.trim() || !code?.trim()) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const { data: otpRow } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('code', code.trim())
      .eq('used', false)
      .maybeSingle()

    if (!otpRow) {
      return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 400 })
    }

    if (new Date(otpRow.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Code expired. Please request a new one.' }, { status: 400 })
    }

    await supabaseAdmin
      .from('otp_codes')
      .update({ used: true })
      .eq('email', normalizedEmail)
      .eq('code', code.trim())

    const session = await createDemoSession(normalizedEmail)
    if (session.error) {
      return NextResponse.json({ error: session.error }, { status: 500 })
    }

    const res = NextResponse.json({ ok: true })
    setSessionCookies(res, session.token!, session.refreshToken)
    return res
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

async function createDemoSession(email: string): Promise<{ token?: string; refreshToken?: string; error?: string }> {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data } = await supabaseAdmin.auth.admin.listUsers()
    const users = data?.users || []
    let authUser = users.find((u: any) => u.email === email)

    if (!authUser) {
      const tempPwd = Math.random().toString(36).slice(2) + 'Qx9!'
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPwd,
        email_confirm: true,
      })
      if (error) return { error: error.message }
      authUser = created.user

      await supabaseAdmin.from('users').insert({
        id: authUser.id,
        email,
        name: email.split('@')[0],
        company_id: NORTHWIND_COMPANY_ID,
        role: 'viewer',
        status: 'active',
      })
    } else {
      const { data: profile } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', authUser.id)
        .maybeSingle()

      if (!profile) {
        await supabaseAdmin.from('users').insert({
          id: authUser.id,
          email,
          name: email.split('@')[0],
          company_id: NORTHWIND_COMPANY_ID,
          role: 'viewer',
          status: 'active',
        })
      } else {
        await supabaseAdmin
          .from('users')
          .update({
            company_id: NORTHWIND_COMPANY_ID,
            status: 'active',
          })
          .eq('id', authUser.id)
      }
    }

    const demoPwd = `demo_${authUser.id.slice(0, 8)}_Qwezy!`
    await supabaseAdmin.auth.admin.updateUserById(authUser.id, { password: demoPwd })

    const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: demoPwd,
    })

    if (signInError || !signIn?.session?.access_token) {
      return { error: signInError?.message || 'Could not create session' }
    }

    return {
      token: signIn.session.access_token,
      refreshToken: signIn.session.refresh_token || '',
    }
  } catch (err: any) {
    return { error: err.message }
  }
}

function setSessionCookies(res: NextResponse, token: string, refreshToken: string = '') {
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  }

  res.cookies.set('qwezy_session', token, opts)
  res.cookies.set('qwezy_refresh', refreshToken, opts)
  res.cookies.set('qwezy_company', NORTHWIND_COMPANY_ID, opts)
}