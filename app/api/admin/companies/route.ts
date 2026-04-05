// app/api/admin/companies/route.ts
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
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
    })
  } catch {}
}

// GET — list all companies with user counts and DB status
export async function GET(req: NextRequest) {
  if (!isMaster(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: companies } = await supabaseAdmin
    .from('companies')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: users } = await supabaseAdmin
    .from('users')
    .select('company_id, id, name, email, role, status, last_seen, created_at')

  const enriched = (companies || []).map(c => ({
    ...c,
    has_db: !!c.db_connection_string,
    db_connection_string: undefined,
    users: (users || []).filter(u => u.company_id === c.id),
  }))

  return NextResponse.json({ companies: enriched })
}

// POST — create company
export async function POST(req: NextRequest) {
  if (!isMaster(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, plan, notes, mrr } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('companies')
    .insert({ name, plan: plan || 'starter', notes, mrr: mrr || 0, status: 'active' })
    .select('id, name, plan')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await log('company.created', data.id, { name, plan }, req)
  return NextResponse.json({ ok: true, company: data })
}

// PATCH — update company
export async function PATCH(req: NextRequest) {
  if (!isMaster(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  // Never expose connection string back — handle separately
  const safeUpdates: any = {}
  if (updates.name !== undefined) safeUpdates.name = updates.name
  if (updates.plan !== undefined) safeUpdates.plan = updates.plan
  if (updates.notes !== undefined) safeUpdates.notes = updates.notes
  if (updates.mrr !== undefined) safeUpdates.mrr = updates.mrr
  if (updates.status !== undefined) safeUpdates.status = updates.status
  if (updates.db_connection_string !== undefined) safeUpdates.db_connection_string = updates.db_connection_string
  safeUpdates.updated_at = new Date().toISOString()

  const { error } = await supabaseAdmin.from('companies').update(safeUpdates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await log('company.updated', id, safeUpdates, req)
  return NextResponse.json({ ok: true })
}

// DELETE — deactivate company (never hard delete)
export async function DELETE(req: NextRequest) {
  if (!isMaster(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  // Deactivate company
  const { error: compErr } = await supabaseAdmin
    .from('companies').update({ status: 'inactive', updated_at: new Date().toISOString() }).eq('id', id)
  if (compErr) return NextResponse.json({ error: compErr.message }, { status: 500 })

  // Deactivate all users in this company
  await supabaseAdmin.from('users').update({ status: 'inactive' }).eq('company_id', id)

  await log('company.deactivated', id, { reason: 'master_action' }, req)
  return NextResponse.json({ ok: true })
}
