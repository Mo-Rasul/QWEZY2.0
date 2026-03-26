// app/api/master/announce/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-app'
import { verifyMasterToken } from '../auth/route'

export async function GET(req: NextRequest) {
  if (!verifyMasterToken(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await supabaseAdmin.from('announcements').select('*').order('created_at', { ascending: false })
  return NextResponse.json({ announcements: data||[] })
}

export async function POST(req: NextRequest) {
  if (!verifyMasterToken(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()

  if (body.action === 'create') {
    await supabaseAdmin.from('announcements').insert({
      title: body.title, body: body.body, type: body.type||'info',
      target: body.target||'all', active: true,
      expires_at: body.expiresAt||null,
    })
    await supabaseAdmin.from('audit_log').insert({ actor:'master', action:'create_announcement', details:{title:body.title} }).catch(()=>{})
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'toggle') {
    await supabaseAdmin.from('announcements').update({ active: body.active }).eq('id', body.id)
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'delete') {
    await supabaseAdmin.from('announcements').delete().eq('id', body.id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
