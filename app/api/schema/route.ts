// app/api/schema/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'
import { Pool } from 'pg'

const poolCache: Record<string, Pool> = {}
function getPool(cs: string) {
  if (!poolCache[cs]) poolCache[cs] = new Pool({ connectionString: cs, ssl: { rejectUnauthorized: false }, max: 2 })
  return poolCache[cs]
}

const COLORS = ['#059669','#8B5CF6','#3B82F6','#F59E0B','#EF4444','#10B981','#EC4899','#6366F1','#14B8A6','#F97316']

// Schemas to always exclude — Supabase internals + Postgres system schemas
const EXCLUDED_SCHEMAS = [
  'pg_catalog','information_schema','pg_toast','pg_temp_1','pg_toast_temp_1',
  'auth','storage','realtime','extensions','graphql','graphql_public',
  'pgsodium','vault','supabase_functions','pgbouncer','_realtime',
  'supabase_migrations','net','cron','pg_partman','pg_monitor',
]

async function getCompanyConnection(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get('qwezy_session')?.value
  if (!token) return null
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return null
    const { data: profile } = await supabaseAdmin.from('users').select('company_id').eq('id', user.id).single()
    if (!profile?.company_id) return null
    const { data: company } = await supabaseAdmin.from('companies').select('db_connection_string').eq('id', profile.company_id).single()
    return company?.db_connection_string || null
  } catch { return null }
}

export async function GET(req: NextRequest) {
  try {
    const cs = await getCompanyConnection(req)
    if (!cs) return NextResponse.json({ error: 'No database connected' }, { status: 404 })

    const pool = getPool(cs)
    const client = await pool.connect()

    try {
      const excludedList = EXCLUDED_SCHEMAS.map(s => `'${s}'`).join(',')

      const tablesRes = await client.query(`
        SELECT
          t.table_schema,
          t.table_name,
          obj_description(
            (quote_ident(t.table_schema)||'.'||quote_ident(t.table_name))::regclass,
            'pg_class'
          ) AS description
        FROM information_schema.tables t
        WHERE t.table_schema NOT IN (${excludedList})
          AND t.table_type = 'BASE TABLE'
          AND t.table_schema NOT LIKE 'pg_%'
          AND t.table_schema NOT LIKE '_timescaledb%'
        ORDER BY t.table_schema, t.table_name
      `)

      const colsRes = await client.query(`
        SELECT table_schema, table_name, column_name, data_type, ordinal_position
        FROM information_schema.columns
        WHERE table_schema NOT IN (${excludedList})
          AND table_schema NOT LIKE 'pg_%'
        ORDER BY table_schema, table_name, ordinal_position
      `)

      const fkRes = await client.query(`
        SELECT
          tc.table_schema, tc.table_name, kcu.column_name,
          ccu.table_name AS foreign_table
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name=tc.constraint_name
        WHERE tc.constraint_type='FOREIGN KEY'
          AND tc.table_schema NOT IN (${excludedList})
          AND tc.table_schema NOT LIKE 'pg_%'
      `)

      const countRes = await client.query(`
        SELECT schemaname AS table_schema, relname AS table_name, n_live_tup AS row_count
        FROM pg_stat_user_tables
        WHERE schemaname NOT IN (${excludedList})
          AND schemaname NOT LIKE 'pg_%'
        ORDER BY schemaname, relname
      `)

      // Build lookup maps
      const colMap: Record<string, { n: string; t: string }[]> = {}
      for (const row of colsRes.rows) {
        const key = `${row.table_schema}.${row.table_name}`
        if (!colMap[key]) colMap[key] = []
        const t = row.data_type.includes('int') || row.data_type.includes('serial') ? 'id'
          : row.data_type.includes('timestamp') || row.data_type.includes('date') ? 'date'
          : row.data_type.includes('numeric') || row.data_type.includes('float') || row.data_type.includes('double') ? 'num'
          : row.data_type.includes('bool') ? 'bool' : 'str'
        colMap[key].push({ n: row.column_name, t })
      }

      const fkMap: Record<string, { to: string; on: string }[]> = {}
      for (const row of fkRes.rows) {
        const key = `${row.table_schema}.${row.table_name}`
        if (!fkMap[key]) fkMap[key] = []
        fkMap[key].push({ to: row.foreign_table, on: row.column_name })
      }

      const countMap: Record<string, number> = {}
      for (const row of countRes.rows) {
        countMap[`${row.table_schema}.${row.table_name}`] = parseInt(row.row_count) || 0
      }

      const tables = tablesRes.rows.map((row, i) => {
        const key = `${row.table_schema}.${row.table_name}`
        const schema = row.table_schema !== 'public' ? row.table_schema : null
        return {
          name: row.table_name,
          schema: row.table_schema,
          displayName: schema ? `${schema}.${row.table_name}` : row.table_name,
          desc: row.description || '',
          color: COLORS[i % COLORS.length],
          rows: countMap[key] || 0,
          columns: colMap[key] || [],
          joins: fkMap[key] || [],
          sampleQ: [],
          // teams is an array for compatibility with ExplorerTab card
          teams: schema ? [schema] : [],
          team: schema || '',
          x: 60 + (i % 4) * 320,
          y: 80 + Math.floor(i / 4) * 200,
        }
      })

      return NextResponse.json({
        tables,
        table_count: tables.length,
        column_count: colsRes.rows.length,
      })

    } finally {
      client.release()
    }
  } catch (err: any) {
    console.error('Schema error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
