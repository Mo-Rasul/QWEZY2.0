'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const C = {
  navBg:'#022c22', navBorder:'#064e3b', navText:'#6ee7b7', navActive:'#10b981',
  bg:'#F6F9FC', card:'#fff', cardBorder:'#E3EAF2',
  accent:'#059669', accentDark:'#047857', accentBg:'#ECFDF5',
  text:'#0F1923', textMuted:'#4B6358', textLight:'#8A9BB0',
  success:'#10B981', danger:'#EF4444', warn:'#F59E0B',
}

type Tab = 'overview'|'companies'|'billing'|'errors'|'flags'|'announce'|'audit'

const PLAN_COLORS:Record<string,string> = {
  demo:'#6B7280', starter:'#3B82F6', growth:'#059669', scale:'#7C3AED', enterprise:'#D97706'
}

const STATUS_COLORS:Record<string,{bg:string,color:string}> = {
  paid:     {bg:'#ECFDF5', color:'#059669'},
  pending:  {bg:'#FFFBEB', color:'#D97706'},
  overdue:  {bg:'#FEF2F2', color:'#EF4444'},
  cancelled:{bg:'#F9FAFB', color:'#9CA3AF'},
  refunded: {bg:'#EFF6FF', color:'#3B82F6'},
}

function Badge({label,color,bg}:{label:string,color:string,bg:string}) {
  return <span style={{fontSize:11.5,fontWeight:600,padding:'2px 8px',borderRadius:4,background:bg,color}}>{label}</span>
}

function Card({children,style={}}:{children:React.ReactNode,style?:React.CSSProperties}) {
  return <div style={{background:C.card,borderRadius:10,border:`1px solid ${C.cardBorder}`,padding:22,...style}}>{children}</div>
}

function StatCard({label,value,sub,color}:{label:string,value:any,sub?:string,color?:string}) {
  return (
    <Card style={{padding:'16px 20px'}}>
      <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>{label}</div>
      <div style={{fontSize:26,fontWeight:800,color:color||C.text,letterSpacing:'-0.5px',lineHeight:1}}>{value}</div>
      {sub&&<div style={{fontSize:12,color:C.textLight,marginTop:5}}>{sub}</div>}
    </Card>
  )
}

