// app/api/query/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Pool } from 'pg'
import { supabaseAdmin } from '@/lib/supabase-app'

const DEMO_DB_URL = process.env.DEMO_DATABASE_URL!

const poolCache: Record<string, Pool> = {}

function getPool(connectionString: string): Pool {
  if (!poolCache[connectionString]) {
    poolCache[connectionString] = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 3,
    })
  }
  return poolCache[connectionString]
}

async function runSQL(sql: string, connectionString: string) {
  const pool = getPool(connectionString)
  const start = Date.now()
  const client = await pool.connect()
  try {
    const result = await client.query(sql)
    return {
      rows: result.rows,
      fields: result.fields.map((f: any) => f.name),
      duration_ms: Date.now() - start,
    }
  } finally {
    client.release()
  }
}

async function getAuthenticatedContext(req: NextRequest) {
  const token = req.cookies.get('qwezy_session')?.value
  if (!token) return null

  try {
    const { createClient } = await import('@supabase/supabase-js')
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

    if (!appUser?.company_id) return { user, appUser: null, company: null }

    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('id, name, db_connection_string, tables_config, db_schema')
      .eq('id', appUser.company_id)
      .single()

    return { user, appUser, company: company || null }
  } catch {
    return null
  }
}

async function getCompanyDB(req: NextRequest): Promise<string> {
  const ctx = await getAuthenticatedContext(req)
  return ctx?.company?.db_connection_string || DEMO_DB_URL
}

async function getSystemPrompt(req: NextRequest): Promise<string> {
  const ctx = await getAuthenticatedContext(req)
  if (!ctx?.company?.db_connection_string) return NORTHWIND_PROMPT
  if (ctx.company.db_connection_string === process.env.DEMO_DATABASE_URL) return NORTHWIND_PROMPT
  if (ctx.company.tables_config?.system_prompt) return ctx.company.tables_config.system_prompt
  const name = String((ctx.company as any)?.name || '').toLowerCase()
  const dbSchema = String((ctx.company as any)?.db_schema || '').toLowerCase()
  if (name.includes('rasul') || name.includes('ahmed') || dbSchema.includes('practice') || dbSchema.includes('finance')) return LAW_FIRM_PROMPT
  return GENERIC_PROMPT
}

async function getMetadataContext(req: NextRequest, question?: string): Promise<string> {
  const ctx = await getAuthenticatedContext(req)
  if (!ctx?.appUser?.company_id) return ''
  try {
    const q = String(question || '').toLowerCase()
    const [{ data: tableRows }, { data: columnRows }] = await Promise.all([
      supabaseAdmin
        .from('table_annotations')
        .select('table_schema, table_name, definition, ai_notes, default_date_format, preferred_metric_logic')
        .eq('company_id', ctx.appUser.company_id),
      supabaseAdmin
        .from('column_notes')
        .select('table_schema, table_name, column_name, description, ai_notes, preferred_label, display_format, synonyms')
        .eq('company_id', ctx.appUser.company_id)
    ])

    const tableNotes = (tableRows || []).filter((r:any)=>{
      if (!q) return true
      return q.includes(String(r.table_name || '').toLowerCase()) || q.includes(String(r.table_schema || '').toLowerCase())
    }).slice(0, 6)

    const columnNotes = (columnRows || []).filter((r:any)=>{
      if (!q) return false
      const candidates = [r.column_name, ...(r.synonyms || [])].map((x:any)=>String(x || '').toLowerCase()).filter(Boolean)
      return q.includes(String(r.table_name || '').toLowerCase()) || candidates.some((c:string)=>q.includes(c))
    }).slice(0, 12)

    const parts:string[] = []
    if (tableNotes.length) {
      parts.push('Admin table notes:')
      for (const r of tableNotes) {
        const line = [
          `${r.table_schema}.${r.table_name}`,
          r.definition ? `definition=${r.definition}` : '',
          r.ai_notes ? `ai_notes=${r.ai_notes}` : '',
          r.preferred_metric_logic ? `metric_logic=${r.preferred_metric_logic}` : '',
          r.default_date_format ? `date_format=${r.default_date_format}` : '',
        ].filter(Boolean).join(' | ')
        parts.push(`- ${line}`)
      }
    }
    if (columnNotes.length) {
      parts.push('Admin column notes:')
      for (const r of columnNotes) {
        const line = [
          `${r.table_schema}.${r.table_name}.${r.column_name}`,
          r.description ? `description=${r.description}` : '',
          r.ai_notes ? `ai_notes=${r.ai_notes}` : '',
          r.preferred_label ? `preferred_label=${r.preferred_label}` : '',
          r.display_format ? `display_format=${r.display_format}` : '',
          Array.isArray(r.synonyms) && r.synonyms.length ? `synonyms=${r.synonyms.join(', ')}` : '',
        ].filter(Boolean).join(' | ')
        parts.push(`- ${line}`)
      }
    }
    return parts.join('\n')
  } catch {
    return ''
  }
}

