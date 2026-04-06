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

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data, error } = await supabaseAdmin
    .from('reports').select('*').eq('company_id', user.company_id)
    .or(`user_id.eq.${user.id},shared.eq.true`)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data || [] })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { name, description, sql, schedule, refreshHours, shared, group } = await req.json()
  if (!name || !sql) return NextResponse.json({ error: 'Name and SQL required' }, { status: 400 })
  const { data, error } = await supabaseAdmin.from('reports').insert({
    name, description: description||'', sql,
    schedule: schedule||'weekly', refresh_hours: refreshHours||168,
    shared: shared??false, group_name: group||'General',
    user_id: user.id, company_id: user.company_id, row_count: 0,
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  try { await supabaseAdmin.from('audit_log').insert({ actor: user.id, action: 'report.created', target_company: user.company_id, details: { name, shared } }) } catch {}
  return NextResponse.json({ ok: true, id: data.id })
}

export async function PATCH(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const { data: report } = await supabaseAdmin.from('reports').select('user_id,company_id').eq('id', id).single()
  if (!report || report.company_id !== user.company_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (report.user_id !== user.id && user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const safe: any = {}
  const fields = ['name','description','sql','schedule','refresh_hours','shared','group_name','last_run','row_count']
  fields.forEach(f => { if (updates[f] !== undefined) safe[f] = updates[f] })
  const { error } = await supabaseAdmin.from('reports').update(safe).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
  const { error } = await supabaseAdmin.from('reports').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  try { await supabaseAdmin.from('audit_log').insert({ actor: user.id, action: 'report.deleted', target_company: user.company_id, details: { name: report.name } }) } catch {}
  return NextResponse.json({ ok: true })
}
