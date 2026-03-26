// lib/email.ts
// Email via Resend. Gracefully stubs out when RESEND_API_KEY is not set.
// Set RESEND_API_KEY=re_xxx in .env.local to activate.

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM = process.env.RESEND_FROM_EMAIL || 'Qwezy <admin@qwezy.io>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log(`[EMAIL STUB] To: ${to} | Subject: ${subject}`)
    return false
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    })
    return res.ok
  } catch (err) {
    console.error('[EMAIL ERROR]', err)
    return false
  }
}

function baseTemplate(content: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>
    body{font-family:Inter,-apple-system,sans-serif;background:#F9FAFB;margin:0;padding:40px 20px}
    .card{background:#fff;border-radius:12px;border:1px solid #E5E7EB;max-width:520px;margin:0 auto;overflow:hidden}
    .header{background:#022c22;padding:24px 32px;display:flex;align-items:center;gap:10px}
    .logo{width:32px;height:32px;background:linear-gradient(135deg,#10B981,#059669);border-radius:7px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;font-family:monospace}
    .brand{color:#fff;font-weight:800;font-size:18px;letter-spacing:-0.3px}
    .body{padding:32px}
    .btn{display:inline-block;background:#059669;color:#fff;text-decoration:none;border-radius:8px;padding:13px 28px;font-weight:700;font-size:15px;margin:20px 0}
    .footer{padding:20px 32px;border-top:1px solid #F3F4F6;font-size:12px;color:#9CA3AF;text-align:center}
    h1{font-size:22px;font-weight:700;color:#0F1923;margin:0 0 8px}
    p{color:#4B5563;line-height:1.65;margin:0 0 16px;font-size:15px}
    .note{font-size:13px;color:#9CA3AF}
  </style></head><body>
    <div class="card">
      <div class="header">
        <div class="logo">{ }</div>
        <div class="brand">Qwezy</div>
      </div>
      <div class="body">${content}</div>
      <div class="footer">Qwezy Inc. &nbsp;|&nbsp; qwezy.io &nbsp;|&nbsp; <a href="${APP_URL}/unsubscribe" style="color:#9CA3AF">Unsubscribe</a></div>
    </div>
  </body></html>`
}

export async function sendMagicLink(email: string, link: string): Promise<boolean> {
  return sendEmail(email, 'Your Qwezy login link', baseTemplate(`
    <h1>Log in to Qwezy</h1>
    <p>Click the button below to log in. This link works anytime - bookmark it for easy return access.</p>
    <a href="${link}" class="btn">Open Qwezy</a>
    <p class="note">If you didn't request this, you can safely ignore it. The link is tied to your email address only.</p>
  `))
}

export async function sendDemoAccess(email: string, name: string, loginLink: string): Promise<boolean> {
  const firstName = name.split(' ')[0]
  return sendEmail(email, 'Your Qwezy demo is ready', baseTemplate(`
    <h1>Welcome, ${firstName}</h1>
    <p>Your live Qwezy demo environment is ready. You're exploring a real SaaS analytics database with real data - ask it anything.</p>
    <a href="${loginLink}" class="btn">Open live demo</a>
    <p>Some questions to try:</p>
    <ul style="color:#4B5563;line-height:2;font-size:14px;padding-left:20px">
      <li>What was total MRR last month?</li>
      <li>Which customers churned this quarter?</li>
      <li>Who are our top 10 customers by revenue?</li>
    </ul>
    <p class="note">This link works anytime - bookmark it. We'll reach out to discuss connecting your own data.</p>
  `))
}

export async function sendInvite(email: string, companyName: string, inviterName: string, inviteLink: string): Promise<boolean> {
  return sendEmail(email, `${inviterName} invited you to ${companyName} on Qwezy`, baseTemplate(`
    <h1>You've been invited</h1>
    <p><strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> on Qwezy - the plain English SQL platform.</p>
    <a href="${inviteLink}" class="btn">Accept invitation</a>
    <p class="note">This invitation expires in 7 days. If you weren't expecting this, you can safely ignore it.</p>
  `))
}

export async function sendScheduledReport(
  email: string, reportName: string, companyName: string,
  rows: any[], fields: string[], ranAt: string
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log(`[EMAIL STUB] Scheduled report "${reportName}" to ${email}`)
    return false
  }

  const tableRows = rows.slice(0,20).map(row =>
    `<tr>${fields.map(f=>`<td style="padding:7px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;color:#374151">${row[f]??''}</td>`).join('')}</tr>`
  ).join('')

  const table = `<table style="width:100%;border-collapse:collapse;margin:16px 0">
    <thead><tr>${fields.map(f=>`<th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #E5E7EB">${f}</th>`).join('')}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>${rows.length>20?`<p style="font-size:12px;color:#9CA3AF">Showing 20 of ${rows.length} rows. <a href="${APP_URL}/dashboard">View full results in Qwezy</a></p>`:''}`

  return sendEmail(email, `${reportName} - ${new Date(ranAt).toLocaleDateString('en-US',{month:'short',day:'numeric'})}`, baseTemplate(`
    <h1>${reportName}</h1>
    <p style="font-size:13px;color:#9CA3AF;margin-bottom:20px">${companyName} &nbsp;|&nbsp; Run at ${new Date(ranAt).toLocaleString()}</p>
    ${table}
    <a href="${APP_URL}/dashboard" style="font-size:13px;color:#059669;font-weight:600">Open in Qwezy →</a>
  `))
}

export async function sendPasswordReset(email: string, resetLink: string): Promise<boolean> {
  return sendEmail(email, 'Reset your Qwezy password', baseTemplate(`
    <h1>Reset your password</h1>
    <p>Click below to set a new password for your Qwezy account.</p>
    <a href="${resetLink}" class="btn">Reset password</a>
    <p class="note">This link expires in 1 hour. If you didn't request a reset, you can safely ignore this.</p>
  `))
}
