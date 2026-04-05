// app/api/admin/audit/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-app'

function isMaster(req: NextRequest) {
  return !!req.cookies.get('qwezy_master_session')?.value
}

export async function GET(req: NextRequest) {
  if (!isMaster(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const company_id = searchParams.get('company_id')
  const action = searchParams.get('action')
  const limit = parseInt(searchParams.get('limit') || '100')
  const offset = parseInt(searchParams.get('offset') || '0')

  let query = supabaseAdmin
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
    .range(offset, offset + limit - 1)

  if (company_id) query = query.eq('target_company', company_id)
  if (action) query = query.ilike('action', `%${action}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs: data || [] })
}

// POST — write a log entry (called from dashboard for user actions)
export async function POST(req: NextRequest) {
  // Allow from authenticated session OR master
  const token = req.cookies.get('qwezy_session')?.value
  const masterCookie = req.cookies.get('qwezy_master_session')?.value
  if (!token && !masterCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { actor, action, target_company, details } = await req.json()

  const { error } = await supabaseAdmin.from('audit_log').insert({
    actor,
    action,
    target_company: target_company || null,
    details: details || {},
    ip_address: req.headers.get('x-forwarded-for') || 'unknown',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
