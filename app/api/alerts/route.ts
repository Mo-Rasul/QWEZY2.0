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

function parsePromptMeta(raw:any){
  if (!raw) return { prompt:'', visibleColumns:[], detailSql:null, severity:'warning' }
  if (typeof raw !== 'string') return { prompt:'', visibleColumns:[], detailSql:null, severity:'warning' }
  try {
    const parsed = JSON.parse(raw)
    if (parsed && parsed.__qwezyAlertMeta) {
      return {
        prompt: parsed.text || '',
        visibleColumns: Array.isArray(parsed.visibleColumns) ? parsed.visibleColumns : [],
        detailSql: parsed.detailSql || null,
        severity: parsed.severity || 'warning',
      }
    }
  } catch {}
  return { prompt: raw, visibleColumns:[], detailSql:null, severity:'warning' }
}

function encodePromptMeta(meta:{prompt?:string, visibleColumns?:string[], detailSql?:string|null, severity?:string}){
  return JSON.stringify({ __qwezyAlertMeta:true, text:meta.prompt || '', visibleColumns: meta.visibleColumns || [], detailSql: meta.detailSql || null, severity: meta.severity || 'warning' })
}

const normalizeAlert = (a:any, latestRun?:any) => {
  const meta = parsePromptMeta(a.prompt)
  return {
    id: a.id,
    name: a.name,
    description: a.description || '',
    sql: a.sql_query || '',
    sourceType: a.source_type || 'sql',
    prompt: meta.prompt,
    detailSql: meta.detailSql,
    visibleColumns: meta.visibleColumns,
    severity: meta.severity,
    conditionType: a.condition_type || 'rows_gt_zero',
    conditionField: a.condition_field || '',
    threshold: a.threshold,
    schedule: a.schedule || 'daily',
    refreshHours: a.refresh_hours ?? 24,
    shared: !!a.shared,
    isActive: a.is_active !== false,
    lastCheckedAt: a.last_checked_at || null,
    lastTriggeredAt: a.last_triggered_at || null,
    latestRun: latestRun ? {
      id: latestRun.id,
      ran_at: latestRun.ran_at,
      status: latestRun.status,
      triggered: !!latestRun.triggered,
      result_count: latestRun.result_count ?? 0,
      condition_value: latestRun.condition_value,
      message: latestRun.message || null,
      rows_data: latestRun.rows_data || [],
      fields: latestRun.fields || [],
    } : null,
  }
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('alerts')
    .select('*')
    .eq('company_id', user.company_id)
    .or(`user_id.eq.${user.id},shared.eq.true`)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (data || []).map((a:any) => a.id)
  let latestByAlert: Record<string, any> = {}
  if (ids.length) {
    const { data: runs } = await supabaseAdmin
      .from('alert_runs')
      .select('*')
      .in('alert_id', ids)
      .eq('company_id', user.company_id)
      .order('ran_at', { ascending: false })
    for (const r of runs || []) {
      if (!latestByAlert[r.alert_id]) latestByAlert[r.alert_id] = r
    }
  }

  return NextResponse.json({ alerts: (data || []).map((a:any) => normalizeAlert(a, latestByAlert[a.id])) })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json()
  const { name, description, prompt, sourceType, sql, detailSql, visibleColumns, severity, conditionType, conditionField, threshold, schedule, refreshHours, shared, isActive } = body
  if (!name || !sql) return NextResponse.json({ error: 'Name and SQL required' }, { status: 400 })

  const payload = {
    company_id: user.company_id,
    user_id: user.id,
    created_by: user.id,
    name,
    description: description || '',
    source_type: sourceType || 'sql',
    prompt: encodePromptMeta({ prompt, visibleColumns, detailSql, severity }),
    sql_query: sql,
    condition_type: conditionType || 'rows_gt_zero',
    condition_field: conditionField || null,
    threshold: threshold ?? null,
    schedule: schedule || 'daily',
    refresh_hours: refreshHours ?? 24,
    shared: !!shared,
    is_active: isActive !== false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabaseAdmin.from('alerts').insert(payload).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, alert: normalizeAlert(data) })
}

export async function PATCH(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json()
  const { id, run, ...updates } = body
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const { data: alert } = await supabaseAdmin.from('alerts').select('*').eq('id', id).single()
  if (!alert || alert.company_id !== user.company_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (alert.user_id !== user.id && user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const safe:any = { updated_at: new Date().toISOString() }
  const currentMeta = parsePromptMeta(alert.prompt)
  const nextMeta = {
    prompt: updates.prompt !== undefined ? updates.prompt : currentMeta.prompt,
    visibleColumns: updates.visibleColumns !== undefined ? updates.visibleColumns : currentMeta.visibleColumns,
    detailSql: updates.detailSql !== undefined ? updates.detailSql : currentMeta.detailSql,
    severity: updates.severity !== undefined ? updates.severity : currentMeta.severity,
  }
  safe.prompt = encodePromptMeta(nextMeta)

  if (updates.name !== undefined) safe.name = updates.name
  if (updates.description !== undefined) safe.description = updates.description
  if (updates.sql !== undefined) safe.sql_query = updates.sql
  if (updates.sourceType !== undefined) safe.source_type = updates.sourceType
  if (updates.conditionType !== undefined) safe.condition_type = updates.conditionType
  if (updates.conditionField !== undefined) safe.condition_field = updates.conditionField || null
  if (updates.threshold !== undefined) safe.threshold = updates.threshold
  if (updates.schedule !== undefined) safe.schedule = updates.schedule
  if (updates.refreshHours !== undefined) safe.refresh_hours = updates.refreshHours
  if (updates.shared !== undefined) safe.shared = updates.shared
  if (updates.isActive !== undefined) safe.is_active = updates.isActive
  if (updates.lastCheckedAt !== undefined) safe.last_checked_at = updates.lastCheckedAt
  if (updates.lastTriggeredAt !== undefined) safe.last_triggered_at = updates.lastTriggeredAt

  const { error } = await supabaseAdmin.from('alerts').update(safe).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (run) {
    const runPayload = {
      alert_id: id,
      company_id: user.company_id,
      ran_at: new Date().toISOString(),
      status: run.status || 'ok',
      triggered: !!run.triggered,
      result_count: run.result_count ?? 0,
      condition_value: run.condition_value ?? null,
      message: run.message || null,
      rows_data: run.rows_data || [],
      fields: run.fields || [],
    }
    const { error: runError } = await supabaseAdmin.from('alert_runs').insert(runPayload)
    if (runError) return NextResponse.json({ error: runError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const { data: alert } = await supabaseAdmin.from('alerts').select('user_id,company_id').eq('id', id).single()
  if (!alert || alert.company_id !== user.company_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (alert.user_id !== user.id && user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await supabaseAdmin.from('alert_runs').delete().eq('alert_id', id).eq('company_id', user.company_id)
  const { error } = await supabaseAdmin.from('alerts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