function buildMessages(
  question: string,
  conversationContext?: string,
  memoryContext?: string
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

  if (conversationContext) {
    const body = conversationContext.replace(/^Previous messages:\n/i, '')
    const lines = body.split('\n')

    let currentRole: 'user' | 'assistant' | null = null
    let currentLines: string[] = []

    const flush = () => {
      if (currentRole && currentLines.length > 0) {
        const content = currentLines.join('\n').trim()
        if (content) messages.push({ role: currentRole, content })
      }
    }

    for (const line of lines) {
      if (line.startsWith('user: ')) {
        flush()
        currentRole = 'user'
        currentLines = [line.slice(6)]
      } else if (line.startsWith('assistant: ')) {
        flush()
        currentRole = 'assistant'
        currentLines = [line.slice(11)]
      } else if (line.trim()) {
        currentLines.push(line)
      }
    }
    flush()
  }

  const currentQuestion = memoryContext
    ? `${question}\n\nAdditional context: ${memoryContext}`
    : question

  messages.push({ role: 'user', content: currentQuestion })
  return messages
}

const NORTHWIND_PROMPT = `You are Qwezy, a SQL assistant for the Northwind demo database (PostgreSQL).

You are in a multi-turn conversation. Always read prior messages carefully — follow-up questions like "top 5 of those", "break it down by country", "where is that city", or "show all orders" refer to whatever was discussed or queried previously. Build on that context rather than starting fresh.

Available tables and key columns:
- orders: order_id, customer_id, employee_id, order_date, required_date, shipped_date, ship_via, freight, ship_city, ship_country
- order_details: order_id, product_id, unit_price, quantity, discount
- customers: customer_id, company_name, contact_name, city, country, phone
- employees: employee_id, last_name, first_name, title, hire_date, city, country, reports_to
- products: product_id, product_name, supplier_id, category_id, unit_price, units_in_stock, units_on_order, reorder_level, discontinued
- categories: category_id, category_name, description
- suppliers: supplier_id, company_name, contact_name, city, country, phone
- shippers: shipper_id, company_name, phone

Key relationships:
- orders.customer_id → customers.customer_id
- orders.employee_id → employees.employee_id
- orders.ship_via → shippers.shipper_id
- order_details.order_id → orders.order_id
- order_details.product_id → products.product_id
- products.category_id → categories.category_id
- products.supplier_id → suppliers.supplier_id

Rules:
- Revenue = SUM(unit_price * quantity * (1 - discount))
- Always use valid PostgreSQL SQL with table aliases
- For ambiguous questions, make a reasonable assumption and note it in "assumptions"

Return ONLY a raw JSON object — no markdown, no backticks, no explanation outside the JSON:

For questions that should query data:
{"type":"sql","sql":"SELECT ...","confidence":"high|medium|low","assumptions":[],"uncertain_about":null,"suggested_clarification":null}

For questions that are explanations, definitions, or genuinely can't be answered with SQL (e.g. "what does freight mean", "explain this result"):
{"type":"text","answer":"your answer here","confidence":"high","assumptions":[]}`

