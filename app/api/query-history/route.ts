// app/api/query-history/route.ts
// Returns recent distinct questions asked by this company — used for rotating suggestions
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('qwezy_session')?.value
    if (!token) return NextResponse.json({ questions: [] })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ questions: [] })

    const { data: profile } = await supabaseAdmin
      .from('users').select('company_id').eq('id', user.id).single()
    if (!profile?.company_id) return NextResponse.json({ questions: [] })

    // Get the last 20 queries for this company, deduplicated by question text
    const { data } = await supabaseAdmin
      .from('query_history')
      .select('natural_language, created_at, result_count')
      .eq('company_id', profile.company_id)
      .not('natural_language', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!data || data.length === 0) return NextResponse.json({ questions: [] })

    // Deduplicate — keep most recent occurrence of each unique question
    const seen = new Set<string>()
    const questions: string[] = []
    for (const row of data) {
      const q = row.natural_language?.trim()
      if (!q || seen.has(q.toLowerCase())) continue
      seen.add(q.toLowerCase())
      questions.push(q)
      if (questions.length >= 10) break
    }

    return NextResponse.json({ questions })
  } catch {
    return NextResponse.json({ questions: [] })
  }
}
