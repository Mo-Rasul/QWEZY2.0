// app/api/conversations/[id]/messages/route.ts
// Load all messages for a conversation

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.cookies.get('qwezy_session')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify conversation belongs to this user
  const { data: conv } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: messages } = await supabaseAdmin
    .from('messages')
    .select('id,role,content,sql_query,result_rows,result_fields,row_count,duration_ms,confidence,assumptions,uncertain_about,created_at')
    .eq('conversation_id', params.id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ messages: messages || [] })
}
