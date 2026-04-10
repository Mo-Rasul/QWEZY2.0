// app/api/team/route.ts
// Returns all users in the current user's company
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('qwezy_session')?.value
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

    const { data: profile } = await supabaseAdmin
      .from('users').select('company_id, role').eq('id', user.id).single()

    if (!profile?.company_id) return NextResponse.json({ users: [] })

    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role, status, last_seen, created_at')
      .eq('company_id', profile.company_id)
      .eq('status', 'active')
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ users: users || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
