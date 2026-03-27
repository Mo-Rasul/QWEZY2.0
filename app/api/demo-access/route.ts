// app/api/demo-access/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'
import { sendDemoAccess } from '@/lib/email'

const DEMO_COMPANY_ID = '4dd68cdf-b52f-4a91-aae1-51ffbc9423db' // Velo

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

    // 2. Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    let userId: string

    if (existingUser) {
      userId = existingUser.id
    } else {
      // Create auth user
      const randomPass = crypto.randomUUID() + crypto.randomUUID()
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: randomPass,
        email_confirm: true,
        user_metadata: { name, company },
      })

      if (authError) {
        // Try to find existing auth user
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
        const existing = users.find((u: any) => u.email === email)
        if (!existing) {
          return NextResponse.json({ error: 'Could not create account' }, { status: 500 })
        }
        userId = existing.id
      } else {
        userId = authData.user.id
      }

      // Assign to Velo demo company
      await supabaseAdmin.from('users').upsert({
        id: userId,
        company_id: DEMO_COMPANY_ID,
        email, name,
        role: 'analyst',
        status: 'active',
      }, { onConflict: 'id' })
    }

    // 3. Generate magic link via Supabase
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qwezy.io'
    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${siteUrl}/auth/callback` },  // ← change /dashboard to /auth/callback
    })

    const magicLink = linkData?.properties?.action_link || `${siteUrl}/auth`
    console.log('Magic link generated:', magicLink)
    console.log('Sending to:', email)

    // 4. Send branded email via Resend with the magic link
    await sendDemoAccess(email, name, magicLink)

    // 5. Also send notification email to admin
    const RESEND_API_KEY = process.env.RESEND_API_KEY
    if (RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Qwezy <admin@qwezy.io>`,
          to: 'admin@qwezy.io',
          subject: `New demo signup: ${name} from ${company || 'unknown'}`,
          html: `<p><strong>${name}</strong> (${email}) just signed up for a demo.</p>
                 <p>Company: ${company || '—'}</p>
                 <p>Role: ${role || '—'}</p>
                 <p>Team size: ${teamSize || '—'}</p>
                 <p>Industry: ${industry || '—'}</p>
                 <p>Use case: ${useCase || '—'}</p>
                 <p><a href="${siteUrl}/master">View in master admin</a></p>`
        })
      }).catch(() => {})
    }

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
