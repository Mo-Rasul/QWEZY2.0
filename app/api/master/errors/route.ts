// app/api/master/errors/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-app'
import { verifyMasterToken } from '@/lib/verify-master'

export async function GET(req: NextRequest) {
  if (!verifyMasterToken(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: errors } = await supabaseAdmin
    .from('error_log')
    .select('*,companies(name)')
    .order('created_at', { ascending: false })
    .limit(200)

  const critical = errors?.filter(e=>e.severity==='critical'&&!e.resolved).length||0
  const unresolved = errors?.filter(e=>!e.resolved).length||0

  return NextResponse.json({ errors: errors||[], stats: { critical, unresolved, total: errors?.length||0 } })
}

export async function POST(req: NextRequest) {
  if (!verifyMasterToken(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { action, errorId } = await req.json()

  if (action === 'resolve') {
    await supabaseAdmin.from('error_log').update({ resolved: true }).eq('id', errorId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'resolve_all') {
    await supabaseAdmin.from('error_log').update({ resolved: true }).eq('resolved', false)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
