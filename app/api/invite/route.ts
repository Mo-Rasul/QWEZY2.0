// app/api/invite/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(req: NextRequest) {
  try {
    // Verify the requesting user is an admin
    const token = req.cookies.get('qwezy_session')?.value
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user: requestingUser } } = await supabase.auth.getUser(token)
    if (!requestingUser) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

    const { data: adminProfile } = await supabaseAdmin
      .from('users')
      .select('company_id, role, name')
      .eq('id', requestingUser.id)
      .single()

    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can invite users' }, { status: 403 })
    }

    const { email, name, role } = await req.json()
    if (!email || !name || !role) {
      return NextResponse.json({ error: 'Email, name and role are required' }, { status: 400 })
    }

    // Get company name for the email
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('name')
      .eq('id', adminProfile.company_id)
      .single()

    // Generate a temporary password — user will be prompted to change on first login
    const tempPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-4).toUpperCase() + '!'

    // Create Supabase auth user
    const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 })
      }
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Create user profile tied to the same company
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: newAuthUser.user.id,
        company_id: adminProfile.company_id,
        email,
        name,
        role,
        status: 'active',
      })

    if (profileError) {
      // Rollback auth user if profile fails
      await supabaseAdmin.auth.admin.deleteUser(newAuthUser.user.id)
      return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 })
    }

    // Send invite email via Resend
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://qwezy.io'}/login`

    await resend.emails.send({
      from: 'Qwezy <noreply@qwezy.io>',
      to: email,
      subject: `You've been invited to ${company?.name || 'Qwezy'}`,
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
          <div style="margin-bottom: 28px;">
            <span style="font-size: 22px; font-weight: 800; color: #059669; letter-spacing: -0.5px;">Qwezy</span>
          </div>

          <h1 style="font-size: 22px; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.3px;">
            You've been invited to ${company?.name || 'Qwezy'}
          </h1>
          <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
            ${adminProfile.name} has added you as a <strong>${role}</strong> on Qwezy.
            Use the credentials below to log in for the first time.
          </p>

          <div style="background: #f8fafd; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px 24px; margin-bottom: 24px;">
            <div style="margin-bottom: 12px;">
              <span style="font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.06em;">Email</span>
              <div style="font-size: 15px; font-weight: 500; color: #1a1a1a; margin-top: 2px;">${email}</div>
            </div>
            <div>
              <span style="font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.06em;">Temporary Password</span>
              <div style="font-family: 'JetBrains Mono', monospace; font-size: 16px; font-weight: 700; color: #059669; margin-top: 2px; letter-spacing: 1px;">${tempPassword}</div>
            </div>
          </div>

          <p style="color: #6b7280; font-size: 13px; margin-bottom: 24px;">
            Please change your password after your first login.
          </p>

          <a href="${loginUrl}" style="display: inline-block; background: #059669; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 7px; font-weight: 600; font-size: 14px;">
            Log in to Qwezy →
          </a>

          <p style="color: #9ca3af; font-size: 12px; margin-top: 32px; line-height: 1.6;">
            If you weren't expecting this invitation, you can ignore this email.
          </p>
        </div>
      `,
    })

    return NextResponse.json({ ok: true, message: `Invite sent to ${email}` })

  } catch (err: any) {
    console.error('Invite error:', err.message)
    return NextResponse.json({ error: err.message || 'Failed to send invite' }, { status: 500 })
  }
}
