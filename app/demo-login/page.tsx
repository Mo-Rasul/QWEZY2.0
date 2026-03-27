'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DemoLogin() {
  const router = useRouter()
  const [status, setStatus] = useState('Logging you in...')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const email = params.get('e')
    if (!email) { router.push('/'); return }

    fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'signin',
        email: decodeURIComponent(email),
        password: process.env.NEXT_PUBLIC_DEMO_PASSWORD || 'QwezyDemo2026!'
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.ok || data.user) {
        setStatus('Welcome to Qwezy! Redirecting...')
        window.location.href = '/dashboard'
      } else {
        setStatus('Link expired. Please sign up again.')
        setTimeout(() => router.push('/'), 2500)
      }
    })
    .catch(() => {
      setStatus('Something went wrong.')
      setTimeout(() => router.push('/'), 2500)
    })
  }, [router])

  return (
    <div style={{fontFamily:'Inter,-apple-system,sans-serif',background:'#022c22',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:44,height:44,background:'linear-gradient(135deg,#10B981,#059669)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px'}}>
          <span style={{color:'#fff',fontFamily:"'JetBrains Mono'",fontWeight:700,fontSize:14}}>{'{ }'}</span>
        </div>
        <div style={{fontSize:16,fontWeight:600,color:'#fff',marginBottom:8}}>Qwezy</div>
        <div style={{fontSize:14,color:'#6EE7B7',marginBottom:20}}>{status}</div>
        <div style={{width:28,height:28,border:'3px solid #064e3b',borderTop:'3px solid #10B981',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}
