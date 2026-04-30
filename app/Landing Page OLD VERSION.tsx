'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// ── Types & data ──────────────────────────────────────────────────────────────
const QUERIES = [
  'Which clients haven\'t placed an order in 90 days?',
  'Show me monthly revenue broken down by product category',
  'Which attorneys are below their billing target this month?',
  'What\'s our average deal size by sales rep this quarter?',
  'Which invoices are more than 60 days overdue?',
  'Show me our top 10 customers by spend this year',
]

const DEMO_ROWS = [
  {customer:'Ernst Handel', revenue:'$48,837', orders:17, country:'Austria'},
  {customer:'QUICK-Stop', revenue:'$37,216', orders:28, country:'Germany'},
  {customer:'Save-a-lot', revenue:'$36,310', orders:31, country:'USA'},
  {customer:'Rattlesnake', revenue:'$21,240', orders:18, country:'USA'},
  {customer:'Hungry Owl', revenue:'$20,105', orders:19, country:'Austria'},
]

function useTyping(strings: string[], speed=38, pause=2400) {
  const [display, setDisplay] = useState('')
  const [si, setSi] = useState(0)
  const [ci, setCi] = useState(0)
  const [del, setDel] = useState(false)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) { const t = setTimeout(() => { setPaused(false); setDel(true) }, pause); return () => clearTimeout(t) }
    const cur = strings[si]
    if (!del) {
      if (ci < cur.length) { const t = setTimeout(() => { setDisplay(cur.slice(0, ci+1)); setCi(c=>c+1) }, speed); return () => clearTimeout(t) }
      else setPaused(true)
    } else {
      if (ci > 0) { const t = setTimeout(() => { setDisplay(cur.slice(0, ci-1)); setCi(c=>c-1) }, speed/2.5); return () => clearTimeout(t) }
      else { setDel(false); setSi(i=>(i+1)%strings.length) }
    }
  }, [ci, del, paused, si])
  return display
}

// ── Lead form ─────────────────────────────────────────────────────────────────
const ROLES = ['CEO / Founder','Operations Manager','Finance Manager / Controller','Business Analyst','Marketing Manager','Sales / Revenue Operations','Product Manager','Developer / Engineer','Other']
const TEAM_SIZES = ['1–5 people','6–15 people','16–50 people','51–200 people','200+ people']
const INDUSTRIES = ['E-commerce / Retail','Professional Services','Legal / Law Firm','Accounting / Finance','Logistics / Supply Chain','SaaS / Technology','Healthcare','Hospitality / Food & Beverage','Real Estate','Agency / Consulting','Other']
const USE_CASES = ['Replace manual reporting','Give my team self-serve data access','Replace a BI tool (Tableau, Power BI etc.)','Query data without waiting on a developer','Build dashboards for clients','Just exploring']

const INP_STYLE = {width:'100%',padding:'10px 13px',borderRadius:8,border:'1.5px solid #E5E7EB',fontSize:14,color:'#0F1923',fontFamily:'Inter,sans-serif',outline:'none',boxSizing:'border-box' as const,background:'#fff'}
const LBL_STYLE = {fontSize:11.5,fontWeight:600 as const,color:'#6B7280',display:'block' as const,marginBottom:5,textTransform:'uppercase' as const,letterSpacing:'0.05em'}

