'use client'
// app/auth/update-password/page.tsx
// Handles Supabase password reset links
// URL arrives as: /auth/update-password#access_token=...&type=recovery

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const C = {
  bg: '#022c22', accent: '#059669', accentLight: '#10B981',
  card: '#fff', text: '#0F1923', muted: '#6B7280', border: '#E5E7EB',
  danger: '#EF4444',
}

export default function UpdatePassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<'loading'|'form'|'success'|'error'>('loading')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [showPw, setShowPw] = useState(false)

  useEffect(() => {
    // Supabase puts the tokens in the URL hash: #access_token=...&type=recovery
    const hash = window.location.hash.replace('#', '')
    const params = new URLSearchParams(hash)
    const error = params.get('error')
    const errorDesc = params.get('error_description')
    const type = params.get('type')
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token') || ''

    if (error) {
      setStatus('error')
      setMessage(errorDesc?.replace(/\+/g, ' ') || 'This link is invalid or has expired.')
      return
    }

    if (!accessToken || type !== 'recovery') {
      setStatus('error')
      setMessage('Invalid link. Please request a new password reset.')
      return
    }

    // Set the session so we can call updateUser
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error: sessionErr }) => {
        if (sessionErr) {
          setStatus('error')
          setMessage('Link expired. Please request a new one.')
        } else {
          setStatus('form')
        }
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setMessage('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setMessage('Passwords do not match.'); return }
    setMessage('')
    setSaving(true)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setMessage(error.message)
      setSaving(false)
      return
    }

    // Now set our httpOnly session cookie via backend
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await fetch('/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: session.access_token, email: session.user.email })
      })
    }

    setStatus('success')
    setSaving(false)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  return (
    <div style={{ fontFamily: 'Inter,-apple-system,sans-serif', background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: C.card, borderRadius: 16, width: '100%', maxWidth: 400, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>

        {/* Header */}
        <div style={{ background: C.bg, padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#10B981,#059669)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontFamily: "'JetBrains Mono'", fontWeight: 700, fontSize: 13 }}>{'{ }'}</span>
          </div>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 20, letterSpacing: '-0.3px' }}>Qwezy</span>
        </div>

        <div style={{ padding: '32px 28px' }}>

          {/* Loading */}
          {status === 'loading' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTop: `3px solid ${C.accent}`, borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 16px' }} />
              <div style={{ color: C.muted, fontSize: 14 }}>Verifying your link…</div>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>Link expired</div>
              <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 24 }}>{message}</div>
              <button onClick={() => router.push('/')}
                style={{ width: '100%', padding: '11px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                Back to sign in
              </button>
            </div>
          )}

          {/* Form */}
          {status === 'form' && (
            <form onSubmit={handleSubmit}>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 6, letterSpacing: '-0.3px' }}>Set your password</div>
              <div style={{ fontSize: 14, color: C.muted, marginBottom: 28, lineHeight: 1.6 }}>Choose a password to secure your Qwezy account.</div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>New password</div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    style={{ width: '100%', padding: '11px 40px 11px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 14, color: C.text, fontFamily: 'Inter,sans-serif', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = C.accent}
                    onBlur={e => e.target.style.borderColor = C.border}
                  />
                  <button type="button" onClick={() => setShowPw(s => !s)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 13, padding: 0 }}>
                    {showPw ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confirm password</div>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat your password"
                  required
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 8, border: `1.5px solid ${confirm && confirm !== password ? C.danger : C.border}`, fontSize: 14, color: C.text, fontFamily: 'Inter,sans-serif', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = C.accent}
                  onBlur={e => e.target.style.borderColor = confirm && confirm !== password ? C.danger : C.border}
                />
              </div>

              {message && (
                <div style={{ padding: '10px 14px', background: '#FEF2F2', border: `1px solid #FECACA`, borderRadius: 8, fontSize: 13, color: C.danger, marginBottom: 16 }}>
                  {message}
                </div>
              )}

              <button type="submit" disabled={saving}
                style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: saving ? '#E5E7EB' : C.accent, color: saving ? C.muted : '#fff', fontSize: 15, fontWeight: 600, cursor: saving ? 'default' : 'pointer', fontFamily: 'Inter,sans-serif' }}>
                {saving ? 'Setting password…' : 'Set password & sign in'}
              </button>
            </form>
          )}

          {/* Success */}
          {status === 'success' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, background: '#ECFDF5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>✓</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>Password set!</div>
              <div style={{ fontSize: 14, color: C.muted }}>Taking you to your dashboard…</div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
