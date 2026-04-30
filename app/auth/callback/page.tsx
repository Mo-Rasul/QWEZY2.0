'use client'
// app/auth/callback/page.tsx
// Handles Supabase email link redirects (password reset + invite links).
// After the session cookie is set, decides where to send the user.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

export default function AuthCallback() {
  const router = useRouter()
  const [message, setMessage] = useState('Setting up your account…')

  useEffect(() => {
    const handle = async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      // Parse the session from the URL hash/query that Supabase puts there
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        setMessage('Invalid or expired link. Redirecting to login…')
        setTimeout(() => router.push('/login'), 2000)
        return
      }

      // Hand the token to our API to set the httpOnly cookie
      try {
        await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: session.access_token }),
        })
      } catch {}

      // Fetch user profile to decide where to route
      try {
        const res = await fetch('/api/auth')
        if (res.ok) {
          const user = await res.json()
          if (!user.db_connected) {
            // Admin with no DB → connect page
            if (user.role === 'admin') {
              setMessage('Almost there — just connect your database…')
              router.push('/connect')
            } else {
              // Non-admin with no DB — dashboard will show the right empty state
              router.push('/dashboard')
            }
          } else {
            router.push('/dashboard')
          }
          return
        }
      } catch {}

      // Fallback
      router.push('/dashboard')
    }

    handle()
  }, [router])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, sans-serif', background: '#F6F9FC',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#059669', marginBottom: 24 }}>Qwezy</div>
        <div style={{
          width: 36, height: 36, border: '3px solid #E3EAF2',
          borderTopColor: '#059669', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 20px',
        }}/>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <p style={{ fontSize: 14, color: '#4B6358' }}>{message}</p>
      </div>
    </div>
  )
}
