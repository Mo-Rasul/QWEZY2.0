'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const C = {
  bg:'#F6F9FC', card:'#fff', cardBorder:'#E3EAF2',
  accent:'#059669', accentDark:'#047857', accentBg:'#ECFDF5',
  text:'#0F1923', textMuted:'#4B6358', textLight:'#8A9BB0',
  success:'#10B981', danger:'#EF4444', warn:'#F59E0B',
}

const DB_SOURCES = [
  {id:'postgres',  label:'PostgreSQL',  icon:'🐘'},
  {id:'mysql',     label:'MySQL',       icon:'🐬'},
  {id:'snowflake', label:'Snowflake',   icon:'❄️'},
  {id:'bigquery',  label:'BigQuery',    icon:'☁️'},
  {id:'redshift',  label:'Redshift',    icon:'🔴'},
  {id:'mssql',     label:'SQL Server',  icon:'🟦'},
]

const TEAMS = ['Finance','Sales','Marketing','Operations','Product','Engineering','HR','Analytics']
const REFRESH = ['Real-time','Hourly','Daily','Weekly','Monthly','Rarely']

const MOCK_TABLES = [
  {name:'orders',     rows:14823, lastDate:'2026-03-22', pk:'order_id',
   cols:['order_id','customer_id','created_at','status','total_amount','region'],
   important:['customer_id','created_at','status','total_amount']},
  {name:'customers',  rows:3201,  lastDate:'2026-03-21', pk:'customer_id',
   cols:['customer_id','company_name','country','plan','mrr','created_at'],
   important:['company_name','plan','mrr']},
  {name:'products',   rows:412,   lastDate:'2026-03-10', pk:'product_id',
   cols:['product_id','name','category','price','in_stock'],
   important:['name','category','price']},
  {name:'revenue',    rows:52019, lastDate:'2026-03-22', pk:'id',
   cols:['id','order_id','amount','currency','date','type'],
   important:['order_id','amount','currency','date']},
  {name:'employees',  rows:87,    lastDate:'2026-02-28', pk:'employee_id',
   cols:['employee_id','name','role','team','hire_date'],
   important:['name','role','team']},
]

const MOCK_JOINS = [
  {id:'j1', from:'orders', fc:'customer_id', to:'customers', tc:'customer_id', type:'INNER', conf:0.98},
  {id:'j2', from:'revenue', fc:'order_id',   to:'orders',    tc:'order_id',    type:'LEFT',  conf:0.97},
  {id:'j3', from:'orders', fc:'product_id',  to:'products',  tc:'product_id',  type:'INNER', conf:0.84},
  {id:'j4', from:'orders', fc:'employee_id', to:'employees', tc:'employee_id', type:'LEFT',  conf:0.61},
]

type Step = 'connect'|'discover'|'annotate'|'joins'|'done'
const STEP_LABELS:{[k in Step]:string} = {connect:'Connect',discover:'Discover',annotate:'Annotate',joins:'Relationships',done:'Done'}
const STEPS:Step[] = ['connect','discover','annotate','joins','done']

// ── Small shared components ───────────────────────────────────────────────────
const Tag = ({label,active,onClick}:{label:string,active:boolean,onClick:()=>void}) => (
  <button onClick={onClick} style={{padding:'5px 11px',borderRadius:14,border:'1.5px solid',fontSize:12.5,fontWeight:500,cursor:'pointer',fontFamily:'Inter,sans-serif',transition:'all .12s',whiteSpace:'nowrap',borderColor:active?C.accent:C.cardBorder,background:active?C.accentBg:'#fff',color:active?C.accentDark:C.textLight}}>{label}</button>
)

const Field = ({label,children,hint}:{label:string,children:React.ReactNode,hint?:string}) => (
  <div>
    <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>{label}</div>
    {children}
    {hint&&<div style={{fontSize:11.5,color:C.textLight,marginTop:3}}>{hint}</div>}
  </div>
)

