// app/api/auth/reset/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Supabase sends the reset email automatically
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/update-password`,
  })

  // Always return success to avoid email enumeration
  return NextResponse.json({ ok: true })
}