const LAW_FIRM_PROMPT = `You are Qwezy, a SQL assistant for a law-firm PostgreSQL database.

You are in a multi-turn conversation. Follow-up questions usually refer to the same table/entity as the previous answer unless the user clearly changes topic.

Assume common schemas like practice and finance. Prefer these tables and columns when they exist:
- practice.attorneys: id, name, email, role, billing_rate, target_hours_monthly, status, practice_area_id
- practice.clients: id, company_name, contact_name, email, phone, city, state, client_type, status, intake_date
- practice.matters: id, matter_number, title, client_id, lead_attorney_id, practice_area_id, status, open_date, close_date, estimated_value
- practice.practice_areas: id, name, code, billing_rate_default
- practice.time_entries: id, matter_id, attorney_id, entry_date, hours, description, billable, billed, rate, amount
- finance.invoices: id, invoice_number, matter_id, client_id, issued_date, due_date, amount, total, status, paid_date
- finance.payments: id, invoice_id, client_id, payment_date, amount, method, notes
- finance.expenses: id, matter_id, attorney_id, expense_date, category, description, amount, billable, reimbursed
- finance.billing_rates: id, attorney_id, practice_area_id, rate, effective_date
- finance.contacts: id, name, company, contact_type

Rules:
- Always use schema prefixes like practice. and finance. when applicable
- For questions about attorneys, roles, paralegals, associates, of counsel, or staff, prefer practice.attorneys unless the conversation clearly points elsewhere
- For billing rates, prefer finance.billing_rates joined to practice.attorneys or practice.practice_areas
- For client money questions, prefer finance.invoices, finance.payments, and practice.time_entries as appropriate
- Always use valid PostgreSQL SQL with table aliases
- For ambiguous questions, make a reasonable assumption and note it in assumptions

Return ONLY a raw JSON object — no markdown, no backticks, no explanation outside the JSON:

For questions that should query data:
{"type":"sql","sql":"SELECT ...","confidence":"high|medium|low","assumptions":[],"uncertain_about":null,"suggested_clarification":null}

For questions that are explanations, definitions, or genuinely can't be answered with SQL:
{"type":"text","answer":"your answer here","confidence":"high","assumptions":[]}`

const GENERIC_PROMPT = `You are Qwezy, a SQL assistant. Generate valid PostgreSQL SQL for the user's question.

You are in a multi-turn conversation. Always read prior messages carefully — follow-up questions refer to whatever was discussed or queried previously. Build on that context rather than starting fresh.

For ambiguous questions, make a reasonable assumption and note it in "assumptions".

Return ONLY a raw JSON object — no markdown, no backticks, no explanation outside the JSON:

For questions that should query data:
{"type":"sql","sql":"SELECT ...","confidence":"high|medium|low","assumptions":[],"uncertain_about":null,"suggested_clarification":null}

For questions that are explanations, definitions, or genuinely can't be answered with SQL:
{"type":"text","answer":"your answer here","confidence":"high","assumptions":[]}`

const ANALYST_PROMPT = `You are a sharp, concise data analyst. The user asked a question about a dataset and you have the query results in front of you. Respond like a real analyst talking to a business user — direct, human, no jargon.

Rules:
- One or two short sentences max. Lead with the actual answer using real names and numbers from the data.
- If the question is vague or could mean multiple things, answer the most likely interpretation AND ask one short clarifying question at the end.
- Never say "Based on the data" or "The results show". Just answer.
- Suggest 2–3 smart follow-up questions an analyst would actually ask next. Make them specific to the data, not generic.

Return ONLY a raw JSON object — no markdown, no backticks:
{"answer":"your 1-2 sentence response","followUps":["follow-up 1","follow-up 2","follow-up 3"]}`

