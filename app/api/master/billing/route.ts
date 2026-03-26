// app/api/master/billing/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-app'
import { verifyMasterToken } from '@/lib/verify-master'

export async function GET(req: NextRequest) {
  if (!verifyMasterToken(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: invoices } = await supabaseAdmin
    .from('billing_invoices')
    .select('*,companies(name,plan)')
    .order('created_at', { ascending: false })

  // Summary stats
  const paid    = invoices?.filter(i=>i.status==='paid').reduce((s,i)=>s+Number(i.amount),0)||0
  const pending = invoices?.filter(i=>i.status==='pending').reduce((s,i)=>s+Number(i.amount),0)||0
  const overdue = invoices?.filter(i=>i.status==='overdue').reduce((s,i)=>s+Number(i.amount),0)||0

  return NextResponse.json({ invoices: invoices||[], summary: { paid, pending, overdue } })
}

export async function POST(req: NextRequest) {
  if (!verifyMasterToken(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()

  if (body.action === 'create_invoice') {
    const { data, error } = await supabaseAdmin.from('billing_invoices').insert({
      company_id: body.companyId, type: body.type, description: body.description,
      amount: body.amount, currency: body.currency||'USD', status: body.status||'pending',
      due_date: body.dueDate, notes: body.notes,
    }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    try { await supabaseAdmin.from('audit_log').insert({ actor:'master', action:'create_invoice', target_company:body.companyId, details:{amount:body.amount,type:body.type} }) } catch {}
    return NextResponse.json({ ok: true, id: data.id })
  }

  if (body.action === 'update_status') {
    await supabaseAdmin.from('billing_invoices').update({
      status: body.status,
      paid_date: body.status==='paid' ? new Date().toISOString().split('T')[0] : null,
      notes: body.notes,
    }).eq('id', body.invoiceId)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
