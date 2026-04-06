// app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-app'

function isMaster(req: NextRequest) {
  return !!req.cookies.get('qwezy_master_session')?.value
}

async function log(action: string, target_company: string | null, details: any, req: NextRequest) {
  try {
    await supabaseAdmin.from('audit_log').insert({
      actor: 'master',
      action,
      target_company,
      details,
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
    })
  } catch {}
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pwd = ''
  for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
  return pwd + '!'
}

// GET — list users, optionally filter by company
export async function GET(req: NextRequest) {
  if (!isMaster(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('company_id')

  let query = supabaseAdmin.from('users').select('*').order('created_at', { ascending: false })
  if (companyId) query = query.eq('company_id', companyId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data || [] })
}

// POST — create user and optionally send invite email
export async function POST(req: NextRequest) {
  if (!isMaster(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { email, name, role, company_id, send_invite } = await req.json()
  if (!email || !name || !company_id) {
    return NextResponse.json({ error: 'Email, name and company_id required' }, { status: 400 })
  }

  const { data: company } = await supabaseAdmin.from('companies').select('name').eq('id', company_id).single()

  // Check if auth user already exists
  const { data: { users: existing } } = await supabaseAdmin.auth.admin.listUsers()
  const existingUser = existing?.find((u: any) => u.email === email)

  let userId: string
  let tempPassword = ''
  let isExisting = false

  if (existingUser) {
    userId = existingUser.id
    isExisting = true
    const { data: existingProfile } = await supabaseAdmin.from('users').select('id').eq('id', userId).single()
    if (existingProfile) {
      await supabaseAdmin.from('users').update({ company_id, name, role: role || 'viewer', status: 'active' }).eq('id', userId)
    } else {
      await supabaseAdmin.from('users').insert({ id: userId, company_id, email, name, role: role || 'viewer', status: 'active' })
    }
  } else {
    tempPassword = generateTempPassword()
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email, password: tempPassword, email_confirm: true,
    })
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 })
    userId = authUser.user.id
    await supabaseAdmin.from('users').insert({ id: userId, company_id, email, name, role: role || 'viewer', status: 'active' })
  }

  if (send_invite) {
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/onboarding`
    let credHtml = ''
    if (isExisting) {
      const { data: resetData } = await supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email })
      const resetUrl = resetData?.properties?.action_link || `${process.env.NEXT_PUBLIC_APP_URL}/login`
      credHtml = `<p style="font-size:14px;color:#374151;margin-bottom:14px;">You already have a Qwezy account. You've been added to <strong>${company?.name}</strong>.</p><a href="${resetUrl}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:10px 22px;border-radius:7px;font-weight:600;font-size:13.5px;">Log in →</a>`
    } else {
      credHtml = `<div style="background:#f8fafd;border:1px solid #e5e7eb;border-radius:8px;padding:18px;margin-bottom:16px;"><div style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:600;margin-bottom:3px;">Email</div><div style="font-size:15px;font-weight:500;margin-bottom:12px;">${email}</div><div style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:600;margin-bottom:3px;">Temporary password</div><div style="font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:700;color:#059669;letter-spacing:2px;">${tempPassword}</div></div>`
    }
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Mo at Qwezy <mo@qwezy.io>',
        to: email,
        subject: `You've been added to ${company?.name} on Qwezy`,
        html: `<div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto;padding:40px 24px;"><div style="margin-bottom:28px;"><span style="font-size:22px;font-weight:800;color:#059669;">Qwezy</span></div><h1 style="font-size:22px;font-weight:700;margin-bottom:10px;">Hi ${name}, you're in.</h1><p style="color:#6b7280;font-size:15px;line-height:1.7;margin-bottom:24px;">You've been added as a <strong>${role || 'viewer'}</strong> on <strong>${company?.name}</strong>'s Qwezy workspace.</p>${credHtml}<div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;"><p style="color:#9ca3af;font-size:13px;margin:0;">Questions? Reply to this email.<br>— Mo, Qwezy</p></div></div>`,
      }),
    })
  }

  await log('user.created', company_id, { email, name, role, send_invite }, req)
  return NextResponse.json({ ok: true, userId })
}

// PATCH — update user (role, status, name, company)
export async function PATCH(req: NextRequest) {
  if (!isMaster(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, company_id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const safeUpdates: any = {}
  if (updates.name !== undefined) safeUpdates.name = updates.name
  if (updates.role !== undefined) safeUpdates.role = updates.role
  if (updates.status !== undefined) safeUpdates.status = updates.status
  if (company_id !== undefined) safeUpdates.company_id = company_id

  const { error } = await supabaseAdmin.from('users').update(safeUpdates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: user } = await supabaseAdmin.from('users').select('company_id').eq('id', id).single()
  await log('user.updated', user?.company_id || null, { id, ...safeUpdates }, req)
  return NextResponse.json({ ok: true })
}

// DELETE — deactivate user
export async function DELETE(req: NextRequest) {
  if (!isMaster(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const { data: user } = await supabaseAdmin.from('users').select('company_id, email').eq('id', id).single()
  const { error } = await supabaseAdmin.from('users').update({ status: 'inactive' }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await log('user.deactivated', user?.company_id || null, { id, email: user?.email }, req)
  return NextResponse.json({ ok: true })
}
