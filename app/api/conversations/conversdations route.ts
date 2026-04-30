// app/api/conversations/route.ts
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'

async function getAppUser(req: NextRequest) {
  const token = req.cookies.get('qwezy_session')?.value
  if (!token) return null

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return null

  const { data: appUser } = await supabaseAdmin
    .from('users')
    .select('id, company_id')
    .eq('id', user.id)
    .single()

  if (!appUser?.company_id) return null
  return { user, appUser }
}

function mapMessageFromDb(row: any) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    sql: row.sql_query || undefined,
    rows: row.result_rows || undefined,
    fields: row.result_fields || undefined,
    duration: row.duration_ms || undefined,
    confidence: row.confidence || undefined,
    assumptions: row.assumptions || undefined,
    uncertain_about: row.uncertain_about || null,
    suggested_clarification: null,
    rewritten: false,
    created_at: row.created_at,
    timestamp: row.created_at,
  }
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await getAppUser(req)
    if (!ctx) return NextResponse.json({ conversations: [] })

    const { data: convs, error: convErr } = await supabaseAdmin
      .from('conversations')
      .select('id, title, created_at, updated_at')
      .eq('user_id', ctx.user.id)
      .eq('company_id', ctx.appUser.company_id)
      .order('updated_at', { ascending: false })
      .limit(15)

    if (convErr) throw convErr
    if (!convs || convs.length === 0) return NextResponse.json({ conversations: [] })

    const ids = convs.map(c => c.id)
    const { data: msgs, error: msgErr } = await supabaseAdmin
      .from('messages')
      .select('id, conversation_id, role, content, sql_query, result_rows, result_fields, duration_ms, confidence, assumptions, uncertain_about, created_at')
      .in('conversation_id', ids)
      .eq('company_id', ctx.appUser.company_id)
      .order('created_at', { ascending: true })

    const byConversation = new Map<string, any[]>()
    for (const msg of msgs || []) {
      if (!byConversation.has(msg.conversation_id)) byConversation.set(msg.conversation_id, [])
      byConversation.get(msg.conversation_id)!.push(mapMessageFromDb(msg))
    }

    return NextResponse.json({
      conversations: convs.map(c => ({
        id: c.id,
        title: c.title,
        created_at: c.created_at,
        updated_at: c.updated_at,
        messages: byConversation.get(c.id) || [],
      })),
      messages_error: msgErr ? (msgErr.message || 'Failed to load conversation messages') : null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to load conversations' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAppUser(req)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const now = new Date().toISOString()
    const conversation = {
      id: randomUUID(),
      user_id: ctx.user.id,
      company_id: ctx.appUser.company_id,
      title: body.title?.trim() || 'New conversation',
      created_at: now,
      updated_at: now,
    }

    const { error } = await supabaseAdmin.from('conversations').insert(conversation)
    if (error) throw error

    return NextResponse.json({ conversation: { ...conversation, messages: [] } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create conversation' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await getAppUser(req)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const conversationId = body.id
    if (!conversationId) return NextResponse.json({ error: 'Conversation id is required' }, { status: 400 })

    const now = new Date().toISOString()
    const { error: convErr } = await supabaseAdmin
      .from('conversations')
      .update({ title: body.title?.trim() || 'New conversation', updated_at: now })
      .eq('id', conversationId)
      .eq('user_id', ctx.user.id)
      .eq('company_id', ctx.appUser.company_id)

    if (convErr) throw convErr

    const { error: deleteErr } = await supabaseAdmin
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('company_id', ctx.appUser.company_id)

    if (deleteErr) throw deleteErr

    const messages = Array.isArray(body.messages) ? body.messages : []
    if (messages.length > 0) {
      const rows = messages.map((msg: any, index: number) => {
        const createdAt = msg.timestamp ? new Date(msg.timestamp).toISOString() : now
        return {
          id: randomUUID(),
          conversation_id: conversationId,
          company_id: ctx.appUser.company_id,
          topic: 'conversation',
          role: msg.role || 'assistant',
          extension: 'qwezy.chat',
          content: msg.content || '',
          sql_query: msg.sql || null,
          event: null,
          private: false,
          result_rows: msg.rows || null,
          updated_at: now,
          result_fields: msg.fields || null,
          row_count: Array.isArray(msg.rows) ? msg.rows.length : null,
          inserted_at: now,
          duration_ms: msg.duration || null,
          confidence: msg.confidence || null,
          assumptions: msg.assumptions || null,
          uncertain_about: msg.uncertainAbout || null,
          created_at: createdAt,
        }
      })

      const { error: insertErr } = await supabaseAdmin.from('messages').insert(rows)
      if (insertErr) throw insertErr
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save conversation' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await getAppUser(req)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Conversation id is required' }, { status: 400 })

    const { error: messageErr } = await supabaseAdmin
      .from('messages')
      .delete()
      .eq('conversation_id', id)
      .eq('company_id', ctx.appUser.company_id)

    if (messageErr) throw messageErr

    const { error: convErr } = await supabaseAdmin
      .from('conversations')
      .delete()
      .eq('id', id)
      .eq('user_id', ctx.user.id)
      .eq('company_id', ctx.appUser.company_id)

    if (convErr) throw convErr

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete conversation' }, { status: 500 })
  }
}
