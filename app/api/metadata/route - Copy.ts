import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'

async function getUser(req: NextRequest) {
  const token = req.cookies.get('qwezy_session')?.value
  if (!token) return null
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return null
  const { data: profile } = await supabaseAdmin.from('users').select('id, company_id, role').eq('id', user.id).single()
  return profile || null
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user?.company_id) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const url = new URL(req.url)
  const table = url.searchParams.get('table')
  const schema = url.searchParams.get('schema') || 'public'
  if (!table) return NextResponse.json({ error: 'Table is required' }, { status: 400 })

  const [{ data: tableMeta }, { data: columnRows }] = await Promise.all([
    supabaseAdmin.from('table_annotations').select('*').eq('company_id', user.company_id).eq('table_schema', schema).eq('table_name', table).maybeSingle(),
    supabaseAdmin.from('column_notes').select('*').eq('company_id', user.company_id).eq('table_schema', schema).eq('table_name', table),
  ])

  const columnMeta: Record<string, any> = {}
  for (const row of columnRows || []) {
    columnMeta[row.column_name] = {
      description: row.description || '',
      ai_notes: row.ai_notes || '',
      preferred_label: row.preferred_label || '',
      display_format: row.display_format || '',
      synonyms: row.synonyms || [],
    }
  }

  return NextResponse.json({
    tableMeta: tableMeta ? {
      definition: tableMeta.definition || '',
      ai_notes: tableMeta.ai_notes || '',
      owner: tableMeta.owner || '',
      point_of_contact: tableMeta.point_of_contact || '',
      teams: tableMeta.teams || [],
      default_date_format: tableMeta.default_date_format || 'MM/DD/YYYY',
      last_updated_label: tableMeta.last_updated_label || '',
      preferred_metric_logic: tableMeta.preferred_metric_logic || '',
    } : null,
    columnMeta,
    canEdit: String(user.role || '').toLowerCase() === 'admin',
  })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user?.company_id) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (String(user.role || '').toLowerCase() !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const table = body.table
  const schema = body.schema || 'public'
  const tableMeta = body.tableMeta || {}
  const columnMeta = body.columnMeta || {}
  if (!table) return NextResponse.json({ error: 'Table is required' }, { status: 400 })

  const tablePayload = {
    company_id: user.company_id,
    table_schema: schema,
    table_name: table,
    definition: tableMeta.definition || '',
    ai_notes: tableMeta.ai_notes || '',
    owner: tableMeta.owner || '',
    point_of_contact: tableMeta.point_of_contact || '',
    teams: Array.isArray(tableMeta.teams) ? tableMeta.teams : [],
    default_date_format: tableMeta.default_date_format || 'MM/DD/YYYY',
    last_updated_label: tableMeta.last_updated_label || '',
    preferred_metric_logic: tableMeta.preferred_metric_logic || '',
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  }

  const { error: tableError } = await supabaseAdmin.from('table_annotations').upsert(tablePayload, { onConflict: 'company_id,table_schema,table_name' })
  if (tableError) return NextResponse.json({ error: tableError.message }, { status: 500 })

  const rows = Object.entries(columnMeta as Record<string, any>).map(([columnName, meta]) => ({
    company_id: user.company_id,
    table_schema: schema,
    table_name: table,
    column_name: columnName,
    description: (meta as any)?.description || '',
    ai_notes: (meta as any)?.ai_notes || '',
    preferred_label: (meta as any)?.preferred_label || '',
    display_format: (meta as any)?.display_format || '',
    synonyms: Array.isArray((meta as any)?.synonyms) ? (meta as any).synonyms : [],
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  }))

  if (rows.length) {
    const { error: columnError } = await supabaseAdmin.from('column_notes').upsert(rows, { onConflict: 'company_id,table_schema,table_name,column_name' })
    if (columnError) return NextResponse.json({ error: columnError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
