// app/api/onboarding/discover/route.ts
// Real schema discovery — connects to customer DB and reads actual tables
import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { decryptCredential } from '@/lib/company-context'
import { logError } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const { host, port, database, username, password, ssl } = await req.json()

  const pool = new Pool({
    host, port: parseInt(port)||5432, database,
    user: username,
    password: password.startsWith('enc:') ? decryptCredential(password) : password,
    ssl: ssl ? { rejectUnauthorized: false } : false,
    max: 2, connectionTimeoutMillis: 10000,
  })

  try {
    const client = await pool.connect()

    // Get tables with row counts and last modified date
    const tablesResult = await client.query(`
      SELECT
        t.table_name,
        t.table_schema,
        obj_description(pgc.oid, 'pg_class') as description,
        pgc.reltuples::bigint as estimated_rows
      FROM information_schema.tables t
      JOIN pg_class pgc ON pgc.relname = t.table_name
      WHERE t.table_schema = current_schema()
        AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `)

    // Get columns for each table
    const colsResult = await client.query(`
      SELECT
        c.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        EXISTS (
          SELECT 1 FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_name = c.table_name
            AND tc.constraint_type = 'PRIMARY KEY'
            AND kcu.column_name = c.column_name
        ) as is_pk
      FROM information_schema.columns c
      WHERE c.table_schema = current_schema()
      ORDER BY c.table_name, c.ordinal_position
    `)

    // Get foreign keys
    const fkResult = await client.query(`
      SELECT
        kcu.table_name as from_table,
        kcu.column_name as from_col,
        ccu.table_name as to_table,
        ccu.column_name as to_col
      FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = rc.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = rc.unique_constraint_name
      WHERE kcu.table_schema = current_schema()
    `)

    client.release()
    await pool.end()

    // Group columns by table
    const colsByTable: Record<string,any[]> = {}
    colsResult.rows.forEach(col => {
      if (!colsByTable[col.table_name]) colsByTable[col.table_name] = []
      colsByTable[col.table_name].push(col)
    })

    // Build tables array with smart column flagging
    const IMPORTANT_PATTERNS = /^(id$|.*_id$|created_at|updated_at|date|amount|total|price|revenue|status|name$|email$|type$|count|qty|quantity)/i
    const tables = tablesResult.rows.map(t => {
      const cols = colsByTable[t.table_name] || []
      return {
        name: t.table_name,
        rows: Math.max(0, t.estimated_rows),
        cols: cols.map(c => ({
          name: c.column_name,
          type: c.data_type,
          pk: c.is_pk,
          nullable: c.is_nullable === 'YES',
          flagged: c.is_pk || IMPORTANT_PATTERNS.test(c.column_name),
        })),
        pk: cols.find(c=>c.is_pk)?.column_name || 'id',
      }
    })

    // Build join suggestions from FK constraints
    const joins = fkResult.rows.map(fk => ({
      from: fk.from_table, fromCol: fk.from_col,
      to: fk.to_table, toCol: fk.to_col,
      type: 'INNER', confidence: 0.98, approved: true,
    }))

    return NextResponse.json({ tables, joins })
  } catch (err: any) {
    await pool.end().catch(()=>{})
    await logError({ route: '/api/onboarding/discover', errorType: 'discovery_failed', message: err.message, severity: 'error' })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
