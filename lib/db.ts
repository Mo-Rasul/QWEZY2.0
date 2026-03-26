// lib/db.ts
// Runs SQL against a company's connected database.
// Loads connection details from Supabase — never hardcoded.
// Falls back to DEMO_DATABASE_URL env var in dev when no auth context.

import { Pool } from 'pg'
import { supabaseAdmin } from './supabase-app'
import { decryptCredential } from './company-context'

// Pool cache keyed by connection_id — reuse across requests
const poolCache = new Map<string, Pool>()

export interface QueryResult {
  rows: any[]
  fields: string[]
  duration_ms: number
}

// ── Get pool for a company ────────────────────────────────────────────────────
export async function getPoolForCompany(companyId: string): Promise<Pool> {
  // Check cache first
  const cached = [...poolCache.entries()].find(([k]) => k.startsWith(companyId))
  if (cached) return cached[1]

  // Load connection from Supabase
  const { data: conn, error } = await supabaseAdmin
    .from('db_connections')
    .select('id,host,port,database_name,username,encrypted_pass,ssl_required')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (error || !conn) {
    throw new Error(`No active database connection found for this company. Please complete onboarding first.`)
  }

  const password = decryptCredential(conn.encrypted_pass)
  const cacheKey = `${companyId}:${conn.id}`

  const pool = new Pool({
    host:     conn.host,
    port:     conn.port,
    database: conn.database_name,  // may include ?search_path=velo
    user:     conn.username,
    password,
    ssl:      conn.ssl_required ? { rejectUnauthorized: false } : false,
    max: 3,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000,
  })

  poolCache.set(cacheKey, pool)
  return pool
}

// ── Dev fallback pool (DEMO_DATABASE_URL) ─────────────────────────────────────
let devPool: Pool | null = null

function getDevPool(): Pool {
  if (!devPool) {
    devPool = new Pool({
      connectionString: process.env.DEMO_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
    })
  }
  return devPool
}

// ── Run SQL ───────────────────────────────────────────────────────────────────
export async function runSQL(sql: string, companyId?: string): Promise<QueryResult> {
  const start = Date.now()

  // Safety check — only SELECT allowed
  const trimmed = sql.trim().toUpperCase()
  if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH') && !trimmed.startsWith('EXPLAIN')) {
    throw new Error('Only SELECT queries are allowed.')
  }

  const pool = companyId ? await getPoolForCompany(companyId) : getDevPool()
  const client = await pool.connect()

  try {
    // Set a 30 second query timeout
    await client.query('SET statement_timeout = 30000')
    const result = await client.query(sql)
    return {
      rows: result.rows,
      fields: result.fields.map(f => f.name),
      duration_ms: Date.now() - start,
    }
  } finally {
    client.release()
  }
}

// ── Get schema for a company (used during onboarding) ────────────────────────
export async function fetchSchema(companyId?: string): Promise<{ table: string, columns: string[] }[]> {
  const pool = companyId ? await getPoolForCompany(companyId) : getDevPool()
  const client = await pool.connect()

  try {
    const result = await client.query(`
      SELECT
        t.table_name,
        array_agg(c.column_name::text ORDER BY c.ordinal_position) AS columns
      FROM information_schema.tables t
      JOIN information_schema.columns c
        ON c.table_name = t.table_name
        AND c.table_schema = t.table_schema
      WHERE t.table_schema = current_schema()
        AND t.table_type = 'BASE TABLE'
      GROUP BY t.table_name
      ORDER BY t.table_name
    `)
    return result.rows.map(r => ({ table: r.table_name, columns: r.columns }))
  } finally {
    client.release()
  }
}
