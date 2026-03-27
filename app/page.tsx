'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const C = {
  accent:'#059669', accentDark:'#047857', accentBg:'#ECFDF5', accentBorder:'#A7F3D0',
  text:'#0F1923', textMuted:'#4B5563', textLight:'#9CA3AF',
  card:'#FFFFFF', cardBorder:'#E5E7EB', bg:'#F9FAFB',
  navBg:'#022c22',
}

const QUERIES = [
  'Who are our top 10 customers by revenue this quarter?',
  'Show monthly revenue broken down by product category',
  'Which products are below reorder level right now?',
  'How many orders were shipped late last month?',
  'What is the average deal size by sales rep?',
  'Show me customer churn rate compared to last year',
]

function useTypingEffect(strings: string[], typingSpeed=40, pauseMs=2200) {
  const [display, setDisplay] = useState('')
  const [strIdx, setStrIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) {
      const t = setTimeout(() => { setPaused(false); setDeleting(true) }, pauseMs)
      return () => clearTimeout(t)
    }
    const current = strings[strIdx]
    if (!deleting) {
      if (charIdx < current.length) {
        const t = setTimeout(() => { setDisplay(current.slice(0, charIdx+1)); setCharIdx(c=>c+1) }, typingSpeed)
        return () => clearTimeout(t)
      } else { setPaused(true) }
    } else {
      if (charIdx > 0) {
        const t = setTimeout(() => { setDisplay(current.slice(0, charIdx-1)); setCharIdx(c=>c-1) }, typingSpeed/2.5)
        return () => clearTimeout(t)
      } else { setDeleting(false); setStrIdx(i=>(i+1)%strings.length) }
    }
  }, [charIdx, deleting, paused, strIdx, strings, typingSpeed, pauseMs])
  return display
}

