// app/api/reports/route.ts
// CRUD for saved reports

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'
import { runSQL } from '@/lib/db'

async function getAuth(req: NextRequest) {
  const token = req.cookies.get('qwezy_session')?.value
  const companyId = req.cookies.get('qwezy_company')?.value
  if (!token || !companyId) return null
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user } } = await supabase.auth.getUser(token)
  return user ? { userId: user.id, companyId } : null
}

// GET — list all reports for company
export async function GET(req: NextRequest) {
  const auth = await getAuth(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: reports } = await supabaseAdmin
    .from('reports')
    .select('id,name,description,sql_query,group_name,schedule,refresh_hours,shared,last_run,created_at,created_by')
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false })

  // Load latest cached results for each report
  const ids = (reports||[]).map(r=>r.id)
  let resultMap: Record<string,any> = {}
  if (ids.length > 0) {
    const { data: results } = await supabaseAdmin
      .from('report_results')
      .select('report_id,rows_data,fields,ran_at')
      .in('report_id', ids)
      .order('ran_at', { ascending: false })
    ;(results||[]).forEach(r => { if (!resultMap[r.report_id]) resultMap[r.report_id] = r })
  }

  return NextResponse.json({
    reports: (reports||[]).map(r => ({
      ...r,
      cachedResult: resultMap[r.id] || null
    }))
  })
}

// POST — create report
export async function POST(req: NextRequest) {
  const auth = await getAuth(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabaseAdmin
    .from('reports')
    .insert({
      company_id: auth.companyId,
      created_by: auth.userId,
      name: body.name, description: body.description||'',
      sql_query: body.sql, group_name: body.group||'General',
      schedule: body.schedule||'manual',
      refresh_hours: body.refreshHours||0,
      shared: body.shared ?? true,
    })
    .select('id,name')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ report: data })
}

// PATCH — run report and cache result
export async function PATCH(req: NextRequest) {
  const auth = await getAuth(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reportId, sql } = await req.json()

  try {
    const result = await runSQL(sql)
    const rows = result.rows.slice(0, 500)

    // Cache result
    await supabaseAdmin.from('report_results').insert({
      report_id: reportId,
      company_id: auth.companyId,
      rows_data: rows,
      fields: result.fields,
      ran_at: new Date().toISOString(),
    })

    // Update last_run on report
    await supabaseAdmin.from('reports')
      .update({ last_run: new Date().toISOString() })
      .eq('id', reportId)

    return NextResponse.json({ rows, fields: result.fields, duration_ms: result.duration_ms, ran_at: new Date().toISOString() })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE — remove report
export async function DELETE(req: NextRequest) {
  const auth = await getAuth(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reportId } = await req.json()
  await supabaseAdmin.from('reports').delete().eq('id', reportId).eq('company_id', auth.companyId)
  return NextResponse.json({ ok: true })
}
