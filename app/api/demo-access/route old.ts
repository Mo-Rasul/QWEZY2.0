// app/api/demo-access/route.ts
// Called when someone submits the lead form.
// 1. Saves the lead
// 2. Creates/finds their Supabase auth user
// 3. Assigns them to the Velo demo company
// 4. Sends them a magic link email for future access
// 5. Returns a session token so they log in immediately

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'

const DEMO_COMPANY_ID = '4dd68cdf-b52f-4a91-aae1-51ffbc9423db' // Velo

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, email, company, role, teamSize, industry, useCase, message } = body

  if (!email || !name) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
  }

  try {
    // 1. Save lead (fire and forget — don't let this block login)
    supabaseAdmin.from('leads' as any).insert({
      name, email, company, role,
      team_size: teamSize, industry,
      use_case: useCase, message,
    }).then(() => {}, () => {})

    // 2. Check if user already exists in our users table
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    let userId: string

    if (existingUser) {
      // Returning visitor — just resend magic link, don't recreate
      userId = existingUser.id
    } else {
      // New visitor — create auth user with a random secure password
      // They'll never use the password — magic link is how they log in
      const randomPass = crypto.randomUUID() + crypto.randomUUID()

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: randomPass,
        email_confirm: true, // auto-confirm — no verification needed
        user_metadata: { name, company },
      })

      if (authError) {
        // User might already exist in auth but not in our table
        // Try to find them by email in auth
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
        const existing = users.find((u: any) => u.email === email)
        if (!existing) {
          return NextResponse.json({ error: 'Could not create account' }, { status: 500 })
        }
        userId = existing.id
      } else {
        userId = authData.user.id
      }

      // 3. Create user row assigned to Velo demo company
      await supabaseAdmin.from('users').upsert({
        id: userId,
        company_id: DEMO_COMPANY_ID,
        email,
        name,
        role: 'analyst',
        status: 'active',
      }, { onConflict: 'id' })
    }

    // 4. Send magic link email (works for both new and returning)
    // Using Supabase's built-in OTP — arrives as a clickable link
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${siteUrl}/dashboard`,
      },
    })
    // Note: generateLink returns the link but doesn't send the email automatically
    // To send the email, use the regular (non-admin) client:
    const supabasePublic = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabasePublic.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // user already exists
        emailRedirectTo: `${siteUrl}/dashboard`,
      },
    })

    // 5. Return success — user gets in via magic link email
        return NextResponse.json({
          success: true,
          magicLinkSent: true,
          immediateLogin: false,
        })

  } catch (err: any) {
    console.error('Demo access error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
