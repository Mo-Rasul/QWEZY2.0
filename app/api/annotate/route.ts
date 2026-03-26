import { NextRequest, NextResponse } from 'next/server'
import { draftAnnotation } from '@/lib/claude'
export async function POST(req: NextRequest) {
  try {
    const { action, table_name, columns } = await req.json()
    if (action === 'draft') {
      const draft = await draftAnnotation(table_name, columns || [])
      return NextResponse.json({ draft })
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
