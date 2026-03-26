// app/api/feedback/route.ts
// Stores thumbs up/down and corrections — enriches AI context over time

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'

export async function POST(req: NextRequest) {
  const token = req.cookies.get('qwezy_session')?.value
  const companyId = req.cookies.get('qwezy_company')?.value
  if (!token || !companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messageId, feedback, correction, editedSql } = await req.json()

  const { error } = await supabaseAdmin.from('ai_feedback').insert({
    message_id: messageId, company_id: companyId, user_id: user.id,
    feedback, correction: correction||null, edited_sql: editedSql||null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
