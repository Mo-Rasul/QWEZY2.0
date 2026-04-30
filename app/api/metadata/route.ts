import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'

async function getUser(req: NextRequest) {
  const token = req.cookies.get('qwezy_session')?.value
  if (!token) return null
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return null
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id, company_id, role')
    .eq('id', user.id)
    .single()
  return profile || null
}

function normalizeTableMeta(meta: any) {
  return {
    summary: meta?.description || '',
    owner: meta?.owner || '',
    point_of_contact: meta?.point_of_contact || '',
    teams: Array.isArray(meta?.teams) ? meta.teams : [],
    preferred_metric_logic: meta?.preferred_metric_logic || '',
    ai_notes: meta?.ai_notes || '',
    rules: Array.isArray(meta?.rules) ? meta.rules : [],
  }
}

function parseSpecialRow(row: any) {
  const extra = row?.extra_json && typeof row.extra_json === 'object' ? row.extra_json : {}
  return normalizeTableMeta({
    description: row?.description || extra?.summary || '',
    owner: extra?.owner || '',
    point_of_contact: extra?.point_of_contact || '',
    teams: extra?.teams || [],
    preferred_metric_logic: extra?.preferred_metric_logic || '',
    ai_notes: row?.ai_notes || extra?.ai_notes || '',
    rules: extra?.rules || [],
  })
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user?.company_id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const url = new URL(req.url)
  const table = url.searchParams.get('table')
  const schema = url.searchParams.get('schema') || 'public'
  if (!table) {
    return NextResponse.json({ error: 'Table is required' }, { status: 400 })
  }

  const { data: columnRows, error } = await supabaseAdmin
    .from('column_notes')
    .select('*')
    .eq('company_id', user.company_id)
    .eq('table_schema', schema)
    .eq('table_name', table)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const columnMeta: Record<string, any> = {}
  let tableMeta = normalizeTableMeta(null)

  for (const row of columnRows || []) {
    if (row.column_name === '__table__') {
      tableMeta = parseSpecialRow(row)
      continue
    }
    columnMeta[row.column_name] = {
      description: row.description || '',
      ai_notes: '',
      preferred_label: row.preferred_label || '',
      display_format: row.display_format || '',
      synonyms: Array.isArray(row.synonyms) ? row.synonyms : [],
    }
  }

  return NextResponse.json({
    tableMeta,
    columnMeta,
    canEdit: ['admin','owner','superadmin',''].includes(String(user.role || '').toLowerCase()),
  })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user?.company_id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  if (!['admin','owner','superadmin',''].includes(String(user.role || '').toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const table = body.table
  const schema = body.schema || 'public'
  const tableMeta = body.tableMeta || {}
  const columnMeta = body.columnMeta || {}
  if (!table) {
    return NextResponse.json({ error: 'Table is required' }, { status: 400 })
  }

  const now = new Date().toISOString()


  const tableRow = {
  company_id: user.company_id,
  table_schema: schema,
  table_name: table,
  column_name: '__table__',
  description: tableMeta.summary || tableMeta.definition || '',
  preferred_label: '',
  display_format: '',
  synonyms: [],
  updated_at: now,
  updated_by: user.id,
  extra_json: {
    summary: tableMeta.summary || tableMeta.definition || '',
    owner: tableMeta.owner || '',
    point_of_contact: tableMeta.point_of_contact || '',
    teams: Array.isArray(tableMeta.teams)
      ? tableMeta.teams
      : String(tableMeta.teams || '').split(',').map((s: string) => s.trim()).filter(Boolean),
    preferred_metric_logic: tableMeta.preferred_metric_logic || '',
    ai_notes: tableMeta.ai_notes || '',
    rules: Array.isArray(tableMeta.rules) ? tableMeta.rules : [],
  },
}

  const columnRows = Object.entries(columnMeta as Record<string, any>).map(([columnName, meta]) => ({
    company_id: user.company_id,
    table_schema: schema,
    table_name: table,
    column_name: columnName,
    description: (meta as any)?.description || '',
    ai_notes: (meta as any)?.ai_notes || '',
    preferred_label: (meta as any)?.preferred_label || '',
    display_format: (meta as any)?.display_format || '',
    synonyms: Array.isArray((meta as any)?.synonyms) ? (meta as any).synonyms : [],
    updated_at: now,
    updated_by: user.id,
  }))

  const { error: upsertError } = await supabaseAdmin
    .from('column_notes')
    .upsert([tableRow, ...columnRows], {
      onConflict: 'company_id,table_schema,table_name,column_name',
    })

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