// ── Overview ──────────────────────────────────────────────────────────────────
function Overview({companies,errors}:{companies:any[],errors:any[]}) {
  const totalMRR = companies.reduce((s,c)=>{
    const rates:Record<string,number>={starter:99,growth:349,scale:899,enterprise:0,demo:0}
    return s+(rates[c.plan]||0)
  },0)
  const activeCompanies = companies.filter(c=>c.plan!=='demo').length
  const totalQueries = companies.reduce((s,c)=>s+c.queriesThisMonth,0)
  const criticalErrors = errors.filter(e=>e.severity==='critical'&&!e.resolved).length

  return (
    <div>
      <div style={{marginBottom:20}}>
        <h2 style={{fontSize:20,fontWeight:700,color:C.text,letterSpacing:'-0.3px'}}>Overview</h2>
        <p style={{fontSize:13,color:C.textMuted,marginTop:2}}>All Qwezy customers at a glance</p>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
        <StatCard label="Monthly recurring revenue" value={`$${totalMRR.toLocaleString()}`} sub="Active plans"/>
        <StatCard label="Paying customers" value={activeCompanies} sub={`${companies.length} total incl. demo`}/>
        <StatCard label="Queries this month" value={totalQueries.toLocaleString()} sub="Across all companies"/>
        <StatCard label="Critical errors" value={criticalErrors} sub="Unresolved" color={criticalErrors>0?C.danger:C.text}/>
      </div>

      <Card style={{marginBottom:16}}>
        <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:14}}>Revenue by plan</div>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {['enterprise','scale','growth','starter'].map(plan=>{
            const count = companies.filter(c=>c.plan===plan).length
            const rates:Record<string,number>={starter:99,growth:349,scale:899,enterprise:0}
            const mrr = count*(rates[plan]||0)
            const maxMRR=totalMRR||1
            return count===0?null:(
              <div key={plan} style={{display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:12.5,fontWeight:600,color:PLAN_COLORS[plan],textTransform:'capitalize',minWidth:80}}>{plan}</span>
                <div style={{flex:1,height:6,background:'#F0F4F8',borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${Math.round(mrr/maxMRR*100)}%`,background:PLAN_COLORS[plan],borderRadius:3}}/>
                </div>
                <span style={{fontSize:12.5,color:C.textMuted,minWidth:80,textAlign:'right'}}>{count} co. · ${mrr}/mo</span>
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:14}}>Recent activity</div>
        {companies.slice(0,5).map(c=>(
          <div key={c.id} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 0',borderBottom:`1px solid ${C.cardBorder}`}}>
            <div style={{width:30,height:30,borderRadius:'50%',background:C.accentBg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:C.accent,flexShrink:0}}>{c.name[0]}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13.5,fontWeight:500,color:C.text}}>{c.name}</div>
              <div style={{fontSize:12,color:C.textLight}}>{c.activeUsers} active users · {c.queriesThisMonth} queries this month</div>
            </div>
            <Badge label={c.plan} color={PLAN_COLORS[c.plan]} bg={`${PLAN_COLORS[c.plan]}18`}/>
            <div style={{width:8,height:8,borderRadius:'50%',background:c.connections?.some((x:any)=>x.test_ok)?C.success:C.warn,flexShrink:0}}/>
          </div>
        ))}
      </Card>
    </div>
  )
}

// ── Companies ─────────────────────────────────────────────────────────────────
function Companies({companies,reload}:{companies:any[],reload:()=>void}) {
  const [search,setSearch]=useState('')
  const [showCreate,setShowCreate]=useState(false)
  const [showUser,setShowUser]=useState<string|null>(null)
  const [form,setForm]=useState({name:'',plan:'starter'})
  const [userForm,setUserForm]=useState({email:'',name:'',role:'admin'})
  const [loading,setLoading]=useState(false)
  const [expanded,setExpanded]=useState<string|null>(null)
  const router=useRouter()

  const filtered=companies.filter(c=>c.name.toLowerCase().includes(search.toLowerCase()))

  const createCompany=async()=>{
    setLoading(true)
    await fetch('/api/master/companies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create_company',...form})})
    setLoading(false); setShowCreate(false); setForm({name:'',plan:'starter'}); reload()
  }

  const createUser=async(companyId:string)=>{
    setLoading(true)
    await fetch('/api/master/companies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create_user',companyId,...userForm})})
    setLoading(false); setShowUser(null); setUserForm({email:'',name:'',role:'admin'}); reload()
  }

  const updatePlan=async(companyId:string,plan:string)=>{
    await fetch('/api/master/companies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update_plan',companyId,plan})})
    reload()
  }

  const impersonate=async(companyId:string,companyName:string)=>{
    await fetch('/api/master/companies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'impersonate',companyId,companyName})})
    router.push('/dashboard')
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:C.text,letterSpacing:'-0.3px'}}>Companies</h2>
          <p style={{fontSize:13,color:C.textMuted,marginTop:2}}>{companies.length} total</p>
        </div>
        <button onClick={()=>setShowCreate(true)} style={{background:C.accent,color:'#fff',border:'none',borderRadius:7,padding:'9px 18px',fontSize:13.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>+ New company</button>
      </div>

      {showCreate&&(
        <Card style={{marginBottom:16,border:`1.5px solid ${C.accent}`}}>
          <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:14}}>Create new company</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:10,alignItems:'end'}}>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>Company name</div>
              <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Acme Corp"
                style={{width:'100%',padding:'8px 11px',borderRadius:7,border:`1.5px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif'}}
                onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>Plan</div>
              <select value={form.plan} onChange={e=>setForm(p=>({...p,plan:e.target.value}))}
                style={{width:'100%',padding:'8px 11px',borderRadius:7,border:`1.5px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff',cursor:'pointer'}}>
                {['demo','starter','growth','scale','enterprise'].map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
            <div style={{display:'flex',gap:7}}>
              <button onClick={createCompany} disabled={loading||!form.name}
                style={{background:C.accent,color:'#fff',border:'none',borderRadius:7,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                {loading?'...':'Create'}
              </button>
              <button onClick={()=>setShowCreate(false)} style={{background:'#fff',color:C.textMuted,border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:'8px 12px',fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Cancel</button>
            </div>
          </div>
        </Card>
      )}

      <div style={{padding:'10px 14px',background:'#F8FAFD',border:`1px solid ${C.cardBorder}`,borderRadius:8,marginBottom:12}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search companies..."
          style={{width:'100%',background:'none',border:'none',fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif'}}
          onFocus={e=>(e.target.parentElement!.style.borderColor=C.accent)} onBlur={e=>(e.target.parentElement!.style.borderColor=C.cardBorder)}/>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {filtered.map(c=>(
          <div key={c.id} style={{background:C.card,borderRadius:10,border:`1px solid ${C.cardBorder}`,overflow:'hidden'}}>
            <div style={{padding:'14px 18px',display:'flex',alignItems:'center',gap:12,cursor:'pointer'}} onClick={()=>setExpanded(expanded===c.id?null:c.id)}>
              <div style={{width:34,height:34,borderRadius:'50%',background:C.accentBg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:C.accent,flexShrink:0}}>{c.name[0]}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600,color:C.text}}>{c.name}</div>
                <div style={{fontSize:12,color:C.textLight,marginTop:2}}>{c.users?.length||0} users · {c.queriesThisMonth} queries this month · {c.connections?.length||0} connections</div>
              </div>
              <Badge label={c.plan} color={PLAN_COLORS[c.plan]} bg={`${PLAN_COLORS[c.plan]}18`}/>
              <div style={{display:'flex',alignItems:'center',gap:5}}>
                <div style={{width:7,height:7,borderRadius:'50%',background:c.connections?.some((x:any)=>x.is_active&&x.test_ok)?C.success:C.warn}}/>
                <span style={{fontSize:11.5,color:C.textLight}}>{c.connections?.some((x:any)=>x.is_active&&x.test_ok)?'Connected':'No connection'}</span>
              </div>
              <span style={{fontSize:12,color:C.textLight}}>{expanded===c.id?'▲':'▾'}</span>
            </div>

            {expanded===c.id&&(
              <div style={{padding:'0 18px 16px',borderTop:`1px solid ${C.cardBorder}`}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginTop:14,marginBottom:14}}>
                  <div style={{background:'#F8FAFD',borderRadius:7,padding:'10px 14px'}}>
                    <div style={{fontSize:11,color:C.textLight,marginBottom:3}}>Queries this month</div>
                    <div style={{fontSize:18,fontWeight:700,color:C.text}}>{c.queriesThisMonth}</div>
                  </div>
                  <div style={{background:'#F8FAFD',borderRadius:7,padding:'10px 14px'}}>
                    <div style={{fontSize:11,color:C.textLight,marginBottom:3}}>Active users</div>
                    <div style={{fontSize:18,fontWeight:700,color:C.text}}>{c.activeUsers}</div>
                  </div>
                  <div style={{background:'#F8FAFD',borderRadius:7,padding:'10px 14px'}}>
                    <div style={{fontSize:11,color:C.textLight,marginBottom:3}}>Onboarding</div>
                    <div style={{fontSize:13,fontWeight:600,color:c.onboarding?.completed_at?C.success:C.warn}}>{c.onboarding?.completed_at?'Complete':'In progress'}</div>
                  </div>
                </div>

                {/* Users */}
                <div style={{marginBottom:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.text}}>Users ({c.users?.length||0})</div>
                    <button onClick={()=>setShowUser(c.id)} style={{fontSize:12,color:C.accent,background:C.accentBg,border:`1px solid ${C.accent}33`,borderRadius:5,padding:'4px 10px',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:500}}>+ Add user</button>
                  </div>
                  {showUser===c.id&&(
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 120px auto',gap:8,marginBottom:10,padding:'12px',background:'#F8FAFD',borderRadius:7,border:`1px solid ${C.cardBorder}`}}>
                      {[['email','Email','user@company.com'],['name','Name','Jane Smith']].map(([k,l,p])=>(
                        <div key={k}>
                          <div style={{fontSize:10.5,color:C.textLight,marginBottom:3,textTransform:'uppercase',letterSpacing:'0.04em'}}>{l}</div>
                          <input value={(userForm as any)[k]} onChange={e=>setUserForm(p=>({...p,[k]:e.target.value}))} placeholder={p as string}
                            style={{width:'100%',padding:'6px 9px',borderRadius:6,border:`1px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif'}}/>
                        </div>
                      ))}
                      <div>
                        <div style={{fontSize:10.5,color:C.textLight,marginBottom:3,textTransform:'uppercase',letterSpacing:'0.04em'}}>Role</div>
                        <select value={userForm.role} onChange={e=>setUserForm(p=>({...p,role:e.target.value}))}
                          style={{width:'100%',padding:'6px 9px',borderRadius:6,border:`1px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff'}}>
                          {['admin','analyst','viewer'].map(r=><option key={r}>{r}</option>)}
                        </select>
                      </div>
                      <div style={{display:'flex',gap:5,alignItems:'end'}}>
                        <button onClick={()=>createUser(c.id)} disabled={loading||!userForm.email||!userForm.name}
                          style={{background:C.accent,color:'#fff',border:'none',borderRadius:6,padding:'6px 12px',fontSize:12.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Add</button>
                        <button onClick={()=>setShowUser(null)} style={{background:'#fff',color:C.textMuted,border:`1px solid ${C.cardBorder}`,borderRadius:6,padding:'6px 10px',fontSize:12.5,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>×</button>
                      </div>
                    </div>
                  )}
                  {c.users?.slice(0,3).map((u:any)=>(
                    <div key={u.id} style={{display:'flex',alignItems:'center',gap:9,padding:'6px 0',borderBottom:`1px solid ${C.cardBorder}`}}>
                      <div style={{width:24,height:24,borderRadius:'50%',background:C.accentBg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:C.accent,flexShrink:0}}>{u.name?.[0]||'?'}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:500,color:C.text}}>{u.name}</div>
                        <div style={{fontSize:11.5,color:C.textLight}}>{u.email}</div>
                      </div>
                      <Badge label={u.role} color={u.role==='admin'?'#4338CA':C.accent} bg={u.role==='admin'?'#EEF2FF':C.accentBg}/>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  <button onClick={()=>impersonate(c.id,c.name)}
                    style={{fontSize:12.5,padding:'6px 12px',borderRadius:6,border:`1px solid ${C.cardBorder}`,background:'#fff',color:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:500}}>
                    View as this company
                  </button>
                  <div>
                    <select onChange={e=>updatePlan(c.id,e.target.value)} value={c.plan}
                      style={{fontSize:12.5,padding:'6px 12px',borderRadius:6,border:`1px solid ${C.accent}`,background:C.accentBg,color:C.accent,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:500}}>
                      {['demo','starter','growth','scale','enterprise'].map(p=><option key={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Billing ───────────────────────────────────────────────────────────────────
function Billing({companies}:{companies:any[]}) {
  const [invoices,setInvoices]=useState<any[]>([])
  const [summary,setSummary]=useState({paid:0,pending:0,overdue:0})
  const [showCreate,setShowCreate]=useState(false)
  const [form,setForm]=useState({companyId:'',type:'monthly',description:'',amount:'',dueDate:'',notes:''})

  const load=useCallback(async()=>{
    const res=await fetch('/api/master/billing'); const d=await res.json()
    setInvoices(d.invoices||[]); setSummary(d.summary||{paid:0,pending:0,overdue:0})
  },[])

  useEffect(()=>{load()},[load])

  const create=async()=>{
    await fetch('/api/master/billing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create_invoice',...form,amount:parseFloat(form.amount)})})
    setShowCreate(false); setForm({companyId:'',type:'monthly',description:'',amount:'',dueDate:'',notes:''}); load()
  }

  const updateStatus=async(invoiceId:string,status:string)=>{
    await fetch('/api/master/billing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update_status',invoiceId,status})})
    load()
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:C.text,letterSpacing:'-0.3px'}}>Billing</h2>
          <p style={{fontSize:13,color:C.textMuted,marginTop:2}}>Manual invoice tracking</p>
        </div>
        <button onClick={()=>setShowCreate(true)} style={{background:C.accent,color:'#fff',border:'none',borderRadius:7,padding:'9px 18px',fontSize:13.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>+ New invoice</button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
        <StatCard label="Collected this month" value={`$${summary.paid.toLocaleString('en',{minimumFractionDigits:0})}`} color={C.success}/>
        <StatCard label="Pending" value={`$${summary.pending.toLocaleString('en',{minimumFractionDigits:0})}`} color={C.warn}/>
        <StatCard label="Overdue" value={`$${summary.overdue.toLocaleString('en',{minimumFractionDigits:0})}`} color={summary.overdue>0?C.danger:C.text}/>
      </div>

      {showCreate&&(
        <Card style={{marginBottom:16,border:`1.5px solid ${C.accent}`}}>
          <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:14}}>New invoice</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            {[
              {k:'companyId',l:'Company',type:'select'},
              {k:'type',l:'Type',type:'select2'},
              {k:'description',l:'Description',type:'text'},
              {k:'amount',l:'Amount (USD)',type:'number'},
              {k:'dueDate',l:'Due date',type:'date'},
              {k:'notes',l:'Notes',type:'text'},
            ].map(f=>(
              <div key={f.k}>
                <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>{f.l}</div>
                {f.type==='select'
                  ?<select value={form.companyId} onChange={e=>setForm(p=>({...p,companyId:e.target.value}))}
                    style={{width:'100%',padding:'7px 10px',borderRadius:6,border:`1px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff',cursor:'pointer'}}>
                    <option value="">Select company...</option>
                    {companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  :f.type==='select2'
                  ?<select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}
                    style={{width:'100%',padding:'7px 10px',borderRadius:6,border:`1px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff',cursor:'pointer'}}>
                    {['onboarding','monthly','annual','addon','credit'].map(t=><option key={t}>{t}</option>)}
                  </select>
                  :<input type={f.type} value={(form as any)[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))}
                    style={{width:'100%',padding:'7px 10px',borderRadius:6,border:`1px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif'}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>}
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={create} disabled={!form.companyId||!form.amount||!form.description}
              style={{background:C.accent,color:'#fff',border:'none',borderRadius:7,padding:'8px 18px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Create</button>
            <button onClick={()=>setShowCreate(false)} style={{background:'#fff',color:C.textMuted,border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:'8px 14px',fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Cancel</button>
          </div>
        </Card>
      )}

      <Card>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:C.bg}}>
              {['Company','Type','Description','Amount','Due','Status',''].map(h=>(
                <th key={h} style={{padding:'9px 12px',textAlign:'left',fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',borderBottom:`1px solid ${C.cardBorder}`,whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv,i)=>{
              const sc=STATUS_COLORS[inv.status]||STATUS_COLORS.pending
              return(
                <tr key={inv.id} style={{borderBottom:`1px solid ${C.cardBorder}`,background:i%2===0?'#fff':'#F8FAFD'}}>
                  <td style={{padding:'10px 12px',fontSize:13,fontWeight:500,color:C.text}}>{inv.companies?.name||'—'}</td>
                  <td style={{padding:'10px 12px',fontSize:12.5,color:C.textMuted,textTransform:'capitalize'}}>{inv.type}</td>
                  <td style={{padding:'10px 12px',fontSize:13,color:C.text,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{inv.description}</td>
                  <td style={{padding:'10px 12px',fontSize:13,fontWeight:600,color:C.text,fontFamily:"'JetBrains Mono',monospace"}}>${Number(inv.amount).toLocaleString()}</td>
                  <td style={{padding:'10px 12px',fontSize:12.5,color:C.textLight,whiteSpace:'nowrap'}}>{inv.due_date||'—'}</td>
                  <td style={{padding:'10px 12px'}}>
                    <select value={inv.status} onChange={e=>updateStatus(inv.id,e.target.value)}
                      style={{padding:'3px 8px',borderRadius:5,border:`1.5px solid ${sc.color}44`,background:sc.bg,color:sc.color,fontSize:12,fontWeight:600,fontFamily:'Inter,sans-serif',cursor:'pointer'}}>
                      {['pending','paid','overdue','cancelled','refunded'].map(s=><option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={{padding:'10px 12px',fontSize:12,color:C.textLight}}>{inv.paid_date||''}</td>
                </tr>
              )
            })}
            {invoices.length===0&&<tr><td colSpan={7} style={{padding:'24px',textAlign:'center',fontSize:13.5,color:C.textLight}}>No invoices yet</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

// ── Errors ─────────────────────────────────────────────────────────────────────
function Errors() {
  const [errors,setErrors]=useState<any[]>([])
  const [stats,setStats]=useState({critical:0,unresolved:0,total:0})
  const [filter,setFilter]=useState<'all'|'unresolved'|'critical'>('unresolved')

  const load=useCallback(async()=>{
    const res=await fetch('/api/master/errors'); const d=await res.json()
    setErrors(d.errors||[]); setStats(d.stats||{critical:0,unresolved:0,total:0})
  },[])

  useEffect(()=>{load()},[load])

  const resolve=async(id:string)=>{
    await fetch('/api/master/errors',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'resolve',errorId:id})})
    load()
  }

  const resolveAll=async()=>{
    await fetch('/api/master/errors',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'resolve_all'})})
    load()
  }

  const SEV_COLORS:Record<string,{bg:string,color:string}>={
    critical:{bg:'#FEF2F2',color:'#EF4444'},
    error:   {bg:'#FEF2F2',color:'#EF4444'},
    warn:    {bg:'#FFFBEB',color:'#D97706'},
    info:    {bg:'#EFF6FF',color:'#3B82F6'},
  }

  const filtered=errors.filter(e=>filter==='all'?true:filter==='unresolved'?!e.resolved:e.severity==='critical'&&!e.resolved)

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:C.text,letterSpacing:'-0.3px'}}>Error monitor</h2>
          <p style={{fontSize:13,color:C.textMuted,marginTop:2}}>{stats.unresolved} unresolved · {stats.critical} critical</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>load()} style={{fontSize:13,padding:'7px 14px',borderRadius:6,border:`1px solid ${C.cardBorder}`,background:'#fff',color:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Refresh</button>
          {stats.unresolved>0&&<button onClick={resolveAll} style={{fontSize:13,padding:'7px 14px',borderRadius:6,border:`1px solid ${C.cardBorder}`,background:'#fff',color:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Resolve all</button>}
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
        <StatCard label="Critical" value={stats.critical} color={stats.critical>0?C.danger:C.text}/>
        <StatCard label="Unresolved" value={stats.unresolved} color={stats.unresolved>0?C.warn:C.text}/>
        <StatCard label="Total logged" value={stats.total}/>
      </div>

      <div style={{display:'flex',gap:7,marginBottom:14}}>
        {(['all','unresolved','critical'] as const).map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{padding:'6px 14px',borderRadius:6,border:'1.5px solid',fontSize:12.5,fontWeight:500,cursor:'pointer',fontFamily:'Inter,sans-serif',textTransform:'capitalize',
              borderColor:filter===f?C.accent:C.cardBorder,background:filter===f?C.accentBg:'#fff',color:filter===f?C.accent:C.textMuted}}>
            {f}
          </button>
        ))}
      </div>

      <Card>
        {filtered.length===0
          ?<div style={{textAlign:'center',padding:'32px',fontSize:13.5,color:C.textLight}}>
            {filter==='unresolved'?'No unresolved errors':'No errors found'}
          </div>
          :filtered.map((e,i)=>{
            const sc=SEV_COLORS[e.severity]||SEV_COLORS.error
            return(
              <div key={e.id} style={{padding:'12px 0',borderBottom:i<filtered.length-1?`1px solid ${C.cardBorder}`:'none',opacity:e.resolved?0.5:1}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                  <span style={{fontSize:11,fontWeight:700,padding:'2px 7px',borderRadius:4,background:sc.bg,color:sc.color,flexShrink:0,marginTop:1}}>{e.severity}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13.5,fontWeight:500,color:C.text,marginBottom:2}}>{e.message}</div>
                    <div style={{fontSize:12,color:C.textLight,display:'flex',gap:10,flexWrap:'wrap'}}>
                      {e.companies?.name&&<span>Company: {e.companies.name}</span>}
                      {e.route&&<span>Route: {e.route}</span>}
                      <span>{new Date(e.created_at).toLocaleString()}</span>
                    </div>
                    {e.stack&&<pre style={{fontSize:10.5,color:C.textLight,marginTop:6,fontFamily:"'JetBrains Mono',monospace",whiteSpace:'pre-wrap',wordBreak:'break-all',maxHeight:60,overflow:'hidden'}}>{e.stack.split('\n').slice(0,3).join('\n')}</pre>}
                  </div>
                  {!e.resolved&&(
                    <button onClick={()=>resolve(e.id)} style={{fontSize:11.5,padding:'4px 9px',borderRadius:5,border:`1px solid ${C.cardBorder}`,background:'#fff',color:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif',whiteSpace:'nowrap',flexShrink:0}}>Resolve</button>
                  )}
                </div>
              </div>
            )
          })}
      </Card>
    </div>
  )
}

// ── Feature flags ─────────────────────────────────────────────────────────────
function Flags() {
  const [flags,setFlags]=useState<any[]>([])
  const [showCreate,setShowCreate]=useState(false)
  const [form,setForm]=useState({name:'',description:''})

  const load=useCallback(async()=>{
    const res=await fetch('/api/master/flags'); const d=await res.json()
    setFlags(d.flags||[])
  },[])

  useEffect(()=>{load()},[load])

  const toggle=async(flagId:string,name:string,enabled:boolean)=>{
    await fetch('/api/master/flags',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'toggle_global',flagId,name,enabled})})
    load()
  }

  const create=async()=>{
    await fetch('/api/master/flags',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create_flag',...form})})
    setShowCreate(false); setForm({name:'',description:''}); load()
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:C.text,letterSpacing:'-0.3px'}}>Feature flags</h2>
          <p style={{fontSize:13,color:C.textMuted,marginTop:2}}>Control feature rollouts globally</p>
        </div>
        <button onClick={()=>setShowCreate(s=>!s)} style={{background:C.accent,color:'#fff',border:'none',borderRadius:7,padding:'9px 18px',fontSize:13.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>+ New flag</button>
      </div>

      {showCreate&&(
        <Card style={{marginBottom:14,border:`1.5px solid ${C.accent}`}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:10,alignItems:'end'}}>
            {[['name','Flag name','scheduled_reports'],['description','Description','Description']].map(([k,l,p])=>(
              <div key={k}>
                <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>{l}</div>
                <input value={(form as any)[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} placeholder={p}
                  style={{width:'100%',padding:'8px 10px',borderRadius:6,border:`1px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif'}}/>
              </div>
            ))}
            <div style={{display:'flex',gap:6}}>
              <button onClick={create} disabled={!form.name} style={{background:C.accent,color:'#fff',border:'none',borderRadius:6,padding:'8px 14px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Add</button>
              <button onClick={()=>setShowCreate(false)} style={{background:'#fff',color:C.textMuted,border:`1px solid ${C.cardBorder}`,borderRadius:6,padding:'8px 10px',fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>×</button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        {flags.map((f,i)=>(
          <div key={f.id} style={{display:'flex',alignItems:'center',gap:14,padding:'13px 0',borderBottom:i<flags.length-1?`1px solid ${C.cardBorder}`:'none'}}>
            <button onClick={()=>toggle(f.id,f.name,!f.enabled_global)}
              style={{width:40,height:22,borderRadius:11,border:'none',cursor:'pointer',background:f.enabled_global?C.accent:'#CBD5E1',position:'relative',transition:'background .2s',flexShrink:0}}>
              <div style={{width:16,height:16,borderRadius:'50%',background:'#fff',position:'absolute',top:3,left:f.enabled_global?21:3,transition:'left .2s'}}/>
            </button>
            <div style={{flex:1}}>
              <div style={{fontSize:13.5,fontWeight:600,color:C.text,fontFamily:"'JetBrains Mono',monospace"}}>{f.name}</div>
              <div style={{fontSize:12.5,color:C.textMuted,marginTop:2}}>{f.description}</div>
            </div>
            <span style={{fontSize:12.5,fontWeight:600,color:f.enabled_global?C.success:C.textLight}}>{f.enabled_global?'Enabled globally':'Disabled'}</span>
          </div>
        ))}
        {flags.length===0&&<div style={{textAlign:'center',padding:'24px',fontSize:13.5,color:C.textLight}}>No flags yet</div>}
      </Card>
    </div>
  )
}

// ── Announcements ─────────────────────────────────────────────────────────────
function Announce() {
  const [items,setItems]=useState<any[]>([])
  const [showCreate,setShowCreate]=useState(false)
  const [form,setForm]=useState({title:'',body:'',type:'info',target:'all'})

  const load=useCallback(async()=>{
    const res=await fetch('/api/master/announce'); const d=await res.json()
    setItems(d.announcements||[])
  },[])

  useEffect(()=>{load()},[load])

  const create=async()=>{
    await fetch('/api/master/announce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',...form})})
    setShowCreate(false); setForm({title:'',body:'',type:'info',target:'all'}); load()
  }

  const toggle=async(id:string,active:boolean)=>{
    await fetch('/api/master/announce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'toggle',id,active})})
    load()
  }

  const del=async(id:string)=>{
    await fetch('/api/master/announce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',id})})
    load()
  }

  const TYPE_COLORS:Record<string,string>={info:'#3B82F6',warning:'#D97706',feature:'#059669',maintenance:'#EF4444'}

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:C.text,letterSpacing:'-0.3px'}}>Announcements</h2>
          <p style={{fontSize:13,color:C.textMuted,marginTop:2}}>Push messages to customer dashboards</p>
        </div>
        <button onClick={()=>setShowCreate(s=>!s)} style={{background:C.accent,color:'#fff',border:'none',borderRadius:7,padding:'9px 18px',fontSize:13.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>+ New announcement</button>
      </div>

      {showCreate&&(
        <Card style={{marginBottom:14,border:`1.5px solid ${C.accent}`}}>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>Title</div>
              <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="New feature available"
                style={{width:'100%',padding:'8px 11px',borderRadius:7,border:`1px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif'}}/>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>Message</div>
              <textarea value={form.body} onChange={e=>setForm(p=>({...p,body:e.target.value}))} rows={3} placeholder="We just shipped..."
                style={{width:'100%',padding:'8px 11px',borderRadius:7,border:`1px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif',resize:'vertical'}}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {[['type','Type',['info','warning','feature','maintenance']],['target','Audience',['all','plan_starter','plan_growth','plan_scale','plan_enterprise']]].map(([k,l,opts])=>(
                <div key={k as string}>
                  <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>{l as string}</div>
                  <select value={(form as any)[k as string]} onChange={e=>setForm(p=>({...p,[k as string]:e.target.value}))}
                    style={{width:'100%',padding:'8px 11px',borderRadius:7,border:`1px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff',cursor:'pointer'}}>
                    {(opts as string[]).map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={create} disabled={!form.title||!form.body} style={{background:C.accent,color:'#fff',border:'none',borderRadius:7,padding:'8px 18px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Publish</button>
              <button onClick={()=>setShowCreate(false)} style={{background:'#fff',color:C.textMuted,border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:'8px 14px',fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Cancel</button>
            </div>
          </div>
        </Card>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {items.map(item=>(
          <Card key={item.id}>
            <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:TYPE_COLORS[item.type]||'#6B7280',marginTop:6,flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <span style={{fontSize:14,fontWeight:600,color:C.text}}>{item.title}</span>
                  <Badge label={item.type} color={TYPE_COLORS[item.type]} bg={`${TYPE_COLORS[item.type]}18`}/>
                  <Badge label={item.target} color={C.textLight} bg='#F9FAFB'/>
                </div>
                <div style={{fontSize:13.5,color:C.textMuted,lineHeight:1.55,marginBottom:6}}>{item.body}</div>
                <div style={{fontSize:12,color:C.textLight}}>{new Date(item.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{display:'flex',gap:7,flexShrink:0}}>
                <button onClick={()=>toggle(item.id,!item.active)}
                  style={{fontSize:12,padding:'4px 10px',borderRadius:5,border:`1px solid ${C.cardBorder}`,background:'#fff',color:item.active?C.warn:C.success,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:500}}>
                  {item.active?'Pause':'Activate'}
                </button>
                <button onClick={()=>del(item.id)} style={{fontSize:12,padding:'4px 10px',borderRadius:5,border:'1px solid #FECACA',background:'#FEF2F2',color:C.danger,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:500}}>Delete</button>
              </div>
            </div>
          </Card>
        ))}
        {items.length===0&&<Card><div style={{textAlign:'center',padding:'24px',fontSize:13.5,color:C.textLight}}>No announcements yet</div></Card>}
      </div>
    </div>
  )
}

// ── Root master page ──────────────────────────────────────────────────────────
export default function MasterAdmin() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overview')
  const [companies, setCompanies] = useState<any[]>([])
  const [errors, setErrors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [companiesRes, errorsRes] = await Promise.all([
      fetch('/api/master/companies'),
      fetch('/api/master/errors'),
    ])
    const [cd, ed] = await Promise.all([companiesRes.json(), errorsRes.json()])
    if (companiesRes.status === 401) { router.push('/master/login'); return }
    setCompanies(cd.companies||[])
    setErrors(ed.errors||[])
    setLoading(false)
  }, [router])

  useEffect(() => { loadAll() }, [loadAll])

  const signOut = async () => {
    await fetch('/api/master/auth', { method: 'DELETE' })
    router.push('/master/login')
  }

  const TAB_LIST:[Tab,string,string?][] = [
    ['overview',  'Overview'],
    ['companies', 'Companies'],
    ['billing',   'Billing'],
    ['errors',    'Errors', errors.filter(e=>!e.resolved&&e.severity==='critical').length>0?'!':undefined],
    ['flags',     'Feature flags'],
    ['announce',  'Announcements'],
  ]

  if (loading) {
    return (
      <div style={{fontFamily:'Inter,sans-serif',background:C.bg,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{fontSize:14,color:C.textLight}}>Loading...</div>
      </div>
    )
  }

  return (
    <div style={{fontFamily:'Inter,-apple-system,sans-serif',background:C.bg,minHeight:'100vh'}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}`}</style>

      <nav style={{background:C.navBg,borderBottom:`1px solid ${C.navBorder}`,padding:'0 24px',height:52,display:'flex',alignItems:'center',gap:0,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginRight:24,paddingRight:20,borderRight:`1px solid ${C.navBorder}`}}>
          <div style={{width:26,height:26,background:'linear-gradient(135deg,#10B981,#059669)',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{color:'#fff',fontFamily:"'JetBrains Mono'",fontWeight:700,fontSize:10}}>{'{ }'}</span>
          </div>
          <span style={{fontWeight:700,fontSize:14.5,color:'#fff'}}>Qwezy</span>
          <span style={{fontSize:11.5,color:C.navText,padding:'2px 7px',background:'rgba(16,185,129,0.15)',borderRadius:4,fontWeight:600,marginLeft:4}}>Master</span>
        </div>
        <div style={{display:'flex',gap:2,flex:1}}>
          {TAB_LIST.map(([t,l,badge])=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{background:'none',border:'none',padding:'0 13px',height:52,fontSize:13,fontWeight:500,color:tab===t?'#fff':C.navText,cursor:'pointer',borderBottom:tab===t?`2px solid ${C.navActive}`:'2px solid transparent',fontFamily:'Inter,sans-serif',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:6}}>
              {l}
              {badge&&<span style={{width:16,height:16,borderRadius:'50%',background:C.danger,color:'#fff',fontSize:9,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center'}}>{badge}</span>}
            </button>
          ))}
        </div>
        <button onClick={signOut} style={{fontSize:13,color:C.navText,background:'none',border:`1px solid ${C.navBorder}`,borderRadius:6,padding:'5px 12px',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Sign out</button>
      </nav>

      <div style={{padding:24,maxWidth:1200,margin:'0 auto'}}>
        {tab==='overview'  &&<Overview companies={companies} errors={errors}/>}
        {tab==='companies' &&<Companies companies={companies} reload={loadAll}/>}
        {tab==='billing'   &&<Billing companies={companies}/>}
        {tab==='errors'    &&<Errors/>}
        {tab==='flags'     &&<Flags/>}
        {tab==='announce'  &&<Announce/>}
      </div>
    </div>
  )
}
