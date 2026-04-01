// app/api/test-connection/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

export async function POST(req: NextRequest) {
  let pool: Pool | null = null
  try {
    const { connectionString, host, port, database, username, password, ssl } = await req.json()

    const connStr = connectionString || buildConnectionString({ host, port, database, username, password, ssl })
    if (!connStr) return NextResponse.json({ ok: false, error: 'Connection details required' })

    pool = new Pool({
      connectionString: connStr,
      ssl: ssl !== false ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 8000,
      max: 1,
    })

    const start = Date.now()
    const client = await pool.connect()

    const result = await client.query(`
      SELECT 
        current_database() AS db_name,
        current_user AS db_user,
        (SELECT COUNT(*) FROM information_schema.tables 
         WHERE table_schema NOT IN ('pg_catalog','information_schema')) AS table_count
    `)
    client.release()

    const row = result.rows[0]

    return NextResponse.json({
      ok: true,
      db_name: row.db_name,
      db_user: row.db_user,
      table_count: parseInt(row.table_count),
      latency_ms: Date.now() - start,
    })

  } catch (err: any) {
    const msg = err.message || ''
    let friendly = 'Connection failed'
    if (msg.includes('password') || msg.includes('authentication')) friendly = 'Authentication failed — check your username and password'
    else if (msg.includes('ECONNREFUSED')) friendly = 'Connection refused — check your host and port'
    else if (msg.includes('timeout')) friendly = 'Connection timed out — check your host is reachable'
    else if (msg.includes('does not exist')) friendly = 'Database not found — check the database name'
    else if (msg.includes('SSL')) friendly = 'SSL error — try toggling the SSL setting'
    return NextResponse.json({ ok: false, error: friendly })
  } finally {
    if (pool) await pool.end().catch(() => {})
  }
}

function buildConnectionString({ host, port, database, username, password, ssl }: any): string {
  if (!host || !database) return ''
  const sslParam = ssl !== false ? '?sslmode=require' : ''
  const auth = username ? `${encodeURIComponent(username)}${password ? ':' + encodeURIComponent(password) : ''}@` : ''
  return `postgresql://${auth}${host}:${port || 5432}/${database}${sslParam}`
}
