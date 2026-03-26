// app/api/master/auth/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-app'

const MASTER_EMAIL    = process.env.MASTER_EMAIL!
const MASTER_PASSWORD = process.env.MASTER_PASSWORD!
const MASTER_TOKEN    = 'qwezy_master_session'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (email !== MASTER_EMAIL || password !== MASTER_PASSWORD) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }
  // Log the login
  await supabaseAdmin.from('audit_log').insert({
    actor: 'master', action: 'master_login', details: { email }
  }).catch(()=>{})

  const res = NextResponse.json({ ok: true })
  res.cookies.set(MASTER_TOKEN, btoa(`${email}:${Date.now()}`), {
    httpOnly: true, secure: process.env.NODE_ENV==='production',
    sameSite: 'lax', maxAge: 60*60*8, path: '/'
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('qwezy_master_session')
  return res
}

export function verifyMasterToken(req: NextRequest): boolean {
  const token = req.cookies.get('qwezy_master_session')?.value
  if (!token) return false
  try {
    const decoded = atob(token)
    const [email] = decoded.split(':')
    return email === process.env.MASTER_EMAIL
  } catch { return false }
}
