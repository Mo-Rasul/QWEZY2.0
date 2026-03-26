// app/api/master/flags/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-app'
import { verifyMasterToken } from '../auth/route'

export async function GET(req: NextRequest) {
  if (!verifyMasterToken(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await supabaseAdmin.from('feature_flags').select('*').order('name')
  return NextResponse.json({ flags: data||[] })
}

export async function POST(req: NextRequest) {
  if (!verifyMasterToken(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()

  if (body.action === 'toggle_global') {
    await supabaseAdmin.from('feature_flags').update({ enabled_global: body.enabled }).eq('id', body.flagId)
    await supabaseAdmin.from('audit_log').insert({ actor:'master', action:'toggle_flag', details:{flag:body.name, enabled:body.enabled} }).catch(()=>{})
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'toggle_company') {
    await supabaseAdmin.from('company_flags').upsert({ company_id:body.companyId, flag_id:body.flagId, enabled:body.enabled }, { onConflict:'company_id,flag_id' })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'create_flag') {
    const { data } = await supabaseAdmin.from('feature_flags').insert({ name:body.name, description:body.description, enabled_global:false, rollout_pct:0 }).select('id').single()
    return NextResponse.json({ ok: true, id: data?.id })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
