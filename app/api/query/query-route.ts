import { NextRequest, NextResponse } from 'next/server'
import { generateSQL } from '@/lib/claude'
import { runSQL } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { question, customSQL, memoryContext, conversationContext } = await req.json()

    if (!question?.trim() && !customSQL?.trim()) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    if (customSQL?.trim()) {
      const result = await runSQL(customSQL.trim())
      return NextResponse.json({
        sql: customSQL.trim(), rows: result.rows.slice(0, 500),
        fields: result.fields, row_count: result.rows.length,
        duration_ms: result.duration_ms, confidence: 'high',
        assumptions: [], uncertain_about: null, suggested_clarification: null,
      })
    }

    const response = await generateSQL(question, memoryContext, conversationContext)
    if (!response.sql) {
      return NextResponse.json({ error: 'Could not generate a SQL query for that question' }, { status: 400 })
    }

    const result = await runSQL(response.sql)
    return NextResponse.json({
      sql: response.sql, rows: result.rows.slice(0, 500),
      fields: result.fields, row_count: result.rows.length,
      duration_ms: result.duration_ms, confidence: response.confidence,
      assumptions: response.assumptions, uncertain_about: response.uncertain_about,
      suggested_clarification: response.suggested_clarification,
    })
  } catch (err: any) {
    console.error('Query error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
