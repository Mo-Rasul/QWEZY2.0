'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

const C = {
  navBg:'#022c22', navBorder:'#064e3b', navText:'#6ee7b7', navActive:'#10b981',
  bg:'#F6F9FC', card:'#fff', cardBorder:'#E3EAF2',
  accent:'#059669', accentDark:'#047857', accentBg:'#ECFDF5',
  text:'#0F1923', textMuted:'#4B6358', textLight:'#8A9BB0',
  success:'#10B981', danger:'#EF4444', warn:'#F59E0B',
}

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_USERS = [
  {id:'u1',name:'Jordan Davis',    email:'jordan@company.com',  role:'admin',   status:'active',  lastSeen:'2 hours ago',   queries:312, joined:'2026-01-10'},
  {id:'u2',name:'Priya Mehta',     email:'priya@company.com',   role:'analyst', status:'active',  lastSeen:'1 day ago',     queries:89,  joined:'2026-02-03'},
  {id:'u3',name:'Chris Okonkwo',   email:'chris@company.com',   role:'analyst', status:'active',  lastSeen:'3 days ago',    queries:204, joined:'2026-01-22'},
  {id:'u4',name:'Sara Lindqvist',  email:'sara@company.com',    role:'viewer',  status:'active',  lastSeen:'Today',         queries:17,  joined:'2026-03-01'},
  {id:'u5',name:'Mike Torres',     email:'mike@company.com',    role:'analyst', status:'pending', lastSeen:'Never',         queries:0,   joined:'2026-03-20'},
  {id:'u6',name:'Elena Vasquez',   email:'elena@company.com',   role:'viewer',  status:'inactive',lastSeen:'30 days ago',   queries:5,   joined:'2026-01-15'},
]

const MOCK_TABLES = ['orders','customers','products','revenue','employees']

const MOCK_USAGE = [
  {date:'Mar 16',queries:42},{date:'Mar 17',queries:67},{date:'Mar 18',queries:55},
  {date:'Mar 19',queries:88},{date:'Mar 20',queries:103},{date:'Mar 21',queries:91},{date:'Mar 22',queries:127},
]

const ROLE_COLOR: Record<string,{bg:string,color:string,border:string}> = {
  admin:   {bg:'#EEF2FF',color:'#4338CA',border:'#C7D2FE'},
  analyst: {bg:C.accentBg,color:C.accent,border:'#A7F3D0'},
  viewer:  {bg:'#F8FAFD',color:C.textLight,border:C.cardBorder},
}
const STATUS_COLOR: Record<string,{bg:string,color:string}> = {
  active:   {bg:C.accentBg,color:C.success},
  pending:  {bg:'#FFFBEB',color:C.warn},
  inactive: {bg:'#F8FAFD',color:C.textLight},
}
const LEAD_STATUS: Record<string,{bg:string,color:string,label:string}> = {
  new:       {bg:C.accentBg,color:C.accent,label:'New'},
  contacted: {bg:'#EEF2FF',color:'#4338CA',label:'Contacted'},
  demo:      {bg:'#FFFBEB',color:C.warn,label:'Demo booked'},
  closed:    {bg:'#F0FDF4',color:C.success,label:'Closed'},
}

type Tab = 'overview'|'users'|'access'|'usage'|'settings'

// ── Role badge ────────────────────────────────────────────────────────────────
const RoleBadge = ({role}:{role:string}) => {
  const s = ROLE_COLOR[role]||ROLE_COLOR.viewer
  return <span style={{fontSize:11.5,fontWeight:600,padding:'2px 8px',borderRadius:4,background:s.bg,color:s.color,border:`1px solid ${s.border}`}}>{role}</span>
}

