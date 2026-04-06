// app/api/auth/password/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-app'

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('qwezy_session')?.value
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { currentPassword, newPassword } = await req.json()
    if (!currentPassword || !newPassword) return NextResponse.json({ error: 'Both passwords required' }, { status: 400 })
    if (newPassword.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })

    // Get current user from session
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

    // Verify current password by attempting sign in
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email!, password: currentPassword })
    if (signInErr) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })

    // Update to new password using admin client
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: newPassword })
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    // Audit log
    try {
      const { data: profile } = await supabaseAdmin.from('users').select('company_id').eq('id', user.id).single()
      await supabaseAdmin.from('audit_log').insert({
        actor: user.id, action: 'user.password_changed',
        target_company: profile?.company_id || null, details: { email: user.email },
      })
    } catch {}

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
