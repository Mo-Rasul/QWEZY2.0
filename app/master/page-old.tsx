'use client'
import { useState, useEffect } from 'react'

const C = {
  bg:'#F6F9FC', card:'#fff', cardBorder:'#E3EAF2',
  accent:'#059669', accentBg:'#ECFDF5',
  text:'#0F1923', textMuted:'#4B6358', textLight:'#8A9BB0',
  success:'#10B981', danger:'#EF4444', warn:'#F59E0B',
  greenBorder:'#A7F3D0',
}

type Company = {
  id: string; name: string; plan: string; has_db: boolean; created_at: string
  users: { id:string; name:string; email:string; role:string; status:string; last_seen:string|null }[]
}

function Badge({ text, color }: { text:string; color:string }) {
  return <span style={{fontSize:11,padding:'2px 8px',borderRadius:4,fontWeight:600,background:`${color}18`,color,border:`1px solid ${color}44`,fontFamily:'Inter,sans-serif'}}>{text}</span>
}

function CreateCompanyModal({ onClose, onCreated }: { onClose:()=>void; onCreated:()=>void }) {
  const [companyName,setCompanyName]=useState('')
  const [plan,setPlan]=useState('starter')
  const [adminEmail,setAdminEmail]=useState('')
  const [adminName,setAdminName]=useState('')
  const [notes,setNotes]=useState('')
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [success,setSuccess]=useState('')

  const create=async()=>{
    if(!companyName||!adminEmail||!adminName){setError('Company name, admin email and name are required');return}
    setLoading(true);setError('')
    try{
      const res=await fetch('/api/company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyName,plan,adminEmail,adminName,notes})})
      const data=await res.json()
      if(!res.ok)throw new Error(data.error)
      setSuccess(`✓ Account created. Welcome email sent to ${adminEmail}`)
      setTimeout(()=>{onCreated();onClose()},2000)
    }catch(e:any){setError(e.message)}
    finally{setLoading(false)}
  }



  return(
    <div style={{position:'fixed',inset:0,background:'rgba(10,20,30,0.7)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'#fff',borderRadius:12,width:'100%',maxWidth:520,boxShadow:'0 24px 64px rgba(0,0,0,0.2)',overflow:'hidden',fontFamily:'Inter,sans-serif'}}>
        <div style={{padding:'16px 20px',borderBottom:`1px solid ${C.cardBorder}`,background:'#FAFAFA',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontWeight:700,fontSize:15,color:C.text}}>Create new company account</span>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,color:C.textLight,cursor:'pointer'}}>×</button>
        </div>
        <div style={{padding:'20px',display:'flex',flexDirection:'column',gap:14}}>
          <div><div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>Company name</div><input value={companyName} onChange={e=>setCompanyName(e.target.value)} placeholder="Ahmed & Rasul LLP" style={{width:'100%',padding:'8px 11px',borderRadius:7,border:`1.5px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif'}} onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/></div>
          <div><div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>Plan</div>
            <div style={{display:'flex',gap:8}}>
              {['starter','growth','scale'].map(p=>(
                <button key={p} onClick={()=>setPlan(p)}
                  style={{flex:1,padding:'8px',borderRadius:7,border:'1.5px solid',cursor:'pointer',fontFamily:'Inter,sans-serif',fontSize:13,fontWeight:500,textTransform:'capitalize',
                    borderColor:plan===p?C.accent:C.cardBorder,background:plan===p?C.accentBg:'#fff',color:plan===p?C.accent:C.textMuted}}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div><div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>Admin name</div><input value={adminName} onChange={e=>setAdminName(e.target.value)} placeholder="Tariq Ahmed" style={{width:'100%',padding:'8px 11px',borderRadius:7,border:`1.5px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif'}} onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/></div>
            <div><div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>Admin email</div><input value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} placeholder="admin@firm.com" type="email" style={{width:'100%',padding:'8px 11px',borderRadius:7,border:`1.5px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif'}} onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/></div>
          </div>
          <div><div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>Internal notes (optional)</div>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="e.g. Law firm, 15 users, referred by…"
              style={{width:'100%',padding:'8px 11px',borderRadius:7,border:`1.5px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif',resize:'none'}}
              onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
          </div>
          {/* Stripe placeholder */}
          <div style={{padding:'12px 14px',background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:8,fontSize:13,color:'#92400E'}}>
            <span style={{fontWeight:600}}>💳 Payment — Coming soon</span>
            <span style={{color:'#B45309'}}> · Manually confirm payment before creating an account. Stripe will automate this.</span>
          </div>
          {error&&<div style={{padding:'10px 12px',background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:7,fontSize:13,color:C.danger}}>{error}</div>}
          {success&&<div style={{padding:'10px 12px',background:C.accentBg,border:`1px solid ${C.greenBorder}`,borderRadius:7,fontSize:13,color:C.accent,fontWeight:600}}>{success}</div>}
        </div>
        <div style={{padding:'14px 20px',borderTop:`1px solid ${C.cardBorder}`,background:'#FAFAFA',display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{background:'#fff',color:C.textMuted,border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:'9px 18px',fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Cancel</button>
          <button onClick={create} disabled={loading||!!success}
            style={{background:loading||success?'#E5E7EB':C.accent,color:loading||success?C.textLight:'#fff',border:'none',borderRadius:7,padding:'9px 24px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
            {loading?'Creating…':'Create account & send invite'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CompanyCard({ company }: { company:Company }) {
  const [expanded,setExpanded]=useState(false)
  const admin=company.users.find(u=>u.role==='admin')

  return(
    <div style={{background:'#fff',borderRadius:10,border:`1px solid ${C.cardBorder}`,overflow:'hidden',marginBottom:10}}>
      <div onClick={()=>setExpanded(s=>!s)}
        style={{padding:'14px 18px',display:'flex',alignItems:'center',gap:14,cursor:'pointer'}}
        onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='#FAFAFA'}
        onMouseOut={e=>(e.currentTarget as HTMLElement).style.background='#fff'}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
            <span style={{fontSize:14,fontWeight:700,color:C.text}}>{company.name}</span>
            <Badge text={company.plan} color={company.plan==='scale'?'#8B5CF6':company.plan==='growth'?C.accent:'#3B82F6'}/>
            <Badge text={company.has_db?'DB connected':'No DB yet'} color={company.has_db?C.success:C.warn}/>
          </div>
          <div style={{fontSize:12,color:C.textLight}}>
            {admin?.email||'No admin yet'} · {company.users.length} user{company.users.length!==1?'s':''} · Created {new Date(company.created_at).toLocaleDateString()}
          </div>
        </div>
        <span style={{fontSize:11,color:C.textLight,display:'inline-block',transform:expanded?'rotate(180deg)':'none',transition:'transform .2s'}}>▼</span>
      </div>
      {expanded&&(
        <div style={{borderTop:`1px solid ${C.cardBorder}`,padding:'14px 18px',background:'#FAFAFA'}}>
          {company.users.length===0
            ?<div style={{fontSize:13,color:C.textLight}}>No users yet</div>
            :<table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead>
                <tr style={{borderBottom:`1px solid ${C.cardBorder}`}}>
                  {['Name','Email','Role','Status','Last seen'].map(h=>(
                    <th key={h} style={{padding:'5px 8px',textAlign:'left',fontSize:11,color:C.textLight,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.04em'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {company.users.map(u=>(
                  <tr key={u.id} style={{borderBottom:'1px solid #F8FAFD'}}>
                    <td style={{padding:'7px 8px',fontWeight:500,color:C.text}}>{u.name}</td>
                    <td style={{padding:'7px 8px',color:C.textMuted}}>{u.email}</td>
                    <td style={{padding:'7px 8px'}}><Badge text={u.role} color={u.role==='admin'?C.accent:u.role==='editor'?'#3B82F6':'#8B5CF6'}/></td>
                    <td style={{padding:'7px 8px'}}><Badge text={u.status} color={u.status==='active'?C.success:C.danger}/></td>
                    <td style={{padding:'7px 8px',color:C.textLight,fontSize:12}}>{u.last_seen?new Date(u.last_seen).toLocaleDateString():'Never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>}
        </div>
      )}
    </div>
  )
}

export default function MasterPage() {
  const [companies,setCompanies]=useState<Company[]>([])
  const [loading,setLoading]=useState(true)
  const [showCreate,setShowCreate]=useState(false)
  const [search,setSearch]=useState('')
  const [error,setError]=useState('')

  const load=async()=>{
    setLoading(true)
    try{
      const res=await fetch('/api/company')
      if(res.status===401){setError('Not authorized — log in as master admin first');setLoading(false);return}
      const data=await res.json()
      setCompanies(data.companies||[])
    }catch{setError('Failed to load')}
    finally{setLoading(false)}
  }

  useEffect(()=>{load()},[])

  const filtered=search?companies.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())||c.users.some(u=>u.email.toLowerCase().includes(search.toLowerCase()))):companies
  const withDB=companies.filter(c=>c.has_db).length

  return(
    <div style={{fontFamily:'Inter,-apple-system,sans-serif',background:C.bg,minHeight:'100vh'}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}`}</style>

      <div style={{background:'#0F1923',padding:'0 28px',display:'flex',alignItems:'center',height:52,position:'sticky',top:0,zIndex:50,borderBottom:'1px solid #1E2D3D'}}>
        <span style={{fontWeight:800,fontSize:16,color:'#10B981',letterSpacing:'-0.5px',flex:1}}>Qwezy</span>
        <span style={{fontSize:12,color:'#4B6358',marginRight:16}}>Master Admin</span>
        <a href="/dashboard" style={{fontSize:13,color:'#4B6358',textDecoration:'none'}}>→ App</a>
      </div>

      <div style={{maxWidth:900,margin:'0 auto',padding:'32px 20px'}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:28}}>
          <div>
            <h1 style={{fontSize:22,fontWeight:800,color:C.text,letterSpacing:'-0.3px',marginBottom:4}}>Company Accounts</h1>
            <p style={{fontSize:13.5,color:C.textMuted}}>Create and manage all Qwezy client accounts</p>
          </div>
          <button onClick={()=>setShowCreate(true)}
            style={{background:C.accent,color:'#fff',border:'none',borderRadius:8,padding:'10px 20px',fontSize:13.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
            + Create account
          </button>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
          {[['Total companies',String(companies.length),C.accent],['Total users',String(companies.reduce((s,c)=>s+c.users.length,0)),'#3B82F6'],['DB connected',String(withDB),C.success],['Pending setup',String(companies.length-withDB),C.warn]].map(([l,v,col])=>(
            <div key={l} style={{background:'#fff',borderRadius:9,border:`1px solid ${C.cardBorder}`,padding:'14px 16px'}}>
              <div style={{fontSize:10,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>{l}</div>
              <div style={{fontSize:26,fontWeight:800,color:col,letterSpacing:'-0.5px'}}>{v}</div>
            </div>
          ))}
        </div>

        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by company name or email…"
          style={{width:'100%',padding:'9px 14px',borderRadius:8,border:`1.5px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif',marginBottom:16,background:'#fff'}}
          onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>

        {loading?<div style={{textAlign:'center',padding:'40px',color:C.textLight}}>Loading…</div>
          :error?<div style={{padding:'16px',background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:8,color:C.danger,fontSize:13}}>{error}</div>
          :filtered.length===0?<div style={{textAlign:'center',padding:'40px',color:C.textLight,fontSize:14}}>{search?'No matches':'No companies yet — create the first one'}</div>
          :filtered.map(c=><CompanyCard key={c.id} company={c}/>)}
      </div>

      {showCreate&&<CreateCompanyModal onClose={()=>setShowCreate(false)} onCreated={load}/>}
    </div>
  )
}
