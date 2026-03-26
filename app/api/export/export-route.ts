import { NextRequest, NextResponse } from 'next/server'
import { runSQL } from '@/lib/db'

const REPORT_SQLS: Record<string, {name:string, sql:string}> = {
  r1: { name:'Monthly Revenue by Category', sql:`SELECT c.category_name, ROUND(SUM(od.unit_price * od.quantity * (1 - od.discount)), 2) AS revenue FROM order_details od JOIN products p ON od.product_id = p.product_id JOIN categories c ON p.category_id = c.category_id GROUP BY c.category_name ORDER BY revenue DESC` },
  r2: { name:'Weekly Top Customers', sql:`SELECT c.company_name, c.country, COUNT(o.order_id) AS total_orders, ROUND(SUM(od.unit_price * od.quantity * (1 - od.discount)), 2) AS total_revenue FROM customers c JOIN orders o ON c.customer_id = o.customer_id JOIN order_details od ON o.order_id = od.order_id GROUP BY c.company_name, c.country ORDER BY total_revenue DESC LIMIT 20` },
  r3: { name:'Daily Low Stock Alert', sql:`SELECT p.product_name, p.units_in_stock, p.reorder_level, s.company_name AS supplier FROM products p JOIN suppliers s ON p.supplier_id = s.supplier_id WHERE p.units_in_stock <= p.reorder_level AND p.discontinued = false ORDER BY p.units_in_stock ASC` },
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const reportId = searchParams.get('reportId')
  const format = searchParams.get('format') || 'json'
  const token = searchParams.get('token')
  if (token !== 'demo') return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  const report = REPORT_SQLS[reportId || '']
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  try {
    const result = await runSQL(report.sql)
    if (format === 'csv') {
      const csv = [result.fields.join(','), ...result.rows.map(r => result.fields.map(f => JSON.stringify(r[f] ?? '')).join(','))].join('\n')
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${reportId}.csv"` } })
    }
    return NextResponse.json({ report_id: reportId, report_name: report.name, generated_at: new Date().toISOString(), row_count: result.rows.length, fields: result.fields, data: result.rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
