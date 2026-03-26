// lib/rate-limit.ts
// Enforces per-company query limits based on their plan.
// Increments query_usage counter and checks against plan_limits.

import { supabaseAdmin } from './supabase-app'

export interface RateLimitResult {
  allowed: boolean
  used: number
  limit: number
  remaining: number
  resetDate: string
  plan: string
}

export async function checkRateLimit(companyId: string): Promise<RateLimitResult> {
  const month = new Date()
  month.setDate(1)
  month.setHours(0,0,0,0)
  const monthStr = month.toISOString().split('T')[0]

  // Get company plan
  const { data: company } = await supabaseAdmin
    .from('companies')
    .select('plan')
    .eq('id', companyId)
    .single()

  const plan = company?.plan || 'starter'

  // Get plan limits
  const { data: limits } = await supabaseAdmin
    .from('plan_limits')
    .select('queries_month')
    .eq('plan', plan)
    .single()

  const queryLimit = limits?.queries_month ?? 500

  // Get current usage (upsert to ensure row exists)
  const { data: usage } = await supabaseAdmin
    .from('query_usage')
    .upsert({ company_id: companyId, month: monthStr, query_count: 0 }, {
      onConflict: 'company_id,month',
      ignoreDuplicates: true
    })
    .select('query_count')
    .eq('company_id', companyId)
    .eq('month', monthStr)
    .single()

  // Re-fetch after upsert
  const { data: currentUsage } = await supabaseAdmin
    .from('query_usage')
    .select('query_count')
    .eq('company_id', companyId)
    .eq('month', monthStr)
    .single()

  const used = currentUsage?.query_count || 0
  const unlimited = queryLimit === -1

  // Reset date = first of next month
  const resetDate = new Date(month)
  resetDate.setMonth(resetDate.getMonth() + 1)

  return {
    allowed: unlimited || used < queryLimit,
    used,
    limit: queryLimit,
    remaining: unlimited ? 999999 : Math.max(0, queryLimit - used),
    resetDate: resetDate.toISOString().split('T')[0],
    plan,
  }
}

export async function incrementUsage(companyId: string): Promise<void> {
  const month = new Date()
  month.setDate(1)
  month.setHours(0,0,0,0)
  const monthStr = month.toISOString().split('T')[0]

  // Upsert then increment
const { error } = await supabaseAdmin.rpc('increment_query_count', {
  p_company_id: companyId,
  p_month: monthStr,
})

  if (error) {
    const { data } = await supabaseAdmin
      .from('query_usage')
      .select('query_count')
      .eq('company_id', companyId)
      .eq('month', monthStr)
      .single()

    const newCount = (data?.query_count || 0) + 1

    await supabaseAdmin
      .from('query_usage')
      .upsert(
        {
          company_id: companyId,
          month: monthStr,
          query_count: newCount,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'company_id,month' }
      )
  }

  // ✅ CLOSE THE FUNCTION BEFORE EXPORT
  }
export async function logError(params: {  companyId?: string
  userId?: string
  route?: string
  errorType?: string
  message: string
  stack?: string
  context?: any
  severity?: 'info'|'warn'|'error'|'critical'
}) {
const { error } = await supabaseAdmin.from('error_log').insert({
  company_id: params.companyId,
  user_id: params.userId,
  route: params.route,
  message: params.message,
  context: params.context,
  severity: params.severity || 'error',
})

if (error) {
 
} // swallow error intentionally
}
