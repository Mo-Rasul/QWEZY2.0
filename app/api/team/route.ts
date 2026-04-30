// app/api/team/route.ts
// Returns active users in the current user's company with current-cycle query counts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('qwezy_session')?.value
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: NO_STORE_HEADERS })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401, headers: NO_STORE_HEADERS })
    }

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) {
      return NextResponse.json({ users: [] }, { headers: NO_STORE_HEADERS })
    }

    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role, status, last_seen, created_at')
      .eq('company_id', profile.company_id)
      .eq('status', 'active')
      .order('created_at', { ascending: true })

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500, headers: NO_STORE_HEADERS })
    }

    const now = new Date()
    const month = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    ).toISOString().slice(0, 10)

    const { data: usageRows, error: usageError } = await supabaseAdmin
      .from('query_usage')
      .select('user_id, query_count')
      .eq('company_id', profile.company_id)
      .eq('month', month)

    if (usageError) {
      return NextResponse.json({ error: usageError.message }, { status: 500, headers: NO_STORE_HEADERS })
    }

    const usageByUser = new Map<string, number>()
    for (const row of usageRows || []) {
      usageByUser.set(row.user_id, (usageByUser.get(row.user_id) || 0) + (row.query_count || 0))
    }

    return NextResponse.json(
      {
        users: (users || []).map((u: any) => ({
          ...u,
          queries: usageByUser.get(u.id) || 0,
        })),
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}