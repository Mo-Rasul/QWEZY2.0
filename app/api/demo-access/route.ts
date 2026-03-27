// app/api/demo-access/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'

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

    // 3. Send email with credentials + auto-login link
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qwezy.io'
    const loginLink = `${siteUrl}/demo-login?e=${encodeURIComponent(email)}`
    const RESEND_API_KEY = process.env.RESEND_API_KEY

    if (RESEND_API_KEY) {
      // Welcome email to user
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Qwezy <admin@qwezy.io>',
          to: email,
          subject: 'Your Qwezy demo is ready',
          html: `
            <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #E5E7EB;overflow:hidden">
              <div style="background:#022c22;padding:20px 28px;display:flex;align-items:center;gap:10px">
                <div style="width:32px;height:32px;background:linear-gradient(135deg,#10B981,#059669);border-radius:7px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-family:monospace;font-size:12px">{ }</div>
                <span style="color:#fff;font-weight:800;font-size:18px">Qwezy</span>
              </div>
              <div style="padding:32px 28px">
                <h1 style="font-size:22px;font-weight:700;color:#0F1923;margin:0 0 8px">Welcome, ${name.split(' ')[0]}</h1>
                <p style="color:#4B5563;line-height:1.65;margin:0 0 24px">Your live demo environment is ready. Click below to log in and start querying a real SaaS analytics database.</p>
                <a href="${loginLink}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;border-radius:8px;padding:13px 28px;font-weight:700;font-size:15px;margin-bottom:24px">Open live demo</a>
                <div style="background:#F9FAFB;border-radius:8px;padding:16px;margin-bottom:24px">
                  <div style="font-size:12px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px">Your login credentials</div>
                  <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #F3F4F6">
                    <span style="color:#4B5563;font-size:13px">Email</span>
                    <span style="color:#0F1923;font-weight:600;font-size:13px;font-family:monospace">${email}</span>
                  </div>
                  <div style="display:flex;justify-content:space-between;padding:6px 0">
                    <span style="color:#4B5563;font-size:13px">Password</span>
                    <span style="color:#0F1923;font-weight:600;font-size:13px;font-family:monospace">${DEMO_PASSWORD}</span>
                  </div>
                </div>
                <p style="color:#4B5563;font-size:14px;margin:0 0 8px">Try asking:</p>
                <ul style="color:#4B5563;font-size:13px;line-height:2;padding-left:20px;margin:0 0 24px">
                  <li>What was total MRR last month?</li>
                  <li>Who are our top 10 customers by revenue?</li>
                  <li>Which customers churned this quarter?</li>
                </ul>
                <p style="color:#9CA3AF;font-size:12px;margin:0">We will reach out to discuss connecting your own data.</p>
              </div>
            </div>
          `
        })
      })

      // Admin notification
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Qwezy <admin@qwezy.io>', to: 'admin@qwezy.io',
          subject: `New demo signup: ${name} from ${company || 'unknown'}`,
          html: `<p><strong>${name}</strong> (${email})<br>Company: ${company || '—'} | Role: ${role || '—'} | Team: ${teamSize || '—'}<br>Use case: ${useCase || '—'}</p>`
        })
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, immediateLogin: false })

  } catch (err: any) {
    console.error('Demo access error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
