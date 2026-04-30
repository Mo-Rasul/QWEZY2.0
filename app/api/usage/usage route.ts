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

    const { data: profile } = await supabaseAdmin
      .from('users').select('company_id').eq('id', user.id).single()
    if (!profile?.company_id) return NextResponse.json({ count: 0 })

    // Sum query_count for current month across all users in the company
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`

    const { data } = await supabaseAdmin
      .from('query_usage')
      .select('query_count')
      .eq('company_id', profile.company_id)
      .eq('month', month)

    const total = (data || []).reduce((sum, row) => sum + (row.query_count || 0), 0)
    return NextResponse.json({ count: total })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}