'use client'
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
        // Get session from URL hash (magic link format)
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error || !session) {
          // Try exchanging the hash tokens manually
          const hash = window.location.hash
          const params = new URLSearchParams(hash.replace('#', ''))
          const accessToken = params.get('access_token')
          const refreshToken = params.get('refresh_token')

          if (!accessToken) {
            setStatus('Invalid or expired link. Redirecting...')
            setTimeout(() => router.push('/auth'), 2000)
            return
          }

          const { data: { session: newSession }, error: setErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          })

          if (setErr || !newSession) {
            setStatus('Link expired. Please request a new one.')
            setTimeout(() => router.push('/'), 2000)
            return
          }

          // Save session to our backend
          await saveSession(newSession.access_token, newSession.user.email || '')
          return
        }

        await saveSession(session.access_token, session.user.email || '')
      } catch (err) {
        setStatus('Something went wrong. Redirecting...')
        setTimeout(() => router.push('/auth'), 2000)
      }
    }

    const saveSession = async (token: string, email: string) => {
      setStatus('Setting up your session...')
      // Call our backend to set the httpOnly cookie
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
        setTimeout(() => router.push('/'), 2000)
      }
    }

    handleCallback()
  }, [router])

  return (
    <div style={{fontFamily:'Inter,-apple-system,sans-serif',background:'#022c22',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:44,height:44,background:'linear-gradient(135deg,#10B981,#059669)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px'}}>
          <span style={{color:'#fff',fontFamily:"'JetBrains Mono'",fontWeight:700,fontSize:14}}>{'{ }'}</span>
        </div>
        <div style={{fontSize:16,fontWeight:600,color:'#fff',marginBottom:8}}>Qwezy</div>
        <div style={{fontSize:14,color:'#6EE7B7'}}>{status}</div>
        <div style={{width:32,height:32,border:'3px solid #064e3b',borderTop:'3px solid #10B981',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'20px auto 0'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}
