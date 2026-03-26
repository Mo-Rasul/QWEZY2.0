// app/api/dashboards/route.ts
// CRUD for dashboard pages and views

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

// GET — all pages + views for company
export async function GET(req: NextRequest) {
  const auth = await getAuth(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: pages } = await supabaseAdmin
    .from('dashboard_pages')
    .select('id,name,order_index')
    .eq('company_id', auth.companyId)
    .order('order_index')

  if (!pages || pages.length === 0) return NextResponse.json({ pages: [] })

  const pageIds = pages.map(p => p.id)
  const { data: views } = await supabaseAdmin
    .from('dashboard_views')
    .select('id,page_id,name,sql_query,viz_type,card_width,card_height,shared,rows_cache,fields_cache,cached_at,order_index')
    .in('page_id', pageIds)
    .order('order_index')

  const viewsByPage: Record<string,any[]> = {}
  ;(views||[]).forEach(v => {
    if (!viewsByPage[v.page_id]) viewsByPage[v.page_id] = []
    viewsByPage[v.page_id].push(v)
  })

  return NextResponse.json({
    pages: pages.map(p => ({ ...p, views: viewsByPage[p.id]||[] }))
  })
}

// POST — create page or view
export async function POST(req: NextRequest) {
  const auth = await getAuth(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (body.type === 'page') {
    const { data: existing } = await supabaseAdmin.from('dashboard_pages').select('id').eq('company_id', auth.companyId)
    const { data, error } = await supabaseAdmin.from('dashboard_pages').insert({
      company_id: auth.companyId, created_by: auth.userId,
      name: body.name||'New page', order_index: existing?.length||0
    }).select('id,name,order_index').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ page: data })
  }

  if (body.type === 'view') {
    // Run query and cache results immediately
    let rowsCache = null, fieldsCache = null, cachedAt = null
    try {
      const result = await runSQL(body.sql)
      rowsCache = result.rows.slice(0,500)
      fieldsCache = result.fields
      cachedAt = new Date().toISOString()
    } catch {}

    const { data: existing } = await supabaseAdmin.from('dashboard_views').select('id').eq('page_id', body.pageId)
    const { data, error } = await supabaseAdmin.from('dashboard_views').insert({
      page_id: body.pageId, company_id: auth.companyId,
      name: body.name, sql_query: body.sql, viz_type: body.vizType||'auto',
      card_width: body.w||380, card_height: body.h||250,
      shared: body.shared||false,
      rows_cache: rowsCache, fields_cache: fieldsCache, cached_at: cachedAt,
      order_index: existing?.length||0
    }).select('id,name').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ view: { ...data, rows_cache: rowsCache, fields_cache: fieldsCache } })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}

// PATCH — update view size/type/name or refresh cache
export async function PATCH(req: NextRequest) {
  const auth = await getAuth(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (body.type === 'refresh_view') {
    const result = await runSQL(body.sql)
    await supabaseAdmin.from('dashboard_views').update({
      rows_cache: result.rows.slice(0,500), fields_cache: result.fields, cached_at: new Date().toISOString()
    }).eq('id', body.viewId).eq('company_id', auth.companyId)
    return NextResponse.json({ rows: result.rows.slice(0,500), fields: result.fields })
  }

  if (body.type === 'update_view') {
    await supabaseAdmin.from('dashboard_views').update({
      viz_type: body.vizType, card_width: body.w, card_height: body.h,
      name: body.name, shared: body.shared,
    }).eq('id', body.viewId).eq('company_id', auth.companyId)
    return NextResponse.json({ ok: true })
  }

  if (body.type === 'rename_page') {
    await supabaseAdmin.from('dashboard_pages').update({ name: body.name }).eq('id', body.pageId).eq('company_id', auth.companyId)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}

// DELETE — remove page or view
export async function DELETE(req: NextRequest) {
  const auth = await getAuth(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, id } = await req.json()
  if (type === 'page') await supabaseAdmin.from('dashboard_pages').delete().eq('id', id).eq('company_id', auth.companyId)
  if (type === 'view') await supabaseAdmin.from('dashboard_views').delete().eq('id', id).eq('company_id', auth.companyId)
  return NextResponse.json({ ok: true })
}
