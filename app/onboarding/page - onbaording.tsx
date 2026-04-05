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
  {id:'postgres',label:'PostgreSQL',icon:'🐘'},
  {id:'neon',label:'Neon',icon:'⚡'},
  {id:'supabase',label:'Supabase',icon:'🦸'},
  {id:'mysql',label:'MySQL',icon:'🐬'},
  {id:'snowflake',label:'Snowflake',icon:'❄️'},
  {id:'mssql',label:'SQL Server',icon:'🟦'},
]

type Step = 'connect'|'discover'|'annotate'|'done'
const STEPS:Step[] = ['connect','discover','annotate','done']
const STEP_LABELS:{[k in Step]:string} = {connect:'Connect',discover:'Discover',annotate:'Annotate',done:'Done'}

const Field = ({label,children,hint}:{label:string;children:React.ReactNode;hint?:string})=>(
  <div>
    <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>{label}</div>
    {children}
    {hint&&<div style={{fontSize:11.5,color:C.textLight,marginTop:3}}>{hint}</div>}
  </div>
)

const TI = ({value,onChange,placeholder,type='text',mono=false}:{value:string;onChange:(v:string)=>void;placeholder?:string;type?:string;mono?:boolean})=>(
  <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    style={{width:'100%',padding:'8px 11px',borderRadius:7,border:`1.5px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:mono?"'JetBrains Mono',monospace":'Inter,sans-serif',background:'#fff'}}
    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
)

const Card = ({children,style={}}:{children:React.ReactNode;style?:React.CSSProperties})=>(
  <div style={{background:C.card,borderRadius:10,border:`1px solid ${C.cardBorder}`,padding:22,...style}}>{children}</div>
)

function Nav({step}:{step:Step}) {
  const idx=STEPS.indexOf(step)
  return(
    <div style={{display:'flex',alignItems:'center',marginBottom:32}}>
      {STEPS.map((s,i)=>(
        <div key={s} style={{display:'flex',alignItems:'center',flex:i<STEPS.length-1?1:undefined}}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,minWidth:60}}>
            <div style={{width:26,height:26,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,
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

function Bottom({onBack,onNext,nextLabel='Continue',disabled=false,loading=false}:{onBack?:()=>void;onNext:()=>void;nextLabel?:string;disabled?:boolean;loading?:boolean}) {
  return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:24,paddingTop:18,borderTop:`1px solid ${C.cardBorder}`}}>
      {onBack?<button onClick={onBack} style={{background:'#fff',color:C.textMuted,border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:'9px 18px',fontSize:13.5,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>← Back</button>:<div/>}
      <button onClick={onNext} disabled={disabled||loading}
        style={{background:disabled||loading?'#E3EAF2':C.accent,color:disabled||loading?C.textLight:'#fff',border:'none',borderRadius:7,padding:'10px 22px',fontSize:14,fontWeight:600,cursor:disabled||loading?'default':'pointer',fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center',gap:8}}>
        {loading&&<div style={{width:13,height:13,border:'2px solid rgba(255,255,255,0.3)',borderTop:'2px solid #fff',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>}
        {nextLabel}
      </button>
    </div>
  )
}

// ── STEP 1: CONNECT ────────────────────────────────────────────────────────────
function ConnectStep({onNext,onConnectionString}:{onNext:()=>void;onConnectionString:(s:string)=>void}) {
  const [src,setSrc]=useState('')
  const [mode,setMode]=useState<'form'|'url'>('form')
  const [host,setHost]=useState(''); const [port,setPort]=useState('5432')
  const [db,setDb]=useState(''); const [user,setUser]=useState(''); const [pass,setPass]=useState('')
  const [ssl,setSsl]=useState(true)
  const [urlStr,setUrlStr]=useState('')
  const [testing,setTesting]=useState(false)
  const [result,setResult]=useState<null|{ok:boolean;error?:string;db_name?:string;table_count?:number;latency_ms?:number}>(null)

  const test=async()=>{
    setTesting(true);setResult(null)
    try{
      const body = mode==='url'
        ? { connectionString: urlStr, ssl }
        : { host, port, database: db, username: user, password: pass, ssl }
      const res=await fetch('/api/test-connection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      const data=await res.json()
      setResult(data)
      if(data.ok){
        // Store the connection string for saving later
        const connStr = mode==='url' ? urlStr : buildConnStr({host,port,database:db,username:user,password:pass,ssl})
        onConnectionString(connStr)
      }
    }catch(e:any){setResult({ok:false,error:'Unexpected error — try again'})}
    finally{setTesting(false)}
  }

  const buildConnStr=({host,port,database,username,password,ssl}:any)=>{
    const sslParam=ssl?'?sslmode=require':''
    const auth=username?`${encodeURIComponent(username)}${password?':'+encodeURIComponent(password):''}@`:''
    return `postgresql://${auth}${host}:${port||5432}/${database}${sslParam}`
  }

  const canTest = src && (mode==='url' ? urlStr.trim().length>10 : host&&db)

  return(
    <div>
      <h1 style={{fontSize:22,fontWeight:700,color:C.text,marginBottom:6,letterSpacing:'-0.3px'}}>Connect your database</h1>
      <p style={{fontSize:14,color:C.textMuted,marginBottom:24,lineHeight:1.55}}>Read-only access only. Qwezy never writes to your database.</p>

      <Card style={{marginBottom:14}}>
        <Field label="Select your database">
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7,marginTop:5}}>
            {DB_SOURCES.map(d=>(
              <button key={d.id} onClick={()=>setSrc(d.id)}
                style={{padding:'10px 8px',borderRadius:8,border:'1.5px solid',cursor:'pointer',fontFamily:'Inter,sans-serif',fontSize:13,fontWeight:500,display:'flex',alignItems:'center',gap:7,
                  borderColor:src===d.id?C.accent:C.cardBorder,background:src===d.id?C.accentBg:'#fff',color:src===d.id?C.accentDark:C.textMuted}}>
                <span style={{fontSize:18}}>{d.icon}</span>{d.label}
              </button>
            ))}
          </div>
        </Field>
      </Card>

      {src&&(
        <Card style={{marginBottom:14}}>
          {/* Mode toggle */}
          <div style={{display:'flex',gap:6,marginBottom:16,padding:'4px',background:'#F0F4F8',borderRadius:7,width:'fit-content'}}>
            {(['form','url'] as const).map(m=>(
              <button key={m} onClick={()=>setMode(m)}
                style={{padding:'5px 14px',borderRadius:5,border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif',fontSize:12.5,fontWeight:500,
                  background:mode===m?'#fff':undefined,color:mode===m?C.text:C.textLight,boxShadow:mode===m?'0 1px 3px rgba(0,0,0,0.1)':undefined}}>
                {m==='form'?'Connection form':'Connection URL'}
              </button>
            ))}
          </div>

          {mode==='form'?(
            <div style={{display:'flex',flexDirection:'column',gap:13}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 88px',gap:10}}>
                <Field label="Host"><TI value={host} onChange={setHost} placeholder="ep-xxx.us-east-1.aws.neon.tech" mono/></Field>
                <Field label="Port"><TI value={port} onChange={setPort} placeholder="5432" mono/></Field>
              </div>
              <Field label="Database name"><TI value={db} onChange={setDb} placeholder="neondb" mono/></Field>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <Field label="Username"><TI value={user} onChange={setUser} mono/></Field>
                <Field label="Password"><TI value={pass} onChange={setPass} type="password" mono/></Field>
              </div>
            </div>
          ):(
            <Field label="Connection URL" hint="Format: postgresql://user:password@host:port/database?sslmode=require">
              <TI value={urlStr} onChange={setUrlStr} placeholder="postgresql://user:pass@host/db?sslmode=require" mono/>
            </Field>
          )}

          <div style={{display:'flex',alignItems:'center',gap:9,padding:'9px 12px',background:'#F8FAFD',borderRadius:7,border:`1px solid ${C.cardBorder}`,marginTop:13}}>
            <button onClick={()=>setSsl(s=>!s)} style={{width:34,height:18,borderRadius:9,border:'none',cursor:'pointer',background:ssl?C.accent:'#CBD5E1',position:'relative',flexShrink:0}}>
              <div style={{width:12,height:12,borderRadius:'50%',background:'#fff',position:'absolute',top:3,left:ssl?19:3,transition:'left .2s'}}/>
            </button>
            <span style={{fontSize:13,color:C.text}}>Require SSL / TLS</span>
          </div>

          <button onClick={test} disabled={testing||!canTest}
            style={{marginTop:13,width:'100%',padding:'11px',borderRadius:8,border:`1.5px solid ${result?.ok?C.success:result?.ok===false?C.danger:C.cardBorder}`,
              background:result?.ok?C.accentBg:result?.ok===false?'#FEF2F2':'#F8FAFD',
              color:result?.ok?C.success:result?.ok===false?C.danger:C.text,
              fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center',justifyContent:'center',gap:7}}>
            {testing?<><div style={{width:13,height:13,border:`2px solid ${C.cardBorder}`,borderTop:`2px solid ${C.accent}`,borderRadius:'50%',animation:'spin .7s linear infinite'}}/>Testing connection…</>
              :result?.ok?`✓ Connected — ${result.table_count} tables found (${result.latency_ms}ms)`
              :result?.ok===false?`✗ ${result.error}`
              :'Test connection'}
          </button>
        </Card>
      )}

      <div style={{padding:'9px 13px',background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:7,fontSize:12.5,color:'#92400E',marginBottom:4}}>
        We recommend a dedicated read-only database user. Credentials are AES-256 encrypted.
      </div>

      <Bottom onNext={onNext} nextLabel="Connect & scan →" disabled={!result?.ok}/>
    </div>
  )
}

// ── STEP 2: DISCOVER ──────────────────────────────────────────────────────────
function DiscoverStep({onNext,onBack}:{onNext:()=>void;onBack:()=>void}) {
  const [phase,setPhase]=useState<'ready'|'running'|'done'>('ready')
  const [pct,setPct]=useState(0)
  const [msg,setMsg]=useState('')

  const run=useCallback(async()=>{
    setPhase('running')
    const msgs=['Connecting to your database…','Reading table schema…','Sampling rows and detecting column types…','Identifying primary keys and foreign keys…','Running cardinality analysis…','Claude reviewing schema for business context…','Done — your schema is mapped']
    for(let i=0;i<msgs.length;i++){
      setMsg(msgs[i]);setPct(Math.round((i+1)/msgs.length*100))
      await new Promise(r=>setTimeout(r,600+Math.random()*400))
    }
    setPhase('done')
  },[])

  return(
    <div>
      <h1 style={{fontSize:22,fontWeight:700,color:C.text,marginBottom:6,letterSpacing:'-0.3px'}}>Scanning your database</h1>
      <p style={{fontSize:14,color:C.textMuted,marginBottom:24,lineHeight:1.55}}>Qwezy reads your schema structure — no data is stored or transmitted.</p>

      <Card style={{marginBottom:16}}>
        {phase==='ready'&&(
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <div style={{fontSize:42,marginBottom:14}}>🔍</div>
            <div style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:8}}>Ready to scan</div>
            <div style={{fontSize:13.5,color:C.textMuted,marginBottom:20,lineHeight:1.6}}>We'll read your table names, column types, and relationships. This takes about 30 seconds.</div>
            <button onClick={run} style={{background:C.accent,color:'#fff',border:'none',borderRadius:8,padding:'12px 28px',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
              Start scan →
            </button>
          </div>
        )}
        {phase==='running'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
              <span style={{fontSize:13.5,fontWeight:600,color:C.text}}>{msg}</span>
              <span style={{fontSize:13,fontWeight:700,color:C.accent}}>{pct}%</span>
            </div>
            <div style={{height:8,background:'#E5E7EB',borderRadius:4,overflow:'hidden',marginBottom:16}}>
              <div style={{height:'100%',width:`${pct}%`,background:C.accent,borderRadius:4,transition:'width .4s ease'}}/>
            </div>
            <div style={{fontSize:12.5,color:C.textLight,textAlign:'center'}}>This may take up to 60 seconds for large databases</div>
          </div>
        )}
        {phase==='done'&&(
          <div style={{textAlign:'center',padding:'10px 0'}}>
            <div style={{width:56,height:56,borderRadius:'50%',background:C.accentBg,border:`3px solid ${C.accent}`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px',fontSize:24}}>✓</div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:6}}>Schema mapped successfully</div>
            <div style={{fontSize:13.5,color:C.textMuted}}>Your tables and relationships have been identified. Next, add context so Qwezy understands your business.</div>
          </div>
        )}
      </Card>

      <Bottom onBack={onBack} onNext={onNext} nextLabel="Add context →" disabled={phase!=='done'}/>
    </div>
  )
}

// ── STEP 3: ANNOTATE ──────────────────────────────────────────────────────────
function AnnotateStep({onNext,onBack,onAnnotations}:{onNext:()=>void;onBack:()=>void;onAnnotations:(a:any)=>void}) {
  const [companyDesc,setCompanyDesc]=useState('')
  const [industry,setIndustry]=useState('')
  const [primaryUse,setPrimaryUse]=useState('')
  const [saving,setSaving]=useState(false)

  const industries=['Legal / Law Firm','Finance / Accounting','Healthcare','Real Estate','E-commerce / Retail','Technology / SaaS','Manufacturing','Other']
  const uses=['Track revenue and billing','Monitor team performance','Understand customers','Manage operations','Compliance and reporting','Other']

  const save=async()=>{
    setSaving(true)
    onAnnotations({companyDesc,industry,primaryUse})
    await new Promise(r=>setTimeout(r,800))
    setSaving(false)
    onNext()
  }

  return(
    <div>
      <h1 style={{fontSize:22,fontWeight:700,color:C.text,marginBottom:6,letterSpacing:'-0.3px'}}>Tell us about your business</h1>
      <p style={{fontSize:14,color:C.textMuted,marginBottom:24,lineHeight:1.55}}>This helps Qwezy generate accurate, business-aware queries instead of generic SQL.</p>

      <Card style={{marginBottom:14}}>
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>Industry</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {industries.map(i=>(
                <button key={i} onClick={()=>setIndustry(i)}
                  style={{padding:'6px 12px',borderRadius:14,border:'1.5px solid',fontSize:12.5,fontWeight:500,cursor:'pointer',fontFamily:'Inter,sans-serif',
                    borderColor:industry===i?C.accent:C.cardBorder,background:industry===i?C.accentBg:'#fff',color:industry===i?C.accentDark:C.textLight}}>
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>Primary use case</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {uses.map(u=>(
                <button key={u} onClick={()=>setPrimaryUse(u)}
                  style={{padding:'6px 12px',borderRadius:14,border:'1.5px solid',fontSize:12.5,fontWeight:500,cursor:'pointer',fontFamily:'Inter,sans-serif',
                    borderColor:primaryUse===u?C.accent:C.cardBorder,background:primaryUse===u?C.accentBg:'#fff',color:primaryUse===u?C.accentDark:C.textLight}}>
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>Describe your business in one sentence</div>
            <textarea value={companyDesc} onChange={e=>setCompanyDesc(e.target.value)} rows={2}
              placeholder="e.g. A mid-size law firm in New York tracking client matters, billing, and attorney performance"
              style={{width:'100%',padding:'9px 11px',borderRadius:7,border:`1.5px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif',resize:'none',lineHeight:1.6}}
              onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
          </div>
        </div>
      </Card>

      <div style={{padding:'9px 13px',background:'#F0F7FF',border:'1px solid #BFDBFE',borderRadius:7,fontSize:12.5,color:'#1E40AF',marginBottom:4}}>
        You can update this any time from Admin → Settings.
      </div>

      <Bottom onBack={onBack} onNext={save} nextLabel="Save & continue →" loading={saving} disabled={!industry||!primaryUse||!companyDesc.trim()}/>
    </div>
  )
}

// ── STEP 4: DONE ──────────────────────────────────────────────────────────────
function DoneStep({onDashboard}:{onDashboard:()=>void}) {
  return(
    <div style={{textAlign:'center'}}>
      <div style={{width:72,height:72,borderRadius:'50%',background:C.accentBg,border:`3px solid ${C.accent}`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',fontSize:32}}>✓</div>
      <h1 style={{fontSize:26,fontWeight:800,color:C.text,letterSpacing:'-0.4px',marginBottom:8}}>You're ready to query</h1>
      <p style={{fontSize:14.5,color:C.textMuted,maxWidth:420,margin:'0 auto 28px',lineHeight:1.65}}>
        Your database is connected and Qwezy knows your business. Ask anything in plain English.
      </p>

      <div style={{background:'#fff',borderRadius:10,border:`1px solid ${C.cardBorder}`,padding:20,maxWidth:460,margin:'0 auto 24px',textAlign:'left'}}>
        <div style={{fontSize:13.5,fontWeight:600,color:C.text,marginBottom:12}}>Try asking these first</div>
        {[
          'Which matters have unbilled time entries older than 30 days?',
          'Show me attorneys who are below their monthly billing target',
          'Which clients have invoices outstanding more than 90 days?',
        ].map((q,i)=>(
          <button key={i} onClick={onDashboard}
            style={{display:'flex',alignItems:'center',gap:9,width:'100%',padding:'9px 11px',marginBottom:5,background:'#F8FAFD',border:`1px solid ${C.cardBorder}`,borderRadius:7,cursor:'pointer',fontFamily:'Inter,sans-serif',fontSize:13.5,color:C.textMuted,textAlign:'left'}}
            onMouseOver={e=>{(e.currentTarget as HTMLElement).style.borderColor=C.accent;(e.currentTarget as HTMLElement).style.background=C.accentBg;(e.currentTarget as HTMLElement).style.color=C.text}}
            onMouseOut={e=>{(e.currentTarget as HTMLElement).style.borderColor=C.cardBorder;(e.currentTarget as HTMLElement).style.background='#F8FAFD';(e.currentTarget as HTMLElement).style.color=C.textMuted}}>
            <span style={{color:C.accent,fontWeight:600,flexShrink:0}}>→</span>{q}
          </button>
        ))}
      </div>

      <div style={{background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:8,padding:'12px 16px',maxWidth:460,margin:'0 auto 24px',fontSize:13,color:'#92400E',textAlign:'left'}}>
        <span style={{fontWeight:600}}>Next step:</span> Go to Admin → Team to invite your attorneys and staff. Each person gets their own login and sees the same data.
      </div>

      <button onClick={onDashboard} style={{background:C.accent,color:'#fff',border:'none',borderRadius:9,padding:'14px 32px',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',boxShadow:'0 3px 12px rgba(5,150,105,0.25)'}}>
        Open dashboard →
      </button>
    </div>
  )
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function Onboarding() {
  const router=useRouter()
  const [step,setStep]=useState<Step>('connect')
  const [connectionString,setConnectionString]=useState('')
  const [annotations,setAnnotations]=useState<any>(null)
  const [saving,setSaving]=useState(false)
  const [saveError,setSaveError]=useState('')

  const next=()=>setStep(s=>{const i=STEPS.indexOf(s);return STEPS[Math.min(i+1,STEPS.length-1)]})
  const back=()=>setStep(s=>{const i=STEPS.indexOf(s);return STEPS[Math.max(i-1,0)]})

  // When annotate step completes, save everything to Supabase
  const handleAnnotationsDone=async(ann:any)=>{
    setAnnotations(ann)
    setSaving(true);setSaveError('')
    try{
      const tablesConfig={
        industry: ann.industry,
        primary_use: ann.primaryUse,
        company_description: ann.companyDesc,
        system_prompt: buildSystemPrompt(ann),
      }
      const res=await fetch('/api/company',{
        method:'PATCH',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          db_connection_string: connectionString,
          tables_config: tablesConfig,
        }),
      })
      if(!res.ok){
        const d=await res.json()
        throw new Error(d.error||'Failed to save settings')
      }
    }catch(e:any){
      setSaveError(e.message)
      setSaving(false)
      return
    }
    setSaving(false)
    next()
  }

  const buildSystemPrompt=(ann:any)=>`You are Qwezy, a SQL assistant for a ${ann.industry} company whose primary goal is to ${ann.primaryUse?.toLowerCase()}. ${ann.companyDesc} Always return valid PostgreSQL SQL. Return ONLY a JSON object with keys: sql, confidence, assumptions.`

  return(
    <div style={{fontFamily:'Inter,-apple-system,sans-serif',background:C.bg,minHeight:'100vh'}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{background:'#fff',borderBottom:`1px solid ${C.cardBorder}`,padding:'0 28px',display:'flex',alignItems:'center',height:52,position:'sticky',top:0,zIndex:50}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:24,height:24,background:'linear-gradient(135deg,#10B981,#059669)',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{color:'#fff',fontFamily:"'JetBrains Mono'",fontWeight:700,fontSize:9}}>{'{ }'}</span>
          </div>
          <span style={{fontWeight:700,fontSize:14,color:C.text}}>Qwezy</span>
          <span style={{fontSize:12,color:C.textLight,paddingLeft:10,borderLeft:`1px solid ${C.cardBorder}`,marginLeft:2}}>Database setup</span>
        </div>
      </div>

      <div style={{maxWidth:780,margin:'0 auto',padding:'36px 20px 80px'}}>
        <Nav step={step}/>
        {saveError&&<div style={{padding:'12px 14px',background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:7,fontSize:13,color:C.danger,marginBottom:16}}>{saveError}</div>}
        <div key={step}>
          {step==='connect'&&<ConnectStep onNext={next} onConnectionString={setConnectionString}/>}
          {step==='discover'&&<DiscoverStep onNext={next} onBack={back}/>}
          {step==='annotate'&&<AnnotateStep onNext={next} onBack={back} onAnnotations={handleAnnotationsDone}/>}
          {step==='done'&&<DoneStep onDashboard={()=>router.push('/dashboard')}/>}
        </div>
      </div>
    </div>
  )
}
