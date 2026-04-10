// app/api/company/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('qwezy_session')?.value
  if (!token) return NextResponse.json({ needs_onboarding: false })

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !user) return NextResponse.json({ needs_onboarding: false })

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (profileErr || !profile?.company_id) {
      return NextResponse.json({ needs_onboarding: false, has_db: false })
    }

    const { data: company, error: companyErr } = await supabaseAdmin
      .from('companies')
      .select('db_connection_string, name')
      .eq('id', profile.company_id)
      .single()

    if (companyErr || !company) {
      return NextResponse.json({ needs_onboarding: true, has_db: false, company_name: '' })
    }

    const has_db = !!company.db_connection_string
    return NextResponse.json({
      needs_onboarding: !has_db,
      has_db,
      company_name: company.name || '',
    })

  } catch (err: any) {
    console.error('Status check error:', err.message)
    return NextResponse.json({ needs_onboarding: true, has_db: false, company_name: '' })
  }
}