async function trackQuery(req: NextRequest, params: {
  question?: string
  customSQL?: string
  sql: string
  resultCount: number
  durationMs: number
}) {
  const ctx = await getAuthenticatedContext(req)
  if (!ctx?.appUser?.company_id || !ctx.user?.id) return

  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const { data: existingUsage, error: usageSelectError } = await supabaseAdmin
    .from('query_usage')
    .select('id, query_count')
    .eq('company_id', ctx.appUser.company_id)
    .eq('user_id', ctx.user.id)
    .eq('month', month)
    .maybeSingle()

  if (usageSelectError) throw usageSelectError

  if (existingUsage) {
    const { error: usageUpdateError } = await supabaseAdmin
      .from('query_usage')
      .update({
        query_count: (existingUsage.query_count || 0) + 1,
        updated_at: now.toISOString(),
        query_type: params.customSQL ? 'sql' : 'nl',
      })
      .eq('id', existingUsage.id)

    if (usageUpdateError) throw usageUpdateError
  } else {
    const { error: usageInsertError } = await supabaseAdmin
      .from('query_usage')
      .insert({
        company_id: ctx.appUser.company_id,
        user_id: ctx.user.id,
        month,
        query_count: 1,
        query_type: params.customSQL ? 'sql' : 'nl',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })

    if (usageInsertError) throw usageInsertError
  }

  if (params.question?.trim()) {
    const { error: historyError } = await supabaseAdmin
      .from('query_history')
      .insert({
        company_id: ctx.appUser.company_id,
        user_id: ctx.user.id,
        natural_language: params.question.trim(),
        sql: params.sql,
        result_count: params.resultCount,
        duration_ms: params.durationMs,
        created_at: now.toISOString(),
      })

    if (historyError) throw historyError
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { question, customSQL, memoryContext, conversationContext, narrativeOnly, rows: narrativeRows, fields: narrativeFields, tableName } = body

    if (narrativeOnly) {
      if (!question?.trim()) {
        return NextResponse.json({ error: 'Question is required' }, { status: 400 })
      }
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
      const dataSample = (narrativeRows || []).slice(0, 20).map((r: any) =>
        (narrativeFields || []).map((f: string) => `${f}: ${r[f]}`).join(', ')
      ).join('\n')

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        system: ANALYST_PROMPT,
        messages: [{
          role: 'user',
          content: `Table: ${tableName}\nColumns: ${(narrativeFields || []).join(', ')}\nTotal rows returned: ${(narrativeRows || []).length}\n\nData:\n${dataSample}\n\nUser's question: ${question}`,
        }],
      })

      const raw = message.content[0].type === 'text' ? message.content[0].text : ''
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw)
        return NextResponse.json({ answer: parsed.answer, followUps: parsed.followUps || [] })
      } catch {
        return NextResponse.json({ answer: raw.trim(), followUps: [] })
      }
    }

    if (!question?.trim() && !customSQL?.trim()) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    const dbUrl = await getCompanyDB(req)
    let sql = customSQL?.trim() || ''
    let confidence = 'high'
    let assumptions: string[] = []
    let uncertain_about: string | null = null
    let suggested_clarification: string | null = null

    if (!sql) {
      const systemPrompt = await getSystemPrompt(req)
      const metadataContext = await getMetadataContext(req, question)
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
      const mergedMemoryContext = [memoryContext, metadataContext].filter(Boolean).join('\n\n')
      const messages = buildMessages(question, conversationContext, mergedMemoryContext)

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system: systemPrompt,
        messages,
      })

      const raw = message.content[0].type === 'text' ? message.content[0].text : ''

      try {
        const clean = raw.replace(/```json|```/g, '').trim()
        const parsed = JSON.parse(clean)

        if (parsed.type === 'text') {
          return NextResponse.json({
            answer: parsed.answer,
            confidence: parsed.confidence || 'high',
            assumptions: parsed.assumptions || [],
          })
        }

        sql = parsed.sql || ''
        confidence = parsed.confidence || 'high'
        assumptions = parsed.assumptions || []
        uncertain_about = parsed.uncertain_about || null
        suggested_clarification = parsed.suggested_clarification || null
      } catch {
        const match = raw.match(/SELECT[\s\S]+?;?$/im)
        sql = match ? match[0] : ''
      }

      if (!sql) {
        return NextResponse.json({ error: 'Could not generate SQL for that question.' }, { status: 400 })
      }
    }

    const result = await runSQL(sql, dbUrl)

    try {
      await trackQuery(req, {
        question,
        customSQL,
        sql,
        resultCount: result.rows.length,
        durationMs: result.duration_ms,
      })
    } catch (trackingError: any) {
      console.error('Tracking error:', trackingError?.message || trackingError, trackingError)
    }

    return NextResponse.json({
      sql,
      rows: result.rows.slice(0, 500),
      fields: result.fields,
      row_count: result.rows.length,
      duration_ms: result.duration_ms,
      confidence,
      assumptions,
      uncertain_about,
      suggested_clarification,
    })
  } catch (err: any) {
    console.error('Query error:', err.message)
    return NextResponse.json({ error: err.message || 'Query failed' }, { status: 500 })
  }
}
