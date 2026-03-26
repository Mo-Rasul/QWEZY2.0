// app/api/reports/schedule/route.ts
// Runs due scheduled reports and emails results.
// Call this from a cron job (Vercel cron, GitHub Actions, etc.) daily.
// Endpoint: GET /api/reports/schedule?secret=YOUR_CRON_SECRET

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-app'
import { runSQL } from '@/lib/db'
import { sendScheduledReport } from '@/lib/email'
import { logError } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  // Protect with a secret
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const dayOfWeek = now.getDay()   // 0=Sun
  const dayOfMonth = now.getDate()
  const hour = now.getHours()

  // Only run once a day at a reasonable hour
  if (hour !== 7 && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ message: 'Not scheduled hour', skipped: true })
  }

  // Get all active scheduled reports
  const { data: reports } = await supabaseAdmin
    .from('reports')
    .select('*,companies(id,plan)')
    .neq('schedule', 'manual')
    .eq('shared', true)

  let sent = 0, failed = 0, skipped = 0

  for (const report of (reports || [])) {
    // Check if this report should run today
    const shouldRun =
      report.schedule === 'daily' ||
      (report.schedule === 'weekly'  && dayOfWeek === 1) ||   // Mondays
      (report.schedule === 'monthly' && dayOfMonth === 1)     // 1st of month

    if (!shouldRun) { skipped++; continue }

    // Check if company plan allows scheduled reports
    const { data: planLimits } = await supabaseAdmin
      .from('plan_limits').select('can_schedule').eq('plan', report.companies?.plan || 'starter').single()
    if (!planLimits?.can_schedule) { skipped++; continue }

    try {
      // Run the query
      const result = await runSQL(report.sql_query, report.company_id)

      // Cache the result
      await supabaseAdmin.from('report_results').insert({
        report_id: report.id,
        company_id: report.company_id,
        rows_data: result.rows.slice(0,500),
        fields: result.fields,
        ran_at: now.toISOString(),
      })

      // Update last_run
      await supabaseAdmin.from('reports')
        .update({ last_run: now.toISOString() })
        .eq('id', report.id)

      // Get company users with admin/analyst roles for delivery
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('email,name')
        .eq('company_id', report.company_id)
        .in('role', ['admin','analyst'])
        .eq('status', 'active')

      // Send to each user
      for (const user of (users || [])) {
        const emailSent = await sendScheduledReport(
          user.email,
          report.name,
          report.companies?.name || 'Your company',
          result.rows,
          result.fields,
          now.toISOString()
        )
        if (emailSent) sent++
      }

    } catch (err: any) {
      failed++
      await logError({
        companyId: report.company_id, route: '/api/reports/schedule',
        errorType: 'scheduled_report_failed', message: err.message,
        stack: err.stack, severity: 'error',
        context: { reportId: report.id, reportName: report.name }
      })
    }
  }

  return NextResponse.json({ sent, failed, skipped, total: reports?.length || 0 })
}
