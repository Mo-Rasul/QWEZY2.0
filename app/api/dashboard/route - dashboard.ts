// app/api/dashboard/route.ts
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
  return profile ? { ...profile } : null
}

// Check if string is a valid UUID
const isUUID = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

// GET — load dashboard from dashboard_pages + dashboard_views
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user?.company_id) return NextResponse.json({ customViews: [], pages: [] })

  const { data: views, error: viewsError } = await supabaseAdmin
    .from('dashboard_views')
    .select('*')
    .eq('company_id', user.company_id)
    .order('order_index', { ascending: true })

  if (viewsError) console.error('Dashboard GET views error:', viewsError.message)

  const mapView = (v: any) => {
    const layout = (v.layout && typeof v.layout === 'object') ? v.layout : {}
    return {
      id: v.id,
      name: v.name,
      sql: v.sql_query || '',
      viz: v.viz_type || 'bar',
      w: 480,
      h: 280,
      gw: layout.gw ?? (Number(v.card_width) || undefined),
      gh: layout.gh ?? (Number(v.card_height) || undefined),
      gx: layout.gx ?? undefined,
      gy: layout.gy ?? undefined,
      shared: v.shared ?? true,
      order: v.order_index || 0,
      rows: Array.isArray(v.rows_cache) ? v.rows_cache : [],
      fields: Array.isArray(v.fields_cache) ? v.fields_cache : [],
      builder: layout.builder || undefined,
    }
  }

  const { data: pages } = await supabaseAdmin
    .from('dashboard_pages')
    .select('*')
    .eq('company_id', user.company_id)
    .order('order_index', { ascending: true })

  if (!pages || pages.length === 0) {
    return NextResponse.json({ customViews: (views || []).map(mapView), pages: [{ id: 'overview', name: 'Overview', shared: true, views: [] }] })
  }

  const overviewPage = pages.find((p: any) => p.name === 'Overview')
  const overviewViews = overviewPage
    ? views.filter((v: any) => v.page_id === overviewPage.id).map(mapView)
    : views.map(mapView)

  const otherPages = pages
    .filter((pg: any) => pg.name !== 'Overview')
    .map((pg: any) => ({
      id: pg.id,
      name: pg.name,
      shared: pg.shared ?? true,
      createdBy: pg.created_by,
      views: views.filter((v: any) => v.page_id === pg.id).map(mapView),
    }))

  return NextResponse.json({
    customViews: overviewViews,
    pages: [{ id: 'overview', name: 'Overview', shared: true, views: [] }, ...otherPages],
  })
}

// POST — save dashboard (admin/analyst only)
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user?.company_id) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (user.role === 'viewer') return NextResponse.json({ error: 'Viewers cannot edit dashboards' }, { status: 403 })

  const { customViews = [], pages = [] } = await req.json()

  // Get or create Overview page
  const { data: overviewPage } = await supabaseAdmin
    .from('dashboard_pages')
    .select('id')
    .eq('company_id', user.company_id)
    .eq('name', 'Overview')
    .single()

  let overviewPageId = overviewPage?.id
  if (!overviewPageId) {
    const { data: newPage, error: pgErr } = await supabaseAdmin
      .from('dashboard_pages')
      .insert({ company_id: user.company_id, created_by: user.id, name: 'Overview', order_index: 0, created_at: new Date().toISOString() })
      .select('id').single()
    if (pgErr) return NextResponse.json({ error: pgErr.message }, { status: 500 })
    overviewPageId = newPage?.id
  }

  // Delete all existing views for this company
  await supabaseAdmin.from('dashboard_views').delete().eq('company_id', user.company_id)

  const allViews: any[] = []

  const buildView = (v: any, pageId: string, i: number) => ({
    // Only use id if it's a real UUID, otherwise let Supabase generate one
    id: isUUID(v.id) ? v.id : crypto.randomUUID(),
    page_id: pageId,
    company_id: user.company_id,
    name: v.name || 'Untitled',
    sql_query: v.sql || '',
    viz_type: v.viz || 'bar',
    card_width: v.gw ? Number(v.gw) : (Number(v.w) || 480),
    card_height: v.gh ? Number(v.gh) : (Number(v.h) || 280),
    shared: v.shared ?? true,
    layout: { gx: v.gx ?? null, gy: v.gy ?? null, gw: v.gw ?? null, gh: v.gh ?? null, builder: v.builder ?? null },
    order_index: i,
    // rows_cache is jsonb — store as JSON
    rows_cache: Array.isArray(v.rows) && v.rows.length > 0 ? v.rows : null,
    // fields_cache is ARRAY type in Supabase — must be a proper array
    fields_cache: Array.isArray(v.fields) && v.fields.length > 0 ? v.fields : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  customViews.forEach((v: any, i: number) => {
    allViews.push(buildView(v, overviewPageId, i))
  })

  // Handle custom pages — track which page IDs we keep
  const keptPageIds: string[] = [overviewPageId]

  for (const pg of pages) {
    if (pg.id === 'overview') continue

    // Find existing page or create new one
    let pageId: string | null = null
    if (isUUID(pg.id)) {
      const { data: existing } = await supabaseAdmin
        .from('dashboard_pages').select('id').eq('id', pg.id).single()
      if (existing) pageId = existing.id
    }

    if (!pageId) {
      const { data: newPg } = await supabaseAdmin
        .from('dashboard_pages')
        .insert({ company_id: user.company_id, created_by: user.id, name: pg.name, shared: pg.shared ?? false, order_index: pages.indexOf(pg), created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .select('id').single()
      pageId = newPg?.id
    } else {
      await supabaseAdmin.from('dashboard_pages')
        .update({ name: pg.name, shared: pg.shared ?? false, order_index: pages.indexOf(pg), updated_at: new Date().toISOString() })
        .eq('id', pageId)
    }

    if (!pageId) continue
    keptPageIds.push(pageId)
    pg.views?.forEach((v: any, i: number) => allViews.push(buildView(v, pageId!, i)))
  }

  // Delete pages that were removed by the user
  if (keptPageIds.length > 0) {
    const notIn = `(${keptPageIds.map((id: string) => `"${id}"`).join(',')})`
    const { error: deletePagesError } = await supabaseAdmin.from('dashboard_pages')
      .delete()
      .eq('company_id', user.company_id)
      .not('id', 'in', notIn)
    if (deletePagesError) {
      console.error('Dashboard POST delete pages error:', deletePagesError.message)
      return NextResponse.json({ error: deletePagesError.message }, { status: 500 })
    }
  }

  if (allViews.length > 0) {
    const { error } = await supabaseAdmin.from('dashboard_views').insert(allViews)
    if (error) {
      console.error('Dashboard POST insert error:', error.message, allViews[0])
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
