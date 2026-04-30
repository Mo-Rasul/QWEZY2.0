import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'

async function getUser(req: NextRequest) {
  const token = req.cookies.get('qwezy_session')?.value
  if (!token) return null
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return null
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id, company_id, role')
    .eq('id', user.id)
    .single()
  return profile ? { ...profile } : null
}

const isUUID = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

function mapView(v: any) {
  const cw = Number(v.card_width) || 480
  const ch = Number(v.card_height) || 280
  let gx: number | undefined
  let gy: number | undefined
  if (v.color && /^[\d.]+:[\d.]+$/.test(v.color)) {
    const [px, py] = v.color.split(':').map(Number)
    gx = px
    gy = py
  }
  return {
    id: v.id,
    name: v.name,
    sql: v.sql_query || '',
    viz: v.viz_type || 'bar',
    w: 480,
    h: 280,
    gw: cw > 0 ? cw : undefined,
    gh: ch > 0 ? ch : undefined,
    gx,
    gy,
    shared: v.shared ?? false,
    order: v.order_index || 0,
    rows: Array.isArray(v.rows_cache) ? v.rows_cache : [],
    fields: Array.isArray(v.fields_cache) ? v.fields_cache : [],
  }
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user?.company_id) return NextResponse.json({ customViews: [], pages: [] })

  const { data: pages, error: pagesError } = await supabaseAdmin
    .from('dashboard_pages')
    .select('*')
    .eq('company_id', user.company_id)
    .order('order_index', { ascending: true })

  if (pagesError) {
    return NextResponse.json({ error: pagesError.message }, { status: 500 })
  }

  if (!pages || pages.length === 0) {
    return NextResponse.json({ customViews: [], pages: [{ id: 'overview', name: 'Overview', shared: true, views: [] }] })
  }

  const visiblePages = pages.filter((p: any) =>
    p.name === 'Overview' || p.shared === true || p.created_by === user.id || user.role === 'admin'
  )

  const pageIds = visiblePages.map((p: any) => p.id)
  const { data: views, error: viewsError } = await supabaseAdmin
    .from('dashboard_views')
    .select('*')
    .eq('company_id', user.company_id)
    .in('page_id', pageIds.length ? pageIds : ['00000000-0000-0000-0000-000000000000'])
    .order('order_index', { ascending: true })

  if (viewsError) {
    return NextResponse.json({ error: viewsError.message }, { status: 500 })
  }

  const overviewPage = visiblePages.find((p: any) => p.name === 'Overview')
  const overviewViews = overviewPage
    ? (views || []).filter((v: any) => v.page_id === overviewPage.id).map(mapView)
    : []

  const otherPages = visiblePages
    .filter((p: any) => p.name !== 'Overview')
    .map((p: any) => ({
      id: p.id,
      name: p.name,
      shared: p.shared ?? false,
      createdBy: p.created_by,
      views: (views || []).filter((v: any) => v.page_id === p.id).map(mapView),
    }))

  return NextResponse.json({
    customViews: overviewViews,
    pages: [{ id: 'overview', name: 'Overview', shared: true, views: [] }, ...otherPages],
  })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user?.company_id) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (user.role === 'viewer') return NextResponse.json({ error: 'Viewers cannot edit dashboards' }, { status: 403 })

  const { customViews = [], pages = [] } = await req.json()
  const now = new Date().toISOString()

  let { data: overviewPage } = await supabaseAdmin
    .from('dashboard_pages')
    .select('id')
    .eq('company_id', user.company_id)
    .eq('name', 'Overview')
    .maybeSingle()

  if (!overviewPage?.id) {
    const { data: created, error } = await supabaseAdmin
      .from('dashboard_pages')
      .insert({ company_id: user.company_id, created_by: user.id, name: 'Overview', order_index: 0, shared: true, created_at: now, updated_at: now })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    overviewPage = created
  }
  const overviewPageId = overviewPage.id

  const buildView = (v: any, pageId: string, i: number) => ({
    ...(isUUID(v.id) ? { id: v.id } : {}),
    page_id: pageId,
    company_id: user.company_id,
    name: v.name || 'Untitled',
    sql_query: v.sql || '',
    viz_type: v.viz || 'bar',
    card_width: v.gw ? Number(v.gw) : (Number(v.w) || 480),
    card_height: v.gh ? Number(v.gh) : (Number(v.h) || 280),
    color: (v.gx != null && v.gy != null) ? `${v.gx}:${v.gy}` : null,
    shared: v.shared ?? false,
    order_index: i,
    rows_cache: Array.isArray(v.rows) && v.rows.length ? v.rows : null,
    fields_cache: Array.isArray(v.fields) && v.fields.length ? v.fields : null,
    created_at: now,
    updated_at: now,
  })

  // Replace only Overview views, not the whole company dashboard
  await supabaseAdmin.from('dashboard_views').delete().eq('company_id', user.company_id).eq('page_id', overviewPageId)
  if (customViews.length) {
    const { error } = await supabaseAdmin.from('dashboard_views').insert(customViews.map((v: any, i: number) => buildView(v, overviewPageId, i)))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: existingOwnedPages } = await supabaseAdmin
    .from('dashboard_pages')
    .select('id')
    .eq('company_id', user.company_id)
    .eq('created_by', user.id)
    .neq('name', 'Overview')

  const keptOwnedPageIds: string[] = []

  for (const [idx, pg] of pages.entries()) {
    if (pg.id === 'overview') continue

    let pageId: string | null = null
    if (isUUID(pg.id)) {
      const { data: existing } = await supabaseAdmin
        .from('dashboard_pages')
        .select('id, created_by')
        .eq('id', pg.id)
        .eq('company_id', user.company_id)
        .maybeSingle()
      if (existing && (existing.created_by === user.id || user.role === 'admin')) pageId = existing.id
    }

    if (!pageId) {
      const { data: created, error } = await supabaseAdmin
        .from('dashboard_pages')
        .insert({
          company_id: user.company_id,
          created_by: user.id,
          name: pg.name || `Page ${idx + 1}`,
          order_index: idx + 1,
          shared: pg.shared ?? false,
          created_at: now,
          updated_at: now,
        })
        .select('id')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      pageId = created.id
    } else {
      const { error } = await supabaseAdmin
        .from('dashboard_pages')
        .update({ name: pg.name || 'Untitled', order_index: idx + 1, shared: pg.shared ?? false, updated_at: now })
        .eq('id', pageId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    keptOwnedPageIds.push(pageId)
    await supabaseAdmin.from('dashboard_views').delete().eq('company_id', user.company_id).eq('page_id', pageId)
    if (pg.views?.length) {
      const { error } = await supabaseAdmin.from('dashboard_views').insert(pg.views.map((v: any, i: number) => buildView(v, pageId!, i)))
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  const ownedIds = (existingOwnedPages || []).map((p: any) => p.id)
  const removedIds = ownedIds.filter((id: string) => !keptOwnedPageIds.includes(id))
  if (removedIds.length) {
    await supabaseAdmin.from('dashboard_views').delete().eq('company_id', user.company_id).in('page_id', removedIds)
    await supabaseAdmin.from('dashboard_pages').delete().eq('company_id', user.company_id).eq('created_by', user.id).in('id', removedIds)
  }

  return NextResponse.json({ ok: true })
}
