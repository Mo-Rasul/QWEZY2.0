// app/api/query/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Pool } from 'pg'
import { supabaseAdmin } from '@/lib/supabase-app'

const DEMO_DB_URL = process.env.DEMO_DATABASE_URL!

// Pool cache — reuse connections per company
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

async function getCompanyDB(req: NextRequest): Promise<string> {
  const token = req.cookies.get('qwezy_session')?.value
  if (!token) return DEMO_DB_URL

  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return DEMO_DB_URL

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) return DEMO_DB_URL

    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('db_connection_string')
      .eq('id', profile.company_id)
      .single()

    return company?.db_connection_string || DEMO_DB_URL
  } catch {
    return DEMO_DB_URL
  }
}

async function getSystemPrompt(req: NextRequest): Promise<string> {
  const token = req.cookies.get('qwezy_session')?.value
  if (!token) return NORTHWIND_PROMPT

  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NORTHWIND_PROMPT

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) return NORTHWIND_PROMPT

    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('db_connection_string, tables_config')
      .eq('id', profile.company_id)
      .single()

    if (!company?.db_connection_string) return NORTHWIND_PROMPT

    if (company.db_connection_string === process.env.DEMO_DATABASE_URL) return NORTHWIND_PROMPT

    if (company.tables_config?.system_prompt) return company.tables_config.system_prompt

    return GENERIC_PROMPT
  } catch {
    return NORTHWIND_PROMPT
  }
}

// Parse the conversationContext string the frontend sends into proper Anthropic messages.
// Format coming in: "Previous messages:\nuser: ...\nSQL: ...\nassistant: Returned N rows..."
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
        // SQL: lines and anything else gets appended to the current message
        currentLines.push(line)
      }
    }
    flush()
  }

  // Append the current question
  const currentQuestion = memoryContext
    ? `${question}\n\nAdditional context: ${memoryContext}`
    : question

  messages.push({ role: 'user', content: currentQuestion })
  return messages
}

// ── System Prompts ─────────────────────────────────────────────────────────────

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

const AHMED_RASUL_PROMPT = `You are Qwezy, a SQL assistant for Ahmed & Rasul LLP's database (PostgreSQL).

You are in a multi-turn conversation. Always read prior messages carefully — follow-up questions refer to whatever was discussed or queried previously. Build on that context rather than starting fresh.

The database has two schemas: practice and finance.

PRACTICE SCHEMA tables:
- practice.attorneys (id, name, email, role, billing_rate, target_hours_monthly, status, practice_area_id)
- practice.clients (id, company_name, contact_name, email, phone, city, state, client_type, status, intake_date)
- practice.matters (id, matter_number, title, client_id, lead_attorney_id, practice_area_id, status, open_date, close_date, estimated_value)
- practice.practice_areas (id, name, code, billing_rate_default)
- practice.time_entries (id, matter_id, attorney_id, entry_date, hours, description, billable, billed, rate, amount)
- practice.tasks (id, matter_id, assigned_to, title, due_date, completed_date, status, priority)
- practice.documents (id, matter_id, title, doc_type, uploaded_by, upload_date, status)
- practice.court_dates (id, matter_id, attorney_id, court_name, date, event_type, outcome)

FINANCE SCHEMA tables:
- finance.invoices (id, invoice_number, matter_id, client_id, issued_date, due_date, amount, total, status, paid_date)
- finance.payments (id, invoice_id, client_id, payment_date, amount, method, notes)
- finance.expenses (id, matter_id, attorney_id, expense_date, category, description, amount, billable, reimbursed)
- finance.billing_rates (id, attorney_id, practice_area_id, rate, effective_date)
- finance.trust_accounts (id, client_id, matter_id, account_number, balance, status, notes)
- finance.contacts (id, name, company, contact_type)
- finance.referrals (id, matter_id, contact_id, referral_date, referral_fee, fee_paid)

Key relationships:
- practice.matters.client_id → practice.clients.id
- practice.matters.lead_attorney_id → practice.attorneys.id
- practice.matters.practice_area_id → practice.practice_areas.id
- practice.time_entries.matter_id → practice.matters.id
- practice.time_entries.attorney_id → practice.attorneys.id
- finance.invoices.matter_id → practice.matters.id
- finance.invoices.client_id → practice.clients.id
- finance.payments.invoice_id → finance.invoices.id

Rules:
- Always use schema prefix (practice. or finance.)
- Billable revenue = SUM(hours * rate) from time_entries where billable = true
- Always use valid PostgreSQL SQL with table aliases
- For ambiguous questions, make a reasonable assumption and note it in "assumptions"

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

// ── Analyst narrative prompt ───────────────────────────────────────────────────

const ANALYST_PROMPT = `You are a sharp, concise data analyst. The user asked a question about a dataset and you have the query results in front of you. Respond like a real analyst talking to a business user — direct, human, no jargon.

Rules:
- One or two short sentences max. Lead with the actual answer using real names and numbers from the data.
- If the question is vague or could mean multiple things, answer the most likely interpretation AND ask one short clarifying question at the end.
- Never say "Based on the data" or "The results show". Just answer.
- Suggest 2–3 smart follow-up questions an analyst would actually ask next. Make them specific to the data, not generic.

Return ONLY a raw JSON object — no markdown, no backticks:
{"answer":"your 1-2 sentence response","followUps":["follow-up 1","follow-up 2","follow-up 3"]}`

// ── POST handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { question, customSQL, memoryContext, conversationContext, narrativeOnly, rows: narrativeRows, fields: narrativeFields, tableName } = body

    // ── Narrative-only mode: read real data and respond like an analyst ──────
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
        // Claude sometimes outputs a sentence before the JSON — extract the JSON block directly
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
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

      // Build proper multi-turn messages — the key fix vs before
      const messages = buildMessages(question, conversationContext, memoryContext)

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      })

      const raw = message.content[0].type === 'text' ? message.content[0].text : ''

      try {
        const clean = raw.replace(/```json|```/g, '').trim()
        const parsed = JSON.parse(clean)

        // Text-type responses: explanations, definitions, non-queryable answers
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
        // Last resort: pull a SELECT statement directly from the raw response
        const match = raw.match(/SELECT[\s\S]+?;?$/im)
        sql = match ? match[0] : ''
      }

      if (!sql) {
        return NextResponse.json({ error: 'Could not generate SQL for that question.' }, { status: 400 })
      }
    }

    // SQL auto-rewrite on error is handled in the frontend — just run it here
    const result = await runSQL(sql, dbUrl)

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