const TI = ({value,onChange,placeholder,type='text',mono=false}:{value:string,onChange:(v:string)=>void,placeholder?:string,type?:string,mono?:boolean}) => (
  <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    style={{width:'100%',padding:'8px 11px',borderRadius:7,border:`1.5px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:mono?"'JetBrains Mono',monospace":'Inter,sans-serif',background:'#fff',transition:'border-color .15s'}}
    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
)

const Card = ({children,style={}}:{children:React.ReactNode,style?:React.CSSProperties}) => (
  <div style={{background:C.card,borderRadius:10,border:`1px solid ${C.cardBorder}`,padding:22,...style}}>{children}</div>
)

function Nav({step}:{step:Step}) {
  const idx = STEPS.indexOf(step)
  return (
    <div style={{display:'flex',alignItems:'center',marginBottom:32,gap:0}}>
      {STEPS.map((s,i)=>(
        <div key={s} style={{display:'flex',alignItems:'center',flex:i<STEPS.length-1?1:undefined}}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,minWidth:60}}>
            <div style={{width:26,height:26,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,transition:'all .25s',
              background:i<idx?C.accent:i===idx?C.accent:'#E3EAF2',color:i<=idx?'#fff':C.textLight,
              boxShadow:i===idx?`0 0 0 4px ${C.accentBg}`:undefined}}>
              {i<idx?'✓':i+1}
            </div>
            <span style={{fontSize:11,fontWeight:i===idx?600:400,color:i===idx?C.accent:i<idx?C.text:C.textLight,whiteSpace:'nowrap'}}>{STEP_LABELS[s]}</span>
          </div>
          {i<STEPS.length-1&&<div style={{flex:1,height:2,background:i<idx?C.accent:'#E3EAF2',marginBottom:14,transition:'background .3s'}}/>}
        </div>
      ))}
    </div>
  )
}

function Bottom({onBack,onNext,nextLabel='Continue',disabled=false,skip,onSkip}:{onBack?:()=>void,onNext:()=>void,nextLabel?:string,disabled?:boolean,skip?:string,onSkip?:()=>void}) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:24,paddingTop:18,borderTop:`1px solid ${C.cardBorder}`}}>
      {onBack?<button onClick={onBack} style={{background:'#fff',color:C.textMuted,border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:'9px 18px',fontSize:13.5,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>← Back</button>:<div/>}
      <div style={{display:'flex',gap:10,alignItems:'center'}}>
        {skip&&onSkip&&<button onClick={onSkip} style={{background:'none',border:'none',color:C.textLight,cursor:'pointer',fontFamily:'Inter,sans-serif',fontSize:13,textDecoration:'underline'}}>{skip}</button>}
        <button onClick={onNext} disabled={disabled}
          style={{background:disabled?'#E3EAF2':C.accent,color:disabled?C.textLight:'#fff',border:'none',borderRadius:7,padding:'10px 22px',fontSize:14,fontWeight:600,cursor:disabled?'default':'pointer',fontFamily:'Inter,sans-serif',transition:'all .15s'}}>
          {nextLabel}
        </button>
      </div>
    </div>
  )
}

// ── CONNECT ───────────────────────────────────────────────────────────────────
function ConnectStep({onNext}:{onNext:()=>void}) {
  const [src,setSrc]=useState('')
  const [host,setHost]=useState(''); const [port,setPort]=useState('5432')
  const [db,setDb]=useState(''); const [user,setUser]=useState(''); const [pass,setPass]=useState('')
  const [ssl,setSsl]=useState(true)
  const [testing,setTesting]=useState(false)
  const [result,setResult]=useState<'idle'|'ok'|'fail'>('idle')

  const test = async()=>{
    setTesting(true);setResult('idle')
    await new Promise(r=>setTimeout(r,1500))
    setResult(host&&db?'ok':'fail')
    setTesting(false)
  }

  return <div>
    <h1 style={{fontSize:22,fontWeight:700,color:C.text,marginBottom:6,letterSpacing:'-0.3px'}}>Connect your database</h1>
    <p style={{fontSize:14,color:C.textMuted,marginBottom:24,lineHeight:1.55}}>Read-only access only. Qwezy never writes to your database.</p>

    <Card style={{marginBottom:14}}>
      <Field label="Select your data source">
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7,marginTop:5}}>
          {DB_SOURCES.map(d=>(
            <button key={d.id} onClick={()=>setSrc(d.id)}
              style={{padding:'10px 8px',borderRadius:8,border:'1.5px solid',cursor:'pointer',fontFamily:'Inter,sans-serif',fontSize:13,fontWeight:500,display:'flex',alignItems:'center',gap:7,transition:'all .12s',borderColor:src===d.id?C.accent:C.cardBorder,background:src===d.id?C.accentBg:'#fff',color:src===d.id?C.accentDark:C.textMuted}}>
              <span style={{fontSize:18}}>{d.icon}</span>{d.label}
            </button>
          ))}
        </div>
      </Field>
    </Card>

    {src&&<Card style={{marginBottom:14}}>
      <div style={{display:'flex',flexDirection:'column',gap:13}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 88px',gap:10}}>
          <Field label="Host"><TI value={host} onChange={setHost} placeholder="db.example.com" mono/></Field>
          <Field label="Port"><TI value={port} onChange={setPort} placeholder="5432" mono/></Field>
        </div>
        <Field label="Database name"><TI value={db} onChange={setDb} placeholder="production" mono/></Field>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <Field label="Username"><TI value={user} onChange={setUser} mono/></Field>
          <Field label="Password"><TI value={pass} onChange={setPass} type="password" mono/></Field>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:9,padding:'9px 12px',background:'#F8FAFD',borderRadius:7,border:`1px solid ${C.cardBorder}`}}>
          <button onClick={()=>setSsl(s=>!s)} style={{width:34,height:18,borderRadius:9,border:'none',cursor:'pointer',background:ssl?C.accent:'#CBD5E1',position:'relative',transition:'background .2s',flexShrink:0}}>
            <div style={{width:12,height:12,borderRadius:'50%',background:'#fff',position:'absolute',top:3,left:ssl?19:3,transition:'left .2s'}}/>
          </button>
          <span style={{fontSize:13,color:C.text}}>Require SSL / TLS</span>
        </div>
        <button onClick={test} disabled={testing||!src}
          style={{padding:'11px',borderRadius:8,border:`1.5px solid ${result==='ok'?C.success:result==='fail'?C.danger:C.cardBorder}`,background:result==='ok'?C.accentBg:result==='fail'?'#FEF2F2':'#F8FAFD',color:result==='ok'?C.success:result==='fail'?C.danger:C.text,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center',justifyContent:'center',gap:7,transition:'all .2s'}}>
          {testing?<><div style={{width:13,height:13,border:`2px solid ${C.cardBorder}`,borderTop:`2px solid ${C.accent}`,borderRadius:'50%',animation:'spin .7s linear infinite'}}/>Testing…</>:result==='ok'?'✓ Connected successfully':result==='fail'?'✗ Connection failed — check credentials':'Test connection'}
        </button>
      </div>
    </Card>}

    <div style={{padding:'9px 13px',background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:7,fontSize:12.5,color:'#92400E',marginBottom:4}}>
      We recommend a dedicated read-only user. Credentials are AES-256 encrypted and never logged.
    </div>

    <Bottom onNext={onNext} nextLabel="Connect & scan →" disabled={result!=='ok'}/>
  </div>
}

// ── DISCOVER ──────────────────────────────────────────────────────────────────
function DiscoverStep({onNext}:{onNext:()=>void}) {
  const [phase,setPhase]=useState<'ready'|'running'|'done'>('ready')
  const [pct,setPct]=useState(0)
  const [msg,setMsg]=useState('')

  const run = useCallback(async()=>{
    setPhase('running')
    const msgs=['Connecting…','Reading table schema…','Sampling rows and detecting column types…','Identifying primary keys and foreign keys…','Running cardinality analysis for join detection…','Claude reviewing schema…','Done']
    for(let i=0;i<msgs.length;i++){
      setMsg(msgs[i])
      setPct(Math.round((i+1)/msgs.length*100))
      await new Promise(r=>setTimeout(r,500+Math.random()*400))
    }
    setPhase('done')
  },[])

  return <div>
    <h1 style={{fontSize:22,fontWeight:700,color:C.text,marginBottom:6,letterSpacing:'-0.3px'}}>Scanning your database</h1>
    <p style={{fontSize:14,color:C.textMuted,marginBottom:24,lineHeight:1.55}}>Qwezy reads your schema, samples rows, and uses Claude to understand your data structure.</p>

    {phase==='ready'&&<Card style={{textAlign:'center',padding:40,marginBottom:14}}>
      <div style={{fontSize:36,marginBottom:14}}>🔍</div>
      <div style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:8}}>Ready to scan</div>
      <div style={{fontSize:13.5,color:C.textMuted,marginBottom:22,maxWidth:360,margin:'0 auto 22px',lineHeight:1.6}}>Takes about 30 seconds. We sample up to 1,000 rows per table — nothing is stored.</div>
      <button onClick={run} style={{background:C.accent,color:'#fff',border:'none',borderRadius:8,padding:'11px 26px',fontSize:14.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',boxShadow:'0 2px 8px rgba(5,150,105,0.25)'}}>Start scan</button>
    </Card>}

    {phase!=='ready'&&<Card style={{marginBottom:14}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
        <span style={{fontSize:13.5,fontWeight:600,color:C.text}}>{phase==='done'?'Scan complete':msg}</span>
        <span style={{fontSize:13,fontWeight:600,color:phase==='done'?C.success:C.accent}}>{pct}%</span>
      </div>
      <div style={{height:6,background:'#F0F4F8',borderRadius:3,overflow:'hidden',marginBottom:phase==='done'?18:0}}>
        <div style={{height:'100%',width:`${pct}%`,background:phase==='done'?C.success:C.accent,borderRadius:3,transition:'width .3s ease'}}/>
      </div>

      {phase==='done'&&<div style={{display:'flex',flexDirection:'column',gap:5}}>
        {MOCK_TABLES.map(t=>(
          <div key={t.name} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 11px',background:'#F8FAFD',borderRadius:7,border:`1px solid ${C.cardBorder}`}}>
            <span style={{fontSize:11,color:C.success,fontWeight:700,flexShrink:0}}>✓</span>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:600,fontSize:12.5,color:C.text,minWidth:90}}>{t.name}</span>
            <span style={{fontSize:12,color:C.textMuted,flex:1}}>{t.cols.length} cols · PK: {t.pk}</span>
            <span style={{fontSize:11.5,color:C.textLight,whiteSpace:'nowrap'}}>{t.rows.toLocaleString()} rows</span>
            <span style={{fontSize:11,color:C.textLight,whiteSpace:'nowrap'}}>Last: {t.lastDate}</span>
          </div>
        ))}
      </div>}
    </Card>}

    <Bottom onNext={onNext} nextLabel="Annotate tables →" disabled={phase!=='done'}/>
  </div>
}

// ── ANNOTATE ──────────────────────────────────────────────────────────────────
function AnnotateStep({onNext,onBack}:{onNext:()=>void,onBack:()=>void}) {
  const [idx,setIdx]=useState(0)
  type Ann = {summary:string,teams:string[],contact:string,refresh:string}
  const [anns,setAnns]=useState<Record<string,Ann>>(Object.fromEntries(MOCK_TABLES.map(t=>[t.name,{summary:'',teams:[],contact:'',refresh:''}])))

  const t = MOCK_TABLES[idx]
  const a = anns[t.name]
  const upd = (k:keyof Ann,v:any)=>setAnns(p=>({...p,[t.name]:{...p[t.name],[k]:v}}))
  const done = (n:string)=>{const x=anns[n];return!!x.summary&&x.teams.length>0&&!!x.refresh}
  const allDone = MOCK_TABLES.every(t=>done(t.name))

  const copyPrev = ()=>{
    if(idx===0) return
    const prev=anns[MOCK_TABLES[idx-1].name]
    upd('teams',prev.teams); upd('contact',prev.contact); upd('refresh',prev.refresh)
  }

  return <div>
    <h1 style={{fontSize:22,fontWeight:700,color:C.text,marginBottom:6,letterSpacing:'-0.3px'}}>Annotate tables</h1>
    <p style={{fontSize:14,color:C.textMuted,marginBottom:20,lineHeight:1.55}}>Add business context so Qwezy understands your data — not just the schema.</p>

    <div style={{display:'flex',gap:14}}>
      {/* Sidebar */}
      <div style={{width:150,flexShrink:0}}>
        {MOCK_TABLES.map((t,i)=>(
          <button key={t.name} onClick={()=>setIdx(i)}
            style={{width:'100%',textAlign:'left',padding:'7px 9px',borderRadius:7,border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif',marginBottom:3,background:idx===i?C.accentBg:'transparent',display:'flex',alignItems:'center',gap:6,transition:'background .1s'}}>
            <div style={{width:7,height:7,borderRadius:'50%',flexShrink:0,background:done(t.name)?C.success:idx===i?C.accent:'#CBD5E1'}}/>
            <span style={{fontSize:13,fontWeight:idx===i?600:400,color:idx===i?C.accentDark:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.name}</span>
          </button>
        ))}
        <div style={{fontSize:11,color:C.textLight,paddingLeft:4,marginTop:8}}>{MOCK_TABLES.filter(t=>done(t.name)).length}/{MOCK_TABLES.length} complete</div>
      </div>

      {/* Form */}
      <div style={{flex:1}}>
        <Card>
          {/* Header */}
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:16,paddingBottom:13,borderBottom:`1px solid ${C.cardBorder}`}}>
            <div>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:15,color:C.text}}>{t.name}</span>
              <div style={{fontSize:12,color:C.textLight,marginTop:3,display:'flex',gap:10}}>
                <span>{t.rows.toLocaleString()} rows</span><span>PK: {t.pk}</span><span>Last: {t.lastDate}</span>
              </div>
            </div>
            {idx>0&&<button onClick={copyPrev} style={{fontSize:11.5,padding:'4px 10px',borderRadius:5,border:`1px solid ${C.cardBorder}`,background:'#F8FAFD',color:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif',whiteSpace:'nowrap'}}>Copy from previous</button>}
          </div>

          {/* Key columns */}
          <div style={{marginBottom:15}}>
            <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:7}}>Key columns (Claude flagged)</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
              {t.important.map(c=>(
                <span key={c} style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:5,background:c===t.pk?C.accentBg:'#F8FAFD',border:`1px solid ${c===t.pk?C.accent:C.cardBorder}`}}>
                  {c===t.pk&&<span style={{fontSize:9,fontWeight:700,color:C.accent}}>PK</span>}
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11.5,color:C.text}}>{c}</span>
                </span>
              ))}
            </div>
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <Field label="What does this table track? *" hint="Plain English — what questions can you answer with it?">
              <textarea value={a.summary} onChange={e=>upd('summary',e.target.value)}
                placeholder={`e.g. Every customer order. Use as the starting point for revenue and customer queries.`}
                rows={2}
                style={{width:'100%',padding:'8px 11px',borderRadius:7,border:`1.5px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif',resize:'vertical',lineHeight:1.5,transition:'border-color .15s'}}
                onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
            </Field>

            <Field label="Owned by *">
              <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:4}}>
                {TEAMS.map(t=><Tag key={t} label={t} active={a.teams.includes(t)} onClick={()=>upd('teams',a.teams.includes(t)?a.teams.filter(x=>x!==t):[...a.teams,t])}/>)}
              </div>
            </Field>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <Field label="Best contact">
                <TI value={a.contact} onChange={v=>upd('contact',v)} placeholder="name or email (optional)"/>
              </Field>
              <Field label="Refresh cadence *">
                <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:4}}>
                  {REFRESH.map(r=><Tag key={r} label={r} active={a.refresh===r} onClick={()=>upd('refresh',r)}/>)}
                </div>
              </Field>
            </div>
          </div>

          {/* Table nav */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:18,paddingTop:14,borderTop:`1px solid ${C.cardBorder}`}}>
            <button onClick={()=>setIdx(i=>Math.max(0,i-1))} disabled={idx===0}
              style={{padding:'6px 12px',borderRadius:6,border:`1px solid ${C.cardBorder}`,background:'#fff',color:idx===0?C.textLight:C.textMuted,cursor:idx===0?'default':'pointer',fontSize:13,fontFamily:'Inter,sans-serif',opacity:idx===0?.35:1}}>
              ← Prev
            </button>
            <span style={{fontSize:12,color:C.textLight}}>{idx+1} / {MOCK_TABLES.length}</span>
            {idx<MOCK_TABLES.length-1
              ?<button onClick={()=>setIdx(i=>i+1)} style={{padding:'6px 12px',borderRadius:6,border:`1px solid ${C.accent}`,background:C.accentBg,color:C.accent,cursor:'pointer',fontSize:13,fontWeight:500,fontFamily:'Inter,sans-serif'}}>Next →</button>
              :<div style={{width:64}}/>}
          </div>
        </Card>
      </div>
    </div>

    <Bottom onBack={onBack} onNext={onNext} nextLabel="Review relationships →" disabled={!allDone} skip="Skip unannotated" onSkip={onNext}/>
  </div>
}

