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
  // Check session cookie for company
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

    // Northwind demo DB — always use Northwind prompt regardless of company
    if (company.db_connection_string === process.env.DEMO_DATABASE_URL) return NORTHWIND_PROMPT

    // Custom system prompt configured for this company
    if (company.tables_config?.system_prompt) return company.tables_config.system_prompt

    // Generic fallback for companies without a configured prompt yet
    return `You are Qwezy, a SQL assistant. Generate valid PostgreSQL SQL for the user's question. Return ONLY a JSON object: {"sql": "SELECT ...", "confidence": "high", "assumptions": []}`
  } catch {
    return NORTHWIND_PROMPT
  }
}

const NORTHWIND_PROMPT = `You are Qwezy, a SQL assistant for the Northwind demo database (PostgreSQL).

Available tables: orders, order_details, customers, employees, products, categories, suppliers, shippers

Key relationships:
- orders.customer_id → customers.customer_id
- orders.employee_id → employees.employee_id
- orders.ship_via → shippers.shipper_id
- order_details.order_id → orders.order_id
- order_details.product_id → products.product_id
- products.category_id → categories.category_id
- products.supplier_id → suppliers.supplier_id

Rules:
- Always return valid PostgreSQL SQL
- Use table aliases for clarity
- Revenue = SUM(unit_price * quantity * (1 - discount))
- Return ONLY a JSON object, no markdown, no explanation

Response format:
{"sql": "SELECT ...", "confidence": "high", "assumptions": []}`

const AHMED_RASUL_PROMPT = `You are Qwezy, a SQL assistant for Ahmed & Rasul LLP's database (PostgreSQL).

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
- Always return valid PostgreSQL SQL
- Billable revenue = SUM(hours * rate) from time_entries where billable = true
- Return ONLY a JSON object, no markdown, no explanation

Response format:
{"sql": "SELECT ...", "confidence": "high", "assumptions": []}`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { question, customSQL, memoryContext } = body

    if (!question?.trim() && !customSQL?.trim()) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    const dbUrl = await getCompanyDB(req)
    let sql = customSQL?.trim() || ''
    let confidence = 'high'
    let assumptions: string[] = []

    if (!sql) {
      const systemPrompt = await getSystemPrompt(req)
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
      const context = memoryContext ? `\n\nConversation context:\n${memoryContext}` : ''

      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: `${question}${context}` }],
      })

      const raw = message.content[0].type === 'text' ? message.content[0].text : ''
      try {
        const clean = raw.replace(/```json|```/g, '').trim()
        const parsed = JSON.parse(clean)
        sql = parsed.sql || ''
        confidence = parsed.confidence || 'high'
        assumptions = parsed.assumptions || []
      } catch {
        const match = raw.match(/SELECT[\s\S]+?;?$/im)
        sql = match ? match[0] : ''
      }

      if (!sql) {
        return NextResponse.json({ error: 'Could not generate SQL for that question.' }, { status: 400 })
      }
    }

    const result = await runSQL(sql, dbUrl)

    return NextResponse.json({
      sql,
      rows: result.rows.slice(0, 500),
      fields: result.fields,
      row_count: result.rows.length,
      duration_ms: result.duration_ms,
      confidence,
      assumptions,
    })
  } catch (err: any) {
    console.error('Query error:', err.message)
    return NextResponse.json({ error: err.message || 'Query failed' }, { status: 500 })
  }
}
