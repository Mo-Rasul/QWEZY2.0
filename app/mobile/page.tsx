'use client'
import { useState } from 'react'

const C = { accent:'#059669', accentDark:'#047857', accentBg:'#ECFDF5', text:'#0F1923', textMuted:'#4B5563', textLight:'#9CA3AF' }

const QUERIES = [
  'Who are our top 10 customers by revenue?',
  'Show monthly MRR for the last 12 months',
  'Which products are below reorder level?',
  'What is our churn rate this quarter?',
]

export default function MobileLanding() {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name:'', email:'', company:'' })
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/demo-access', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ ...form, role:'Other', teamSize:'2-5' })
      })
      const data = await res.json()
      if (data.immediateLogin) {
        window.location.href = '/dashboard'
      } else {
        setSent(true)
      }
    } catch { setSent(true) }
    setLoading(false)
  }

  return (
    <div style={{fontFamily:'Inter,-apple-system,sans-serif',background:'#fff',minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}`}</style>

      {/* Header */}
      <div style={{background:'#022c22',padding:'16px 20px',display:'flex',alignItems:'center',gap:9}}>
        <div style={{width:28,height:28,background:'linear-gradient(135deg,#10B981,#059669)',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <span style={{color:'#fff',fontFamily:"'JetBrains Mono'",fontWeight:700,fontSize:11}}>{'{ }'}</span>
        </div>
        <span style={{fontWeight:800,fontSize:18,color:'#fff',letterSpacing:'-0.3px'}}>Qwezy</span>
      </div>

      <div style={{flex:1,padding:'32px 24px',display:'flex',flexDirection:'column',gap:28}}>
        {/* Hero */}
        <div>
          <div style={{display:'inline-flex',alignItems:'center',gap:7,padding:'4px 10px',borderRadius:20,background:C.accentBg,border:'1px solid #A7F3D0',marginBottom:16}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:C.accent}}/>
            <span style={{fontSize:12,fontWeight:600,color:C.accentDark}}>Early access - limited spots</span>
          </div>
          <h1 style={{fontSize:34,fontWeight:800,color:C.text,letterSpacing:'-1px',lineHeight:1.1,marginBottom:14}}>
            Ask your data<br/><span style={{color:C.accent}}>anything.</span>
          </h1>
          <p style={{fontSize:15,color:C.textMuted,lineHeight:1.65}}>
            Qwezy translates plain English into SQL - giving your whole team instant answers without writing a single line of code.
          </p>
        </div>

        {/* Sample queries */}
        <div>
          <div style={{fontSize:12,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>Try asking</div>
          <div style={{display:'flex',flexDirection:'column',gap:7}}>
            {QUERIES.map((q,i)=>(
              <div key={i} style={{padding:'11px 14px',background:'#F8FAFD',border:'1px solid #E5E7EB',borderRadius:9,fontSize:14,color:C.text,display:'flex',gap:8,alignItems:'center'}}>
                <span style={{color:C.accent,fontWeight:700,flexShrink:0}}>→</span>{q}
              </div>
            ))}
          </div>
        </div>

        {/* Desktop notice */}
        <div style={{padding:'16px',background:'#F8FAFD',border:'1px solid #E5E7EB',borderRadius:10,textAlign:'center'}}>
          <div style={{fontSize:22,marginBottom:8}}>💻</div>
          <div style={{fontSize:14.5,fontWeight:600,color:C.text,marginBottom:6}}>Best experienced on desktop</div>
          <div style={{fontSize:13.5,color:C.textMuted,lineHeight:1.6}}>Qwezy is built for data work - query results, SQL editor, and dashboards are designed for a full screen. Sign up now and we'll send you a link for when you're at your desk.</div>
        </div>

        {/* CTA */}
        {!showForm && !sent && (
          <button onClick={()=>setShowForm(true)}
            style={{background:C.accent,color:'#fff',border:'none',borderRadius:10,padding:'15px',fontSize:16,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',boxShadow:'0 4px 16px rgba(5,150,105,0.3)'}}>
            Get early access - free
          </button>
        )}

        {showForm && !sent && (
          <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:12}}>
            {[['name','Full name','Jane Smith'],['email','Work email','jane@company.com'],['company','Company','Acme Inc.']].map(([k,l,p])=>(
              <div key={k}>
                <label style={{fontSize:11.5,fontWeight:600,color:C.textMuted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>{l}</label>
                <input type={k==='email'?'email':'text'} value={(form as any)[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} placeholder={p} required
                  style={{width:'100%',padding:'12px 14px',borderRadius:8,border:'1.5px solid #E5E7EB',fontSize:15,color:C.text,fontFamily:'Inter,sans-serif'}}/>
              </div>
            ))}
            <button type="submit" disabled={loading||!form.name||!form.email||!form.company}
              style={{background:C.accent,color:'#fff',border:'none',borderRadius:9,padding:'14px',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',marginTop:4}}>
              {loading?'Setting up...':'Get access + desktop link'}
            </button>
          </form>
        )}

        {sent && (
          <div style={{padding:'20px',background:C.accentBg,border:'1px solid #A7F3D0',borderRadius:10,textAlign:'center'}}>
            <div style={{fontSize:28,marginBottom:8}}>✓</div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:6}}>You're in</div>
            <div style={{fontSize:14,color:C.textMuted,lineHeight:1.6}}>Check your email - we sent you a link that works on any device. See you on desktop.</div>
          </div>
        )}

        {/* Trust */}
        <div style={{display:'flex',flexDirection:'column',gap:7}}>
          {['Read-only access - we never write to your database','Your data never trains our models','Company-isolated AI context','AES-256 encrypted credentials'].map(item=>(
            <div key={item} style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:C.textMuted}}>
              <span style={{color:C.accent,fontWeight:700,flexShrink:0}}>+</span>{item}
            </div>
          ))}
        </div>
      </div>

      <div style={{padding:'20px 24px',borderTop:'1px solid #F3F4F6',textAlign:'center',fontSize:12,color:C.textLight}}>
        2026 Qwezy Inc. - qwezy.io
      </div>
    </div>
  )
}
