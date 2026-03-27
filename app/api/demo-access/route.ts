// app/api/demo-access/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'
import { sendDemoAccess } from '@/lib/email'

const DEMO_COMPANY_ID = '4dd68cdf-b52f-4a91-aae1-51ffbc9423db'
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || 'QwezyDemo2026!'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, email, company, role, teamSize, industry, useCase, message } = body

  if (!email || !name) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
  }

  try {
    // 1. Save lead
    try {
      await supabaseAdmin.from('leads' as any).insert({
        name, email, company, role,
        team_size: teamSize, industry,
        use_case: useCase, message,
      })
    } catch {}

    // 2. Create or find user
    let userId: string
    const { data: existingUser } = await supabaseAdmin
      .from('users').select('id').eq('email', email).single()

    if (existingUser) {
      userId = existingUser.id
      await supabaseAdmin.auth.admin.updateUserById(userId, { password: DEMO_PASSWORD })
    } else {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email, password: DEMO_PASSWORD, email_confirm: true,
        user_metadata: { name, company },
      })
      if (authError) {
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
        const existing = users.find((u: any) => u.email === email)
        if (!existing) return NextResponse.json({ error: 'Could not create account' }, { status: 500 })
        userId = existing.id
        await supabaseAdmin.auth.admin.updateUserById(userId, { password: DEMO_PASSWORD })
      } else {
        userId = authData.user.id
      }
      await supabaseAdmin.from('users').upsert({
        id: userId, company_id: DEMO_COMPANY_ID,
        email, name, role: 'analyst', status: 'active',
      }, { onConflict: 'id' })
    }

    // 3. Sign in to get session
    const supabasePublic = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: signInData, error: signInError } = await supabasePublic.auth.signInWithPassword({
      email, password: DEMO_PASSWORD
    })

    // 4. Notifications
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qwezy.io'
    const RESEND_API_KEY = process.env.RESEND_API_KEY
    if (RESEND_API_KEY) {
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Qwezy <admin@qwezy.io>', to: 'admin@qwezy.io',
          subject: `New demo signup: ${name} from ${company || 'unknown'}`,
          html: `<p><strong>${name}</strong> (${email})<br>Company: ${company || '—'} | Role: ${role || '—'}<br>Use case: ${useCase || '—'}</p><p><a href="${siteUrl}/master">View in master admin</a></p>`
        })
      }).catch(() => {})
    }
    try { await sendDemoAccess(email, name, `${siteUrl}/dashboard`) } catch {}

    // 5. Return token to frontend — let frontend set it via /api/auth/callback
    if (!signInError && signInData?.session) {
      return NextResponse.json({
        ok: true,
        immediateLogin: true,
        token: signInData.session.access_token,
        companyId: DEMO_COMPANY_ID,
      })
    }

    return NextResponse.json({ success: true, immediateLogin: false })

  } catch (err: any) {
    console.error('Demo access error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
