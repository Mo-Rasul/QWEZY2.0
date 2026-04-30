import { NextResponse } from 'next/server'
import { Client } from 'pg'

export async function POST(req: Request) {
  try {
    const { connectionString } = await req.json()

    const client = new Client({
      connectionString,
      ssl: true
    })

    const start = Date.now()

    await client.connect()

    // ✅ ADD THIS (this is the fix)
    const result = await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
    `)

    await client.end()

    return NextResponse.json({
      ok: true,
      tableCount: result.rows.length,
      latency_ms: Date.now() - start
    })

  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    )
  }
}