// ── Invite Modal ──────────────────────────────────────────────────────────────
function InviteModal({onClose,onAdd}:{onClose:()=>void,onAdd:(u:any)=>void}) {
  const [email,setEmail]=useState('')
  const [name,setName]=useState('')
  const [role,setRole]=useState('analyst')
  const [sent,setSent]=useState(false)
  const submit=()=>{if(!email||!name)return;onAdd({id:`u${Date.now()}`,name,email,role,status:'pending',lastSeen:'Never',queries:0,joined:new Date().toISOString().split('T')[0]});setSent(true)}
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(15,25,35,0.55)',zIndex:400,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'#fff',borderRadius:10,width:'100%',maxWidth:420,boxShadow:'0 20px 60px rgba(0,0,0,0.2)',overflow:'hidden'}}>
        <div style={{padding:'14px 18px',borderBottom:`1px solid ${C.cardBorder}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontWeight:600,fontSize:14.5,color:C.text}}>Invite team member</div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,color:C.textLight,cursor:'pointer'}}>×</button>
        </div>
        {sent
          ?<div style={{padding:40,textAlign:'center'}}>
            <div style={{fontSize:40,marginBottom:12}}>✉️</div>
            <div style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:4}}>Invitation sent</div>
            <div style={{fontSize:13,color:C.textMuted,marginBottom:20}}>An invite link was sent to {email}</div>
            <button onClick={onClose} style={{background:C.accent,color:'#fff',border:'none',borderRadius:7,padding:'9px 20px',fontSize:13.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Done</button>
          </div>
          :<div style={{padding:20,display:'flex',flexDirection:'column',gap:13}}>
            {[['Full name',name,setName,'Jane Smith'],['Email address',email,setEmail,'jane@company.com']].map(([l,v,s,p]:any)=>(
              <div key={l}>
                <label style={{fontSize:11,fontWeight:600,color:C.textLight,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>{l}</label>
                <input value={v} onChange={e=>s(e.target.value)} placeholder={p}
                  style={{width:'100%',padding:'8px 11px',borderRadius:7,border:`1.5px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif'}}
                  onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
              </div>
            ))}
            <div>
              <label style={{fontSize:11,fontWeight:600,color:C.textLight,display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Role</label>
              <div style={{display:'flex',gap:7}}>
                {[['admin','Admin','Full access — can manage users, connections, and annotations'],['analyst','Analyst','Can query, save results, and build dashboards'],['viewer','Viewer','Read-only — can view dashboards and saved reports']].map(([v,l,d])=>(
                  <button key={v} onClick={()=>setRole(v)}
                    style={{flex:1,padding:'8px 6px',borderRadius:7,border:'1.5px solid',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'center',borderColor:role===v?C.accent:C.cardBorder,background:role===v?C.accentBg:'#fff',color:role===v?C.accent:C.textMuted,transition:'all .12s'}}>
                    <div style={{fontWeight:600,marginBottom:2}}>{l}</div>
                    <div style={{fontSize:10.5,lineHeight:1.35,fontWeight:400}}>{d}</div>
                  </button>
                ))}
              </div>
            </div>
            <button onClick={submit} disabled={!email||!name}
              style={{background:(!email||!name)?'#E3EAF2':C.accent,color:(!email||!name)?C.textLight:'#fff',border:'none',borderRadius:7,padding:'10px',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',marginTop:4,transition:'all .15s'}}>
              Send invitation
            </button>
          </div>}
      </div>
    </div>
  )
}

// ── Access Control Matrix ─────────────────────────────────────────────────────
function AccessMatrix() {
  type AccessState = Record<string, Record<string,'full'|'limited'|'none'>>
  const initAccess:AccessState = Object.fromEntries(MOCK_TABLES.map(t=>([t,{admin:'full',analyst:'full',viewer:'limited'}])))
  const [access,setAccess]=useState<AccessState>(initAccess)
  const [saved,setSaved]=useState(false)

  const cycle=(table:string,role:string)=>{
    if(role==='admin') return
    const cur=access[table][role]
    const next=cur==='full'?'limited':cur==='limited'?'none':'full'
    setAccess(p=>({...p,[table]:{...p[table],[role]:next}}))
    setSaved(false)
  }

  const AccessCell=({table,role}:{table:string,role:string})=>{
    const val=access[table]?.[role]||'none'
    const locked=role==='admin'
    const style:{bg:string,color:string,label:string}={
      full:    {bg:C.accentBg,    color:C.accent,    label:'Full'},
      limited: {bg:'#FFFBEB',    color:C.warn,      label:'View'},
      none:    {bg:'#F8FAFD',    color:C.textLight, label:'None'},
    }[val]||{bg:'#F8FAFD',color:C.textLight,label:'None'}
    return(
      <button onClick={()=>cycle(table,role)} disabled={locked}
        style={{padding:'5px 10px',borderRadius:5,border:'1.5px solid',fontSize:12,fontWeight:600,cursor:locked?'default':'pointer',fontFamily:'Inter,sans-serif',borderColor:style.color+'44',background:style.bg,color:style.color,transition:'all .12s',minWidth:60}}>
        {locked?'Full ✓':style.label}
      </button>
    )
  }

  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
        <div>
          <div style={{fontSize:15,fontWeight:600,color:C.text}}>Table-level access control</div>
          <div style={{fontSize:13,color:C.textMuted,marginTop:2}}>Click a cell to cycle: Full → View only → No access</div>
        </div>
        <button onClick={()=>setSaved(true)} style={{background:saved?C.accentBg:C.accent,color:saved?C.accent:'#fff',border:saved?`1px solid ${C.accent}`:'none',borderRadius:7,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',transition:'all .15s'}}>
          {saved?'✓ Saved':'Save changes'}
        </button>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:C.bg}}>
              <th style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',borderBottom:`1px solid ${C.cardBorder}`}}>Table</th>
              {['Admin','Analyst','Viewer'].map(r=><th key={r} style={{padding:'10px 14px',textAlign:'center',fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',borderBottom:`1px solid ${C.cardBorder}`}}>{r}</th>)}
            </tr>
          </thead>
          <tbody>
            {MOCK_TABLES.map((t,i)=>(
              <tr key={t} style={{background:i%2===0?'#fff':'#F8FAFD',borderBottom:`1px solid ${C.cardBorder}`}}>
                <td style={{padding:'10px 14px'}}>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:600,color:C.text}}>{t}</span>
                </td>
                {['admin','analyst','viewer'].map(r=>(
                  <td key={r} style={{padding:'8px 14px',textAlign:'center'}}>
                    <AccessCell table={t} role={r}/>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{marginTop:14,padding:'10px 13px',background:'#F8FAFD',borderRadius:7,border:`1px solid ${C.cardBorder}`,fontSize:12.5,color:C.textMuted}}>
        <strong style={{color:C.text}}>Full</strong> — query and export · <strong style={{color:C.text}}>View only</strong> — see results, no raw export · <strong style={{color:C.text}}>None</strong> — table hidden from all queries
      </div>
    </div>
  )
}

// ── Main Admin ────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter()
  const [tab,setTab]=useState<Tab>('overview')
  const [users,setUsers]=useState(MOCK_USERS)
  const [showInvite,setShowInvite]=useState(false)
  const [search,setSearch]=useState('')
  const [editUser,setEditUser]=useState<string|null>(null)
  const [userRole,setUserRole]=useState<Record<string,string>>({})
  const [leadStatus,setLeadStatus]=useState<Record<string,string>>({})
  const [confirmRemove,setConfirmRemove]=useState<string|null>(null)
  const filteredUsers=useMemo(()=>users.filter(u=>u.name.toLowerCase().includes(search.toLowerCase())||u.email.toLowerCase().includes(search.toLowerCase())),[users,search])

  const totalQueries=users.reduce((s,u)=>s+u.queries,0)
  const activeUsers=users.filter(u=>u.status==='active').length

  const TAB_LIST:[Tab,string][]=[['overview','Overview'],['users','Users'],['access','Access control'],['usage','Usage'],['settings','Settings']]

  const statCard=(label:string,val:string|number,sub?:string,color?:string)=>(
    <div style={{background:'#fff',borderRadius:9,border:`1px solid ${C.cardBorder}`,padding:'16px 18px'}}>
      <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>{label}</div>
      <div style={{fontSize:26,fontWeight:800,color:color||C.text,letterSpacing:'-0.5px',lineHeight:1}}>{val}</div>
      {sub&&<div style={{fontSize:12,color:C.textLight,marginTop:5}}>{sub}</div>}
    </div>
  )

  return(
    <div style={{fontFamily:'Inter,-apple-system,sans-serif',background:C.bg,minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}`}</style>
      {showInvite&&<InviteModal onClose={()=>setShowInvite(false)} onAdd={u=>{setUsers(p=>[...p,u]);setShowInvite(false)}}/>}

      {/* Nav */}
      <nav style={{background:C.navBg,borderBottom:`1px solid ${C.navBorder}`,padding:'0 24px',height:52,display:'flex',alignItems:'center',gap:0,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginRight:28,paddingRight:24,borderRight:`1px solid ${C.navBorder}`}}>
          <div style={{width:26,height:26,background:'linear-gradient(135deg,#10B981,#059669)',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{color:'#fff',fontFamily:"'JetBrains Mono'",fontWeight:700,fontSize:10}}>{'{ }'}</span>
          </div>
          <span style={{fontWeight:700,fontSize:14.5,color:'#fff'}}>Qwezy</span>
          <span style={{fontSize:12,color:C.navText,marginLeft:4,padding:'2px 8px',background:'rgba(16,185,129,0.15)',borderRadius:4,fontWeight:600}}>Admin</span>
        </div>
        <div style={{display:'flex',gap:2,flex:1}}>
          {TAB_LIST.map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{background:'none',border:'none',padding:'0 13px',height:52,fontSize:13,fontWeight:500,color:tab===t?'#fff':C.navText,cursor:'pointer',borderBottom:tab===t?`2px solid ${C.navActive}`:'2px solid transparent',fontFamily:'Inter,sans-serif',transition:'color .15s',whiteSpace:'nowrap'}}>
              {l}
            </button>
          ))}
        </div>
        <div style={{display:'flex',gap:9,alignItems:'center'}}>
          <button onClick={()=>router.push('/dashboard')} style={{fontSize:13,color:C.navText,background:'none',border:`1px solid ${C.navBorder}`,borderRadius:6,padding:'5px 12px',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>← Back to app</button>
          <div style={{width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,#10B981,#047857)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:11}}>JD</div>
        </div>
      </nav>

      <div style={{padding:24,flex:1}}>

        {/* ── OVERVIEW ── */}
        {tab==='overview'&&<div>
          <div style={{marginBottom:20}}>
            <h2 style={{fontSize:20,fontWeight:700,color:C.text,letterSpacing:'-0.3px'}}>Overview</h2>
            <p style={{fontSize:13,color:C.textMuted,marginTop:2}}>Your Qwezy workspace at a glance</p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
            {statCard('Active users',activeUsers,`${users.length} total`)}
            {statCard('Queries this month',totalQueries,'Across all users')}
            {statCard('Tables connected','5','Northwind DB')}
          </div>

          {/* Usage sparkline */}
          <div style={{background:'#fff',borderRadius:9,border:`1px solid ${C.cardBorder}`,padding:'18px 20px',marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:16}}>Queries — last 7 days</div>
            <div style={{display:'flex',alignItems:'flex-end',gap:8,height:80}}>
              {MOCK_USAGE.map(d=>{
                const max=Math.max(...MOCK_USAGE.map(x=>x.queries))
                const h=Math.round((d.queries/max)*72)
                return(
                  <div key={d.date} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
                    <span style={{fontSize:10.5,color:C.textLight,fontWeight:600}}>{d.queries}</span>
                    <div style={{width:'100%',height:h,background:C.accent,borderRadius:'4px 4px 0 0',opacity:0.85}}/>
                    <span style={{fontSize:10,color:C.textLight}}>{d.date.replace('Mar ','')}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recent users */}
          <div style={{background:'#fff',borderRadius:9,border:`1px solid ${C.cardBorder}`,padding:'18px 20px'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
              <div style={{fontSize:14,fontWeight:600,color:C.text}}>Active users</div>
              <button onClick={()=>setTab('users')} style={{fontSize:13,color:C.accent,background:'none',border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:500}}>Manage →</button>
            </div>
            {users.filter(u=>u.status==='active').slice(0,4).map(u=>(
              <div key={u.id} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 0',borderBottom:`1px solid ${C.cardBorder}`}}>
                <div style={{width:30,height:30,borderRadius:'50%',background:C.accentBg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:C.accent,flexShrink:0}}>{u.name[0]}</div>
                <div style={{flex:1}}><div style={{fontSize:13.5,fontWeight:500,color:C.text}}>{u.name}</div><div style={{fontSize:12,color:C.textLight}}>{u.lastSeen}</div></div>
                <RoleBadge role={u.role}/>
                <span style={{fontSize:12.5,color:C.textMuted,fontWeight:500,minWidth:60,textAlign:'right'}}>{u.queries} queries</span>
              </div>
            ))}
          </div>
        </div>}

        {/* ── USERS ── */}
        {tab==='users'&&<div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
            <div>
              <h2 style={{fontSize:20,fontWeight:700,color:C.text,letterSpacing:'-0.3px'}}>Team members</h2>
              <p style={{fontSize:13,color:C.textMuted,marginTop:2}}>{users.length} members · {activeUsers} active</p>
            </div>
            <button onClick={()=>setShowInvite(true)}
              style={{background:C.accent,color:'#fff',border:'none',borderRadius:7,padding:'9px 18px',fontSize:13.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
              + Invite member
            </button>
          </div>

          <div style={{background:'#fff',borderRadius:9,border:`1px solid ${C.cardBorder}`,overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.cardBorder}`,background:C.bg}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or email…"
                style={{padding:'7px 11px',borderRadius:7,border:`1px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif',width:280,background:'#fff'}}
                onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
            </div>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:C.bg}}>
                  {['Member','Role','Status','Queries','Last seen','Joined',''].map(h=>(
                    <th key={h} style={{padding:'10px 16px',textAlign:'left',fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',borderBottom:`1px solid ${C.cardBorder}`,whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u,i)=>{
                  const sc=STATUS_COLOR[u.status]||STATUS_COLOR.inactive
                  return(
                    <tr key={u.id} style={{borderBottom:`1px solid ${C.cardBorder}`,background:i%2===0?'#fff':'#F8FAFD'}}>
                      <td style={{padding:'12px 16px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:9}}>
                          <div style={{width:30,height:30,borderRadius:'50%',background:u.status==='inactive'?'#F0F4F8':C.accentBg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:u.status==='inactive'?C.textLight:C.accent,flexShrink:0}}>{u.name[0]}</div>
                          <div><div style={{fontSize:13.5,fontWeight:500,color:C.text}}>{u.name}</div><div style={{fontSize:12,color:C.textLight}}>{u.email}</div></div>
                        </div>
                      </td>
                      <td style={{padding:'12px 16px'}}>
                        {editUser===u.id
                          ?<select value={userRole[u.id]||u.role} onChange={e=>setUserRole(p=>({...p,[u.id]:e.target.value}))}
                            style={{padding:'4px 8px',borderRadius:5,border:`1px solid ${C.cardBorder}`,fontSize:12.5,fontFamily:'Inter,sans-serif',background:'#fff',cursor:'pointer'}}>
                            <option value="admin">Admin</option><option value="analyst">Analyst</option><option value="viewer">Viewer</option>
                          </select>
                          :<RoleBadge role={userRole[u.id]||u.role}/>}
                      </td>
                      <td style={{padding:'12px 16px'}}><span style={{fontSize:12,fontWeight:600,padding:'2px 8px',borderRadius:4,background:sc.bg,color:sc.color}}>{u.status}</span></td>
                      <td style={{padding:'12px 16px',fontSize:13,color:C.textMuted}}>{u.queries}</td>
                      <td style={{padding:'12px 16px',fontSize:13,color:C.textMuted,whiteSpace:'nowrap'}}>{u.lastSeen}</td>
                      <td style={{padding:'12px 16px',fontSize:13,color:C.textMuted,whiteSpace:'nowrap'}}>{u.joined}</td>
                      <td style={{padding:'12px 16px'}}>
                        <div style={{display:'flex',gap:6}}>
                          {editUser===u.id
                            ?<><button onClick={()=>{setUsers(p=>p.map(x=>x.id===u.id?{...x,role:userRole[u.id]||x.role}:x));setEditUser(null)}}
                                style={{fontSize:12,padding:'4px 9px',borderRadius:5,border:'none',background:C.accent,color:'#fff',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:600}}>Save</button>
                              <button onClick={()=>setEditUser(null)} style={{fontSize:12,padding:'4px 9px',borderRadius:5,border:`1px solid ${C.cardBorder}`,background:'#fff',color:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Cancel</button></>
                            :<><button onClick={()=>{setEditUser(u.id);setUserRole(p=>({...p,[u.id]:u.role}))}}
                                style={{fontSize:12,padding:'4px 10px',borderRadius:5,border:`1px solid ${C.cardBorder}`,background:'#fff',color:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:500}}>Edit</button>
                              {confirmRemove===u.id
                                ?<><button onClick={()=>{setUsers(p=>p.filter(x=>x.id!==u.id));setConfirmRemove(null)}} style={{fontSize:12,padding:'4px 9px',borderRadius:5,border:'none',background:C.danger,color:'#fff',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:600}}>Confirm</button>
                                  <button onClick={()=>setConfirmRemove(null)} style={{fontSize:12,padding:'4px 9px',borderRadius:5,border:`1px solid ${C.cardBorder}`,background:'#fff',color:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Cancel</button></>
                                :<button onClick={()=>setConfirmRemove(u.id)} style={{fontSize:12,padding:'4px 10px',borderRadius:5,border:'1px solid #FECACA',background:'#FEF2F2',color:C.danger,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:500}}>Remove</button>}</>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>}

        {/* ── ACCESS ── */}
        {tab==='access'&&<div>
          <div style={{marginBottom:20}}>
            <h2 style={{fontSize:20,fontWeight:700,color:C.text,letterSpacing:'-0.3px'}}>Access control</h2>
            <p style={{fontSize:13,color:C.textMuted,marginTop:2}}>Control which roles can query each table. Changes apply immediately to all members with that role.</p>
          </div>
          <div style={{background:'#fff',borderRadius:9,border:`1px solid ${C.cardBorder}`,padding:'20px 22px',marginBottom:16}}>
            <AccessMatrix/>
          </div>
          <div style={{background:'#fff',borderRadius:9,border:`1px solid ${C.cardBorder}`,padding:'18px 22px'}}>
            <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:12}}>Role definitions</div>
            {[['Admin','Full access — can manage users, connections, annotations, and all tables. Can change any setting.'],['Analyst','Can query any table they have access to, save results, build dashboards and reports. Cannot manage users or settings.'],['Viewer','Can view dashboards and saved reports. Cannot run new queries or see raw table data.']].map(([r,d])=>(
              <div key={r} style={{display:'flex',gap:12,padding:'10px 0',borderBottom:`1px solid ${C.cardBorder}`}}>
                <div style={{paddingTop:1,flexShrink:0}}><RoleBadge role={r.toLowerCase()}/></div>
                <div style={{fontSize:13.5,color:C.textMuted,lineHeight:1.55}}>{d}</div>
              </div>
            ))}
          </div>
        </div>}

        {/* ── USAGE ── */}
        {tab==='usage'&&(()=>{
          const QUERY_LIMIT=5000, SEAT_LIMIT=30, REPORT_LIMIT=50
          const queriesUsed=totalQueries, seatsUsed=activeUsers, reportsUsed=8
          const qPct=Math.round(queriesUsed/QUERY_LIMIT*100)
          const sPct=Math.round(seatsUsed/SEAT_LIMIT*100)
          const rPct=Math.round(reportsUsed/REPORT_LIMIT*100)
          const barColor=(pct:number)=>pct>=90?C.danger:pct>=70?C.warn:C.accent
          const QuotaBar=({label,used,limit,unit,pct,note}:{label:string,used:number,limit:number,unit:string,pct:number,note?:string})=>(
            <div style={{background:'#fff',borderRadius:9,border:`1px solid ${C.cardBorder}`,padding:'18px 22px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:10}}>
                <div style={{fontSize:14.5,fontWeight:600,color:C.text}}>{label}</div>
                <div style={{textAlign:'right'}}>
                  <span style={{fontSize:22,fontWeight:800,color:pct>=90?C.danger:pct>=70?C.warn:C.text,letterSpacing:'-0.5px'}}>{used.toLocaleString()}</span>
                  <span style={{fontSize:13.5,color:C.textLight}}> / {limit.toLocaleString()} {unit}</span>
                </div>
              </div>
              <div style={{height:8,background:'#F0F4F8',borderRadius:4,overflow:'hidden',marginBottom:8}}>
                <div style={{height:'100%',width:`${Math.min(pct,100)}%`,background:barColor(pct),borderRadius:4,transition:'width .5s ease'}}/>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:12,color:pct>=90?C.danger:pct>=70?C.warn:C.textLight,fontWeight:pct>=70?600:400}}>
                  {pct>=90?'Approaching limit — consider upgrading':pct>=70?`${100-pct}% remaining`:`${100-pct}% remaining`}
                </span>
                {note&&<span style={{fontSize:12,color:C.textLight}}>{note}</span>}
              </div>
            </div>
          )
          return(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
              <div>
                <h2 style={{fontSize:20,fontWeight:700,color:C.text,letterSpacing:'-0.3px'}}>Usage</h2>
                <p style={{fontSize:13,color:C.textMuted,marginTop:2}}>March 2026 · Growth plan · Resets Apr 1</p>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',background:C.accentBg,border:`1px solid ${C.accent}33`,borderRadius:8}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:C.success}}/>
                <span style={{fontSize:13,fontWeight:600,color:C.accentDark}}>Growth plan · $1,200/mo</span>
                <button style={{fontSize:12,color:C.accent,background:'none',border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:600,marginLeft:4,textDecoration:'underline'}}>Upgrade →</button>
              </div>
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:20}}>
              <QuotaBar label="Queries this month" used={queriesUsed} limit={QUERY_LIMIT} unit="queries" pct={qPct} note="Resets Apr 1"/>
              <QuotaBar label="Active seats" used={seatsUsed} limit={SEAT_LIMIT} unit="seats" pct={sPct} note="Invite more on Users tab"/>
              <QuotaBar label="Scheduled reports" used={reportsUsed} limit={REPORT_LIMIT} unit="reports" pct={rPct}/>
            </div>

            {/* Daily bar chart */}
            <div style={{background:'#fff',borderRadius:9,border:`1px solid ${C.cardBorder}`,padding:'18px 20px',marginBottom:14}}>
              <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:18}}>Queries per day — last 7 days</div>
              <div style={{display:'flex',alignItems:'flex-end',gap:8,height:100}}>
                {MOCK_USAGE.map(d=>{
                  const max=Math.max(...MOCK_USAGE.map(x=>x.queries))
                  const h=Math.round((d.queries/max)*90)
                  return(
                    <div key={d.date} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                      <span style={{fontSize:10.5,color:C.textLight,fontWeight:600}}>{d.queries}</span>
                      <div style={{width:'100%',height:h,background:C.accent,borderRadius:'3px 3px 0 0',opacity:0.85}}/>
                      <span style={{fontSize:10,color:C.textLight}}>{d.date.replace('Mar ','')}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Per-member usage */}
            <div style={{background:'#fff',borderRadius:9,border:`1px solid ${C.cardBorder}`,padding:'18px 20px'}}>
              <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:4}}>Usage by member</div>
              <div style={{fontSize:12.5,color:C.textMuted,marginBottom:14}}>This billing period</div>
              {[...users].sort((a,b)=>b.queries-a.queries).map((u,i)=>{
                const pct=Math.round(u.queries/QUERY_LIMIT*100*users.length) // per-user share of plan
                const sharePct=totalQueries>0?Math.round(u.queries/totalQueries*100):0
                return(
                  <div key={u.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:i<users.length-1?`1px solid ${C.cardBorder}`:'none'}}>
                    <div style={{width:30,height:30,borderRadius:'50%',background:u.status==='inactive'?'#F0F4F8':C.accentBg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:u.status==='inactive'?C.textLight:C.accent,flexShrink:0}}>{u.name[0]}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                        <span style={{fontSize:13.5,color:C.text,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u.name}</span>
                        <span style={{fontSize:12.5,color:C.textMuted,whiteSpace:'nowrap',marginLeft:8}}>{u.queries} queries · {sharePct}% of total</span>
                      </div>
                      <div style={{height:5,background:'#F0F4F8',borderRadius:3,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${sharePct}%`,background:sharePct>40?C.warn:C.accent,borderRadius:3,transition:'width .4s ease'}}/>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          )
        })()}

        {/* ── SETTINGS ── */}
        {tab==='settings'&&<div>
          <div style={{marginBottom:20}}>
            <h2 style={{fontSize:20,fontWeight:700,color:C.text,letterSpacing:'-0.3px'}}>Workspace settings</h2>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            {[
              {title:'Workspace name',desc:'Shown to all members',el:<input defaultValue="My Company" style={{padding:'8px 11px',borderRadius:7,border:`1.5px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif',width:280}} onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>},
              {title:'AI context isolation',desc:'Each company\'s AI context is fully isolated. Your data never leaves your organisation or trains any model.',el:<span style={{fontSize:13,fontWeight:600,color:C.success,background:C.accentBg,padding:'4px 10px',borderRadius:5,border:`1px solid ${C.success}44`}}>✓ Enabled — always on</span>},
              {title:'Query logging',desc:'Store query history for all users. Required for usage analytics.',el:<div style={{display:'flex',alignItems:'center',gap:9}}><button style={{width:36,height:20,borderRadius:10,border:'none',cursor:'pointer',background:C.accent,position:'relative'}}><div style={{width:14,height:14,borderRadius:'50%',background:'#fff',position:'absolute',top:3,left:19}}/></button><span style={{fontSize:13,color:C.text}}>Enabled</span></div>},
              {title:'Sensitive column masking',desc:'Columns marked sensitive during onboarding are always hidden from query results.',el:<span style={{fontSize:13,fontWeight:600,color:C.success,background:C.accentBg,padding:'4px 10px',borderRadius:5,border:`1px solid ${C.success}44`}}>✓ Enabled — always on</span>},
              {title:'API token',desc:'Use this token to connect Qwezy results to BI tools like PowerBI or Tableau.',el:<div style={{display:'flex',gap:7,alignItems:'center'}}><code style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12.5,background:'#F0F4F8',padding:'5px 10px',borderRadius:5,color:C.textMuted}}>demo-token-xxxxx</code><button style={{fontSize:12,padding:'5px 10px',borderRadius:5,border:`1px solid ${C.cardBorder}`,background:'#fff',color:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Rotate</button></div>},
            ].map(({title,desc,el})=>(
              <div key={title} style={{background:'#fff',borderRadius:9,border:`1px solid ${C.cardBorder}`,padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:16}}>
                <div><div style={{fontSize:14,fontWeight:600,color:C.text}}>{title}</div><div style={{fontSize:12.5,color:C.textMuted,marginTop:3}}>{desc}</div></div>
                {el}
              </div>
            ))}
          </div>
        </div>}

      </div>
    </div>
  )
}