// ── JOINS ─────────────────────────────────────────────────────────────────────
function JoinsStep({onNext,onBack}:{onNext:()=>void,onBack:()=>void}) {
  type JS = {approved:boolean,editing:boolean,fc:string,tc:string,type:string}
  const [joins,setJoins]=useState<Record<string,JS>>(Object.fromEntries(MOCK_JOINS.map(j=>[j.id,{approved:j.conf>=0.9,editing:false,fc:j.fc,tc:j.tc,type:j.type}])))
  const [showAdd,setShowAdd]=useState(false)
  const [manual,setManual]=useState({from:'',fc:'',to:'',tc:'',type:'INNER'})
  const [extras,setExtras]=useState<any[]>([])

  const upd = (id:string,k:keyof JS,v:any)=>setJoins(p=>({...p,[id]:{...p[id],[k]:v}}))

  const high   = MOCK_JOINS.filter(j=>j.conf>=0.9)
  const review = MOCK_JOINS.filter(j=>j.conf>=0.7&&j.conf<0.9)
  const low    = MOCK_JOINS.filter(j=>j.conf<0.7)

  const Row = ({j}:{j:typeof MOCK_JOINS[0]})=>{
    const s=joins[j.id]
    const badge=j.conf<0.7?{label:'Uncertain',color:C.danger,bg:'#FEF2F2',border:'#FECACA'}:j.conf<0.9?{label:'Review',color:C.warn,bg:'#FFFBEB',border:'#FDE68A'}:null
    return(
      <div style={{padding:'10px 13px',borderRadius:8,border:`1.5px solid ${s.approved?C.accent:C.cardBorder}`,background:s.approved?C.accentBg:'#F8FAFD',marginBottom:6,transition:'all .15s'}}>
        {s.editing
          ?<div style={{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap'}}>
            <select value={s.fc} onChange={e=>upd(j.id,'fc',e.target.value)}
              style={{padding:'4px 7px',borderRadius:5,border:`1px solid ${C.cardBorder}`,fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:C.text,background:'#fff'}}>
              {MOCK_TABLES.find(t=>t.name===j.from)?.cols.map(c=><option key={c}>{c}</option>)}
            </select>
            <span style={{fontSize:11,color:C.textLight}}>→</span>
            <select value={s.tc} onChange={e=>upd(j.id,'tc',e.target.value)}
              style={{padding:'4px 7px',borderRadius:5,border:`1px solid ${C.cardBorder}`,fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:C.text,background:'#fff'}}>
              {MOCK_TABLES.find(t=>t.name===j.to)?.cols.map(c=><option key={c}>{c}</option>)}
            </select>
            <select value={s.type} onChange={e=>upd(j.id,'type',e.target.value)}
              style={{padding:'4px 7px',borderRadius:5,border:`1px solid ${C.cardBorder}`,fontSize:12,fontFamily:'Inter,sans-serif',color:C.text,background:'#fff'}}>
              {['INNER','LEFT','RIGHT','FULL'].map(t=><option key={t}>{t}</option>)}
            </select>
            <button onClick={()=>{upd(j.id,'editing',false);upd(j.id,'approved',true)}} style={{fontSize:11.5,padding:'3px 9px',borderRadius:5,border:'none',background:C.accent,color:'#fff',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:600}}>Save</button>
            <button onClick={()=>upd(j.id,'editing',false)} style={{fontSize:11.5,padding:'3px 9px',borderRadius:5,border:`1px solid ${C.cardBorder}`,background:'#fff',color:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Cancel</button>
          </div>
          :<div style={{display:'flex',alignItems:'center',gap:9}}>
            <button onClick={()=>upd(j.id,'approved',!s.approved)}
              style={{width:18,height:18,borderRadius:4,border:`2px solid ${s.approved?C.accent:'#CBD5E1'}`,background:s.approved?C.accent:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .15s'}}>
              {s.approved&&<span style={{color:'#fff',fontSize:9,fontWeight:800}}>✓</span>}
            </button>
            <div style={{flex:1,fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              <span style={{fontWeight:600}}>{j.from}</span><span style={{color:C.textLight,margin:'0 5px'}}>{s.type} JOIN</span><span style={{fontWeight:600}}>{j.to}</span>
              <span style={{color:C.textLight}}> ON {j.from}.{s.fc} = {j.to}.{s.tc}</span>
            </div>
            {badge&&<span style={{fontSize:11,fontWeight:600,padding:'2px 7px',borderRadius:4,background:badge.bg,color:badge.color,border:`1px solid ${badge.border}`,whiteSpace:'nowrap',flexShrink:0}}>{badge.label}</span>}
            <button onClick={()=>upd(j.id,'editing',true)} style={{fontSize:11.5,color:C.textLight,background:'none',border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif',padding:'1px 4px',flexShrink:0}} onMouseOver={e=>e.currentTarget.style.color=C.accent} onMouseOut={e=>e.currentTarget.style.color=C.textLight}>Edit</button>
          </div>}
      </div>
    )
  }

  const Section = ({title,items,note}:{title:string,items:typeof MOCK_JOINS,note?:string})=>
    items.length===0?null:<div style={{marginBottom:18}}>
      <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:note?6:8}}>{title}</div>
      {note&&<div style={{fontSize:12,color:C.textMuted,marginBottom:8,padding:'6px 10px',background:'#F8FAFD',borderRadius:6,border:`1px solid ${C.cardBorder}`}}>{note}</div>}
      {items.map(j=><Row key={j.id} j={j}/>)}
    </div>

  return <div>
    <h1 style={{fontSize:22,fontWeight:700,color:C.text,marginBottom:6,letterSpacing:'-0.3px'}}>Table relationships</h1>
    <p style={{fontSize:14,color:C.textMuted,marginBottom:20,lineHeight:1.55}}>Claude detected these join paths. Approve, edit, or remove them — and add any we missed.</p>

    <Card style={{marginBottom:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <span style={{fontSize:13,color:C.textMuted}}>{Object.values(joins).filter(j=>j.approved).length+extras.filter(e=>e.approved).length} of {MOCK_JOINS.length+extras.length} approved</span>
        <button onClick={()=>setShowAdd(s=>!s)}
          style={{fontSize:13,padding:'5px 12px',borderRadius:6,border:`1.5px solid ${showAdd?C.accent:C.cardBorder}`,background:showAdd?C.accentBg:'#fff',color:showAdd?C.accent:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:500}}>
          + Add join
        </button>
      </div>

      {showAdd&&<div style={{padding:14,background:'#F8FAFD',borderRadius:8,border:`1px solid ${C.cardBorder}`,marginBottom:16}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr auto 80px auto',gap:8,alignItems:'end'}}>
          <div><div style={{fontSize:11,color:C.textLight,marginBottom:4}}>FROM TABLE</div>
            <select value={manual.from} onChange={e=>setManual(m=>({...m,from:e.target.value}))} style={{width:'100%',padding:'7px 9px',borderRadius:6,border:`1px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff'}}>
              <option value="">Select…</option>{MOCK_TABLES.map(t=><option key={t.name}>{t.name}</option>)}
            </select></div>
          <div style={{paddingBottom:2,color:C.textLight,alignSelf:'end',paddingLeft:2,paddingRight:2}}>→</div>
          <div><div style={{fontSize:11,color:C.textLight,marginBottom:4}}>TO TABLE</div>
            <select value={manual.to} onChange={e=>setManual(m=>({...m,to:e.target.value}))} style={{width:'100%',padding:'7px 9px',borderRadius:6,border:`1px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff'}}>
              <option value="">Select…</option>{MOCK_TABLES.map(t=><option key={t.name}>{t.name}</option>)}
            </select></div>
          <div style={{paddingBottom:2,color:C.textLight,alignSelf:'end',paddingLeft:2}}>ON</div>
          <div><div style={{fontSize:11,color:C.textLight,marginBottom:4}}>TYPE</div>
            <select value={manual.type} onChange={e=>setManual(m=>({...m,type:e.target.value}))} style={{width:'100%',padding:'7px 9px',borderRadius:6,border:`1px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff'}}>
              {['INNER','LEFT','RIGHT','FULL'].map(t=><option key={t}>{t}</option>)}
            </select></div>
          <div style={{paddingBottom:2}}>
            <button onClick={()=>{if(manual.from&&manual.to){setExtras(p=>[...p,{id:`e${Date.now()}`,from:manual.from,fc:'id',to:manual.to,tc:`${manual.from}_id`,type:manual.type,conf:1,approved:true}]);setManual({from:'',fc:'',to:'',tc:'',type:'INNER'})}}}
              style={{background:C.accent,color:'#fff',border:'none',borderRadius:6,padding:'7px 12px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Add</button>
          </div>
        </div>
      </div>}

      <Section title="High confidence — pre-approved" items={high} note="Strong cardinality match. Pre-approved — uncheck any that look wrong."/>
      <Section title="Review recommended" items={review} note="Likely correct but worth a quick check."/>
      <Section title="Uncertain — verify before approving" items={low}/>

      {extras.length>0&&<div>
        <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:8}}>Manually added</div>
        {extras.map((e,i)=>(
          <div key={e.id} style={{display:'flex',alignItems:'center',gap:9,padding:'9px 12px',borderRadius:8,border:`1.5px solid ${C.accent}`,background:C.accentBg,marginBottom:6}}>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:C.text,flex:1}}>{e.from} {e.type} JOIN {e.to} ON {e.from}.{e.fc} = {e.to}.{e.tc}</span>
            <button onClick={()=>setExtras(p=>p.filter((_,idx)=>idx!==i))} style={{background:'none',border:'none',color:C.danger,cursor:'pointer',fontSize:15,lineHeight:1}}>×</button>
          </div>
        ))}
      </div>}
    </Card>

    <div style={{padding:'9px 12px',background:'#F0F7FF',border:'1px solid #BFDBFE',borderRadius:7,fontSize:12.5,color:'#1E40AF',marginBottom:4}}>
      You can edit relationships any time from the Relationships page.
    </div>

    <Bottom onBack={onBack} onNext={onNext} nextLabel="Finish setup →" skip="Skip for now" onSkip={onNext}/>
  </div>
}

// ── DONE ──────────────────────────────────────────────────────────────────────
function DoneStep({onDashboard,onAddAnother}:{onDashboard:()=>void,onAddAnother:()=>void}) {
  return (
    <div style={{textAlign:'center'}}>
      <div style={{width:68,height:68,borderRadius:'50%',background:C.accentBg,border:`3px solid ${C.accent}`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',fontSize:30,color:C.accent}}>✓</div>
      <h1 style={{fontSize:26,fontWeight:800,color:C.text,letterSpacing:'-0.4px',marginBottom:8}}>You're ready to query</h1>
      <p style={{fontSize:14.5,color:C.textMuted,maxWidth:420,margin:'0 auto 28px',lineHeight:1.65}}>Your database is connected and annotated. Qwezy will use your context to generate accurate, business-aware SQL.</p>

      <Card style={{maxWidth:460,margin:'0 auto 20px',textAlign:'left'}}>
        <div style={{fontSize:13.5,fontWeight:600,color:C.text,marginBottom:10}}>Try these first</div>
        {['What was total revenue last month?','Who are our top 10 customers by spend?','Which products are below reorder level?'].map((q,i)=>(
          <button key={i} onClick={onDashboard}
            style={{display:'flex',alignItems:'center',gap:9,width:'100%',padding:'9px 11px',marginBottom:5,background:'#F8FAFD',border:`1px solid ${C.cardBorder}`,borderRadius:7,cursor:'pointer',fontFamily:'Inter,sans-serif',fontSize:13.5,color:C.textMuted,textAlign:'left',transition:'all .12s'}}
            onMouseOver={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.text;e.currentTarget.style.background=C.accentBg}}
            onMouseOut={e=>{e.currentTarget.style.borderColor=C.cardBorder;e.currentTarget.style.color=C.textMuted;e.currentTarget.style.background='#F8FAFD'}}>
            <span style={{color:C.accent,fontWeight:600,flexShrink:0}}>→</span>{q}
          </button>
        ))}
      </Card>

      <div style={{display:'flex',gap:10,justifyContent:'center'}}>
        <button onClick={onDashboard} style={{background:C.accent,color:'#fff',border:'none',borderRadius:9,padding:'13px 28px',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',boxShadow:'0 3px 12px rgba(5,150,105,0.25)'}}>Open dashboard →</button>
        <button onClick={onAddAnother} style={{background:'#fff',color:C.textMuted,border:`1.5px solid ${C.cardBorder}`,borderRadius:9,padding:'13px 18px',fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>+ Connect another database</button>
      </div>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function Onboarding() {
  const router = useRouter()
  const [step,setStep]=useState<Step>('connect')
  const next=()=>setStep(s=>{const i=STEPS.indexOf(s);return STEPS[Math.min(i+1,STEPS.length-1)]})
  const back=()=>setStep(s=>{const i=STEPS.indexOf(s);return STEPS[Math.max(i-1,0)]})

  return (
    <div style={{fontFamily:'Inter,-apple-system,sans-serif',background:C.bg,minHeight:'100vh'}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      <div style={{background:'#fff',borderBottom:`1px solid ${C.cardBorder}`,padding:'0 28px',display:'flex',alignItems:'center',height:52,position:'sticky',top:0,zIndex:50}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginRight:16}}>
          <div style={{width:24,height:24,background:'linear-gradient(135deg,#10B981,#059669)',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{color:'#fff',fontFamily:"'JetBrains Mono'",fontWeight:700,fontSize:9}}>{'{ }'}</span>
          </div>
          <span style={{fontWeight:700,fontSize:14,color:C.text}}>Qwezy</span>
          <span style={{fontSize:12,color:C.textLight,paddingLeft:10,borderLeft:`1px solid ${C.cardBorder}`,marginLeft:2}}>Database setup</span>
        </div>
      </div>

      <div style={{maxWidth:780,margin:'0 auto',padding:'36px 20px 80px'}}>
        <Nav step={step}/>
        <div key={step}>
          {step==='connect'     &&<ConnectStep  onNext={next}/>}
          {step==='discover'    &&<DiscoverStep onNext={next}/>}
          {step==='annotate'    &&<AnnotateStep onNext={next} onBack={back}/>}
          {step==='joins'       &&<JoinsStep    onNext={next} onBack={back}/>}
          {step==='done'        &&<DoneStep     onDashboard={()=>router.push('/dashboard')} onAddAnother={()=>setStep('connect')}/>}
        </div>
      </div>
    </div>
  )
}
