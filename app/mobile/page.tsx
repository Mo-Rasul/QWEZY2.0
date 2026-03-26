'use client'
import { useState } from 'react'

export default function MobileLanding() {
  const [form, setForm] = useState({ name:'', email:'', company:'' })
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/demo-access', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ ...form, role:'Other', teamSize:'2-5' })
      })
      setSent(true)
    } catch { setSent(true) }
    setLoading(false)
  }

  return (
    <div style={{fontFamily:'Inter,-apple-system,sans-serif',background:'#fff',minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}`}</style>

      <div style={{background:'#022c22',padding:'16px 20px',display:'flex',alignItems:'center',gap:9}}>
        <div style={{width:28,height:28,background:'linear-gradient(135deg,#10B981,#059669)',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <span style={{color:'#fff',fontFamily:"'JetBrains Mono'",fontWeight:700,fontSize:11}}>{'{ }'}</span>
        </div>
        <span style={{fontWeight:800,fontSize:18,color:'#fff'}}>Qwezy</span>
      </div>

      <div style={{flex:1,padding:'32px 24px',display:'flex',flexDirection:'column',gap:24}}>
        <div>
          <h1 style={{fontSize:34,fontWeight:800,color:'#0F1923',letterSpacing:'-1px',lineHeight:1.1,marginBottom:14}}>
            Ask your data<br/><span style={{color:'#059669'}}>anything.</span>
          </h1>
          <p style={{fontSize:15,color:'#4B5563',lineHeight:1.65}}>
            Qwezy translates plain English into SQL - giving your whole team instant answers without writing a single line of code.
          </p>
        </div>

        <div style={{padding:'16px',background:'#F8FAFD',border:'1px solid #E5E7EB',borderRadius:10,textAlign:'center'}}>
          <div style={{fontSize:22,marginBottom:8}}>💻</div>
          <div style={{fontSize:14.5,fontWeight:600,color:'#0F1923',marginBottom:6}}>Best experienced on desktop</div>
          <div style={{fontSize:13.5,color:'#4B5563',lineHeight:1.6}}>Sign up now and we'll send you a link for when you're at your desk.</div>
        </div>

        {!sent ? (
          <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:12}}>
            {[['name','Full name','Jane Smith'],['email','Work email','jane@company.com'],['company','Company','Acme Inc.']].map(([k,l,p])=>(
              <div key={k}>
                <label style={{fontSize:11.5,fontWeight:600,color:'#4B5563',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>{l}</label>
                <input
                  type={k==='email'?'email':'text'}
                  value={(form as any)[k]}
                  onChange={e=>setForm(prev=>({...prev,[k]:e.target.value}))}
                  placeholder={p}
                  required
                  style={{width:'100%',padding:'12px 14px',borderRadius:8,border:'1.5px solid #E5E7EB',fontSize:15,color:'#0F1923',fontFamily:'Inter,sans-serif'}}
                />
              </div>
            ))}
            <button type="submit" disabled={loading||!form.name||!form.email||!form.company}
              style={{background:'#059669',color:'#fff',border:'none',borderRadius:9,padding:'14px',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',marginTop:4}}>
              {loading?'Setting up...':'Get access and desktop link'}
            </button>
          </form>
        ) : (
          <div style={{padding:'20px',background:'#ECFDF5',border:'1px solid #A7F3D0',borderRadius:10,textAlign:'center'}}>
            <div style={{fontSize:28,marginBottom:8}}>✓</div>
            <div style={{fontSize:16,fontWeight:700,color:'#0F1923',marginBottom:6}}>You are in</div>
            <div style={{fontSize:14,color:'#4B5563',lineHeight:1.6}}>Check your email - we sent you a link that works on any device.</div>
          </div>
        )}
      </div>

      <div style={{padding:'20px 24px',borderTop:'1px solid #F3F4F6',textAlign:'center',fontSize:12,color:'#9CA3AF'}}>
        2026 Qwezy Inc.
      </div>
    </div>
  )
}
