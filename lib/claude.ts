// lib/claude.ts
// SQL generation via Anthropic API.
// companyContext is injected per-request from lib/company-context.ts
// — it contains that company's annotations, joins, and corrections.
// Claude never sees raw data rows, only the business context layer.

import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const BASE_SYSTEM = `You are Qwezy, an expert SQL query engine. You generate accurate, well-formatted SQL based on the user's question and the company context provided.

SQL FORMATTING RULES — always follow these exactly:
- Each major clause on its own line: SELECT, FROM, JOIN, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT
- Indent column list 2 spaces under SELECT
- Each JOIN on its own line
- ROUND all monetary values to 2 decimal places
- Use table aliases throughout
- Use CURRENT_DATE for relative dates

RESPONSE FORMAT — return ONLY valid JSON, no markdown fences, no explanation:
{
  "sql": "formatted SQL with real newlines",
  "confidence": "high" | "medium" | "low",
  "assumptions": ["assumption if any"],
  "uncertain_about": null or "short sentence",
  "suggested_clarification": null or "one question"
}

Use confidence "high" for clear questions with obvious column mappings.
Use confidence "medium" for one significant business logic assumption.
Use confidence "low" only when a key term has no clear column mapping.
For high confidence: set assumptions to [], uncertain_about and suggested_clarification to null.`

export interface QueryResponse {
  sql: string
  confidence: 'high' | 'medium' | 'low'
  assumptions: string[]
  uncertain_about: string | null
  suggested_clarification: string | null
}

export async function generateSQL(
  question: string,
  memoryContext?: string,
  companyContext?: string  // loaded from lib/company-context.ts
): Promise<QueryResponse> {

  // Build system prompt: base rules + company-specific context
  const system = companyContext
    ? `${BASE_SYSTEM}\n\n${companyContext}`
    : BASE_SYSTEM

  // Build user message
  let userContent = ''
  if (memoryContext) userContent += `User notes:\n${memoryContext}\n\n`
  userContent += `Question: "${question}"`

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: userContent }],
  })

  const c = res.content[0]
  if (c.type !== 'text') throw new Error('Unexpected response type from AI')

  try {
    const parsed = JSON.parse(c.text.replace(/```json|```/g, '').trim())
    return {
      sql:                    parsed.sql || '',
      confidence:             parsed.confidence || 'medium',
      assumptions:            Array.isArray(parsed.assumptions) ? parsed.assumptions : [],
      uncertain_about:        parsed.uncertain_about || null,
      suggested_clarification: parsed.suggested_clarification || null,
    }
  } catch {
    return {
      sql:                    c.text.trim(),
      confidence:             'medium',
      assumptions:            [],
      uncertain_about:        'Response format was unexpected',
      suggested_clarification: null,
    }
  }
}

export async function draftAnnotation(tableName: string, columns: string[]) {
  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `Table: ${tableName}\nColumns: ${columns.join(', ')}\nReturn ONLY JSON (no markdown): {"description":"...","key_metrics":"...","suggested_team":"..."}`
    }],
  })
  const c = res.content[0]
  if (c.type !== 'text') throw new Error('Unexpected response')
  try {
    return JSON.parse(c.text.replace(/```json|```/g, '').trim())
  } catch {
    return { description: `${tableName} records`, key_metrics: 'id', suggested_team: 'Operations' }
  }
}
