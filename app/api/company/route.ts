// app/api/company/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-app'
// ── POST: Create a new company + admin user + send welcome email ──────────────
export async function POST(req: NextRequest) {
  try {
    // Verify master session
    const masterCookie = req.cookies.get('qwezy_master_session')?.value
    if (!masterCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { companyName, plan, adminEmail, adminName, notes } = await req.json()
    if (!companyName || !adminEmail || !adminName) {
      return NextResponse.json({ error: 'Company name, admin email and name are required' }, { status: 400 })
    }

    // 1. Create company row
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({ name: companyName, plan: plan || 'starter', notes: notes || null })
      .select('id, name, plan')
      .single()

    if (companyError) throw new Error(companyError.message)

    // 2. Find or create Supabase auth user
    // If they already registered via demo form, reuse their account
    let userId: string
    let isExistingUser = false
    let tempPassword = ''

    const { data: { users: allUsers } } = await supabaseAdmin.auth.admin.listUsers()
    const existingAuthUser = allUsers?.find((u: any) => u.email === adminEmail)

    if (existingAuthUser) {
      userId = existingAuthUser.id
      isExistingUser = true
      // Update their existing profile to point to the new company
      const { data: existingProfile } = await supabaseAdmin.from('users').select('id').eq('id', userId).single()
      if (existingProfile) {
        await supabaseAdmin.from('users').update({ company_id: company.id, name: adminName, role: 'admin', status: 'active' }).eq('id', userId)
      } else {
        await supabaseAdmin.from('users').insert({ id: userId, company_id: company.id, email: adminEmail, name: adminName, role: 'admin', status: 'active' })
      }
    } else {
      tempPassword = generateTempPassword()
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({ email: adminEmail, password: tempPassword, email_confirm: true })
      if (authError) { await supabaseAdmin.from('companies').delete().eq('id', company.id); throw new Error(authError.message) }
      userId = authUser.user.id
      const { error: profileError } = await supabaseAdmin.from('users').insert({ id: userId, company_id: company.id, email: adminEmail, name: adminName, role: 'admin', status: 'active' })
      if (profileError) { await supabaseAdmin.auth.admin.deleteUser(userId); await supabaseAdmin.from('companies').delete().eq('id', company.id); throw new Error(profileError.message) }
    }

    // 3. Send welcome email
    const onboardingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/onboarding`
    let credentialsHtml = ''
    if (isExistingUser) {
      const { data: resetData } = await supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email: adminEmail })
      const resetUrl = resetData?.properties?.action_link || `${process.env.NEXT_PUBLIC_APP_URL}/login`
      credentialsHtml = `<div style="background:#f8fafd;border:1px solid #e5e7eb;border-radius:10px;padding:22px 24px;margin-bottom:28px;"><p style="font-size:14px;color:#374151;margin-bottom:14px;">You already have a Qwezy account. Your workspace has been upgraded to <strong>${companyName}</strong>.</p><a href="${resetUrl}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:10px 22px;border-radius:7px;font-weight:600;font-size:13.5px;">Log in to Qwezy →</a></div>`
    } else {
      credentialsHtml = `<div style="background:#f8fafd;border:1px solid #e5e7eb;border-radius:10px;padding:22px 24px;margin-bottom:28px;"><div style="margin-bottom:12px;"><div style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:600;margin-bottom:3px;">Email</div><div style="font-size:15px;font-weight:500;">${adminEmail}</div></div><div><div style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:600;margin-bottom:3px;">Temporary password</div><div style="font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:700;color:#059669;letter-spacing:2px;">${tempPassword}</div></div></div><p style="color:#6b7280;font-size:13.5px;margin-bottom:24px;">Please change your password after first login.</p>`
    }

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Mo at Qwezy <mo@qwezy.io>',
        to: adminEmail,
        subject: `Welcome to Qwezy — your ${companyName} workspace is ready`,
        html: `<div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;color:#1a1a1a;"><div style="margin-bottom:32px;"><span style="font-size:24px;font-weight:800;color:#059669;">Qwezy</span></div><h1 style="font-size:24px;font-weight:700;margin-bottom:10px;">Hi ${adminName}, your workspace is ready.</h1><p style="color:#6b7280;font-size:15px;line-height:1.7;margin-bottom:28px;">I've set up your <strong>${companyName}</strong> workspace. Connect your database and you'll be querying your data in plain English within minutes.</p>${credentialsHtml}<a href="${onboardingUrl}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;">Start setup →</a><div style="margin-top:40px;padding-top:24px;border-top:1px solid #e5e7eb;"><p style="color:#6b7280;font-size:13px;margin:0;">Questions? Reply to this email.<br>— Mo, Qwezy</p></div></div>`,
      }),
    })

    return NextResponse.json({
      ok: true,
      company: { id: company.id, name: company.name, plan: company.plan },
      user: { id: userId, email: adminEmail, name: adminName },
      message: `Account created and welcome email sent to ${adminEmail}`,
    })

  } catch (err: any) {
    console.error('Create company error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── PATCH: Update company DB connection string ─────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get('qwezy_session')?.value
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { db_connection_string, tables_config } = await req.json()

    const updates: any = {}
    if (db_connection_string !== undefined) updates.db_connection_string = db_connection_string
    if (tables_config !== undefined) updates.tables_config = tables_config
    updates.updated_at = new Date().toISOString()

    const { error } = await supabaseAdmin
      .from('companies')
      .update(updates)
      .eq('id', profile.company_id)

    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── GET: List all companies (master only) ─────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const masterCookie = req.cookies.get('qwezy_master_session')?.value
    if (!masterCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: companies } = await supabaseAdmin
      .from('companies')
      .select('id, name, plan, created_at, db_connection_string')
      .order('created_at', { ascending: false })

    const { data: users } = await supabaseAdmin
      .from('users')
      .select('company_id, id, name, email, role, status, last_seen')

    const enriched = (companies || []).map(c => ({
      ...c,
      has_db: !!c.db_connection_string,
      db_connection_string: undefined, // never expose to frontend
      users: (users || []).filter(u => u.company_id === c.id),
    }))

    return NextResponse.json({ companies: enriched })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pwd = ''
  for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
  return pwd + '!'
}
