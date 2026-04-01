// app/api/query/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Pool } from 'pg'

const DEMO_DB_URL = process.env.DEMO_DATABASE_URL!

async function runSQL(sql: string): Promise<{ rows: any[], fields: string[], duration_ms: number }> {
  const pool = new Pool({ connectionString: DEMO_DB_URL, ssl: { rejectUnauthorized: false }, max: 3 })
  const start = Date.now()
  try {
    const client = await pool.connect()
    const result = await client.query(sql)
    client.release()
    await pool.end()
    return {
      rows: result.rows,
      fields: result.fields.map((f: any) => f.name),
      duration_ms: Date.now() - start,
    }
  } catch (err) {
    await pool.end().catch(() => {})
    throw err
  }
}

const SYSTEM_PROMPT = `You are Qwezy, a SQL assistant for the Northwind demo database (PostgreSQL).

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { question, customSQL, conversationId, memoryContext } = body

    if (!question?.trim() && !customSQL?.trim()) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    let sql = customSQL?.trim() || ''
    let confidence = 'high'
    let assumptions: string[] = []

    // Generate SQL from question if no custom SQL provided
    if (!sql) {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
      
      const context = memoryContext ? `\n\nConversation context:\n${memoryContext}` : ''
      
      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
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
        // Try to extract SQL directly
        const match = raw.match(/SELECT[\s\S]+?;?$/im)
        sql = match ? match[0] : ''
      }

      if (!sql) {
        return NextResponse.json({ error: 'Could not generate SQL for that question.' }, { status: 400 })
      }
    }

    // Run the query
    const result = await runSQL(sql)

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
