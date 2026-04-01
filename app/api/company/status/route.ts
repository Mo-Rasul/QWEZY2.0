// app/api/company/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('qwezy_session')?.value
    if (!token) return NextResponse.json({ needs_onboarding: false })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ needs_onboarding: false })

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    // No company = demo user, no onboarding needed
    if (!profile?.company_id) return NextResponse.json({ needs_onboarding: false, has_db: false })

    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('db_connection_string')
      .eq('id', profile.company_id)
      .single()

    const has_db = !!company?.db_connection_string
    return NextResponse.json({ needs_onboarding: !has_db, has_db })

  } catch {
    return NextResponse.json({ needs_onboarding: false })
  }
}
