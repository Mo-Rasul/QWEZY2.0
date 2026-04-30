// app/api/usage/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('qwezy_session')?.value
  if (!token) return NextResponse.json({ count: 0 })
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ count: 0 })
    const { data: profile } = await supabaseAdmin.from('users').select('company_id').eq('id', user.id).single()
    if (!profile?.company_id) return NextResponse.json({ count: 0 })
    // Count queries this calendar month
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0)
    const { count } = await supabaseAdmin.from('query_usage')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', profile.company_id)
      .gte('created_at', startOfMonth.toISOString())
    return NextResponse.json({ count: count || 0 })
  } catch { return NextResponse.json({ count: 0 }) }
}
