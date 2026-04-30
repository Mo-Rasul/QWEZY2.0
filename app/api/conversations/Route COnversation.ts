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
    uncertainAbout: row.uncertain_about || null,
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
      .limit(25)

    if (convErr) throw convErr
    if (!convs?.length) return NextResponse.json({ conversations: [] })

    const ids = convs.map(c => c.id)
    const { data: msgs, error: msgErr } = await supabaseAdmin
      .from('messages')
      .select('id, conversation_id, role, content, sql_query, result_rows, result_fields, duration_ms, confidence, assumptions, uncertain_about, created_at')
      .in('conversation_id', ids)
      .eq('company_id', ctx.appUser.company_id)
      .order('created_at', { ascending: true })

    if (msgErr) throw msgErr

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
    })
  } catch (err: any) {
    console.error('LOAD_CONVERSATIONS_ERROR', err)
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
    console.error('CREATE_CONVERSATION_ERROR', err)
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

    const { data: existingConv, error: existingErr } = await supabaseAdmin
      .from('conversations')
      .select('title')
      .eq('id', conversationId)
      .eq('user_id', ctx.user.id)
      .eq('company_id', ctx.appUser.company_id)
      .single()

    if (existingErr) throw existingErr

    const messages = Array.isArray(body.messages) ? body.messages : []
    const firstUserMessage = messages.find((m: any) => m?.role === 'user' && (m?.content || '').trim())
    const incomingTitle = (body.title || '').trim()
    const titleToSave = existingConv?.title && existingConv.title !== 'New conversation'
      ? existingConv.title
      : (incomingTitle && incomingTitle !== 'New conversation'
          ? incomingTitle
          : ((firstUserMessage?.content || 'New conversation').trim().slice(0, 40) || 'New conversation'))

    const now = new Date().toISOString()
    const { error: convErr } = await supabaseAdmin
      .from('conversations')
      .update({ title: titleToSave, updated_at: now })
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

    if (messages.length > 0) {
      const rows = messages.map((msg: any) => ({
        conversation_id: conversationId,
        company_id: ctx.appUser.company_id,
        role: msg.role || 'assistant',
        content: msg.content || '',
        sql_query: msg.sql || null,
        result_rows: msg.rows || null,
        result_fields: msg.fields || null,
        row_count: Array.isArray(msg.rows) ? msg.rows.length : null,
        duration_ms: msg.duration || null,
        confidence: msg.confidence || null,
        assumptions: msg.assumptions || null,
        uncertain_about: msg.uncertainAbout || null,
        created_at: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString(),
      }))

      const { error: insertErr } = await supabaseAdmin.from('messages').insert(rows)
      if (insertErr) throw insertErr
    }

    return NextResponse.json({ ok: true, title: titleToSave })
  } catch (err: any) {
    console.error('SAVE_CONVERSATION_ERROR', err)
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
    console.error('DELETE_CONVERSATION_ERROR', err)
    return NextResponse.json({ error: err.message || 'Failed to delete conversation' }, { status: 500 })
  }
}
