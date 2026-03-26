'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const C = { accent:'#059669', text:'#0F1923', textMuted:'#4B5563', textLight:'#9CA3AF', danger:'#EF4444' }

export default function MasterLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/master/auth', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (data.ok) {
        router.push('/master')
      } else {
        setError(data.error || 'Invalid credentials')
      }
    } catch {
      setError('Something went wrong')
    }
    setLoading(false)
  }

  return (
    <div style={{fontFamily:'Inter,-apple-system,sans-serif',background:'#022c22',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}input:focus{outline:none}`}</style>
      <div style={{background:'#fff',borderRadius:14,width:'100%',maxWidth:380,boxShadow:'0 24px 64px rgba(0,0,0,0.3)',overflow:'hidden'}}>
        <div style={{background:'#022c22',padding:'24px 28px',display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:30,height:30,background:'linear-gradient(135deg,#10B981,#059669)',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{color:'#fff',fontFamily:"'JetBrains Mono'",fontWeight:700,fontSize:11}}>{'{ }'}</span>
          </div>
          <div>
            <div style={{color:'#fff',fontWeight:800,fontSize:16}}>Qwezy</div>
            <div style={{color:'#6EE7B7',fontSize:11.5,fontWeight:500}}>Master admin</div>
          </div>
        </div>
        <form onSubmit={submit} style={{padding:28,display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <div style={{fontSize:22,fontWeight:700,color:C.text,marginBottom:4}}>Sign in</div>
            <div style={{fontSize:13.5,color:C.textLight}}>Master admin access only</div>
          </div>
          {error&&<div style={{padding:'9px 12px',background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:7,fontSize:13,color:C.danger}}>{error}</div>}
          <div>
            <label style={{fontSize:11.5,fontWeight:600,color:C.textMuted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoFocus
              style={{width:'100%',padding:'9px 12px',borderRadius:7,border:'1.5px solid #E5E7EB',fontSize:14,color:C.text,fontFamily:'Inter,sans-serif'}}
              onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor='#E5E7EB'}/>
          </div>
          <div>
            <label style={{fontSize:11.5,fontWeight:600,color:C.textMuted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required
              style={{width:'100%',padding:'9px 12px',borderRadius:7,border:'1.5px solid #E5E7EB',fontSize:14,color:C.text,fontFamily:'Inter,sans-serif'}}
              onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor='#E5E7EB'}/>
          </div>
          <button type="submit" disabled={loading||!email||!password}
            style={{background:loading||!email||!password?'#E5E7EB':C.accent,color:loading||!email||!password?C.textLight:'#fff',border:'none',borderRadius:8,padding:'11px',fontSize:14.5,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',marginTop:4}}>
            {loading?'Signing in...':'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
