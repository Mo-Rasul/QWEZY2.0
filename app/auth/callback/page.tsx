'use client'
// app/auth/callback/page.tsx
// Handles ALL Supabase auth redirects — magic links, recovery, invites

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

export default function AuthCallback() {
  const router = useRouter()
  const [status, setStatus] = useState('Signing you in...')

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const handleCallback = async () => {
      try {
        const hash = window.location.hash.replace('#', '')
        const params = new URLSearchParams(hash)
        const type = params.get('type')
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token') || ''
        const error = params.get('error')
        const errorDesc = params.get('error_description')

        // Handle error from Supabase
        if (error) {
          setStatus(errorDesc?.replace(/\+/g, ' ') || 'Link expired.')
          setTimeout(() => router.push('/auth'), 3000)
          return
        }

        // ── Recovery / password reset ─────────────────────────────────────
        // Redirect to update-password page WITH the tokens in the hash
        if (type === 'recovery' && accessToken) {
          router.replace(`/auth/update-password#access_token=${accessToken}&refresh_token=${refreshToken}&type=recovery`)
          return
        }

        // ── Magic link / invite ───────────────────────────────────────────
        if (!accessToken) {
          // Try getting session from Supabase directly (OAuth flow)
          const { data: { session }, error: sessionErr } = await supabase.auth.getSession()
          if (sessionErr || !session) {
            setStatus('Invalid or expired link.')
            setTimeout(() => router.push('/auth'), 2000)
            return
          }
          await saveSession(session.access_token, session.user.email || '')
          return
        }

        // Set session from hash tokens
        const { data: { session }, error: setErr } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (setErr || !session) {
          setStatus('Link expired. Please request a new one.')
          setTimeout(() => router.push('/auth'), 2000)
          return
        }

        await saveSession(session.access_token, session.user.email || '')
      } catch {
        setStatus('Something went wrong. Redirecting...')
        setTimeout(() => router.push('/auth'), 2000)
      }
    }

    const saveSession = async (token: string, email: string) => {
      setStatus('Setting up your session...')
      const res = await fetch('/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email })
      })
      const data = await res.json()
      if (data.ok) {
        setStatus('Redirecting to your dashboard...')
        router.push('/dashboard')
      } else {
        setStatus('Could not sign in. Please try again.')
        setTimeout(() => router.push('/auth'), 2000)
      }
    }

    handleCallback()
  }, [router])

  return (
    <div style={{ fontFamily: 'Inter,-apple-system,sans-serif', background: '#022c22', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, background: 'linear-gradient(135deg,#10B981,#059669)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <span style={{ color: '#fff', fontFamily: "'JetBrains Mono'", fontWeight: 700, fontSize: 14 }}>{'{ }'}</span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 8 }}>Qwezy</div>
        <div style={{ fontSize: 14, color: '#6EE7B7', marginBottom: 20 }}>{status}</div>
        <div style={{ width: 32, height: 32, border: '3px solid #064e3b', borderTop: '3px solid #10B981', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}
