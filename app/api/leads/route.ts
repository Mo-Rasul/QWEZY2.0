import { NextRequest, NextResponse } from 'next/server'
const leads: any[] = []
export async function POST(req: NextRequest) {
  const body = await req.json()
  leads.push({ ...body, id: `lead_${Date.now()}`, createdAt: new Date().toISOString(), status: 'new' })
  return NextResponse.json({ success: true, id: leads[leads.length-1].id })
}
export async function GET() {
  return NextResponse.json({ leads })
}
