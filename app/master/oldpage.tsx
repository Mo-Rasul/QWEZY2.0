'use client'
import { useState, useEffect, useCallback } from 'react'

const C = {
  bg:'#F6F9FC', card:'#fff', cardBorder:'#E3EAF2',
  accent:'#059669', accentBg:'#ECFDF5', accentDark:'#047857',
  text:'#0F1923', textMuted:'#4B6358', textLight:'#8A9BB0',
  success:'#10B981', danger:'#EF4444', warn:'#F59E0B',
  greenBorder:'#A7F3D0', navBg:'#0F1923',
}

type Company = {
  id:string; name:string; plan:string; status:string; has_db:boolean
  created_at:string; notes?:string; mrr?:number; updated_at?:string
  users: User[]
}
type User = {
  id:string; company_id:string; name:string; email:string
  role:string; status:string; last_seen:string|null; created_at:string
}
type LogEntry = {
  id:string; actor:string; action:string; target_company:string|null
  details:any; ip_address:string; created_at:string
}

// ── Shared components ──────────────────────────────────────────────────────────
function Badge({text,color}:{text:string;color:string}) {
  return <span style={{fontSize:11,padding:'2px 8px',borderRadius:4,fontWeight:600,background:`${color}18`,color,border:`1px solid ${color}44`,fontFamily:'Inter,sans-serif',whiteSpace:'nowrap'}}>{text}</span>
}

function Btn({onClick,children,variant='primary',disabled=false,small=false}:{onClick:()=>void;children:React.ReactNode;variant?:'primary'|'secondary'|'danger'|'ghost';disabled?:boolean;small?:boolean}) {
  const bg = disabled?'#E5E7EB':variant==='primary'?C.accent:variant==='danger'?C.danger:variant==='ghost'?'transparent':'#fff'
  const col = disabled?C.textLight:variant==='primary'||variant==='danger'?'#fff':C.text
  const bdr = variant==='secondary'?`1px solid ${C.cardBorder}`:variant==='ghost'?'none':'none'
  return <button onClick={onClick} disabled={disabled}
    style={{background:bg,color:col,border:bdr,borderRadius:6,padding:small?'4px 10px':'7px 14px',fontSize:small?11.5:13,fontWeight:600,cursor:disabled?'default':'pointer',fontFamily:'Inter,sans-serif',whiteSpace:'nowrap'}}>
    {children}
  </button>
}

function Field({label,children}:{label:string;children:React.ReactNode}) {
  return <div><div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>{label}</div>{children}</div>
}

