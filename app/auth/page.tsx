'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const C = {
  accent:'#059669', accentDark:'#047857', accentBg:'#ECFDF5',
  text:'#0F1923', textMuted:'#4B5563', textLight:'#9CA3AF',
  danger:'#EF4444', navBg:'#022c22',
}

export default function AuthPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'signin'|'reset'>('signin')
  const [resetSent, setResetSent] = useState(false)

  // ← ADD THIS BLOCK HERE
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('access_token')) return
    const params = new URLSearchParams(hash.replace('#', ''))
    const accessToken = params.get('access_token')
    if (!accessToken) return
    setLoading(true)
    fetch('/api/auth/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: accessToken, email: '' })
    }).then(res => res.json()).then(data => {
      if (data.ok) {
        window.location.href = '/dashboard'
      } else {
        setError('Link expired. Please request a new one.')
        setLoading(false)
      }
    }).catch(() => {
      setError('Something went wrong.')
      setLoading(false)
    })
  }, [])





  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'signin', email, password }),
      })
      const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Sign in failed')
    } else if (data.master) {
      window.location.href = '/master'
    } else {
      window.location.href = '/dashboard'
    }
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setResetSent(true)
    } catch {}
    setLoading(false)
  }

  return (
    <div style={{fontFamily:'Inter,-apple-system,sans-serif',background:C.navBg,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}input:focus{outline:none}`}</style>

      <div style={{width:'100%',maxWidth:400}}>
        {/* Logo */}
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{width:44,height:44,background:'linear-gradient(135deg,#10B981,#059669)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
            <span style={{color:'#fff',fontFamily:"'JetBrains Mono'",fontWeight:700,fontSize:14}}>{'{ }'}</span>
          </div>
          <div style={{fontWeight:800,fontSize:22,color:'#fff',letterSpacing:'-0.3px'}}>Qwezy</div>
        </div>

        <div style={{background:'#fff',borderRadius:14,boxShadow:'0 24px 64px rgba(0,0,0,0.3)',overflow:'hidden'}}>
          <div style={{padding:'28px 28px 24px'}}>

            {mode==='reset' ? (
              <>
                <h1 style={{fontSize:20,fontWeight:700,color:C.text,marginBottom:6}}>Reset password</h1>
                <p style={{fontSize:13.5,color:C.textLight,marginBottom:22}}>Enter your email and we'll send a reset link.</p>
                {resetSent
                  ? <div style={{padding:'14px',background:C.accentBg,border:'1px solid #A7F3D0',borderRadius:8,fontSize:14,color:C.accentDark,textAlign:'center'}}>
                      Check your email for a reset link.
                    </div>
                  : <form onSubmit={sendReset} style={{display:'flex',flexDirection:'column',gap:14}}>
                      <div>
                        <label style={{fontSize:11.5,fontWeight:600,color:C.textMuted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>Email</label>
                        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoFocus
                          style={{width:'100%',padding:'10px 13px',borderRadius:7,border:'1.5px solid #E5E7EB',fontSize:14,color:C.text,fontFamily:'Inter,sans-serif'}}
                          onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor='#E5E7EB'}/>
                      </div>
                      <button type="submit" disabled={loading||!email}
                        style={{background:C.accent,color:'#fff',border:'none',borderRadius:8,padding:'11px',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                        {loading?'Sending...':'Send reset link'}
                      </button>
                    </form>}
                <button onClick={()=>{setMode('signin');setResetSent(false)}} style={{background:'none',border:'none',color:C.textLight,cursor:'pointer',fontFamily:'Inter,sans-serif',fontSize:13,marginTop:16,display:'block',width:'100%',textAlign:'center'}}>
                  Back to sign in
                </button>
              </>
            ) : (
              <>
                <h1 style={{fontSize:20,fontWeight:700,color:C.text,marginBottom:6}}>Sign in</h1>
                <p style={{fontSize:13.5,color:C.textLight,marginBottom:22}}>Enter your email and password to continue.</p>
                {error&&<div style={{padding:'9px 12px',background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:7,fontSize:13,color:C.danger,marginBottom:14}}>{error}</div>}
                <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
                  <div>
                    <label style={{fontSize:11.5,fontWeight:600,color:C.textMuted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>Email</label>
                    <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoFocus
                      style={{width:'100%',padding:'10px 13px',borderRadius:7,border:'1.5px solid #E5E7EB',fontSize:14,color:C.text,fontFamily:'Inter,sans-serif'}}
                      onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor='#E5E7EB'}/>
                  </div>
                  <div>
                    <label style={{fontSize:11.5,fontWeight:600,color:C.textMuted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>Password</label>
                    <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required
                      style={{width:'100%',padding:'10px 13px',borderRadius:7,border:'1.5px solid #E5E7EB',fontSize:14,color:C.text,fontFamily:'Inter,sans-serif'}}
                      onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor='#E5E7EB'}/>
                  </div>
                  <button type="submit" disabled={loading||!email||!password}
                    style={{background:loading||!email||!password?'#E5E7EB':C.accent,color:loading||!email||!password?C.textLight:'#fff',border:'none',borderRadius:8,padding:'11px',fontSize:14.5,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',transition:'all .15s',marginTop:4}}>
                    {loading?'Signing in...':'Sign in'}
                  </button>
                </form>
                <button onClick={()=>setMode('reset')} style={{background:'none',border:'none',color:C.textLight,cursor:'pointer',fontFamily:'Inter,sans-serif',fontSize:13,marginTop:16,display:'block',width:'100%',textAlign:'center',textDecoration:'underline'}}>
                  Forgot password?
                </button>
              </>
            )}
          </div>

          <div style={{padding:'14px 28px',background:'#F9FAFB',borderTop:'1px solid #F3F4F6',textAlign:'center',fontSize:13,color:C.textLight}}>
            Don't have an account?{' '}
            <button onClick={()=>router.push('/')} style={{background:'none',border:'none',color:C.accent,cursor:'pointer',fontFamily:'Inter,sans-serif',fontSize:13,fontWeight:600}}>
              Request access
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
