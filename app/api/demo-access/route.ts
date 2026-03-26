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
    }).then(() => {}).catch(() => {})

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
        const existing = users.find(u => u.email === email)
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

    // 5. Create a session for immediate login
    // Sign them in with a short-lived token
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.createSession({
      user_id: userId,
    } as any) // using admin API to create session without password

    if (sessionError || !sessionData) {
      // Fallback: return success but they'll need to use the magic link
      return NextResponse.json({ 
        success: true, 
        magicLinkSent: true,
        immediateLogin: false,
        message: 'Check your email for your demo link'
      })
    }

    // Return session for immediate login
    const res = NextResponse.json({
      success: true,
      magicLinkSent: true,
      immediateLogin: true,
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
      }
    })

    // Set session cookies so they're logged in immediately
    res.cookies.set('qwezy_session', sessionData.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    res.cookies.set('qwezy_company', DEMO_COMPANY_ID, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return res

  } catch (err: any) {
    console.error('Demo access error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
