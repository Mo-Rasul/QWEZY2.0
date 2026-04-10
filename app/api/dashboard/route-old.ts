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

// GET — load dashboard from dashboard_pages + dashboard_views
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user?.company_id) return NextResponse.json({ customViews: [], pages: [] })

  // Load all views for this company, ordered
  const { data: views } = await supabaseAdmin
    .from('dashboard_views')
    .select('*')
    .eq('company_id', user.company_id)
    .order('order_index', { ascending: true })

  if (!views || views.length === 0) return NextResponse.json({ customViews: [], pages: [] })

  // Map DB rows to DashView shape the frontend expects
  const mapView = (v: any) => ({
    id: v.id,
    name: v.name,
    sql: v.sql_query,
    viz: v.viz_type,
    w: v.card_width,
    h: v.card_height,
    shared: v.shared,
    order: v.order_index,
    rows: v.rows_cache || [],
    fields: v.fields_cache || [],
  })

  // Load pages for this company
  const { data: pages } = await supabaseAdmin
    .from('dashboard_pages')
    .select('*')
    .eq('company_id', user.company_id)
    .order('order_index', { ascending: true })

  if (!pages || pages.length === 0) {
    // No pages — all views go to customViews (overview)
    return NextResponse.json({ customViews: views.map(mapView), pages: [] })
  }

  // Split: Overview page views → customViews, all other pages → pages array
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

  const finalPages = [
    { id: 'overview', name: 'Overview', shared: true, views: [] },
    ...otherPages,
  ]

  return NextResponse.json({ customViews: overviewViews, pages: finalPages })
}

// POST — save dashboard (admin/editor only)
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user?.company_id) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (user.role === 'viewer') return NextResponse.json({ error: 'Viewers cannot edit dashboards' }, { status: 403 })

  const { customViews = [], pages = [] } = await req.json()

  // Upsert overview views (customViews go to the Overview page)
  // Find or use the known Overview page id
  const { data: overviewPage } = await supabaseAdmin
    .from('dashboard_pages')
    .select('id')
    .eq('company_id', user.company_id)
    .eq('name', 'Overview')
    .single()

  let overviewPageId = overviewPage?.id
  if (!overviewPageId) {
    const { data: newPage } = await supabaseAdmin
      .from('dashboard_pages')
      .insert({ company_id: user.company_id, created_by: user.id, name: 'Overview', order_index: 0, created_at: new Date().toISOString() })
      .select('id').single()
    overviewPageId = newPage?.id
  }

  // Delete existing views for this company and re-insert
  await supabaseAdmin.from('dashboard_views').delete().eq('company_id', user.company_id)

  const allViews: any[] = []

  // Overview views
  customViews.forEach((v: any, i: number) => {
    allViews.push({
      id: v.id,
      page_id: overviewPageId,
      company_id: user.company_id,
      name: v.name,
      sql_query: v.sql,
      viz_type: v.viz,
      card_width: v.w || 460,
      card_height: v.h || 260,
      shared: v.shared ?? true,
      order_index: i,
      rows_cache: v.rows || null,
      fields_cache: v.fields || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  })

  // Custom page views
  for (const pg of pages) {
    if (pg.id === 'overview') continue
    // Upsert the page
    await supabaseAdmin.from('dashboard_pages').upsert({
      id: pg.id.startsWith('p') ? undefined : pg.id,
      company_id: user.company_id,
      created_by: user.id,
      name: pg.name,
      order_index: pages.indexOf(pg),
      created_at: new Date().toISOString(),
    }, { onConflict: 'id', ignoreDuplicates: false })

    const { data: savedPage } = await supabaseAdmin
      .from('dashboard_pages')
      .select('id').eq('company_id', user.company_id).eq('name', pg.name).single()

    const pageId = savedPage?.id
    if (!pageId) continue

    pg.views?.forEach((v: any, i: number) => {
      allViews.push({
        id: v.id,
        page_id: pageId,
        company_id: user.company_id,
        name: v.name,
        sql_query: v.sql,
        viz_type: v.viz,
        card_width: v.w || 460,
        card_height: v.h || 260,
        shared: v.shared ?? true,
        order_index: i,
        rows_cache: v.rows || null,
        fields_cache: v.fields || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    })
  }

  if (allViews.length > 0) {
    const { error } = await supabaseAdmin.from('dashboard_views').insert(allViews)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
