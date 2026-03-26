// app/api/master/auth/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-app'

const MASTER_TOKEN = 'qwezy_master_session'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (email !== process.env.MASTER_EMAIL || password !== process.env.MASTER_PASSWORD) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }
  try {
    await supabaseAdmin.from('audit_log').insert({
      actor: 'master', action: 'master_login', details: { email }
    })
  } catch {}

  const res = NextResponse.json({ ok: true })
  res.cookies.set(MASTER_TOKEN, btoa(`${email}:${Date.now()}`), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('qwezy_master_session')
  return res
}