function LeadForm({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name:'', email:'', company:'', role:'', teamSize:'', industry:'', useCase:'' })
  const [step, setStep] = useState<'form'|'done'>('form')
  const [loading, setLoading] = useState(false)
  const set = (k: string, v: string) => setForm(p => ({...p, [k]:v}))
  const ready = !!form.name && !!form.email && !!form.company && !!form.role

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/demo-access', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (data.immediateLogin || data.ok) {
        window.location.href = '/dashboard'
      } else {
        setStep('done')
      }
    } catch {
      setStep('done')
    }
    setLoading(false)
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'#fff',borderRadius:14,width:'100%',maxWidth:500,maxHeight:'92vh',overflow:'auto',boxShadow:'0 24px 64px rgba(0,0,0,0.2)'}}>
        <div style={{padding:'20px 24px',borderBottom:'1px solid #F3F4F6',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,background:'#fff',zIndex:1}}>
          <div>
            <div style={{fontWeight:700,fontSize:16,color:C.text}}>Try Qwezy free</div>
            <div style={{fontSize:12.5,color:C.textLight,marginTop:1}}>Get instant access to a live demo environment</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,color:C.textLight,cursor:'pointer',lineHeight:1}}>x</button>
        </div>

        {step==='done' ? (
          <div style={{padding:36,textAlign:'center'}}>
            <div style={{width:56,height:56,borderRadius:'50%',background:C.accentBg,border:`2px solid ${C.accent}`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',fontSize:22,color:C.accent}}>✉</div>
            <div style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:6}}>Check your email</div>
            <div style={{fontSize:14,color:C.textMuted,lineHeight:1.65,marginBottom:10}}>
              We sent a link to <strong style={{color:C.text}}>{form.email}</strong>.<br/>
              Click it to open your live demo instantly.
            </div>
            <div style={{fontSize:13,color:C.textLight,marginBottom:24}}>The link works anytime - bookmark it for easy return access.</div>
            <button onClick={onClose} style={{background:C.accent,color:'#fff',border:'none',borderRadius:8,padding:'10px 24px',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Got it</button>
          </div>
        ) : (
          <form onSubmit={submit} style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div>
                <label style={{fontSize:11.5,fontWeight:600,color:C.textMuted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>Full name</label>
                <input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Jane Smith" required
                  style={{width:'100%',padding:'9px 12px',borderRadius:7,border:'1.5px solid #E5E7EB',fontSize:14,color:C.text,fontFamily:'Inter,sans-serif'}}
                  onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor='#E5E7EB'}/>
              </div>
              <div>
                <label style={{fontSize:11.5,fontWeight:600,color:C.textMuted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>Work email</label>
                <input type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="jane@company.com" required
                  style={{width:'100%',padding:'9px 12px',borderRadius:7,border:'1.5px solid #E5E7EB',fontSize:14,color:C.text,fontFamily:'Inter,sans-serif'}}
                  onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor='#E5E7EB'}/>
              </div>
            </div>
            <div>
              <label style={{fontSize:11.5,fontWeight:600,color:C.textMuted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>Company</label>
              <input value={form.company} onChange={e=>set('company',e.target.value)} placeholder="Acme Inc." required
                style={{width:'100%',padding:'9px 12px',borderRadius:7,border:'1.5px solid #E5E7EB',fontSize:14,color:C.text,fontFamily:'Inter,sans-serif'}}
                onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor='#E5E7EB'}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div>
                <label style={{fontSize:11.5,fontWeight:600,color:C.textMuted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>Your role</label>
                <select value={form.role} onChange={e=>set('role',e.target.value)} required
                  style={{width:'100%',padding:'9px 12px',borderRadius:7,border:'1.5px solid #E5E7EB',fontSize:14,color:form.role?C.text:C.textLight,fontFamily:'Inter,sans-serif',background:'#fff',cursor:'pointer'}}>
                  <option value="">Select...</option>
                  {['Data Analyst','Data Engineer','BI / Analytics Lead','Product Manager','Engineering','CEO / Founder','Finance','Operations','Other'].map(r=><option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:11.5,fontWeight:600,color:C.textMuted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>Team size</label>
                <select value={form.teamSize} onChange={e=>set('teamSize',e.target.value)}
                  style={{width:'100%',padding:'9px 12px',borderRadius:7,border:'1.5px solid #E5E7EB',fontSize:14,color:form.teamSize?C.text:C.textLight,fontFamily:'Inter,sans-serif',background:'#fff',cursor:'pointer'}}>
                  <option value="">Select...</option>
                  {['Just me','2-5','6-20','21-100','100+'].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{fontSize:11.5,fontWeight:600,color:C.textMuted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>Industry</label>
              <select value={form.industry} onChange={e=>set('industry',e.target.value)}
                style={{width:'100%',padding:'9px 12px',borderRadius:7,border:'1.5px solid #E5E7EB',fontSize:14,color:form.industry?C.text:C.textLight,fontFamily:'Inter,sans-serif',background:'#fff',cursor:'pointer'}}>
                <option value="">Select...</option>
                {['SaaS / Software','E-commerce / Retail','Finance / Fintech','Media & Entertainment','Healthcare','Manufacturing','Logistics','Real Estate','Other'].map(i=><option key={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:11.5,fontWeight:600,color:C.textMuted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>Primary use case</label>
              <textarea value={form.useCase} onChange={e=>set('useCase',e.target.value)} placeholder="e.g. Revenue reporting, customer analytics..." rows={2}
                style={{width:'100%',padding:'9px 12px',borderRadius:7,border:'1.5px solid #E5E7EB',fontSize:14,color:C.text,fontFamily:'Inter,sans-serif',resize:'vertical',lineHeight:1.5}}
                onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor='#E5E7EB'}/>
            </div>
            <button type="submit" disabled={!ready||loading}
              style={{background:ready&&!loading?C.accent:'#E5E7EB',color:ready&&!loading?'#fff':C.textLight,border:'none',borderRadius:8,padding:'12px',fontSize:15,fontWeight:700,cursor:ready&&!loading?'pointer':'default',fontFamily:'Inter,sans-serif',marginTop:4}}>
              {loading?'Setting up your demo...':'Open live demo'}
            </button>
            <div style={{fontSize:12,color:C.textLight,textAlign:'center'}}>No spam. We will reach out personally within one business day.</div>
          </form>
        )}
      </div>
    </div>
  )
}

const DEMO_RESULT = [
  {company:'Acme Corp',revenue:'$128,440',orders:94,country:'US'},
  {company:'Meridian SaaS',revenue:'$107,220',orders:82,country:'UK'},
  {company:'Volta Commerce',revenue:'$98,010',orders:71,country:'DE'},
  {company:'Orbis Health',revenue:'$76,550',orders:63,country:'FR'},
  {company:'Atlas Systems',revenue:'$71,200',orders:58,country:'US'},
]

function DemoPane({ query }: { query: string }) {
  const sqlLines = [
    'SELECT',
    '  c.company_name,',
    '  ROUND(SUM(od.unit_price * od.quantity',
    '        * (1 - od.discount)), 2) AS revenue,',
    '  COUNT(o.order_id) AS orders,',
    '  c.country',
    'FROM customers c',
    "JOIN orders o ON c.customer_id = o.customer_id",
    "JOIN order_details od ON o.order_id = od.order_id",
    "WHERE o.order_date >= DATE_TRUNC('quarter', CURRENT_DATE)",
    'GROUP BY c.company_name, c.country',
    'ORDER BY revenue DESC',
    'LIMIT 10',
  ]
  const fields = ['company','revenue','orders','country']
  const KW = ['SELECT','FROM','JOIN','WHERE','GROUP BY','ORDER BY','LIMIT','ON','AS','AND']

  return (
    <div style={{borderRadius:14,overflow:'hidden',border:'1px solid #E5E7EB',boxShadow:'0 24px 64px rgba(0,0,0,0.12)',background:'#fff'}}>
      <div style={{background:C.navBg,padding:'11px 16px',display:'flex',alignItems:'center',gap:8}}>
        <div style={{display:'flex',gap:5}}>
          {['#FF5F57','#FEBC2E','#28C840'].map(c=><div key={c} style={{width:11,height:11,borderRadius:'50%',background:c}}/>)}
        </div>
        <span style={{fontSize:12,color:'#6EE7B7',fontFamily:"'JetBrains Mono',monospace",marginLeft:6,opacity:0.8}}>qwezy.io - live demo</span>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:5,background:'rgba(16,185,129,0.2)',border:'1px solid rgba(16,185,129,0.3)',borderRadius:10,padding:'2px 8px'}}>
          <div style={{width:5,height:5,borderRadius:'50%',background:'#10B981'}}/>
          <span style={{fontSize:10.5,color:'#6EE7B7',fontWeight:600}}>Live</span>
        </div>
      </div>
      <div style={{padding:'14px 18px',borderBottom:'1px solid #F3F4F6',background:'#FAFAFA'}}>
        <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:7}}>Ask anything about your data</div>
        <div style={{fontSize:15.5,color:C.text,fontWeight:500,minHeight:24,display:'flex',alignItems:'center'}}>
          {query}<span style={{display:'inline-block',width:2,height:18,background:C.accent,marginLeft:1,animation:'blink 1s step-end infinite',verticalAlign:'middle'}}/>
        </div>
      </div>
      <div style={{background:'#0D1117',padding:'14px 18px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
          <span style={{fontSize:11,fontWeight:600,color:'#484F58',textTransform:'uppercase',letterSpacing:'0.07em'}}>Generated SQL - 1.2s</span>
          <span style={{fontSize:11,color:C.accent,fontWeight:600,background:'rgba(5,150,105,0.15)',padding:'2px 8px',borderRadius:4}}>high confidence</span>
        </div>
        <pre style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:'#E6EDF3',lineHeight:1.7,margin:0,overflow:'hidden'}}>
          {sqlLines.map((l,i)=>(
            <div key={i}>
              <span style={{color:'#484F58',userSelect:'none',marginRight:14,fontSize:10}}>{String(i+1).padStart(2,'0')}</span>
              {l.split(new RegExp(`(${KW.join('|')})`, 'g')).map((part,j)=>(
                KW.includes(part)
                  ? <span key={j} style={{color:'#FF7B72'}}>{part}</span>
                  : part.startsWith("'")
                  ? <span key={j} style={{color:'#A5D6FF'}}>{part}</span>
                  : <span key={j}>{part}</span>
              ))}
            </div>
          ))}
        </pre>
      </div>
      <div style={{padding:'0'}}>
        <div style={{padding:'10px 18px',background:'#F8FAFD',borderTop:'1px solid #F3F4F6',borderBottom:'1px solid #F3F4F6',display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:12,fontWeight:600,color:C.textMuted}}>{DEMO_RESULT.length} rows</span>
          <span style={{fontSize:11.5,color:C.textLight}}>0.38s</span>
          <span style={{marginLeft:'auto',fontSize:11.5,color:C.accent,fontWeight:600,cursor:'pointer'}}>Export CSV</span>
        </div>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:'#F8FAFD'}}>
              {fields.map(f=><th key={f} style={{padding:'8px 18px',textAlign:'left',fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',borderBottom:'1px solid #F3F4F6',whiteSpace:'nowrap'}}>{f}</th>)}
            </tr>
          </thead>
          <tbody>
            {DEMO_RESULT.map((row,i)=>(
              <tr key={i} style={{borderBottom:'1px solid #F9FAFB',background:i%2===0?'#fff':'#FAFAFA'}}>
                {fields.map(f=>(
                  <td key={f} style={{padding:'8px 18px',fontSize:13,color:f==='revenue'?C.accent:C.text,fontWeight:f==='revenue'?600:400,fontFamily:f==='revenue'||f==='orders'?"'JetBrains Mono',monospace":'Inter,sans-serif',whiteSpace:'nowrap'}}>
                    {(row as any)[f]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const STEPS_HOW = [
  {n:'01', title:'Connect your database', desc:'PostgreSQL, MySQL, Snowflake, BigQuery, Redshift and more. Read-only. Setup in under 5 minutes.', detail:'We never write to your database. Credentials are AES-256 encrypted.'},
  {n:'02', title:'We learn your schema', desc:'Qwezy scans your tables, identifies joins, and understands your business context.', detail:'You annotate each table with plain-English descriptions. Your AI context is company-isolated.'},
  {n:'03', title:'Your team asks questions', desc:'Anyone on your team can type a question and get an answer - no SQL knowledge needed.', detail:'Analysts can edit the generated SQL. Everyone else just gets results.'},
  {n:'04', title:'Build dashboards and reports', desc:'Save queries as reports, schedule them to run automatically, and build shared dashboards.', detail:'Connect live to PowerBI and Tableau. Email results to any distribution list.'},
]

const TRUST_LOGOS = ['Postgres','MySQL','Snowflake','BigQuery','Redshift','SQL Server']

export default function Landing() {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const typedQuery = useTypingEffect(QUERIES)

  return (
    <div style={{fontFamily:'Inter,-apple-system,sans-serif',color:C.text,background:'#fff'}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        html{scroll-behavior:smooth}
        a{text-decoration:none}
      `}</style>
      {showForm && <LeadForm onClose={()=>setShowForm(false)}/>}

      <nav style={{position:'sticky',top:0,zIndex:100,background:'rgba(255,255,255,0.93)',backdropFilter:'blur(12px)',borderBottom:'1px solid #F3F4F6',padding:'0 40px',height:58,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:9}}>
          <div style={{width:28,height:28,background:'linear-gradient(135deg,#10B981,#059669)',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{color:'#fff',fontFamily:"'JetBrains Mono'",fontWeight:700,fontSize:11}}>{'{ }'}</span>
          </div>
          <span style={{fontWeight:800,fontSize:18,color:C.text,letterSpacing:'-0.3px'}}>Qwezy</span>
        </div>
        <div style={{display:'flex',gap:28,alignItems:'center'}}>
          {[['How it works','#how'],['Features','#features'],['Security','#security'],['Pricing','#pricing']].map(([l,h])=>(
            <a key={l} href={h} style={{fontSize:14,color:C.textMuted,fontWeight:500}}>{l}</a>
          ))}
        </div>
        <div style={{display:'flex',gap:9,alignItems:'center'}}>
          <button onClick={()=>router.push('/auth')} style={{fontSize:14,color:C.textMuted,background:'none',border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:500,padding:'7px 14px',borderRadius:7}}>Sign in</button>
          <button onClick={()=>setShowForm(true)} style={{background:C.accent,color:'#fff',border:'none',borderRadius:7,padding:'8px 18px',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Request access</button>
        </div>
      </nav>

      <section style={{padding:'80px 40px 0',maxWidth:1140,margin:'0 auto',display:'grid',gridTemplateColumns:'1fr 1.1fr',gap:60,alignItems:'center',minHeight:'calc(100vh - 58px)'}}>
        <div>
          <div style={{display:'inline-flex',alignItems:'center',gap:7,padding:'5px 12px',borderRadius:20,background:C.accentBg,border:`1px solid ${C.accentBorder}`,marginBottom:28}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:C.accent}}/>
            <span style={{fontSize:13,fontWeight:600,color:C.accentDark}}>Early access - limited spots</span>
          </div>
          <h1 style={{fontSize:56,fontWeight:800,color:C.text,letterSpacing:'-1.5px',lineHeight:1.08,marginBottom:22}}>
            Ask your data<br/>
            <span style={{color:C.accent}}>anything.</span>
          </h1>
          <p style={{fontSize:17,color:C.textMuted,lineHeight:1.7,marginBottom:32,maxWidth:460}}>
            Qwezy translates plain English into SQL and runs it against your database - giving your whole team instant answers without writing a single line of code.
          </p>
          <div style={{display:'flex',gap:10,marginBottom:20}}>
            <button onClick={()=>setShowForm(true)} style={{background:C.accent,color:'#fff',border:'none',borderRadius:9,padding:'14px 26px',fontSize:15.5,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',boxShadow:'0 4px 20px rgba(5,150,105,0.3)'}}>
              Try it free - no setup needed
            </button>
            <button onClick={()=>router.push('/auth')} style={{background:'#fff',color:C.text,border:'1.5px solid #E5E7EB',borderRadius:9,padding:'14px 20px',fontSize:15.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
              Sign in
            </button>
          </div>
          <p style={{fontSize:12.5,color:C.textLight}}>No credit card - no setup - live data ready instantly</p>
        </div>
        <div style={{paddingBottom:16}}>
          <DemoPane query={typedQuery}/>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginTop:14}}>
            <button onClick={()=>setShowForm(true)} style={{background:C.accent,color:'#fff',border:'none',borderRadius:8,padding:'10px 22px',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',boxShadow:'0 2px 12px rgba(5,150,105,0.3)'}}>
              Try this yourself - free
            </button>
            <span style={{fontSize:13,color:C.textLight}}>No setup. Live data. 30 seconds.</span>
          </div>
        </div>
      </section>

      <section style={{padding:'48px 40px',borderTop:'1px solid #F3F4F6',borderBottom:'1px solid #F3F4F6',background:'#FAFAFA'}}>
        <div style={{maxWidth:900,margin:'0 auto',display:'flex',alignItems:'center',gap:24,flexWrap:'wrap',justifyContent:'center'}}>
          <span style={{fontSize:13,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.07em',marginRight:8}}>Connects to</span>
          {TRUST_LOGOS.map(l=>(
            <span key={l} style={{fontSize:13.5,fontWeight:600,color:C.textMuted,padding:'6px 14px',borderRadius:7,border:'1px solid #E5E7EB',background:'#fff'}}>{l}</span>
          ))}
        </div>
      </section>

      <section id="how" style={{padding:'96px 40px',maxWidth:1000,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:56}}>
          <h2 style={{fontSize:38,fontWeight:800,color:C.text,letterSpacing:'-0.8px',marginBottom:10}}>How it works</h2>
          <p style={{fontSize:17,color:C.textMuted,maxWidth:500,margin:'0 auto',lineHeight:1.6}}>From database connection to your first query in under 30 minutes.</p>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:0}}>
          {STEPS_HOW.map((s,i)=>(
            <div key={s.n} style={{display:'grid',gridTemplateColumns:'80px 1fr',gap:28,padding:'28px 0',borderBottom:i<STEPS_HOW.length-1?'1px solid #F3F4F6':'none',alignItems:'start'}}>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:32,fontWeight:800,color:'#E5E7EB',lineHeight:1}}>{s.n}</div>
              <div>
                <div style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:5,letterSpacing:'-0.2px'}}>{s.title}</div>
                <div style={{fontSize:15,color:C.textMuted,lineHeight:1.6,marginBottom:5}}>{s.desc}</div>
                <div style={{fontSize:13,color:C.textLight}}>{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{padding:'80px 40px',background:'#022c22',position:'relative'}}>
        <div style={{maxWidth:960,margin:'0 auto',position:'relative'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:64,alignItems:'center'}}>
            <div>
              <div style={{display:'inline-flex',alignItems:'center',gap:7,padding:'5px 12px',borderRadius:20,background:'rgba(16,185,129,0.15)',border:'1px solid rgba(16,185,129,0.3)',marginBottom:20}}>
                <div style={{width:7,height:7,borderRadius:'50%',background:'#10B981'}}/>
                <span style={{fontSize:13,fontWeight:600,color:'#6EE7B7'}}>Your data never leaves your control</span>
              </div>
              <h2 style={{fontSize:40,fontWeight:800,color:'#fff',letterSpacing:'-1px',lineHeight:1.1,marginBottom:18}}>
                Qwezy understands<br/>your data.<br/>
                <span style={{color:'#34D399'}}>Nobody else does.</span>
              </h2>
              <p style={{fontSize:16,color:'#6EE7B7',lineHeight:1.75,marginBottom:24}}>
                Most AI tools send your queries and fragments of your data to a shared model. Qwezy works differently. We learn your schema, your business terminology, and your join logic once, during onboarding. That context is stored privately, per company, and injected locally into every query.
              </p>
              <p style={{fontSize:16,color:'rgba(110,231,183,0.75)',lineHeight:1.75}}>
                The result: Qwezy can write complex, multi-table SQL accurate to your specific business - without ever seeing your actual data rows, and without sharing anything across organisations.
              </p>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {[
                {label:'Your question', value:'Who are our top customers this quarter?', color:'#fff', icon:'Q', note:'Stays in your session'},
                {label:'Your private context', value:'Table annotations, join paths, business rules, metric definitions', color:'#34D399', icon:'L', note:'Stored per company - never shared'},
                {label:'Generated SQL', value:'SELECT ... FROM orders JOIN customers ... WHERE ...', color:'#6EE7B7', icon:'S', note:'Built from your context'},
                {label:'Your database', value:'Read-only query. No data extracted. No training.', color:'#A7F3D0', icon:'D', note:'We never see your rows'},
              ].map((row,i)=>(
                <div key={i} style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,padding:'14px 18px',display:'flex',gap:14,alignItems:'flex-start'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:11,fontWeight:600,color:'rgba(110,231,183,0.6)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:4}}>{row.label}</div>
                    <div style={{fontSize:13,color:row.color,lineHeight:1.5,marginBottom:3}}>{row.value}</div>
                    <div style={{fontSize:11.5,color:'rgba(255,255,255,0.35)'}}>{row.note}</div>
                  </div>
                </div>
              ))}
              <div style={{padding:'12px 16px',borderRadius:8,background:'rgba(52,211,153,0.1)',border:'1px solid rgba(52,211,153,0.25)',fontSize:13,color:'#34D399',lineHeight:1.55,textAlign:'center',fontWeight:500}}>
                Every company's AI context is fully isolated - end to end
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" style={{padding:'80px 40px',background:C.bg}}>
        <div style={{maxWidth:1000,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:52}}>
            <h2 style={{fontSize:36,fontWeight:800,color:C.text,letterSpacing:'-0.7px',marginBottom:10}}>Built for the whole team</h2>
            <p style={{fontSize:17,color:C.textMuted,maxWidth:500,margin:'0 auto',lineHeight:1.6}}>Analysts get SQL they can edit. Everyone else just gets answers.</p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
            {[
              {title:'Natural language queries', desc:'Ask any question in plain English. Qwezy generates SQL, runs it, and returns results in seconds.'},
              {title:'SQL editor for analysts', desc:'Every generated query is editable. Inspect, tweak, and re-run with line numbers and a copy button.'},
              {title:'Live dashboards', desc:'Build a dashboard from any query. Drag to resize, choose chart type. Create multiple pages and share with your team.'},
              {title:'Scheduled reports', desc:'Set any report to run daily, weekly, or monthly. Results land in your inbox or Slack automatically.'},
              {title:'BI tool integration', desc:'Expose any report as a live JSON or CSV endpoint. Connect directly to PowerBI, Tableau, Google Sheets, or Excel.'},
              {title:'Company-isolated AI', desc:'Your annotations and query history are fully isolated per organisation. Your data never trains our models.'},
            ].map(f=>(
              <div key={f.title} style={{background:'#fff',borderRadius:12,padding:24,border:'1px solid #E5E7EB'}}>
                <div style={{width:10,height:10,borderRadius:'50%',background:C.accent,marginBottom:12}}/>
                <div style={{fontSize:15.5,fontWeight:700,color:C.text,marginBottom:7,letterSpacing:'-0.2px'}}>{f.title}</div>
                <div style={{fontSize:13.5,color:C.textMuted,lineHeight:1.65}}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{padding:'80px 40px'}}>
        <div style={{maxWidth:1000,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:48}}>
            <h2 style={{fontSize:32,fontWeight:800,color:C.text,letterSpacing:'-0.6px'}}>What early users say</h2>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:18}}>
            {[
              {q:'We went from a 3-day turnaround on data requests to 30 seconds. It changed how our entire finance team operates.',name:'Sarah Chen',role:'VP Finance',co:'Meridian SaaS'},
              {q:'Our analysts used to spend half their time writing the same queries. Now they focus on insight, not SQL syntax.',name:'James Okafor',role:'Head of Analytics',co:'Volta Commerce'},
              {q:'Setup took 20 minutes. By end of day our sales team was querying the CRM without any training at all.',name:'Maria Santos',role:'Chief of Staff',co:'Orbis Health'},
            ].map(t=>(
              <div key={t.name} style={{background:C.bg,borderRadius:12,padding:24,border:'1px solid #E5E7EB',display:'flex',flexDirection:'column',gap:16}}>
                <p style={{fontSize:14.5,color:C.text,lineHeight:1.7,flex:1}}>"{t.q}"</p>
                <div>
                  <div style={{fontSize:13.5,fontWeight:600,color:C.text}}>{t.name}</div>
                  <div style={{fontSize:12.5,color:C.textLight,marginTop:2}}>{t.role} - {t.co}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="security" style={{padding:'80px 40px',background:C.bg}}>
        <div style={{maxWidth:820,margin:'0 auto',display:'grid',gridTemplateColumns:'1fr 1fr',gap:48,alignItems:'center'}}>
          <div>
            <h2 style={{fontSize:32,fontWeight:800,color:C.text,letterSpacing:'-0.6px',marginBottom:12}}>Security first</h2>
            <p style={{fontSize:15,color:C.textMuted,lineHeight:1.7,marginBottom:24}}>Qwezy issues read-only queries only. It cannot write, update, or delete your data. Every company's AI context is fully isolated. Your data never trains our models.</p>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {['Read-only database access - never writes','AES-256 encrypted credentials','Per-company isolated AI context','No data used to train any model','GDPR compliant data handling'].map(item=>(
                <div key={item} style={{display:'flex',alignItems:'center',gap:9}}>
                  <span style={{color:C.accent,fontWeight:700,fontSize:14,flexShrink:0}}>+</span>
                  <span style={{fontSize:13.5,color:C.text}}>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{background:'#fff',borderRadius:12,padding:24,border:'1px solid #E5E7EB'}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:'#484F58',marginBottom:14,textTransform:'uppercase',letterSpacing:'0.07em'}}>How isolation works</div>
            {[
              {label:'Company context',val:'Injected per query',color:C.accent},
              {label:'Table annotations',val:'Company-specific',color:C.accent},
              {label:'Query history',val:'Isolated per org',color:C.accent},
              {label:'Data access',val:'Read-only only',color:C.accent},
              {label:'Model training',val:'Never',color:'#EF4444'},
              {label:'Credential storage',val:'AES-256',color:C.accent},
            ].map(r=>(
              <div key={r.label} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid #F3F4F6'}}>
                <span style={{fontSize:13,color:C.textMuted}}>{r.label}</span>
                <span style={{fontSize:13,fontWeight:600,color:r.color}}>{r.val}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" style={{padding:'80px 40px'}}>
        <div style={{maxWidth:980,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:48}}>
            <h2 style={{fontSize:32,fontWeight:800,color:C.text,letterSpacing:'-0.3px',marginBottom:8}}>Simple, transparent pricing</h2>
            <p style={{fontSize:15,color:C.textMuted}}>One-time onboarding fee to get set up - then a flat monthly subscription - add seats anytime</p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
            {[
              {name:'Starter',onboard:'$299',monthly:'$99/mo',includes:['1 database','Up to 5 tables','1 admin seat','1 analyst seat','3 viewer seats'],highlight:false,note:'Best for solo teams or a single department'},
              {name:'Growth',onboard:'$750',monthly:'$349/mo',includes:['3 databases','Up to 20 tables','2 admin seats','5 analyst seats','10 viewer seats','Scheduled reports','Email delivery'],highlight:true,note:'Most popular for growing teams'},
              {name:'Scale',onboard:'$1,500',monthly:'$899/mo',includes:['10 databases','Up to 75 tables','5 admin seats','15 analyst seats','Unlimited viewers','BI tool connections','Priority support'],highlight:false,note:'Multi-team or multi-product companies'},
              {name:'Enterprise',onboard:'Custom',monthly:'Custom',includes:['Unlimited databases','Unlimited tables','Unlimited seats','SSO / SAML','Dedicated CSM','Custom SLA','Audit log'],highlight:false,note:'Large orgs with compliance needs'},
            ].map(p=>(
              <div key={p.name} style={{background:'#fff',borderRadius:12,padding:22,border:p.highlight?`2px solid ${C.accent}`:'1px solid #E5E7EB',position:'relative',display:'flex',flexDirection:'column'}}>
                {p.highlight && <div style={{position:'absolute',top:-12,left:'50%',transform:'translateX(-50%)',background:C.accent,color:'#fff',fontSize:11,fontWeight:700,padding:'3px 12px',borderRadius:10,whiteSpace:'nowrap'}}>Most popular</div>}
                <div style={{fontSize:14.5,fontWeight:700,color:C.text,marginBottom:4}}>{p.name}</div>
                <div style={{fontSize:10.5,color:C.textLight,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Onboarding</div>
                <div style={{fontSize:26,fontWeight:800,color:p.onboard==='Custom'?C.textMuted:C.text,letterSpacing:'-0.5px',marginBottom:2}}>{p.onboard}</div>
                <div style={{fontSize:13,fontWeight:600,color:p.highlight?C.accent:C.textMuted,marginBottom:14}}>{p.monthly==='Custom'?'Talk to us':p.monthly}</div>
                <div style={{display:'flex',flexDirection:'column',gap:6,flex:1,marginBottom:18}}>
                  {p.includes.map(item=>(
                    <div key={item} style={{display:'flex',alignItems:'center',gap:7,fontSize:12.5,color:C.textMuted}}>
                      <span style={{color:C.accent,fontWeight:700,flexShrink:0,fontSize:11}}>+</span>{item}
                    </div>
                  ))}
                </div>
                <div style={{fontSize:11.5,color:C.textLight,marginBottom:14,lineHeight:1.4,fontStyle:'italic'}}>{p.note}</div>
                <button onClick={()=>setShowForm(true)}
                  style={{width:'100%',background:p.highlight?C.accent:'#fff',color:p.highlight?'#fff':C.text,border:p.highlight?'none':'1.5px solid #E5E7EB',borderRadius:7,padding:'9px',fontSize:13.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',marginTop:'auto'}}>
                  {p.onboard==='Custom'?'Contact us':'Request access'}
                </button>
              </div>
            ))}
          </div>
          <div style={{background:'#F9FAFB',borderRadius:10,border:'1px solid #E5E7EB',padding:'18px 24px',display:'flex',gap:32,alignItems:'center',flexWrap:'wrap'}}>
            <div>
              <div style={{fontSize:13.5,fontWeight:600,color:C.text,marginBottom:3}}>Need more seats?</div>
              <div style={{fontSize:13,color:C.textMuted}}>Add seats to any plan at any time.</div>
            </div>
            {[['Admin','$40/mo per seat'],['Analyst','$25/mo per seat'],['Viewer','$8/mo per seat']].map(([role,price])=>(
              <div key={role} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 16px',background:'#fff',borderRadius:8,border:'1px solid #E5E7EB'}}>
                <div>
                  <div style={{fontSize:12.5,fontWeight:600,color:C.text}}>{role}</div>
                  <div style={{fontSize:12,color:C.accent,fontWeight:600}}>{price}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{padding:'80px 40px',background:C.navBg}}>
        <div style={{maxWidth:580,margin:'0 auto',textAlign:'center'}}>
          <h2 style={{fontSize:36,fontWeight:800,color:'#fff',letterSpacing:'-0.8px',marginBottom:12}}>Start querying in 30 minutes</h2>
          <p style={{fontSize:16,color:'#6EE7B7',lineHeight:1.65,marginBottom:32}}>We onboard every new customer personally - setup, annotation, and first queries included in the onboarding fee.</p>
          <button onClick={()=>setShowForm(true)} style={{background:C.accent,color:'#fff',border:'none',borderRadius:9,padding:'14px 30px',fontSize:16,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',boxShadow:'0 4px 20px rgba(16,185,129,0.4)'}}>
            Request early access
          </button>
        </div>
      </section>

      <footer style={{padding:'28px 40px',borderTop:'1px solid #F3F4F6',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:7,cursor:'pointer'}} onClick={()=>router.push('/auth')}>
          <div style={{width:22,height:22,background:'linear-gradient(135deg,#10B981,#059669)',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{color:'#fff',fontFamily:"'JetBrains Mono'",fontWeight:700,fontSize:9}}>{'{ }'}</span>
          </div>
          <span style={{fontWeight:700,fontSize:14,color:C.text}}>Qwezy</span>
        </div>
        <div style={{fontSize:12.5,color:C.textLight}}>2026 Qwezy Inc. reports@qwezy.io</div>
        <div style={{display:'flex',gap:20}}>
          {['Privacy','Terms','Security'].map(l=><a key={l} href="#" style={{fontSize:12.5,color:C.textLight}}>{l}</a>)}
        </div>
      </footer>
    </div>
  )
}
