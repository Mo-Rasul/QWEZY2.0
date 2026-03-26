// app/api/annotations/route.ts
// Save onboarding annotations to the database

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'

async function getAuth(req: NextRequest) {
  const token = req.cookies.get('qwezy_session')?.value
  const companyId = req.cookies.get('qwezy_company')?.value
  if (!token || !companyId) return null
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user } } = await supabase.auth.getUser(token)
  return user ? { userId: user.id, companyId } : null
}

// POST — save all annotations from onboarding
export async function POST(req: NextRequest) {
  const auth = await getAuth(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { connectionId, tables, joins } = await req.json()
  // tables: [{name, summary, teams, contact, refresh, isPrimary, rowCount, lastDate, columns: [{name, aliases, note}], metrics: [{name, formula}]}]
  // joins: [{from, fromCol, to, toCol, type, approved, confidence}]

  for (const table of tables) {
    // Upsert annotation
    const { data: ann, error: annErr } = await supabaseAdmin
      .from('table_annotations')
      .upsert({
        connection_id: connectionId, company_id: auth.companyId,
        table_name: table.name, summary: table.summary,
        teams: table.teams, contact: table.contact||'',
        refresh_cadence: table.refresh||'Daily',
        is_primary: table.isPrimary||false,
        row_count: table.rowCount, last_data_date: table.lastDate,
      }, { onConflict: 'connection_id,table_name' })
      .select('id').single()

    if (annErr || !ann) continue

    // Upsert column notes
    for (const col of (table.columns||[])) {
      if (!col.aliases?.length && !col.note) continue
      await supabaseAdmin.from('column_notes').upsert({
        annotation_id: ann.id, company_id: auth.companyId,
        column_name: col.name, aliases: col.aliases||[], note: col.note||'',
      }, { onConflict: 'annotation_id,column_name' })
    }

    // Insert metrics
    if (table.metrics?.length) {
      await supabaseAdmin.from('table_metrics').delete().eq('annotation_id', ann.id)
      await supabaseAdmin.from('table_metrics').insert(
        table.metrics.map((m: any) => ({
          annotation_id: ann.id, company_id: auth.companyId,
          name: m.name, formula: m.formula,
        }))
      )
    }
  }

  // Save approved joins
  if (joins?.length) {
    await supabaseAdmin.from('table_joins').delete().eq('connection_id', connectionId)
    await supabaseAdmin.from('table_joins').insert(
      joins.map((j: any) => ({
        connection_id: connectionId, company_id: auth.companyId,
        from_table: j.from, from_col: j.fromCol,
        to_table: j.to, to_col: j.toCol,
        join_type: j.type, approved: j.approved,
        confidence: j.confidence||null,
      }))
    )
  }

  return NextResponse.json({ ok: true })
}

// GET — load annotations for a connection (for context building + display)
export async function GET(req: NextRequest) {
  const auth = await getAuth(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const connectionId = req.nextUrl.searchParams.get('connectionId')
  if (!connectionId) return NextResponse.json({ error: 'connectionId required' }, { status: 400 })

  const { data: annotations } = await supabaseAdmin
    .from('table_annotations')
    .select('*')
    .eq('company_id', auth.companyId)
    .eq('connection_id', connectionId)

  return NextResponse.json({ annotations: annotations||[] })
}
