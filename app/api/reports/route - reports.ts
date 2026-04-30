// app/api/reports/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'

async function getUser(req: NextRequest) {
  const token = req.cookies.get('qwezy_session')?.value
  if (!token) return null
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return null
  const { data: profile } = await supabaseAdmin.from('users').select('id,company_id,role').eq('id', user.id).single()
  return profile ? { ...profile, authId: user.id } : null
}

const normalizeReport = (r:any) => ({
  ...r,
  sql: r.sql || r.sql_query || '',
  sql_query: r.sql_query || r.sql || '',
  group: r.group || r.group_name || 'General',
  refreshHours: r.refreshHours ?? r.refresh_hours ?? 168,
  lastRun: r.lastRun || r.last_run || null,
  rows: r.rows ?? r.row_count ?? 0,
})

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data, error } = await supabaseAdmin
    .from('reports').select('*').eq('company_id', user.company_id)
    .or(`user_id.eq.${user.id},shared.eq.true`)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const reportIds = (data || []).map((r:any) => r.id)
  let latestResults:Record<string, any> = {}
  if (reportIds.length) {
    const { data: rr } = await supabaseAdmin
      .from('report_results')
      .select('*')
      .in('report_id', reportIds)
      .eq('company_id', user.company_id)
      .order('ran_at', { ascending: false })
    for (const row of rr || []) {
      if (!latestResults[row.report_id]) latestResults[row.report_id] = { rows: row.rows_data || [], fields: row.fields || [], ran_at: row.ran_at }
    }
  }
  return NextResponse.json({ reports: (data || []).map(normalizeReport), latestResults })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { name, description, sql, schedule, refreshHours, shared, group } = await req.json()
  if (!name || !sql) return NextResponse.json({ error: 'Name and SQL required' }, { status: 400 })
  const payload = {
    name,
    description: description || '',
    sql_query: sql,
    sql,
    schedule: schedule || 'weekly',
    refresh_hours: refreshHours || 168,
    shared: shared ?? false,
    group_name: group || 'General',
    user_id: user.id,
    created_by: user.id,
    company_id: user.company_id,
    row_count: 0,
  }
  const { data, error } = await supabaseAdmin.from('reports').insert(payload).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}

export async function PATCH(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const { data: report } = await supabaseAdmin.from('reports').select('user_id,company_id,name').eq('id', id).single()
  if (!report || report.company_id !== user.company_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (report.user_id !== user.id && user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const safe:any = {}
  if (updates.name !== undefined) safe.name = updates.name
  if (updates.description !== undefined) safe.description = updates.description
  if (updates.sql !== undefined) { safe.sql = updates.sql; safe.sql_query = updates.sql }
  if (updates.schedule !== undefined) safe.schedule = updates.schedule
  if (updates.refreshHours !== undefined) safe.refresh_hours = updates.refreshHours
  if (updates.refresh_hours !== undefined) safe.refresh_hours = updates.refresh_hours
  if (updates.shared !== undefined) safe.shared = updates.shared
  if (updates.group !== undefined) safe.group_name = updates.group
  if (updates.group_name !== undefined) safe.group_name = updates.group_name
  if (updates.lastRun !== undefined) safe.last_run = updates.lastRun
  if (updates.last_run !== undefined) safe.last_run = updates.last_run
  if (updates.rows !== undefined) safe.row_count = updates.rows
  if (updates.row_count !== undefined) safe.row_count = updates.row_count

  if (Object.keys(safe).length) {
    const { error } = await supabaseAdmin.from('reports').update(safe).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (updates.rows_data || updates.fields) {
    const payload = {
      report_id: id,
      company_id: user.company_id,
      rows_data: updates.rows_data || [],
      fields: updates.fields || [],
      ran_at: new Date().toISOString(),
    }
    const { data: existing } = await supabaseAdmin.from('report_results').select('id').eq('report_id', id).eq('company_id', user.company_id).maybeSingle()
    if (existing?.id) {
      const { error } = await supabaseAdmin.from('report_results').update(payload).eq('id', existing.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabaseAdmin.from('report_results').insert(payload)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const { data: report } = await supabaseAdmin.from('reports').select('user_id,company_id,name').eq('id', id).single()
  if (!report || report.company_id !== user.company_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (report.user_id !== user.id && user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await supabaseAdmin.from('report_results').delete().eq('report_id', id).eq('company_id', user.company_id)
  const { error } = await supabaseAdmin.from('reports').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