function Input({value,onChange,placeholder,type='text',mono=false}:{value:string;onChange:(v:string)=>void;placeholder?:string;type?:string;mono?:boolean}) {
  return <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} type={type}
    style={{width:'100%',padding:'8px 11px',borderRadius:7,border:`1.5px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:mono?"'JetBrains Mono',monospace":'Inter,sans-serif',background:'#fff'}}
    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
}

function Select({value,onChange,options}:{value:string;onChange:(v:string)=>void;options:{value:string;label:string}[]}) {
  return <select value={value} onChange={e=>onChange(e.target.value)}
    style={{width:'100%',padding:'8px 11px',borderRadius:7,border:`1.5px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff'}}
    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}>
    {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
}

function Modal({title,onClose,children,width=520}:{title:string;onClose:()=>void;children:React.ReactNode;width?:number}) {
  return <div style={{position:'fixed',inset:0,background:'rgba(10,20,30,0.7)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
    <div style={{background:'#fff',borderRadius:12,width:'100%',maxWidth:width,boxShadow:'0 24px 64px rgba(0,0,0,0.22)',overflow:'hidden',fontFamily:'Inter,sans-serif',maxHeight:'90vh',display:'flex',flexDirection:'column'}}>
      <div style={{padding:'15px 20px',borderBottom:`1px solid ${C.cardBorder}`,background:'#FAFAFA',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <span style={{fontWeight:700,fontSize:15,color:C.text}}>{title}</span>
        <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,color:C.textLight,cursor:'pointer',lineHeight:1}}>×</button>
      </div>
      <div style={{overflow:'auto',flex:1}}>{children}</div>
    </div>
  </div>
}

// ── Company modals ─────────────────────────────────────────────────────────────
function CompanyModal({company,onClose,onSaved}:{company?:Company;onClose:()=>void;onSaved:()=>void}) {
  const [name,setName]=useState(company?.name||'')
  const [plan,setPlan]=useState(company?.plan||'starter')
  const [notes,setNotes]=useState(company?.notes||'')
  const [mrr,setMrr]=useState(String(company?.mrr||''))
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')

  const save=async()=>{
    if(!name.trim()){setError('Name required');return}
    setLoading(true);setError('')
    try{
      const res=await fetch('/api/admin/companies',{
        method:company?'PATCH':'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(company?{id:company.id,name,plan,notes,mrr:parseFloat(mrr)||0}:{name,plan,notes,mrr:parseFloat(mrr)||0}),
      })
      const d=await res.json()
      if(!res.ok)throw new Error(d.error)
      onSaved();onClose()
    }catch(e:any){setError(e.message)}
    finally{setLoading(false)}
  }

  return <Modal title={company?`Edit — ${company.name}`:'New company'} onClose={onClose}>
    <div style={{padding:20,display:'flex',flexDirection:'column',gap:14}}>
      <Field label="Company name"><Input value={name} onChange={setName} placeholder="Ahmed & Rasul LLP"/></Field>
      <Field label="Plan">
        <div style={{display:'flex',gap:8}}>
          {['starter','growth','scale'].map(p=>(
            <button key={p} onClick={()=>setPlan(p)} style={{flex:1,padding:'8px',borderRadius:7,border:'1.5px solid',cursor:'pointer',fontFamily:'Inter,sans-serif',fontSize:13,fontWeight:500,textTransform:'capitalize',borderColor:plan===p?C.accent:C.cardBorder,background:plan===p?C.accentBg:'#fff',color:plan===p?C.accent:C.textMuted}}>{p}</button>
          ))}
        </div>
      </Field>
      <Field label="Monthly MRR ($)"><Input value={mrr} onChange={setMrr} placeholder="349"/></Field>
      <Field label="Internal notes">
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="Referred by… industry… anything useful"
          style={{width:'100%',padding:'8px 11px',borderRadius:7,border:`1.5px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif',resize:'vertical'}}
          onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
      </Field>
      {error&&<div style={{padding:'9px 12px',background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:7,fontSize:13,color:C.danger}}>{error}</div>}
    </div>
    <div style={{padding:'12px 20px',borderTop:`1px solid ${C.cardBorder}`,background:'#FAFAFA',display:'flex',gap:8,justifyContent:'flex-end'}}>
      <Btn onClick={onClose} variant="secondary">Cancel</Btn>
      <Btn onClick={save} disabled={loading}>{loading?'Saving…':company?'Save changes':'Create company'}</Btn>
    </div>
  </Modal>
}

function DatabaseModal({company,onClose,onSaved}:{company:Company;onClose:()=>void;onSaved:()=>void}) {
  const [urlStr,setUrlStr]=useState('')
  const [testing,setTesting]=useState(false)
  const [testResult,setTestResult]=useState<{ok:boolean;error?:string;table_count?:number;latency_ms?:number}|null>(null)
  const [saving,setSaving]=useState(false)
  const [saved,setSaved]=useState(false)
  const [error,setError]=useState('')
  const [removeLoading,setRemoveLoading]=useState(false)

  const test=async()=>{
    if(!urlStr.trim())return
    setTesting(true);setTestResult(null)
    try{
      const res=await fetch('/api/test-connection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({connectionString:urlStr})})
      setTestResult(await res.json())
    }catch{setTestResult({ok:false,error:'Network error'})}
    setTesting(false)
  }

  const save=async()=>{
    setSaving(true);setError('')
    try{
      const res=await fetch('/api/admin/companies',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:company.id,db_connection_string:urlStr})})
      const d=await res.json()
      if(!res.ok)throw new Error(d.error)
      setSaved(true);setTimeout(()=>{onSaved();onClose()},1500)
    }catch(e:any){setError(e.message)}
    setSaving(false)
  }

  const remove=async()=>{
    if(!confirm('Remove database connection from this company?'))return
    setRemoveLoading(true)
    await fetch('/api/admin/companies',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:company.id,db_connection_string:null})})
    setRemoveLoading(false);onSaved();onClose()
  }

  return <Modal title={`Database — ${company.name}`} onClose={onClose} width={580}>
    <div style={{padding:20,display:'flex',flexDirection:'column',gap:14}}>
      <div style={{padding:'10px 14px',background:company.has_db?C.accentBg:'#FFFBEB',border:`1px solid ${company.has_db?C.greenBorder:'#FDE68A'}`,borderRadius:8,fontSize:13,color:company.has_db?C.accent:'#92400E',fontWeight:500}}>
        {company.has_db?'✓ Database connected — paste a new URL below to replace it':'No database connected yet'}
      </div>
      <Field label="Connection URL (PostgreSQL)">
        <Input value={urlStr} onChange={setUrlStr} placeholder="postgresql://user:pass@host/db?sslmode=require" mono/>
      </Field>
      {testResult&&<div style={{padding:'10px 13px',borderRadius:8,border:`1px solid ${testResult.ok?C.greenBorder:'#FECACA'}`,background:testResult.ok?C.accentBg:'#FEF2F2',fontSize:13}}>
        {testResult.ok?<span style={{color:C.accent,fontWeight:600}}>✓ Connected — {testResult.table_count} tables ({testResult.latency_ms}ms)</span>:<span style={{color:C.danger}}>✗ {testResult.error}</span>}
      </div>}
      {error&&<div style={{padding:'9px 12px',background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:7,fontSize:13,color:C.danger}}>{error}</div>}
      {saved&&<div style={{padding:'9px 12px',background:C.accentBg,border:`1px solid ${C.greenBorder}`,borderRadius:7,fontSize:13,color:C.accent,fontWeight:600}}>✓ Database saved</div>}
    </div>
    <div style={{padding:'12px 20px',borderTop:`1px solid ${C.cardBorder}`,background:'#FAFAFA',display:'flex',gap:8,justifyContent:'space-between',alignItems:'center'}}>
      <div>{company.has_db&&<Btn onClick={remove} variant="danger" disabled={removeLoading}>{removeLoading?'Removing…':'Remove connection'}</Btn>}</div>
      <div style={{display:'flex',gap:8}}>
        <Btn onClick={onClose} variant="secondary">Cancel</Btn>
        <Btn onClick={test} variant="secondary" disabled={!urlStr.trim()||testing}>{testing?'Testing…':'Test connection'}</Btn>
        <Btn onClick={save} disabled={!testResult?.ok||saving||saved}>{saving?'Saving…':saved?'Saved ✓':'Save & connect'}</Btn>
      </div>
    </div>
  </Modal>
}

// ── User modal ─────────────────────────────────────────────────────────────────
function UserModal({user,companies,onClose,onSaved}:{user?:User;companies:Company[];onClose:()=>void;onSaved:()=>void}) {
  const [name,setName]=useState(user?.name||'')
  const [email,setEmail]=useState(user?.email||'')
  const [role,setRole]=useState(user?.role||'viewer')
  const [companyId,setCompanyId]=useState(user?.company_id||companies[0]?.id||'')
  const [sendInvite,setSendInvite]=useState(!user)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [success,setSuccess]=useState('')

  const save=async()=>{
    if(!name.trim()||(!user&&!email.trim())||!companyId){setError('Name, email and company required');return}
    setLoading(true);setError('')
    try{
      const res=await fetch('/api/admin/users',{
        method:user?'PATCH':'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(user?{id:user.id,company_id:companyId,name,role}:{name,email,role,company_id:companyId,send_invite:sendInvite}),
      })
      const d=await res.json()
      if(!res.ok)throw new Error(d.error)
      setSuccess(user?'Saved':'User created'+(sendInvite?' and invite sent':''))
      setTimeout(()=>{onSaved();onClose()},1500)
    }catch(e:any){setError(e.message)}
    finally{setLoading(false)}
  }

  const resetPassword=async()=>{
    if(!user)return
    setLoading(true)
    try{
      const { createClient }=await import('@supabase/supabase-js')
      const res=await fetch('/api/admin/users',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:user.id,send_reset:true})})
      setSuccess('Password reset email sent')
    }catch(e:any){setError('Failed to send reset')}
    setLoading(false)
  }

  return <Modal title={user?`Edit user — ${user.name}`:'Add user'} onClose={onClose}>
    <div style={{padding:20,display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <Field label="Full name"><Input value={name} onChange={setName} placeholder="Tariq Ahmed"/></Field>
        {!user&&<Field label="Email"><Input value={email} onChange={setEmail} placeholder="user@company.com" type="email"/></Field>}
      </div>
      <Field label="Company">
        <Select value={companyId} onChange={setCompanyId} options={companies.filter(c=>c.status!=='inactive').map(c=>({value:c.id,label:c.name}))}/>
      </Field>
      <Field label="Role">
        <div style={{display:'flex',gap:8}}>
          {[['admin','Admin','Full access'],['editor','Editor','Build & query'],['viewer','Viewer','Read only']].map(([v,l,d])=>(
            <button key={v} onClick={()=>setRole(v)} style={{flex:1,padding:'8px 6px',borderRadius:7,border:'1.5px solid',cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'center',borderColor:role===v?C.accent:C.cardBorder,background:role===v?C.accentBg:'#fff'}}>
              <div style={{fontSize:12.5,fontWeight:600,color:role===v?C.accent:C.text}}>{l}</div>
              <div style={{fontSize:10.5,color:C.textLight}}>{d}</div>
            </button>
          ))}
        </div>
      </Field>
      {!user&&<div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'#F8FAFD',borderRadius:7,border:`1px solid ${C.cardBorder}`}}>
        <button onClick={()=>setSendInvite(s=>!s)} style={{width:34,height:18,borderRadius:9,border:'none',cursor:'pointer',background:sendInvite?C.accent:'#CBD5E1',position:'relative',flexShrink:0}}>
          <div style={{width:12,height:12,borderRadius:'50%',background:'#fff',position:'absolute',top:3,left:sendInvite?19:3,transition:'left .2s'}}/>
        </button>
        <div>
          <div style={{fontSize:13,fontWeight:500,color:C.text}}>Send invite email</div>
          <div style={{fontSize:11.5,color:C.textLight}}>User receives login credentials by email</div>
        </div>
      </div>}
      {error&&<div style={{padding:'9px 12px',background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:7,fontSize:13,color:C.danger}}>{error}</div>}
      {success&&<div style={{padding:'9px 12px',background:C.accentBg,border:`1px solid ${C.greenBorder}`,borderRadius:7,fontSize:13,color:C.accent,fontWeight:600}}>{success}</div>}
    </div>
    <div style={{padding:'12px 20px',borderTop:`1px solid ${C.cardBorder}`,background:'#FAFAFA',display:'flex',gap:8,justifyContent:'space-between',alignItems:'center'}}>
      <div>{user&&<Btn onClick={resetPassword} variant="secondary" disabled={loading}>Send password reset</Btn>}</div>
      <div style={{display:'flex',gap:8}}>
        <Btn onClick={onClose} variant="secondary">Cancel</Btn>
        <Btn onClick={save} disabled={loading||!!success}>{loading?'Saving…':user?'Save changes':'Create user'}</Btn>
      </div>
    </div>
  </Modal>
}

// ── Overview tab ───────────────────────────────────────────────────────────────
function OverviewTab({companies}:{companies:Company[]}) {
  const active=companies.filter(c=>c.status!=='inactive')
  const totalUsers=companies.reduce((s,c)=>s+c.users.length,0)
  const withDB=companies.filter(c=>c.has_db).length
  const totalMRR=companies.reduce((s,c)=>s+(c.mrr||0),0)

  return <div style={{padding:'24px 0'}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:28}}>
      {[
        ['Active companies',String(active.length),C.accent],
        ['Total users',String(totalUsers),'#3B82F6'],
        ['DB connected',String(withDB),C.success],
        ['Total MRR',`$${totalMRR.toLocaleString()}`,C.success],
      ].map(([l,v,col])=>(
        <div key={l} style={{background:'#fff',borderRadius:10,border:`1px solid ${C.cardBorder}`,padding:'16px 18px'}}>
          <div style={{fontSize:10,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>{l}</div>
          <div style={{fontSize:28,fontWeight:800,color:col,letterSpacing:'-0.5px'}}>{v}</div>
        </div>
      ))}
    </div>

    <div style={{background:'#fff',borderRadius:10,border:`1px solid ${C.cardBorder}`,overflow:'hidden'}}>
      <div style={{padding:'12px 18px',borderBottom:`1px solid ${C.cardBorder}`,fontSize:12,fontWeight:700,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em'}}>All companies</div>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead><tr style={{background:'#F8FAFD',borderBottom:`1px solid ${C.cardBorder}`}}>
          {['Company','Plan','MRR','Users','DB','Status','Created'].map(h=><th key={h} style={{padding:'9px 14px',textAlign:'left',fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.04em'}}>{h}</th>)}
        </tr></thead>
        <tbody>
          {companies.map((c,i)=>(
            <tr key={c.id} style={{borderBottom:`1px solid #F8FAFD`,background:i%2===0?'#fff':'#FAFAFA'}}>
              <td style={{padding:'9px 14px',fontWeight:600,color:C.text}}>{c.name}</td>
              <td style={{padding:'9px 14px'}}><Badge text={c.plan} color={c.plan==='scale'?'#8B5CF6':c.plan==='growth'?C.accent:'#3B82F6'}/></td>
              <td style={{padding:'9px 14px',color:c.mrr?C.success:C.textLight,fontWeight:c.mrr?600:400,fontFamily:"'JetBrains Mono',monospace"}}>{c.mrr?`$${c.mrr.toLocaleString()}`:'-'}</td>
              <td style={{padding:'9px 14px',color:C.text}}>{c.users.length}</td>
              <td style={{padding:'9px 14px'}}><Badge text={c.has_db?'Connected':'No DB'} color={c.has_db?C.success:C.warn}/></td>
              <td style={{padding:'9px 14px'}}><Badge text={c.status||'active'} color={c.status==='inactive'?C.danger:C.success}/></td>
              <td style={{padding:'9px 14px',color:C.textLight,fontSize:12}}>{new Date(c.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
}

// ── Companies tab ──────────────────────────────────────────────────────────────
function CompaniesTab({companies,onRefresh}:{companies:Company[];onRefresh:()=>void}) {
  const [search,setSearch]=useState('')
  const [editCompany,setEditCompany]=useState<Company|null>(null)
  const [editDB,setEditDB]=useState<Company|null>(null)
  const [newCompany,setNewCompany]=useState(false)
  const [expanded,setExpanded]=useState<string|null>(null)
  const [deactivating,setDeactivating]=useState<string|null>(null)

  const filtered=search?companies.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())):companies

  const deactivate=async(c:Company)=>{
    if(!confirm(`Deactivate ${c.name}? This will also deactivate all their users.`))return
    setDeactivating(c.id)
    await fetch('/api/admin/companies',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:c.id})})
    setDeactivating(null);onRefresh()
  }

  const reactivate=async(c:Company)=>{
    await fetch('/api/admin/companies',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:c.id,status:'active'})})
    onRefresh()
  }

  return <div style={{padding:'20px 0'}}>
    <div style={{display:'flex',gap:10,marginBottom:18,alignItems:'center'}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search companies…"
        style={{flex:1,padding:'8px 13px',borderRadius:8,border:`1.5px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff'}}
        onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
      <Btn onClick={()=>setNewCompany(true)}>+ New company</Btn>
    </div>

    {filtered.map(c=>(
      <div key={c.id} style={{background:'#fff',borderRadius:10,border:`1px solid ${C.cardBorder}`,marginBottom:10,overflow:'hidden',opacity:c.status==='inactive'?0.65:1}}>
        <div style={{padding:'13px 16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}
          onClick={()=>setExpanded(s=>s===c.id?null:c.id)}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
              <span style={{fontSize:14,fontWeight:700,color:C.text}}>{c.name}</span>
              <Badge text={c.plan} color={c.plan==='scale'?'#8B5CF6':c.plan==='growth'?C.accent:'#3B82F6'}/>
              <Badge text={c.has_db?'DB connected':'No DB'} color={c.has_db?C.success:C.warn}/>
              {c.status==='inactive'&&<Badge text="Inactive" color={C.danger}/>}
            </div>
            <div style={{fontSize:12,color:C.textLight}}>
              {c.users.length} user{c.users.length!==1?'s':''} · {c.mrr?`$${c.mrr.toLocaleString()}/mo · `:''}Created {new Date(c.created_at).toLocaleDateString()}{c.notes?` · ${c.notes.slice(0,60)}${c.notes.length>60?'…':''}`:''} 
            </div>
          </div>
          <div style={{display:'flex',gap:6,alignItems:'center'}} onClick={e=>e.stopPropagation()}>
            <Btn onClick={()=>setEditDB(c)} variant="secondary" small>DB</Btn>
            <Btn onClick={()=>setEditCompany(c)} variant="secondary" small>Edit</Btn>
            {c.status==='inactive'
              ?<Btn onClick={()=>reactivate(c)} variant="secondary" small>Reactivate</Btn>
              :<Btn onClick={()=>deactivate(c)} variant="danger" small disabled={deactivating===c.id}>{deactivating===c.id?'…':'Deactivate'}</Btn>}
          </div>
          <span style={{fontSize:11,color:C.textLight,transform:expanded===c.id?'rotate(180deg)':'none',transition:'transform .2s'}}>▼</span>
        </div>

        {expanded===c.id&&(
          <div style={{borderTop:`1px solid ${C.cardBorder}`,background:'#FAFAFA',padding:'12px 16px'}}>
            {c.users.length===0?<div style={{fontSize:13,color:C.textLight}}>No users yet</div>
            :<table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr style={{borderBottom:`1px solid ${C.cardBorder}`}}>
                {['Name','Email','Role','Status','Last seen'].map(h=><th key={h} style={{padding:'5px 8px',textAlign:'left',fontSize:11,color:C.textLight,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.04em'}}>{h}</th>)}
              </tr></thead>
              <tbody>{c.users.map(u=>(
                <tr key={u.id} style={{borderBottom:'1px solid #F1F5F9'}}>
                  <td style={{padding:'7px 8px',fontWeight:500,color:C.text}}>{u.name}</td>
                  <td style={{padding:'7px 8px',color:C.textMuted}}>{u.email}</td>
                  <td style={{padding:'7px 8px'}}><Badge text={u.role} color={u.role==='admin'?C.accent:u.role==='editor'?'#3B82F6':'#8B5CF6'}/></td>
                  <td style={{padding:'7px 8px'}}><Badge text={u.status} color={u.status==='active'?C.success:C.danger}/></td>
                  <td style={{padding:'7px 8px',color:C.textLight,fontSize:12}}>{u.last_seen?new Date(u.last_seen).toLocaleDateString():'Never'}</td>
                </tr>
              ))}</tbody>
            </table>}
          </div>
        )}
      </div>
    ))}

    {editCompany&&<CompanyModal company={editCompany} onClose={()=>setEditCompany(null)} onSaved={onRefresh}/>}
    {editDB&&<DatabaseModal company={editDB} onClose={()=>setEditDB(null)} onSaved={onRefresh}/>}
    {newCompany&&<CompanyModal onClose={()=>setNewCompany(false)} onSaved={onRefresh}/>}
  </div>
}

// ── Users tab ──────────────────────────────────────────────────────────────────
function UsersTab({companies,onRefresh}:{companies:Company[];onRefresh:()=>void}) {
  const allUsers=companies.flatMap(c=>c.users.map(u=>({...u,companyName:c.name})))
  const [search,setSearch]=useState('')
  const [filterCompany,setFilterCompany]=useState('')
  const [filterRole,setFilterRole]=useState('')
  const [filterStatus,setFilterStatus]=useState('')
  const [editUser,setEditUser]=useState<User|null>(null)
  const [newUser,setNewUser]=useState(false)
  const [deactivating,setDeactivating]=useState<string|null>(null)

  const filtered=allUsers.filter(u=>{
    if(search&&!u.name.toLowerCase().includes(search.toLowerCase())&&!u.email.toLowerCase().includes(search.toLowerCase()))return false
    if(filterCompany&&u.company_id!==filterCompany)return false
    if(filterRole&&u.role!==filterRole)return false
    if(filterStatus&&u.status!==filterStatus)return false
    return true
  })

  const deactivate=async(u:User&{companyName:string})=>{
    if(!confirm(`Deactivate ${u.name}?`))return
    setDeactivating(u.id)
    await fetch('/api/admin/users',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:u.id})})
    setDeactivating(null);onRefresh()
  }

  const reactivate=async(u:User)=>{
    await fetch('/api/admin/users',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:u.id,status:'active'})})
    onRefresh()
  }

  return <div style={{padding:'20px 0'}}>
    <div style={{display:'flex',gap:10,marginBottom:18,flexWrap:'wrap',alignItems:'center'}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users…"
        style={{flex:1,minWidth:180,padding:'8px 13px',borderRadius:8,border:`1.5px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff'}}
        onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
      <select value={filterCompany} onChange={e=>setFilterCompany(e.target.value)}
        style={{padding:'8px 11px',borderRadius:7,border:`1.5px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff',minWidth:160}}>
        <option value="">All companies</option>
        {companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select value={filterRole} onChange={e=>setFilterRole(e.target.value)}
        style={{padding:'8px 11px',borderRadius:7,border:`1.5px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff'}}>
        <option value="">All roles</option>
        {['admin','editor','viewer'].map(r=><option key={r} value={r}>{r}</option>)}
      </select>
      <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
        style={{padding:'8px 11px',borderRadius:7,border:`1.5px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff'}}>
        <option value="">All statuses</option>
        {['active','inactive'].map(s=><option key={s} value={s}>{s}</option>)}
      </select>
      <Btn onClick={()=>setNewUser(true)}>+ Add user</Btn>
    </div>

    <div style={{background:'#fff',borderRadius:10,border:`1px solid ${C.cardBorder}`,overflow:'hidden'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead><tr style={{background:'#F8FAFD',borderBottom:`1px solid ${C.cardBorder}`}}>
          {['Name','Email','Company','Role','Status','Last seen','Actions'].map(h=><th key={h} style={{padding:'9px 14px',textAlign:'left',fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.04em'}}>{h}</th>)}
        </tr></thead>
        <tbody>
          {filtered.length===0?<tr><td colSpan={7} style={{padding:'28px',textAlign:'center',color:C.textLight,fontSize:13}}>No users match</td></tr>
          :filtered.map((u,i)=>(
            <tr key={u.id} style={{borderBottom:`1px solid #F8FAFD`,background:i%2===0?'#fff':'#FAFAFA',opacity:u.status==='inactive'?0.6:1}}>
              <td style={{padding:'9px 14px',fontWeight:500,color:C.text}}>{u.name}</td>
              <td style={{padding:'9px 14px',color:C.textMuted,fontSize:12}}>{u.email}</td>
              <td style={{padding:'9px 14px',color:C.text,fontSize:12}}>{(u as any).companyName}</td>
              <td style={{padding:'9px 14px'}}><Badge text={u.role} color={u.role==='admin'?C.accent:u.role==='editor'?'#3B82F6':'#8B5CF6'}/></td>
              <td style={{padding:'9px 14px'}}><Badge text={u.status} color={u.status==='active'?C.success:C.danger}/></td>
              <td style={{padding:'9px 14px',color:C.textLight,fontSize:12}}>{u.last_seen?new Date(u.last_seen).toLocaleDateString():'Never'}</td>
              <td style={{padding:'9px 14px'}}>
                <div style={{display:'flex',gap:5}}>
                  <Btn onClick={()=>setEditUser(u)} variant="secondary" small>Edit</Btn>
                  {u.status==='inactive'
                    ?<Btn onClick={()=>reactivate(u)} variant="secondary" small>Reactivate</Btn>
                    :<Btn onClick={()=>deactivate(u as any)} variant="danger" small disabled={deactivating===u.id}>{deactivating===u.id?'…':'Deactivate'}</Btn>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {editUser&&<UserModal user={editUser} companies={companies} onClose={()=>setEditUser(null)} onSaved={onRefresh}/>}
    {newUser&&<UserModal companies={companies} onClose={()=>setNewUser(false)} onSaved={onRefresh}/>}
  </div>
}

// ── Audit log tab ──────────────────────────────────────────────────────────────
function AuditTab({companies}:{companies:Company[]}) {
  const [logs,setLogs]=useState<LogEntry[]>([])
  const [loading,setLoading]=useState(true)
  const [filterCompany,setFilterCompany]=useState('')
  const [filterAction,setFilterAction]=useState('')
  const [selected,setSelected]=useState<LogEntry|null>(null)

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const params=new URLSearchParams()
      if(filterCompany)params.set('company_id',filterCompany)
      if(filterAction)params.set('action',filterAction)
      params.set('limit','200')
      const res=await fetch(`/api/admin/audit?${params}`)
      const d=await res.json()
      setLogs(d.logs||[])
    }catch{}
    setLoading(false)
  },[filterCompany,filterAction])

  useEffect(()=>{load()},[load])

  const actionColor=(a:string)=>{
    if(a.includes('delete')||a.includes('deactivate'))return C.danger
    if(a.includes('create')||a.includes('connect'))return C.success
    if(a.includes('update')||a.includes('edit'))return '#3B82F6'
    if(a.includes('login'))return C.accent
    return C.textLight
  }

  const companyName=(id:string|null)=>companies.find(c=>c.id===id)?.name||id?.slice(0,8)||'—'

  return <div style={{padding:'20px 0'}}>
    <div style={{display:'flex',gap:10,marginBottom:18,alignItems:'center',flexWrap:'wrap'}}>
      <select value={filterCompany} onChange={e=>setFilterCompany(e.target.value)}
        style={{padding:'8px 11px',borderRadius:7,border:`1.5px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff',minWidth:180}}>
        <option value="">All companies</option>
        {companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <input value={filterAction} onChange={e=>setFilterAction(e.target.value)} placeholder="Filter by action (e.g. user.created)"
        style={{flex:1,minWidth:200,padding:'8px 13px',borderRadius:8,border:`1.5px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff'}}
        onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
      <Btn onClick={load} variant="secondary">Refresh</Btn>
    </div>

    {loading?<div style={{padding:'40px',textAlign:'center',color:C.textLight}}>Loading…</div>
    :<div style={{background:'#fff',borderRadius:10,border:`1px solid ${C.cardBorder}`,overflow:'hidden'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead><tr style={{background:'#F8FAFD',borderBottom:`1px solid ${C.cardBorder}`}}>
          {['Time','Actor','Action','Company','IP','Details'].map(h=><th key={h} style={{padding:'9px 14px',textAlign:'left',fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.04em'}}>{h}</th>)}
        </tr></thead>
        <tbody>
          {logs.length===0?<tr><td colSpan={6} style={{padding:'28px',textAlign:'center',color:C.textLight}}>No logs yet</td></tr>
          :logs.map((l,i)=>(
            <tr key={l.id} onClick={()=>setSelected(l)} style={{borderBottom:`1px solid #F8FAFD`,background:i%2===0?'#fff':'#FAFAFA',cursor:'pointer'}}
              onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='#F0F7FF'}
              onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=i%2===0?'#fff':'#FAFAFA'}>
              <td style={{padding:'8px 14px',color:C.textLight,fontSize:12,whiteSpace:'nowrap'}}>{new Date(l.created_at).toLocaleString()}</td>
              <td style={{padding:'8px 14px',fontWeight:500,color:C.text}}>{l.actor}</td>
              <td style={{padding:'8px 14px'}}><span style={{fontSize:12,fontWeight:600,color:actionColor(l.action),fontFamily:"'JetBrains Mono',monospace"}}>{l.action}</span></td>
              <td style={{padding:'8px 14px',color:C.textMuted,fontSize:12}}>{companyName(l.target_company)}</td>
              <td style={{padding:'8px 14px',color:C.textLight,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>{l.ip_address}</td>
              <td style={{padding:'8px 14px',color:C.textLight,fontSize:12,maxWidth:240,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {l.details?JSON.stringify(l.details).slice(0,80):'—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>}

    {selected&&<Modal title="Log entry detail" onClose={()=>setSelected(null)} width={560}>
      <div style={{padding:20,display:'flex',flexDirection:'column',gap:10}}>
        {[
          ['Time',new Date(selected.created_at).toLocaleString()],
          ['Actor',selected.actor],
          ['Action',selected.action],
          ['Company',companyName(selected.target_company)],
          ['IP address',selected.ip_address],
        ].map(([k,v])=>(
          <div key={k} style={{display:'flex',gap:12,padding:'8px 12px',background:'#F8FAFD',borderRadius:7,border:`1px solid ${C.cardBorder}`}}>
            <span style={{fontSize:12,fontWeight:600,color:C.textLight,width:100,flexShrink:0,textTransform:'uppercase',letterSpacing:'0.04em'}}>{k}</span>
            <span style={{fontSize:13,color:C.text,fontFamily:k==='Action'||k==='IP address'?"'JetBrains Mono',monospace":'Inter,sans-serif'}}>{v}</span>
          </div>
        ))}
        <div style={{padding:'12px',background:'#0D1117',borderRadius:8,border:'1px solid #21262D'}}>
          <div style={{fontSize:11,fontWeight:600,color:'#484F58',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Details (JSON)</div>
          <pre style={{fontSize:12.5,color:'#E6EDF3',fontFamily:"'JetBrains Mono',monospace",margin:0,whiteSpace:'pre-wrap',wordBreak:'break-all'}}>
            {JSON.stringify(selected.details,null,2)}
          </pre>
        </div>
      </div>
      <div style={{padding:'12px 20px',borderTop:`1px solid ${C.cardBorder}`,background:'#FAFAFA',display:'flex',justifyContent:'flex-end'}}>
        <Btn onClick={()=>setSelected(null)} variant="secondary">Close</Btn>
      </div>
    </Modal>}
  </div>
}

// ── Main master page ───────────────────────────────────────────────────────────
export default function MasterPage() {
  const [tab,setTab]=useState<'overview'|'companies'|'users'|'audit'>('overview')
  const [companies,setCompanies]=useState<Company[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const res=await fetch('/api/admin/companies')
      if(res.status===401){setError('Not authorized — log in as master admin');setLoading(false);return}
      const d=await res.json()
      setCompanies(d.companies||[])
    }catch{setError('Failed to load')}
    finally{setLoading(false)}
  },[])

  useEffect(()=>{load()},[load])

  const TABS=[
    {id:'overview',label:'Overview'},
    {id:'companies',label:`Companies (${companies.length})`},
    {id:'users',label:`Users (${companies.reduce((s,c)=>s+c.users.length,0)})`},
    {id:'audit',label:'Audit Log'},
  ] as const

  return(
    <div style={{fontFamily:'Inter,-apple-system,sans-serif',background:C.bg,minHeight:'100vh'}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Nav */}
      <div style={{background:C.navBg,padding:'0 28px',display:'flex',alignItems:'center',height:52,position:'sticky',top:0,zIndex:50,borderBottom:'1px solid #1E2D3D'}}>
        <span style={{fontWeight:800,fontSize:16,color:'#10B981',letterSpacing:'-0.5px',flex:1}}>Qwezy</span>
        <span style={{fontSize:12,color:'#4B6358',marginRight:16}}>Master Admin</span>
        <a href="/dashboard" style={{fontSize:13,color:'#4B6358',textDecoration:'none'}}>→ App</a>
      </div>

      <div style={{maxWidth:1100,margin:'0 auto',padding:'28px 24px'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
          <div>
            <h1 style={{fontSize:22,fontWeight:800,color:C.text,letterSpacing:'-0.3px',marginBottom:3}}>Master Admin</h1>
            <p style={{fontSize:13.5,color:C.textMuted}}>Full control over all Qwezy accounts, users, and data</p>
          </div>
          <Btn onClick={load} variant="secondary">↻ Refresh</Btn>
        </div>

        {/* Tab bar */}
        <div style={{display:'flex',gap:0,borderBottom:`2px solid ${C.cardBorder}`,marginBottom:0}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id as any)}
              style={{padding:'10px 18px',background:'none',border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif',fontSize:13.5,fontWeight:tab===t.id?600:400,
                color:tab===t.id?C.accent:C.textMuted,borderBottom:`2px solid ${tab===t.id?C.accent:'transparent'}`,marginBottom:-2,whiteSpace:'nowrap'}}>
              {t.label}
            </button>
          ))}
        </div>

        {loading?<div style={{padding:'60px',textAlign:'center',color:C.textLight,fontSize:14}}>Loading…</div>
        :error?<div style={{padding:'20px',background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:8,color:C.danger,fontSize:13,marginTop:20}}>{error}</div>
        :<>
          {tab==='overview'&&<OverviewTab companies={companies}/>}
          {tab==='companies'&&<CompaniesTab companies={companies} onRefresh={load}/>}
          {tab==='users'&&<UsersTab companies={companies} onRefresh={load}/>}
          {tab==='audit'&&<AuditTab companies={companies}/>}
        </>}
      </div>
    </div>
  )
}