function DemoSelect({label,value,onChange,options,placeholder}:{label:string,value:string,onChange:(v:string)=>void,options:string[],placeholder:string}) {
  return (
    <div>
      <label style={LBL_STYLE}>{label}</label>
      <div style={{position:'relative'}}>
        <select value={value} onChange={e=>onChange(e.target.value)}
          style={{...INP_STYLE,appearance:'none' as const,cursor:'pointer',paddingRight:32}}
          onFocus={e=>e.target.style.borderColor='#059669'} onBlur={e=>e.target.style.borderColor='#E5E7EB'}>
          <option value="" disabled>{placeholder}</option>
          {options.map(o=><option key={o} value={o}>{o}</option>)}
        </select>
        <div style={{position:'absolute',right:11,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',color:'#9CA3AF',fontSize:11}}>▾</div>
      </div>
    </div>
  )
}

function LeadForm({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'email'|'form'|'otp'|'welcome'>('email')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [teamSize, setTeamSize] = useState('')
  const [industry, setIndustry] = useState('')
  const [useCase, setUseCase] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const checkEmail = async () => {
    if(!email.trim()||!email.includes('@')){setError('Please enter a valid email.');return}
    setLoading(true);setError('')
    try{
      const res=await fetch('/api/demo-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'send_otp',email:email.trim()})})
      const data=await res.json()
      if(!res.ok){setError(data.error||'Something went wrong.');return}
      if(data.skipOTP){window.location.href='/dashboard';return}
      // needsForm: true OR returning: false — show the full form
      setStep('form')
    }catch{setError('Something went wrong.')}
    finally{setLoading(false)}
  }

  const submitForm = async () => {
    if(!name.trim()){setError('Please enter your name.');return}
    if(!company.trim()){setError('Please enter your company.');return}
    if(!role){setError('Please select your role.');return}
    if(!teamSize){setError('Please select your team size.');return}
    setLoading(true);setError('')
    try{
      const res=await fetch('/api/demo-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'send_otp',email:email.trim(),name:name.trim(),company:company.trim(),role,teamSize,industry,useCase})})
      const data=await res.json()
      if(!res.ok){setError(data.error||'Something went wrong.');return}
      setStep('otp')
    }catch{setError('Something went wrong.')}
    finally{setLoading(false)}
  }

  const verifyOTP = async () => {
    if(otp.length!==6){setError('Please enter the 6-digit code.');return}
    setLoading(true);setError('')
    try{
      const res=await fetch('/api/demo-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'verify_otp',email:email.trim(),code:otp})})
      const data=await res.json()
      if(!res.ok){setError(data.error||'Invalid code.');return}
      setStep('welcome')
      setTimeout(()=>{window.location.href='/dashboard'},2000)
    }catch{setError('Something went wrong.')}
    finally{setLoading(false)}
  }

  const stepTitle = step==='email'?'Try the live demo':step==='form'?'Tell us about yourself':step==='otp'?'Check your email':`You're in!`
  const stepSub = step==='email'?'No credit card. No setup. Live data in minutes.':step==='form'?`We'll tailor the demo to your use case.`:step==='otp'?`We sent a 6-digit code to ${email}`:'Taking you to your dashboard…'

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(2,20,12,0.82)',backdropFilter:'blur(8px)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:500,boxShadow:'0 32px 80px rgba(0,0,0,0.28)',overflow:'hidden',fontFamily:'Inter,sans-serif',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{padding:'24px 28px 0',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <div style={{fontSize:20,fontWeight:800,color:'#0F1923',letterSpacing:'-0.4px',marginBottom:4}}>{stepTitle}</div>
            <div style={{fontSize:13.5,color:'#6B7280',lineHeight:1.5}}>{stepSub}</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,color:'#9CA3AF',cursor:'pointer',lineHeight:1,padding:'0 0 0 16px',flexShrink:0}}>×</button>
        </div>
        <div style={{padding:'20px 28px 28px',display:'flex',flexDirection:'column',gap:14}}>

          {step==='email'&&<>
            <div>
              <label style={LBL_STYLE}>Work email</label>
              <input value={email} onChange={e=>{setEmail(e.target.value);setError('')}}
                onKeyDown={e=>e.key==='Enter'&&checkEmail()}
                placeholder="you@company.com" type="email" style={INP_STYLE}
                onFocus={e=>e.target.style.borderColor='#059669'} onBlur={e=>e.target.style.borderColor='#E5E7EB'}
                autoComplete="email"/>
            </div>
            {error&&<div style={{fontSize:13,color:'#EF4444',background:'#FEF2F2',padding:'8px 12px',borderRadius:7}}>{error}</div>}
            <button onClick={checkEmail} disabled={loading}
              style={{background:loading?'#A7F3D0':'#059669',color:'#fff',border:'none',borderRadius:9,padding:'13px',fontSize:15,fontWeight:700,cursor:loading?'not-allowed':'pointer',fontFamily:'Inter,sans-serif'}}>
              {loading?'Checking…':'Continue →'}
            </button>
            <div style={{fontSize:12,color:'#9CA3AF',textAlign:'center'}}>No credit card · No setup · Live data immediately</div>
          </>}

          {step==='form'&&<>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div>
                <label style={LBL_STYLE}>Full name</label>
                <input value={name} onChange={e=>{setName(e.target.value);setError('')}} placeholder="Jane Smith" style={INP_STYLE}
                  onFocus={e=>e.target.style.borderColor='#059669'} onBlur={e=>e.target.style.borderColor='#E5E7EB'}/>
              </div>
              <div>
                <label style={LBL_STYLE}>Company</label>
                <input value={company} onChange={e=>{setCompany(e.target.value);setError('')}} placeholder="Acme Inc" style={INP_STYLE}
                  onFocus={e=>e.target.style.borderColor='#059669'} onBlur={e=>e.target.style.borderColor='#E5E7EB'}/>
              </div>
            </div>
            <DemoSelect label="Your role" value={role} onChange={v=>{setRole(v);setError('')}} options={ROLES} placeholder="Select your role"/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <DemoSelect label="Team size" value={teamSize} onChange={v=>{setTeamSize(v);setError('')}} options={TEAM_SIZES} placeholder="Select size"/>
              <DemoSelect label="Industry" value={industry} onChange={setIndustry} options={INDUSTRIES} placeholder="Select industry"/>
            </div>
            <DemoSelect label="What brings you here?" value={useCase} onChange={setUseCase} options={USE_CASES} placeholder="Select use case (optional)"/>
            {error&&<div style={{fontSize:13,color:'#EF4444',background:'#FEF2F2',padding:'8px 12px',borderRadius:7}}>{error}</div>}
            <button onClick={submitForm} disabled={loading}
              style={{background:loading?'#A7F3D0':'#059669',color:'#fff',border:'none',borderRadius:9,padding:'13px',fontSize:15,fontWeight:700,cursor:loading?'not-allowed':'pointer',fontFamily:'Inter,sans-serif'}}>
              {loading?'Sending code…':'Send verification code →'}
            </button>
            <button onClick={()=>{setStep('email');setError('')}} style={{background:'none',border:'none',fontSize:13,color:'#9CA3AF',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>← Back</button>
          </>}

          {step==='otp'&&<>
            <input value={otp}
              onChange={e=>{setOtp(e.target.value.replace(/\D/g,'').slice(0,6));setError('')}}
              onKeyDown={e=>e.key==='Enter'&&verifyOTP()}
              placeholder="000000" maxLength={6}
              style={{...INP_STYLE,textAlign:'center',fontSize:32,fontFamily:"'JetBrains Mono',monospace",letterSpacing:10,fontWeight:800,padding:'14px'}}
              onFocus={e=>e.target.style.borderColor='#059669'} onBlur={e=>e.target.style.borderColor='#E5E7EB'}
              autoComplete="one-time-code"/>
            {error&&<div style={{fontSize:13,color:'#EF4444',background:'#FEF2F2',padding:'8px 12px',borderRadius:7}}>{error}</div>}
            <button onClick={verifyOTP} disabled={otp.length!==6||loading}
              style={{background:otp.length===6&&!loading?'#059669':'#E5E7EB',color:otp.length===6&&!loading?'#fff':'#9CA3AF',border:'none',borderRadius:9,padding:'13px',fontSize:15,fontWeight:700,cursor:otp.length===6?'pointer':'default',fontFamily:'Inter,sans-serif'}}>
              {loading?'Verifying…':'Access the demo →'}
            </button>
            <button onClick={()=>{setStep('form');setOtp('');setError('')}} style={{background:'none',border:'none',fontSize:13,color:'#9CA3AF',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>← Resend code</button>
          </>}

          {step==='welcome'&&(
            <div style={{textAlign:'center',padding:'12px 0 8px'}}>
              <div style={{width:56,height:56,borderRadius:'50%',background:'#ECFDF5',border:'3px solid #059669',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px',fontSize:24}}>✓</div>
              <div style={{fontSize:14,color:'#6B7280',lineHeight:1.6}}>Setting up your workspace…</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Feature mockups ───────────────────────────────────────────────────────────
function QueryDemo({ query }: { query: string }) {
  return (
    <div style={{borderRadius:12,overflow:'hidden',border:'1px solid #E5E7EB',boxShadow:'0 20px 60px rgba(0,0,0,0.10)',background:'#fff'}}>
      <div style={{background:'#022c22',padding:'10px 14px',display:'flex',alignItems:'center',gap:8}}>
        <div style={{display:'flex',gap:4}}>{['#FF5F57','#FEBC2E','#28C840'].map(c=><div key={c} style={{width:10,height:10,borderRadius:'50%',background:c}}/>)}</div>
        <span style={{fontSize:11.5,color:'#6EE7B7',fontFamily:"'JetBrains Mono',monospace",marginLeft:4,opacity:0.8}}>qwezy.io</span>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:4,background:'rgba(16,185,129,0.2)',border:'1px solid rgba(16,185,129,0.3)',borderRadius:8,padding:'2px 8px'}}>
          <div style={{width:5,height:5,borderRadius:'50%',background:'#10B981'}}/><span style={{fontSize:10,color:'#6EE7B7',fontWeight:600}}>Live</span>
        </div>
      </div>
      <div style={{padding:'12px 16px',borderBottom:'1px solid #F3F4F6',background:'#FAFAFA'}}>
        <div style={{fontSize:11,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:6}}>Ask anything about your data</div>
        <div style={{fontSize:15,color:'#0F1923',fontWeight:500,minHeight:22,display:'flex',alignItems:'center'}}>
          {query}<span style={{display:'inline-block',width:2,height:16,background:'#059669',marginLeft:1,animation:'blink 1s step-end infinite',verticalAlign:'middle'}}/>
        </div>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:'#F8FAFD'}}>
              {['Customer','Revenue','Orders','Country'].map(h=><th key={h} style={{padding:'8px 14px',textAlign:'left',fontSize:10.5,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.05em',borderBottom:'1px solid #F3F4F6',whiteSpace:'nowrap'}}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {DEMO_ROWS.map((r,i)=>(
              <tr key={i} style={{borderBottom:'1px solid #F9FAFB',background:i%2===0?'#fff':'#FAFAFA'}}>
                <td style={{padding:'7px 14px',fontSize:13,fontWeight:500,color:'#0F1923'}}>{r.customer}</td>
                <td style={{padding:'7px 14px',fontSize:13,fontWeight:700,color:'#059669',fontFamily:"'JetBrains Mono',monospace"}}>{r.revenue}</td>
                <td style={{padding:'7px 14px',fontSize:13,color:'#4B5563',fontFamily:"'JetBrains Mono',monospace"}}>{r.orders}</td>
                <td style={{padding:'7px 14px',fontSize:13,color:'#4B5563'}}>{r.country}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{padding:'8px 14px',background:'#F8FAFD',display:'flex',alignItems:'center',gap:10,borderTop:'1px solid #F3F4F6'}}>
        <span style={{fontSize:12,fontWeight:600,color:'#6B7280'}}>5 rows · 0.4s</span>
        <span style={{marginLeft:'auto',fontSize:12,color:'#059669',fontWeight:600,cursor:'pointer'}}>Export CSV ↓</span>
      </div>
    </div>
  )
}

function DashboardMockup() {
  const bars = [65,42,78,55,90,38,72]
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul']
  return (
    <div style={{borderRadius:12,overflow:'hidden',border:'1px solid #E5E7EB',boxShadow:'0 12px 40px rgba(0,0,0,0.08)',background:'#fff',padding:'16px'}}>
      <div style={{fontSize:12,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:14}}>Revenue dashboard · Live</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
        {[['Total Revenue','$284,516','+12%'],['Active Customers','847','+3%'],['Avg Order Value','$336','+8%']].map(([l,v,d])=>(
          <div key={l} style={{background:'#F8FAFD',borderRadius:8,padding:'10px 12px',border:'1px solid #E5E7EB'}}>
            <div style={{fontSize:10,color:'#9CA3AF',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>{l}</div>
            <div style={{fontSize:18,fontWeight:800,color:'#0F1923',letterSpacing:'-0.5px'}}>{v}</div>
            <div style={{fontSize:11,color:'#059669',fontWeight:600,marginTop:2}}>{d} vs last month</div>
          </div>
        ))}
      </div>
      <div style={{background:'#F8FAFD',borderRadius:8,padding:'12px',border:'1px solid #E5E7EB'}}>
        <div style={{fontSize:11,fontWeight:600,color:'#9CA3AF',marginBottom:10}}>Monthly revenue</div>
        <div style={{display:'flex',alignItems:'flex-end',gap:6,height:56}}>
          {bars.map((h,i)=>(
            <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
              <div style={{width:'100%',background:i===4?'#059669':'#D1FAE5',borderRadius:'3px 3px 0 0',height:`${h}%`,minHeight:4,transition:'height .3s'}}/>
              <span style={{fontSize:9,color:'#9CA3AF'}}>{months[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ReportMockup() {
  return (
    <div style={{borderRadius:12,overflow:'hidden',border:'1px solid #E5E7EB',boxShadow:'0 12px 40px rgba(0,0,0,0.08)',background:'#fff'}}>
      <div style={{padding:'14px 16px',borderBottom:'1px solid #F3F4F6',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <div style={{fontSize:11,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:2}}>Scheduled report</div>
          <div style={{fontSize:14,fontWeight:700,color:'#0F1923'}}>Weekly Top Customers</div>
        </div>
        <div style={{fontSize:11,padding:'3px 9px',borderRadius:10,background:'#ECFDF5',color:'#059669',border:'1px solid #A7F3D0',fontWeight:600}}>Sends Monday 8am</div>
      </div>
      <div style={{padding:'10px 16px',background:'#F8FAFD',borderBottom:'1px solid #F3F4F6',fontSize:12,color:'#6B7280'}}>
        <span style={{fontWeight:600,color:'#0F1923'}}>To:</span> team@company.com, ceo@company.com
      </div>
      <div style={{padding:'14px 16px'}}>
        <div style={{padding:'12px 14px',background:'#F8FAFD',borderLeft:'3px solid #059669',borderRadius:'0 8px 8px 0',marginBottom:12,fontSize:13,color:'#374151',lineHeight:1.65}}>
          Ernst Handel leads this week with $48,837 across 17 orders. Germany accounts for 3 of your top 8 clients — strong regional concentration.
        </div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead><tr style={{borderBottom:'1px solid #F3F4F6'}}>
            {['Company','Country','Revenue'].map(h=><th key={h} style={{padding:'5px 8px',textAlign:'left',color:'#9CA3AF',fontWeight:600,textTransform:'uppercase',fontSize:10,letterSpacing:'0.05em'}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {DEMO_ROWS.slice(0,3).map((r,i)=>(
              <tr key={i} style={{borderBottom:'1px solid #F9FAFB'}}>
                <td style={{padding:'6px 8px',fontWeight:500,color:'#0F1923',fontSize:12}}>{r.customer}</td>
                <td style={{padding:'6px 8px',color:'#6B7280',fontSize:12}}>{r.country}</td>
                <td style={{padding:'6px 8px',fontWeight:700,color:'#059669',fontFamily:"'JetBrains Mono',monospace",fontSize:12}}>{r.revenue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main landing page ─────────────────────────────────────────────────────────
export default function Landing() {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const typedQuery = useTyping(QUERIES)

  return (
    <div style={{fontFamily:'Inter,-apple-system,sans-serif',color:'#0F1923',background:'#fff'}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        html{scroll-behavior:smooth}
        a{text-decoration:none}
        .fade-up{animation:fadeUp .6s ease forwards}
      `}</style>

      {showForm && <LeadForm onClose={()=>setShowForm(false)}/>}

      {/* Nav */}
      <nav style={{position:'sticky',top:0,zIndex:100,background:'rgba(255,255,255,0.95)',backdropFilter:'blur(12px)',borderBottom:'1px solid #F3F4F6',padding:'0 40px',height:58,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:9}}>
          <div style={{width:28,height:28,background:'linear-gradient(135deg,#10B981,#059669)',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{color:'#fff',fontFamily:"'JetBrains Mono'",fontWeight:700,fontSize:11}}>{'{ }'}</span>
          </div>
          <span style={{fontWeight:800,fontSize:18,color:'#0F1923',letterSpacing:'-0.3px'}}>Qwezy</span>
        </div>
        <div style={{display:'flex',gap:28,alignItems:'center'}}>
          {[['How it works','#how'],['Features','#features'],['Pricing','#pricing']].map(([l,h])=>(
            <a key={l} href={h} style={{fontSize:14,color:'#4B5563',fontWeight:500}}>{l}</a>
          ))}
        </div>
        <div style={{display:'flex',gap:9,alignItems:'center'}}>
          <button onClick={()=>router.push('/auth')} style={{fontSize:14,color:'#4B5563',background:'none',border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:500,padding:'7px 14px',borderRadius:7}}>Sign in</button>
          <button onClick={()=>setShowForm(true)} style={{background:'#059669',color:'#fff',border:'none',borderRadius:7,padding:'8px 18px',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Request access</button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{padding:'80px 40px 60px',maxWidth:1140,margin:'0 auto',display:'grid',gridTemplateColumns:'1fr 1.05fr',gap:64,alignItems:'center'}}>
        <div>
          <div style={{display:'inline-flex',alignItems:'center',gap:7,padding:'5px 14px',borderRadius:20,background:'#ECFDF5',border:'1px solid #A7F3D0',marginBottom:28}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:'#059669'}}/>
            <span style={{fontSize:13,fontWeight:600,color:'#047857'}}>Built for small businesses</span>
          </div>
          <h1 style={{fontSize:52,fontWeight:800,color:'#0F1923',letterSpacing:'-1.5px',lineHeight:1.08,marginBottom:20}}>
            Act on your data<br/>
            <span style={{color:'#059669'}}>like the big ones do.</span>
          </h1>
          <p style={{fontSize:17,color:'#4B5563',lineHeight:1.75,marginBottom:16,maxWidth:460}}>
            Large companies have data teams, analysts, and dashboards. You have a spreadsheet and a gut feeling. Qwezy fixes that — connect your database and ask anything in plain English.
          </p>
          <p style={{fontSize:15,color:'#6B7280',lineHeight:1.7,marginBottom:32,maxWidth:440}}>
            Live dashboards, automated reports, email summaries. The intelligence layer your business never had access to — until now.
          </p>
          <div style={{display:'flex',gap:10,marginBottom:16}}>
            <button onClick={()=>setShowForm(true)} style={{background:'#059669',color:'#fff',border:'none',borderRadius:9,padding:'14px 26px',fontSize:15.5,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',boxShadow:'0 4px 20px rgba(5,150,105,0.3)'}}>
              Try it free →
            </button>
            <button onClick={()=>router.push('/auth')} style={{background:'#fff',color:'#0F1923',border:'1.5px solid #E5E7EB',borderRadius:9,padding:'14px 20px',fontSize:15.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
              Sign in
            </button>
          </div>
          <p style={{fontSize:12.5,color:'#9CA3AF'}}>No credit card · No SQL knowledge needed · Setup in 30 minutes</p>
        </div>
        <div>
          <QueryDemo query={typedQuery}/>
        </div>
      </section>

      {/* DB logos */}
      <section style={{padding:'36px 40px',borderTop:'1px solid #F3F4F6',borderBottom:'1px solid #F3F4F6',background:'#FAFAFA'}}>
        <div style={{maxWidth:900,margin:'0 auto',display:'flex',alignItems:'center',gap:20,flexWrap:'wrap',justifyContent:'center'}}>
          <span style={{fontSize:12.5,fontWeight:600,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'0.07em',marginRight:8}}>Connects to</span>
          {['PostgreSQL','MySQL','Neon','Supabase','Snowflake','BigQuery','Redshift','SQL Server'].map(l=>(
            <span key={l} style={{fontSize:13,fontWeight:600,color:'#4B5563',padding:'5px 13px',borderRadius:7,border:'1px solid #E5E7EB',background:'#fff'}}>{l}</span>
          ))}
        </div>
      </section>

      {/* Three pillars */}
      <section id="features" style={{padding:'96px 40px'}}>
        <div style={{maxWidth:1100,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:64}}>
            <h2 style={{fontSize:38,fontWeight:800,color:'#0F1923',letterSpacing:'-0.8px',marginBottom:12}}>Everything a large company has.<br/><span style={{color:'#059669'}}>Built for your size.</span></h2>
            <p style={{fontSize:17,color:'#4B5563',maxWidth:520,margin:'0 auto',lineHeight:1.65}}>Three tools in one. Ask questions, build dashboards, and automate reports — no data team required.</p>
          </div>

          {/* Feature 1: Ask */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:64,alignItems:'center',marginBottom:96}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:'#059669',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12}}>01 · Ask</div>
              <h3 style={{fontSize:30,fontWeight:800,color:'#0F1923',letterSpacing:'-0.5px',lineHeight:1.2,marginBottom:16}}>Ask your data anything.<br/>Get a real answer.</h3>
              <p style={{fontSize:15.5,color:'#4B5563',lineHeight:1.75,marginBottom:20}}>Type a question. Qwezy writes the SQL, runs it against your live database, and hands you results in seconds. No training needed for your team.</p>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {[
                  'Who are our top 10 customers this quarter?',
                  'Which invoices are 60+ days overdue?',
                  'Show me revenue by category vs last year',
                ].map(q=>(
                  <div key={q} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'#F8FAFD',borderRadius:8,border:'1px solid #E5E7EB',fontSize:13.5,color:'#374151',cursor:'pointer',fontStyle:'italic'}}
                    onClick={()=>setShowForm(true)}
                    onMouseOver={e=>{(e.currentTarget as HTMLElement).style.borderColor='#059669';(e.currentTarget as HTMLElement).style.background='#ECFDF5'}}
                    onMouseOut={e=>{(e.currentTarget as HTMLElement).style.borderColor='#E5E7EB';(e.currentTarget as HTMLElement).style.background='#F8FAFD'}}>
                    <span style={{color:'#059669',fontWeight:700,flexShrink:0,fontStyle:'normal'}}>→</span>{q}
                  </div>
                ))}
              </div>
            </div>
            <QueryDemo query={typedQuery}/>
          </div>

          {/* Feature 2: Dashboard */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:64,alignItems:'center',marginBottom:96}}>
            <DashboardMockup/>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:'#059669',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12}}>02 · Dashboards</div>
              <h3 style={{fontSize:30,fontWeight:800,color:'#0F1923',letterSpacing:'-0.5px',lineHeight:1.2,marginBottom:16}}>Live dashboards.<br/>Without a BI team.</h3>
              <p style={{fontSize:15.5,color:'#4B5563',lineHeight:1.75,marginBottom:20}}>Turn any query into a chart. Build a dashboard your team can check every morning — KPIs, trends, and tables, all pulling from your live database.</p>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {['Revenue trends by month','KPI cards that update in real time','Multiple dashboard pages for different teams','Bar, line, stacked, and table views'].map(f=>(
                  <div key={f} style={{display:'flex',alignItems:'center',gap:9}}>
                    <span style={{color:'#059669',fontWeight:700,fontSize:13,flexShrink:0}}>+</span>
                    <span style={{fontSize:14,color:'#374151'}}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Feature 3: Reports */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:64,alignItems:'center'}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:'#059669',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12}}>03 · Reports</div>
              <h3 style={{fontSize:30,fontWeight:800,color:'#0F1923',letterSpacing:'-0.5px',lineHeight:1.2,marginBottom:16}}>Automated reports.<br/>Delivered to your inbox.</h3>
              <p style={{fontSize:15.5,color:'#4B5563',lineHeight:1.75,marginBottom:20}}>Schedule any report to run daily, weekly, or monthly. Results land in your team's inbox automatically — with an AI summary that calls out what matters.</p>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {['Daily, weekly, or monthly schedule','AI-written summary of key trends','Send to any email list','Export to CSV, PowerBI, or Tableau'].map(f=>(
                  <div key={f} style={{display:'flex',alignItems:'center',gap:9}}>
                    <span style={{color:'#059669',fontWeight:700,fontSize:13,flexShrink:0}}>+</span>
                    <span style={{fontSize:14,color:'#374151'}}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
            <ReportMockup/>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" style={{padding:'80px 40px',background:'#F9FAFB',borderTop:'1px solid #F3F4F6'}}>
        <div style={{maxWidth:860,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:52}}>
            <h2 style={{fontSize:36,fontWeight:800,color:'#0F1923',letterSpacing:'-0.7px',marginBottom:10}}>Up and running in 30 minutes</h2>
            <p style={{fontSize:16,color:'#4B5563',lineHeight:1.6}}>We onboard every new customer personally. Your first dashboard is included.</p>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:0}}>
            {[
              {n:'01',title:'Connect your database',desc:'PostgreSQL, MySQL, Neon, Supabase, Snowflake and more. Read-only. We never write to your data.',detail:'Credentials are AES-256 encrypted. Setup takes under 5 minutes.'},
              {n:'02',title:'We learn your schema',desc:'Qwezy scans your tables, identifies relationships, and understands your business context.',detail:'You add plain-English descriptions. Your context is fully isolated — no data is shared.'},
              {n:'03',title:'Your team asks questions',desc:'Anyone can type a question and get an answer. No SQL. No training. No waiting.',detail:'Analysts can see and edit the generated SQL. Everyone else just gets results.'},
              {n:'04',title:'Build dashboards and automate reports',desc:'Save queries as reports, schedule them, and build dashboards your team actually checks.',detail:'Connect live to PowerBI and Tableau. Email results to any distribution list.'},
            ].map((s,i,arr)=>(
              <div key={s.n} style={{display:'grid',gridTemplateColumns:'72px 1fr',gap:24,padding:'28px 0',borderBottom:i<arr.length-1?'1px solid #E5E7EB':'none',alignItems:'start'}}>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:28,fontWeight:800,color:'#D1FAE5',lineHeight:1}}>{s.n}</div>
                <div>
                  <div style={{fontSize:17,fontWeight:700,color:'#0F1923',marginBottom:5,letterSpacing:'-0.2px'}}>{s.title}</div>
                  <div style={{fontSize:14.5,color:'#4B5563',lineHeight:1.65,marginBottom:4}}>{s.desc}</div>
                  <div style={{fontSize:13,color:'#9CA3AF'}}>{s.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section style={{padding:'80px 40px',background:'#022c22'}}>
        <div style={{maxWidth:820,margin:'0 auto',display:'grid',gridTemplateColumns:'1fr 1fr',gap:48,alignItems:'center'}}>
          <div>
            <h2 style={{fontSize:32,fontWeight:800,color:'#fff',letterSpacing:'-0.6px',marginBottom:12}}>Your data stays yours.</h2>
            <p style={{fontSize:15,color:'#6EE7B7',lineHeight:1.75,marginBottom:24}}>Qwezy issues read-only queries only. It cannot write, update, or delete anything. Every company's context is fully isolated — your data never trains our models.</p>
            <div style={{display:'flex',flexDirection:'column',gap:9}}>
              {['Read-only access — Qwezy never writes to your DB','AES-256 encrypted credentials','Per-company isolated AI context','Your data never trains any model','GDPR compliant'].map(item=>(
                <div key={item} style={{display:'flex',alignItems:'center',gap:9}}>
                  <span style={{color:'#34D399',fontWeight:700,fontSize:14,flexShrink:0}}>+</span>
                  <span style={{fontSize:13.5,color:'rgba(255,255,255,0.85)'}}>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{background:'rgba(255,255,255,0.05)',borderRadius:12,padding:24,border:'1px solid rgba(255,255,255,0.08)'}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:'#6EE7B7',marginBottom:14,textTransform:'uppercase',letterSpacing:'0.07em',opacity:0.7}}>How isolation works</div>
            {[
              {label:'Company context',val:'Injected per query',color:'#34D399'},
              {label:'Query history',val:'Isolated per org',color:'#34D399'},
              {label:'Data access',val:'Read-only only',color:'#34D399'},
              {label:'Model training',val:'Never',color:'#F87171'},
              {label:'Credential storage',val:'AES-256',color:'#34D399'},
              {label:'Cross-company data',val:'Impossible',color:'#34D399'},
            ].map(r=>(
              <div key={r.label} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                <span style={{fontSize:13,color:'rgba(255,255,255,0.5)'}}>{r.label}</span>
                <span style={{fontSize:13,fontWeight:600,color:r.color}}>{r.val}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{padding:'80px 40px'}}>
        <div style={{maxWidth:980,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:48}}>
            <h2 style={{fontSize:32,fontWeight:800,color:'#0F1923',letterSpacing:'-0.3px',marginBottom:8}}>Simple, transparent pricing</h2>
            <p style={{fontSize:15,color:'#4B5563'}}>One-time onboarding fee to get set up — then a flat monthly rate. Add seats anytime.</p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
            {[
              {name:'Starter',onboard:'$299',monthly:'$99/mo',includes:['1 database','Up to 5 tables','1 admin + 1 analyst','3 viewer seats'],highlight:false,note:'Solo teams or single departments'},
              {name:'Growth',onboard:'$750',monthly:'$349/mo',includes:['3 databases','Up to 20 tables','2 admin + 5 analyst','10 viewer seats','Scheduled reports','Email delivery'],highlight:true,note:'Most popular for growing teams'},
              {name:'Scale',onboard:'$1,500',monthly:'$899/mo',includes:['10 databases','Up to 75 tables','5 admin + 15 analyst','Unlimited viewers','BI tool connections','Priority support'],highlight:false,note:'Multi-team companies'},
              {name:'Enterprise',onboard:'Custom',monthly:'Custom',includes:['Unlimited everything','SSO / SAML','Dedicated CSM','Custom SLA','Audit log'],highlight:false,note:'Large orgs with compliance needs'},
            ].map(p=>(
              <div key={p.name} style={{background:'#fff',borderRadius:12,padding:22,border:p.highlight?`2px solid #059669`:'1px solid #E5E7EB',position:'relative',display:'flex',flexDirection:'column'}}>
                {p.highlight&&<div style={{position:'absolute',top:-12,left:'50%',transform:'translateX(-50%)',background:'#059669',color:'#fff',fontSize:11,fontWeight:700,padding:'3px 12px',borderRadius:10,whiteSpace:'nowrap'}}>Most popular</div>}
                <div style={{fontSize:14.5,fontWeight:700,color:'#0F1923',marginBottom:4}}>{p.name}</div>
                <div style={{fontSize:10.5,color:'#9CA3AF',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>Onboarding</div>
                <div style={{fontSize:24,fontWeight:800,color:p.onboard==='Custom'?'#9CA3AF':'#0F1923',letterSpacing:'-0.5px',marginBottom:2}}>{p.onboard}</div>
                <div style={{fontSize:13,fontWeight:600,color:p.highlight?'#059669':'#6B7280',marginBottom:14}}>{p.monthly==='Custom'?'Talk to us':p.monthly}</div>
                <div style={{display:'flex',flexDirection:'column',gap:6,flex:1,marginBottom:16}}>
                  {p.includes.map(item=>(
                    <div key={item} style={{display:'flex',alignItems:'center',gap:7,fontSize:12.5,color:'#4B5563'}}>
                      <span style={{color:'#059669',fontWeight:700,flexShrink:0,fontSize:11}}>+</span>{item}
                    </div>
                  ))}
                </div>
                <div style={{fontSize:11.5,color:'#9CA3AF',marginBottom:14,lineHeight:1.4,fontStyle:'italic'}}>{p.note}</div>
                <button onClick={()=>setShowForm(true)}
                  style={{width:'100%',background:p.highlight?'#059669':'#fff',color:p.highlight?'#fff':'#0F1923',border:p.highlight?'none':'1.5px solid #E5E7EB',borderRadius:7,padding:'9px',fontSize:13.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',marginTop:'auto'}}>
                  {p.onboard==='Custom'?'Contact us':'Request access'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{padding:'80px 40px',background:'#022c22'}}>
        <div style={{maxWidth:580,margin:'0 auto',textAlign:'center'}}>
          <h2 style={{fontSize:36,fontWeight:800,color:'#fff',letterSpacing:'-0.8px',marginBottom:12}}>Start querying in 30 minutes</h2>
          <p style={{fontSize:16,color:'#6EE7B7',lineHeight:1.65,marginBottom:32}}>We onboard every new customer personally — setup, annotation, and first queries included in the onboarding fee.</p>
          <button onClick={()=>setShowForm(true)} style={{background:'#059669',color:'#fff',border:'none',borderRadius:9,padding:'14px 30px',fontSize:16,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',boxShadow:'0 4px 20px rgba(16,185,129,0.4)'}}>
            Request access →
          </button>
        </div>
      </section>

      <footer style={{padding:'24px 40px',borderTop:'1px solid #F3F4F6',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:7,cursor:'pointer'}} onClick={()=>router.push('/auth')}>
          <div style={{width:22,height:22,background:'linear-gradient(135deg,#10B981,#059669)',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{color:'#fff',fontFamily:"'JetBrains Mono'",fontWeight:700,fontSize:9}}>{'{ }'}</span>
          </div>
          <span style={{fontWeight:700,fontSize:14,color:'#0F1923'}}>Qwezy</span>
        </div>
        <div style={{fontSize:12.5,color:'#9CA3AF'}}>© 2026 Qwezy Inc. · reports@qwezy.io</div>
        <div style={{display:'flex',gap:20}}>
          {['Privacy','Terms','Security'].map(l=><a key={l} href="#" style={{fontSize:12.5,color:'#9CA3AF'}}>{l}</a>)}
        </div>
      </footer>
    </div>
  )
}
