// app/api/company/analyse/route.ts
// Called once after a company connects their database.
// Samples real data, sends to Claude, stores a tailored system prompt.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'
import { Pool } from 'pg'
import Anthropic from '@anthropic-ai/sdk'

const poolCache: Record<string, Pool> = {}
function getPool(cs: string) {
  if (!poolCache[cs]) {
    poolCache[cs] = new Pool({
      connectionString: cs,
      ssl: { rejectUnauthorized: false },
      max: 2,
    })
  }
  return poolCache[cs]
}

const EXCLUDED_SCHEMAS = [
  'pg_catalog','information_schema','pg_toast','auth','storage','realtime',
  'extensions','graphql','graphql_public','pgsodium','vault','supabase_functions',
  'pgbouncer','_realtime','supabase_migrations','net','cron',
]

async function getUserAndCompany(req: NextRequest) {
  const token = req.cookies.get('qwezy_session')?.value
  if (!token) return null
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return null
    const { data: profile } = await supabaseAdmin
      .from('users').select('company_id, role').eq('id', user.id).single()
    if (!profile?.company_id) return null
    const { data: company } = await supabaseAdmin
      .from('companies').select('id, name, db_connection_string').eq('id', profile.company_id).single()
    if (!company?.db_connection_string) return null
    return { profile, company }
  } catch { return null }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getUserAndCompany(req)
    if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (auth.profile.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

    const { company } = auth
    const cs = company.db_connection_string
    const pool = getPool(cs)
    const client = await pool.connect()

    try {
      const excludedList = EXCLUDED_SCHEMAS.map(s => `'${s}'`).join(',')

      // ── 1. Get all tables ────────────────────────────────────────────────────
      const tablesRes = await client.query(`
        SELECT t.table_schema, t.table_name
        FROM information_schema.tables t
        WHERE t.table_schema NOT IN (${excludedList})
          AND t.table_schema NOT LIKE 'pg_%'
          AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_schema, t.table_name
      `)

      // ── 2. Get columns ───────────────────────────────────────────────────────
      const colsRes = await client.query(`
        SELECT table_schema, table_name, column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema NOT IN (${excludedList})
          AND table_schema NOT LIKE 'pg_%'
        ORDER BY table_schema, table_name, ordinal_position
      `)

      // ── 3. Get foreign keys ──────────────────────────────────────────────────
      const fkRes = await client.query(`
        SELECT
          tc.table_schema, tc.table_name, kcu.column_name,
          ccu.table_schema AS foreign_schema,
          ccu.table_name AS foreign_table,
          ccu.column_name AS foreign_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema NOT IN (${excludedList})
          AND tc.table_schema NOT LIKE 'pg_%'
      `)

      // ── 4. Get row counts ────────────────────────────────────────────────────
      const countRes = await client.query(`
        SELECT schemaname AS table_schema, relname AS table_name, n_live_tup AS row_count
        FROM pg_stat_user_tables
        WHERE schemaname NOT IN (${excludedList})
          AND schemaname NOT LIKE 'pg_%'
      `)

      // Build lookup maps
      const colMap: Record<string, {name: string, type: string, nullable: string}[]> = {}
      for (const row of colsRes.rows) {
        const key = `${row.table_schema}.${row.table_name}`
        if (!colMap[key]) colMap[key] = []
        colMap[key].push({ name: row.column_name, type: row.data_type, nullable: row.is_nullable })
      }

      const fkMap: Record<string, {column: string, foreignSchema: string, foreignTable: string, foreignColumn: string}[]> = {}
      for (const row of fkRes.rows) {
        const key = `${row.table_schema}.${row.table_name}`
        if (!fkMap[key]) fkMap[key] = []
        fkMap[key].push({
          column: row.column_name,
          foreignSchema: row.foreign_schema,
          foreignTable: row.foreign_table,
          foreignColumn: row.foreign_column,
        })
      }

      const countMap: Record<string, number> = {}
      for (const row of countRes.rows) {
        countMap[`${row.table_schema}.${row.table_name}`] = parseInt(row.row_count) || 0
      }

      // ── 5. Sample 20 rows per table (skip non-null bias) ────────────────────
      const tableSamples: Record<string, {columns: string[], rows: any[]}> = {}

      for (const tbl of tablesRes.rows) {
        const fqn = `"${tbl.table_schema}"."${tbl.table_name}"`
        const key = `${tbl.table_schema}.${tbl.table_name}`
        try {
          // Sample 20 rows — order randomly so we get a spread of real data
          const sample = await client.query(
            `SELECT * FROM ${fqn} ORDER BY RANDOM() LIMIT 20`
          )
          tableSamples[key] = {
            columns: sample.fields.map(f => f.name),
            rows: sample.rows,
          }
        } catch {
          // Table might have permissions issues — skip gracefully
          tableSamples[key] = { columns: [], rows: [] }
        }
      }

      // ── 6. Build schema summary for Claude ──────────────────────────────────
      const schemaLines: string[] = []

      for (const tbl of tablesRes.rows) {
        const key = `${tbl.table_schema}.${tbl.table_name}`
        const fqn = tbl.table_schema === 'public'
          ? tbl.table_name
          : `${tbl.table_schema}.${tbl.table_name}`

        const cols = colMap[key] || []
        const fks = fkMap[key] || []
        const count = countMap[key] || 0
        const sample = tableSamples[key]

        const colStr = cols.map(c => `${c.name} (${c.type}${c.nullable === 'NO' ? ', required' : ''})`).join(', ')
        const fkStr = fks.length > 0
          ? '\n  Foreign keys: ' + fks.map(f => `${f.column} → ${f.foreignSchema === 'public' ? '' : f.foreignSchema + '.'}${f.foreignTable}.${f.foreignColumn}`).join(', ')
          : ''

        // Build sample data summary — show non-null values so Claude understands real content
        let sampleStr = ''
        if (sample.rows.length > 0) {
          const nonEmptyRows = sample.rows.filter(r =>
            Object.values(r).some(v => v !== null && v !== '' && v !== undefined)
          ).slice(0, 5)
          if (nonEmptyRows.length > 0) {
            sampleStr = '\n  Sample data:\n' + nonEmptyRows.map(r =>
              '    ' + Object.entries(r)
                .filter(([, v]) => v !== null && v !== undefined)
                .slice(0, 8)
                .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                .join(', ')
            ).join('\n')
          }
        }

        schemaLines.push(
          `Table: ${fqn} (${count.toLocaleString()} rows)\n  Columns: ${colStr}${fkStr}${sampleStr}`
        )
      }

      const schemaContext = schemaLines.join('\n\n')

      // ── 7. Send to Claude to generate system prompt ──────────────────────────
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `You are helping configure an AI SQL assistant called Qwezy for a company called "${company.name}".

Below is their complete database schema including sample data. Analyse it carefully and generate a system prompt that will be used every time a user asks a question about their data.

The system prompt must:
1. Identify what kind of business this is based on the data
2. List EVERY table with its FULLY QUALIFIED name (schema.table — never omit the schema prefix for non-public schemas)
3. List ALL columns for each table with their EXACT names as they appear in the schema — never guess or infer column names
4. Document key JOIN relationships with exact syntax using fully qualified names
5. Note important business rules inferred from the data (revenue calculations, status values, date patterns)
6. Explicitly warn: never use column names that aren't listed — if unsure, use SELECT * first
7. Specify PostgreSQL dialect
8. End with the JSON response format instruction

DATABASE SCHEMA:
${schemaContext}

Generate ONLY the system prompt text. No preamble, no explanation. The system prompt should start with "You are Qwezy..." and end with the JSON format instruction.

The JSON response format to include at the end:
For SQL queries: {"type":"sql","sql":"SELECT ...","confidence":"high|medium|low","assumptions":[],"uncertain_about":null}
For non-SQL answers: {"type":"text","answer":"...","confidence":"high","assumptions":[]}`
        }],
      })

      const systemPrompt = message.content[0].type === 'text' ? message.content[0].text : ''

      if (!systemPrompt) {
        return NextResponse.json({ error: 'Failed to generate system prompt' }, { status: 500 })
      }

      // ── 8. Save to companies.tables_config ───────────────────────────────────
      const tablesConfig = {
        system_prompt: systemPrompt,
        analysed_at: new Date().toISOString(),
        table_count: tablesRes.rows.length,
        schemas: [...new Set(tablesRes.rows.map(t => t.table_schema))],
      }

      const { error: saveError } = await supabaseAdmin
        .from('companies')
        .update({ tables_config: tablesConfig })
        .eq('id', company.id)

      if (saveError) {
        console.error('Failed to save tables_config:', saveError.message)
        return NextResponse.json({ error: 'Failed to save analysis' }, { status: 500 })
      }

      // Log it
      try {
        await supabaseAdmin.from('audit_log').insert({
          actor: auth.profile.company_id,
          action: 'company.db_analysed',
          details: {
            company: company.name,
            tables: tablesRes.rows.length,
            schemas: tablesConfig.schemas,
          }
        })
      } catch {}

      return NextResponse.json({
        ok: true,
        tables: tablesRes.rows.length,
        schemas: tablesConfig.schemas,
        message: `Analysed ${tablesRes.rows.length} tables across ${tablesConfig.schemas.join(', ')} schema(s). AI is now configured for ${company.name}.`,
      })

    } finally {
      client.release()
    }

  } catch (err: any) {
    console.error('Analyse error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}