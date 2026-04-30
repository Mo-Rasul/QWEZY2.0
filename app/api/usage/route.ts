// app/api/usage/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('qwezy_session')?.value
  if (!token) {
    return NextResponse.json({ count: 0 }, { headers: NO_STORE_HEADERS })
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) {
      return NextResponse.json({ count: 0 }, { headers: NO_STORE_HEADERS })
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (profileError) throw profileError

    if (!profile?.company_id) {
      return NextResponse.json({ count: 0 }, { headers: NO_STORE_HEADERS })
    }

    const now = new Date()
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    ).toISOString().slice(0, 10)

    const { data, error } = await supabaseAdmin
      .from('query_usage')
      .select('query_count')
      .eq('company_id', profile.company_id)
      .eq('month', monthStart)

    if (error) throw error

    const total = (data || []).reduce((sum, row) => sum + (row.query_count || 0), 0)

    return NextResponse.json({ count: total }, { headers: NO_STORE_HEADERS })
  } catch (err: any) {
    console.error('Usage route error:', err?.message || err, err)
    return NextResponse.json(
      { count: 0, error: err?.message || 'Failed to load usage' },
      { headers: NO_STORE_HEADERS }
    )
  }
}
