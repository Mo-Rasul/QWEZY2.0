'use client'
import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid, PieChart, Pie } from 'recharts'

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  navBg:'#022c22', navBorder:'#064e3b', navText:'#6ee7b7', navActive:'#10b981',
  bg:'#F6F9FC', sidebar:'#FFFFFF', sidebarBorder:'#E3EAF2',
  card:'#FFFFFF', cardBorder:'#E3EAF2',
  accent:'#059669', accentDark:'#047857', accentBg:'#ECFDF5',
  text:'#0F1923', textMuted:'#4B6358', textLight:'#8A9BB0',
  success:'#10B981', danger:'#EF4444', warn:'#F59E0B',
  codeBg:'#0D1117', codeText:'#7EE787',
  tableHead:'#F8FAFD', tableRowAlt:'#FAFCFE',
  greenBg:'#ECFDF5', greenBorder:'#A7F3D0',
  chatBg:'#F0F4F8',
}

// ── Tables ────────────────────────────────────────────────────────────────────
const TABLES = [
  { name:'orders', team:'Sales / Finance', color:'#F59E0B', rows:'830', refresh:'Real-time',
    joins:[{to:'customers',on:'customer_id'},{to:'employees',on:'employee_id'},{to:'shippers',on:'ship_via'}],
    desc:'Every customer order placed. Central fact table connecting customers, employees and shippers.',
    teams:['Sales','Finance','Operations'],
    sampleQ:['Top 10 customers by total revenue','Orders shipped late this year','Monthly revenue for 2025'],
    columns:[{n:'order_id',t:'id'},{n:'customer_id',t:'str'},{n:'employee_id',t:'id'},{n:'order_date',t:'date'},{n:'required_date',t:'date'},{n:'shipped_date',t:'date'},{n:'ship_via',t:'id'},{n:'freight',t:'num'},{n:'ship_city',t:'str'},{n:'ship_country',t:'str'}],
    dateField:'order_date', x:500, y:120 },
  { name:'order_details', team:'Finance / Analytics', color:'#8B5CF6', rows:'2,155', refresh:'Real-time',
    joins:[{to:'orders',on:'order_id'},{to:'products',on:'product_id'}],
    desc:'Line items per order. Source of truth for all revenue calculations.',
    teams:['Finance','Analytics'],
    sampleQ:['Revenue by product category','Best selling products','Total revenue this year'],
    columns:[{n:'order_id',t:'id'},{n:'product_id',t:'id'},{n:'unit_price',t:'num'},{n:'quantity',t:'num'},{n:'discount',t:'num'}],
    dateField:'order_id', x:320, y:240 },
  { name:'customers', team:'Sales / CRM', color:'#06B6D4', rows:'91', refresh:'Weekly',
    joins:[{to:'orders',on:'customer_id'}],
    desc:'All companies who purchase from Northwind.',
    teams:['Sales','Marketing','CRM'],
    sampleQ:['Customers not ordering in 90 days','Revenue by country','Top customers by order count'],
    columns:[{n:'customer_id',t:'str'},{n:'company_name',t:'str'},{n:'contact_name',t:'str'},{n:'city',t:'str'},{n:'country',t:'str'},{n:'phone',t:'str'}],
    dateField:'customer_id', x:680, y:60 },
  { name:'employees', team:'HR / Sales', color:'#10B981', rows:'9', refresh:'Monthly',
    joins:[{to:'orders',on:'employee_id'}],
    desc:'Northwind staff who handle orders. Includes manager hierarchy.',
    teams:['HR','Sales'],
    sampleQ:['Sales by employee this year','Average order value per employee'],
    columns:[{n:'employee_id',t:'id'},{n:'last_name',t:'str'},{n:'first_name',t:'str'},{n:'title',t:'str'},{n:'hire_date',t:'date'},{n:'city',t:'str'},{n:'country',t:'str'},{n:'reports_to',t:'id'}],
    dateField:'hire_date', x:680, y:280 },
  { name:'products', team:'Inventory / Finance', color:'#059669', rows:'77', refresh:'Daily',
    joins:[{to:'categories',on:'category_id'},{to:'suppliers',on:'supplier_id'},{to:'order_details',on:'product_id'}],
    desc:'Full product catalog with pricing, stock levels and supplier info.',
    teams:['Inventory','Finance','Product'],
    sampleQ:['Products below reorder level','Revenue by product category'],
    columns:[{n:'product_id',t:'id'},{n:'product_name',t:'str'},{n:'supplier_id',t:'id'},{n:'category_id',t:'id'},{n:'unit_price',t:'num'},{n:'units_in_stock',t:'num'},{n:'units_on_order',t:'num'},{n:'reorder_level',t:'num'},{n:'discontinued',t:'bool'}],
    dateField:'product_id', x:180, y:240 },
  { name:'categories', team:'Product', color:'#0EA5E9', rows:'8', refresh:'Rarely',
    joins:[{to:'products',on:'category_id'}],
    desc:'8 product categories grouping the entire catalog.',
    teams:['Inventory','Product'],
    sampleQ:['Revenue by category','Product count per category'],
    columns:[{n:'category_id',t:'id'},{n:'category_name',t:'str'},{n:'description',t:'str'}],
    dateField:'category_id', x:60, y:120 },
  { name:'suppliers', team:'Procurement', color:'#F97316', rows:'29', refresh:'Monthly',
    joins:[{to:'products',on:'supplier_id'}],
    desc:'Companies that supply products to Northwind.',
    teams:['Procurement','Inventory'],
    sampleQ:['Products per supplier','Suppliers by country'],
    columns:[{n:'supplier_id',t:'id'},{n:'company_name',t:'str'},{n:'contact_name',t:'str'},{n:'city',t:'str'},{n:'country',t:'str'},{n:'phone',t:'str'}],
    dateField:'supplier_id', x:60, y:360 },
  { name:'shippers', team:'Operations', color:'#EF4444', rows:'3', refresh:'Rarely',
    joins:[{to:'orders',on:'ship_via'}],
    desc:'Three shipping carriers used to deliver orders.',
    teams:['Operations','Logistics'],
    sampleQ:['Orders by shipper','Average freight by shipper'],
    columns:[{n:'shipper_id',t:'id'},{n:'company_name',t:'str'},{n:'phone',t:'str'}],
    dateField:'shipper_id', x:500, y:360 },
]

const ALL_COLS = TABLES.flatMap(t=>t.columns.map(c=>({...c,table:t.name,team:t.team})))
const TC: any = {id:'#059669',str:'#8A9BB0',num:'#10B981',date:'#F59E0B',bool:'#8B5CF6'}
const STEPS = ['Reading question…','Identifying tables…','Mapping joins…','Generating SQL…','Running query…']
const GREEN_SHADES = ['#059669','#10B981','#34D399','#6EE7B7','#A7F3D0','#064E3B','#047857']
const SCHED_COLOR: any = {daily:'#10B981',weekly:'#F59E0B',monthly:'#8B5CF6',manual:'#8A9BB0'}
const SCHEDULE_NEXT: any = {daily:'Tomorrow 6:00 AM',weekly:'Monday 6:00 AM',monthly:'1st of next month',manual:'Manual only'}

const INITIAL_REPORTS = [
  { id:'r1', name:'Monthly Revenue by Category', group:'Finance',
    description:'Total revenue broken down by product category',
    sql:`SELECT\n  c.category_name,\n  ROUND(SUM(od.unit_price * od.quantity * (1 - od.discount)), 2) AS revenue\nFROM order_details od\nJOIN products p ON od.product_id = p.product_id\nJOIN categories c ON p.category_id = c.category_id\nGROUP BY c.category_name\nORDER BY revenue DESC`,
    schedule:'monthly', refreshHours:720, shared:true, owner:'JD', lastRun:'2026-03-01', rows:8 },
  { id:'r2', name:'Weekly Top Customers', group:'Sales',
    description:'Top 20 customers ranked by total spend',
    sql:`SELECT\n  c.company_name,\n  c.country,\n  COUNT(o.order_id) AS total_orders,\n  ROUND(SUM(od.unit_price * od.quantity * (1 - od.discount)), 2) AS total_revenue\nFROM customers c\nJOIN orders o ON c.customer_id = o.customer_id\nJOIN order_details od ON o.order_id = od.order_id\nGROUP BY c.company_name, c.country\nORDER BY total_revenue DESC\nLIMIT 20`,
    schedule:'weekly', refreshHours:168, shared:true, owner:'JD', lastRun:'2026-03-18', rows:20 },
  { id:'r3', name:'Daily Low Stock Alert', group:'Operations',
    description:'Products below reorder level with supplier info',
    sql:`SELECT\n  p.product_name,\n  p.units_in_stock,\n  p.reorder_level,\n  s.company_name AS supplier\nFROM products p\nJOIN suppliers s ON p.supplier_id = s.supplier_id\nWHERE p.units_in_stock <= p.reorder_level\n  AND p.discontinued = false\nORDER BY p.units_in_stock ASC`,
    schedule:'daily', refreshHours:24, shared:false, owner:'JD', lastRun:'2026-03-22', rows:5 },
]

type ReportResult = {rows:any[], fields:string[], ts:string, ranAt:number}
const reportCache: Record<string, ReportResult> = {}

// ── Types ─────────────────────────────────────────────────────────────────────
type ConvMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sql?: string
  rows?: any[]
  fields?: string[]
  duration?: number
  confidence?: string
  assumptions?: string[]
  uncertainAbout?: string | null
  suggestedClarification?: string | null
  timestamp: Date
}

type Conversation = {
  id: string
  title: string
  messages: ConvMessage[]
  createdAt: Date
  updatedAt: Date
}

// ── SQL Editor ────────────────────────────────────────────────────────────────
function SQLEditor({value,onChange,onRun,original,showRevert=false,height=140}:{value:string,onChange:(v:string)=>void,onRun?:(v:string)=>void,original?:string,showRevert?:boolean,height?:number}) {
  const taRef=useRef<HTMLTextAreaElement>(null)
  const lnRef=useRef<HTMLDivElement>(null)
  const [copied,setCopied]=useState(false)
  const edited=original!==undefined&&value!==original
  const lines=Array.from({length:value.split('\n').length},(_,i)=>i+1)
  const sync=()=>{if(taRef.current&&lnRef.current)lnRef.current.scrollTop=taRef.current.scrollTop}
  const copySQL=()=>{navigator.clipboard?.writeText(value);setCopied(true);setTimeout(()=>setCopied(false),1600)}
  return(
    <div style={{background:C.codeBg,borderRadius:8,overflow:'hidden',border:'1px solid #21262D'}}>
      <div style={{padding:'7px 12px',borderBottom:'1px solid #21262D',display:'flex',alignItems:'center',gap:8}}>
        <div style={{display:'flex',gap:5,marginRight:4}}>{['#FF5F57','#FEBC2E','#28C840'].map(c=><div key={c} style={{width:9,height:9,borderRadius:'50%',background:c}}/>)}</div>
        <span style={{fontFamily:"'JetBrains Mono'",fontSize:10.5,color:'#8B949E',flex:1}}>SQL {edited&&<span style={{color:'#F0883E'}}>· modified</span>}</span>
        <div style={{display:'flex',gap:6}}>
          <button onClick={copySQL} style={{fontSize:11,padding:'2px 9px',borderRadius:4,border:'1px solid #30363D',background:'transparent',color:copied?'#3FB950':'#8B949E',cursor:'pointer',fontFamily:'Inter,sans-serif',transition:'color .2s'}}>
            {copied?'Copied':'Copy'}
          </button>
          {showRevert&&edited&&original&&<button onClick={()=>onChange(original)} style={{fontSize:11,padding:'2px 9px',borderRadius:4,border:'1px solid #30363D',background:'transparent',color:'#8B949E',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Revert</button>}
          {onRun&&<button onClick={()=>onRun(value)} style={{fontSize:11.5,padding:'2px 12px',borderRadius:4,border:'none',background:'#238636',color:'#fff',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:600}}>Run</button>}
        </div>
      </div>
      <div style={{display:'flex',overflow:'hidden',height}}>
        <div ref={lnRef} style={{background:'#0D1117',padding:'12px 8px',minWidth:36,textAlign:'right',overflow:'hidden',flexShrink:0,userSelect:'none'}}>
          {lines.map(n=><div key={n} style={{fontFamily:"'JetBrains Mono'",fontSize:12,lineHeight:'1.7em',color:'#484F58',height:'1.7em'}}>{n}</div>)}
        </div>
        <textarea ref={taRef} value={value} onChange={e=>onChange(e.target.value)} onScroll={sync} spellCheck={false}
          onKeyDown={e=>{if(e.key==='Enter'&&e.ctrlKey&&onRun){e.preventDefault();onRun(value)}}}
          style={{flex:1,background:C.codeBg,color:'#E6EDF3',fontFamily:"'JetBrains Mono'",fontSize:12.5,lineHeight:'1.7em',padding:'12px 14px',border:'none',resize:'none',height:'100%'}}/>
      </div>
    </div>
  )
}

// ── Results Table ─────────────────────────────────────────────────────────────
function ResultsTable({rows,fields,compact=false}:{rows:any[],fields:string[],compact?:boolean}) {
  const [sort,setSort]=useState<string|null>(null)
  const [dir,setDir]=useState<'asc'|'desc'>('asc')
  const [filter,setFilter]=useState('')
  const [vis,setVis]=useState<string[]>(fields)
  const toggleSort=(c:string)=>{if(sort===c)setDir(d=>d==='asc'?'desc':'asc');else{setSort(c);setDir('asc')}}
  const data=useMemo(()=>{
    let r=rows
    if(filter)r=r.filter(row=>Object.values(row).some(v=>String(v).toLowerCase().includes(filter.toLowerCase())))
    if(sort)r=[...r].sort((a,b)=>{const cmp=String(a[sort]).localeCompare(String(b[sort]),undefined,{numeric:true});return dir==='asc'?cmp:-cmp})
    return r
  },[rows,filter,sort,dir])
  return(
    <div style={{background:C.card,borderRadius:8,border:`1px solid ${C.cardBorder}`,overflow:'hidden'}}>
      {!compact&&<div style={{padding:'7px 12px',borderBottom:`1px solid ${C.cardBorder}`,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',background:C.tableHead}}>
        <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter rows…"
          style={{padding:'4px 9px',borderRadius:5,border:`1px solid ${C.cardBorder}`,fontSize:12,color:C.text,fontFamily:'Inter,sans-serif',width:150,background:'#fff'}}/>
        <span style={{fontSize:11.5,color:C.textLight}}>{data.length}/{rows.length} rows</span>
        <div style={{marginLeft:'auto',display:'flex',gap:3,flexWrap:'wrap'}}>
          {fields.map(f=><button key={f} onClick={()=>setVis(v=>v.includes(f)?v.filter(c=>c!==f):[...v,f])}
            style={{fontSize:10.5,padding:'2px 7px',borderRadius:4,border:'1px solid',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:500,
              borderColor:vis.includes(f)?C.accent:'#E3EAF2',background:vis.includes(f)?C.accentBg:'#F8FAFD',color:vis.includes(f)?C.accent:C.textLight}}>
            {f.replace(/_/g,' ')}
          </button>)}
        </div>
      </div>}
      <div style={{overflowX:'auto',maxHeight:compact?180:300}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead style={{position:'sticky',top:0,zIndex:1}}>
            <tr style={{background:C.tableHead}}>
              {fields.filter(f=>vis.includes(f)).map(f=><th key={f} onClick={()=>toggleSort(f)}
                style={{padding:compact?'5px 10px':'7px 12px',textAlign:'left',fontSize:10.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',whiteSpace:'nowrap',cursor:'pointer',userSelect:'none',borderBottom:`1px solid ${C.cardBorder}`}}
                onMouseOver={e=>(e.currentTarget.style.color=C.accent)} onMouseOut={e=>(e.currentTarget.style.color=C.textLight)}>
                {f.replace(/_/g,' ')} {sort===f?(dir==='asc'?'↑':'↓'):''}
              </th>)}
            </tr>
          </thead>
          <tbody>
            {data.map((row,i)=><tr key={i} style={{borderTop:`1px solid #F1F5F9`,background:i%2===0?'#fff':C.tableRowAlt,transition:'background .1s'}}
              onMouseOver={e=>(e.currentTarget.style.background='#F0F7FF')} onMouseOut={e=>(e.currentTarget.style.background=i%2===0?'#fff':C.tableRowAlt)}>
              {fields.filter(f=>vis.includes(f)).map(f=><td key={f} style={{padding:compact?'5px 10px':'7px 12px',fontSize:12.5,color:C.text,whiteSpace:'nowrap'}}>
                {String(row[f]??'').match(/^-?\d+(\.\d+)?$/)
                  ?<span style={{background:C.accentBg,color:C.accentDark,fontWeight:600,padding:'1px 7px',borderRadius:4,fontFamily:"'JetBrains Mono'",fontSize:11.5}}>{row[f]}</span>
                  :String(row[f]??'')}
              </td>)}
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Viz ───────────────────────────────────────────────────────────────────────
function VizRender({rows,fields,vizType,height=200}:{rows:any[],fields:string[],vizType:string,height?:number}) {
  const numF=fields.find(f=>String(rows[0]?.[f]??'').match(/^-?\d+(\.\d+)?$/))
  const strF=fields.find(f=>f!==numF)
  const chartData=rows.slice(0,14).map(r=>({name:String(r[strF||fields[0]]||'').slice(0,14),value:parseFloat(String(r[numF||fields[1]]||'0'))||0}))
  if(vizType==='kpi') return(
    <div style={{display:'flex',gap:20,justifyContent:'center',flexWrap:'wrap',padding:'10px 0'}}>
      {Object.entries(rows[0]||{}).map(([k,v])=>(
        <div key={k} style={{textAlign:'center'}}>
          <div style={{fontSize:32,fontWeight:800,color:C.accent,letterSpacing:'-1px',fontFamily:"'JetBrains Mono'"}}>{String(v)}</div>
          <div style={{fontSize:11,color:C.textLight,marginTop:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>{k.replace(/_/g,' ')}</div>
        </div>
      ))}
    </div>
  )
  if(vizType==='bar') return(
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{top:4,right:4,left:-20,bottom:36}}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
        <XAxis dataKey="name" tick={{fontSize:10,fill:C.textLight}} angle={-30} textAnchor="end" interval={0}/>
        <YAxis tick={{fontSize:10,fill:C.textLight}} tickFormatter={(v:number)=>v>=1000?`${(v/1000).toFixed(0)}k`:String(v)}/>
        <Tooltip contentStyle={{background:'#fff',border:`1px solid ${C.cardBorder}`,borderRadius:6,fontSize:12}} cursor={{fill:'#F0F7FF'}}/>
        <Bar dataKey="value" radius={[3,3,0,0]}>{chartData.map((_,i)=><Cell key={i} fill={GREEN_SHADES[i%GREEN_SHADES.length]}/>)}</Bar>
      </BarChart>
    </ResponsiveContainer>
  )
  if(vizType==='line') return(
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{top:4,right:4,left:-20,bottom:16}}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
        <XAxis dataKey="name" tick={{fontSize:10,fill:C.textLight}}/>
        <YAxis tick={{fontSize:10,fill:C.textLight}} tickFormatter={(v:number)=>v>=1000?`${(v/1000).toFixed(0)}k`:String(v)}/>
        <Tooltip contentStyle={{background:'#fff',border:`1px solid ${C.cardBorder}`,borderRadius:6,fontSize:12}}/>
        <Line type="monotone" dataKey="value" stroke={C.accent} strokeWidth={2} dot={{fill:C.accent,r:2.5}} activeDot={{r:4}}/>
      </LineChart>
    </ResponsiveContainer>
  )
  if(vizType==='pie') return(
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={68} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
          {chartData.map((_,i)=><Cell key={i} fill={GREEN_SHADES[i%GREEN_SHADES.length]}/>)}
        </Pie>
        <Tooltip contentStyle={{background:'#fff',border:`1px solid ${C.cardBorder}`,borderRadius:6,fontSize:12}}/>
      </PieChart>
    </ResponsiveContainer>
  )
  return <div style={{width:'100%',alignSelf:'stretch'}}><ResultsTable rows={rows} fields={fields} compact/></div>
}

function autoViz(rows:any[],fields:string[]) {
  if(!rows.length) return 'table'
  if(rows.length===1&&fields.length<=3) return 'kpi'
  const hasNum=fields.some(f=>String(rows[0]?.[f]??'').match(/^-?\d+(\.\d+)?$/))
  const hasStr=fields.some(f=>!String(rows[0]?.[f]??'').match(/^-?\d+(\.\d+)?$/))
  const hasDate=fields.some(f=>f.toLowerCase().includes('month')||f.toLowerCase().includes('date')||f.toLowerCase().includes('week'))
  if(rows.length<=20&&hasNum&&hasStr) return hasDate?'line':'bar'
  return 'table'
}

// ── Table Drawer ──────────────────────────────────────────────────────────────
function TableDrawer({table,onClose,onAsk,onPreview}:{table:any,onClose:()=>void,onAsk:(q:string)=>void,onPreview:(t:any)=>void}) {
  return(
    <div style={{position:'fixed',top:52,right:0,bottom:0,width:400,background:'#fff',borderLeft:`1px solid ${C.cardBorder}`,zIndex:200,display:'flex',flexDirection:'column',boxShadow:'-4px 0 20px rgba(0,0,0,0.07)',animation:'slideIn .15s ease'}} onClick={e=>e.stopPropagation()}>
      <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
      <div style={{padding:'13px 18px',borderBottom:`1px solid ${C.cardBorder}`,display:'flex',alignItems:'center',gap:9}}>
        <div style={{width:9,height:9,borderRadius:'50%',background:table.color}}/>
        <span style={{fontFamily:"'JetBrains Mono'",fontWeight:600,fontSize:14,color:C.text,flex:1}}>{table.name}</span>
        <span style={{background:C.accentBg,color:C.accent,fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:4}}>{table.team}</span>
        <button onClick={onClose} style={{background:'none',border:'none',fontSize:18,color:C.textLight,cursor:'pointer',padding:'2px 6px',lineHeight:1}}>×</button>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:18}}>
        <p style={{fontSize:13,color:C.textMuted,lineHeight:1.65,marginBottom:16}}>{table.desc}</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:16}}>
          {[['Rows',table.rows],['Refresh',table.refresh],['Joins',String(table.joins.length)]].map(([k,v])=>(
            <div key={k} style={{background:C.bg,borderRadius:7,padding:'8px 10px',border:`1px solid ${C.cardBorder}`}}>
              <div style={{fontSize:9.5,color:C.textLight,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:2}}>{k}</div>
              <div style={{fontSize:13.5,fontWeight:600,color:C.text}}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>Teams</div>
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>{table.teams.map((t:string)=><span key={t} style={{background:C.greenBg,border:`1px solid ${C.greenBorder}`,color:C.accent,fontSize:11.5,fontWeight:500,padding:'2px 8px',borderRadius:4}}>{t}</span>)}</div>
        </div>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>Join Paths</div>
          {table.joins.map((j:any)=>(
            <div key={j.to} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 9px',borderRadius:5,background:C.bg,border:`1px solid ${C.cardBorder}`,marginBottom:3}}>
              <span style={{fontFamily:"'JetBrains Mono'",fontSize:11.5,color:C.accent,fontWeight:600}}>{j.to}</span>
              <span style={{fontSize:10.5,color:C.textLight}}>ON {j.on}</span>
            </div>
          ))}
        </div>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>Columns</div>
          <div style={{background:C.bg,borderRadius:7,border:`1px solid ${C.cardBorder}`,overflow:'hidden'}}>
            {table.columns.map((c:any,i:number)=>(
              <div key={c.n} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 10px',borderTop:i>0?`1px solid ${C.cardBorder}`:'none'}}>
                <span style={{width:6,height:6,borderRadius:'50%',background:TC[c.t]||'#8A9BB0',display:'inline-block',flexShrink:0}}/>
                <span style={{fontSize:10.5,color:TC[c.t],fontFamily:"'JetBrains Mono'",width:26,flexShrink:0}}>{c.t}</span>
                <span style={{fontFamily:"'JetBrains Mono'",fontSize:12.5,color:C.text}}>{c.n}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{fontSize:10.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>Sample Questions</div>
          {table.sampleQ.map((q:string)=>(
            <button key={q} onClick={()=>{onAsk(q);onClose()}}
              style={{width:'100%',textAlign:'left',background:'#fff',border:`1px solid ${C.cardBorder}`,borderRadius:6,padding:'7px 11px',fontSize:12.5,color:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif',marginBottom:3,transition:'all .12s'}}
              onMouseOver={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.text}}
              onMouseOut={e=>{e.currentTarget.style.borderColor=C.cardBorder;e.currentTarget.style.color=C.textMuted}}>
              {q}
            </button>
          ))}
        </div>
      </div>
      <div style={{padding:'12px 18px',borderTop:`1px solid ${C.cardBorder}`}}>
        <button onClick={()=>onPreview(table)} style={{width:'100%',background:C.accent,color:'#fff',border:'none',borderRadius:6,padding:'8px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>View top 100 rows</button>
      </div>
    </div>
  )
}

// ── Preview Modal ─────────────────────────────────────────────────────────────
function PreviewModal({table,onClose}:{table:any,onClose:()=>void}) {
  const [rows,setRows]=useState<any[]>([])
  const [fields,setFields]=useState<string[]>([])
  const [loading,setLoading]=useState(true)
  const [err,setErr]=useState('')
  useEffect(()=>{
    fetch('/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customSQL:`SELECT * FROM ${table.name} ORDER BY ${table.dateField} DESC LIMIT 100`})})
      .then(r=>r.json()).then(d=>{if(d.error)setErr(d.error);else{setRows(d.rows);setFields(d.fields)}})
      .catch(e=>setErr(e.message)).finally(()=>setLoading(false))
  },[table.name])
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(15,25,35,0.6)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'#fff',borderRadius:10,width:'100%',maxWidth:920,maxHeight:'88vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
        <div style={{padding:'12px 18px',borderBottom:`1px solid ${C.cardBorder}`,display:'flex',alignItems:'center',gap:9}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:table.color}}/>
          <span style={{fontFamily:"'JetBrains Mono'",fontWeight:600,fontSize:14,color:C.text}}>{table.name}</span>
          <span style={{fontSize:12,color:C.textLight}}>Top 100 rows · ordered by {table.dateField} DESC</span>
          <button onClick={onClose} style={{marginLeft:'auto',background:'none',border:'none',fontSize:20,color:C.textLight,cursor:'pointer'}}>×</button>
        </div>
        <div style={{flex:1,overflow:'auto',padding:14}}>
          {loading&&<div style={{textAlign:'center',padding:40,color:C.textLight,fontSize:13}}>Loading…</div>}
          {err&&<div style={{padding:14,color:C.danger,background:'#FEF2F2',borderRadius:6,fontSize:13}}>{err}</div>}
          {!loading&&!err&&rows.length>0&&<ResultsTable rows={rows} fields={fields}/>}
        </div>
      </div>
    </div>
  )
}

// ── Context Menu ──────────────────────────────────────────────────────────────
function ContextMenu({x,y,table,onClose,onAsk,onPreview,onDrawer}:{x:number,y:number,table:any,onClose:()=>void,onAsk:(q:string)=>void,onPreview:(t:any)=>void,onDrawer:(t:any)=>void}) {
  useEffect(()=>{const h=()=>onClose();window.addEventListener('click',h);return()=>window.removeEventListener('click',h)},[])
  return(
    <div style={{position:'fixed',left:x,top:y,background:'#fff',borderRadius:7,border:`1px solid ${C.cardBorder}`,boxShadow:'0 6px 20px rgba(0,0,0,0.1)',zIndex:500,minWidth:200,overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
      <div style={{padding:'5px 11px',borderBottom:`1px solid ${C.cardBorder}`,background:C.tableHead}}>
        <span style={{fontSize:10.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em'}}>{table.name}</span>
      </div>
      {[['View top 100 rows',()=>{onPreview(table);onClose()}],['Ask a question',()=>{onAsk(`Tell me about the ${table.name} table`);onClose()}],['Table details',()=>{onDrawer(table);onClose()}],['Copy table name',()=>{navigator.clipboard?.writeText(table.name);onClose()}]].map(([label,fn]:any)=>(
        <button key={label} onClick={fn}
          style={{display:'flex',alignItems:'center',width:'100%',padding:'8px 12px',background:'none',border:'none',fontSize:13,color:C.text,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left',transition:'background .1s'}}
          onMouseOver={e=>e.currentTarget.style.background='#F0F7FF'} onMouseOut={e=>e.currentTarget.style.background='none'}>
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Relationships Diagram ─────────────────────────────────────────────────────
function RelationshipsDiagram({onTableClick}:{onTableClick:(t:any)=>void}) {
  const [hov,setHov]=useState<string|null>(null)
  const [hovEdge,setHovEdge]=useState<string|null>(null)
  const [tooltip,setTooltip]=useState<{x:number,y:number,label:string}|null>(null)
  const edges=TABLES.flatMap(t=>t.joins.map(j=>({from:t.name,to:j.to,on:j.on,key:`${t.name}-${j.to}`}))).filter((e,i,arr)=>arr.findIndex(x=>(x.from===e.from&&x.to===e.to)||(x.from===e.to&&x.to===e.from))===i)
  const pos=(name:string)=>TABLES.find(t=>t.name===name)||{x:0,y:0,color:C.accent}
  return(
    <div style={{padding:24,position:'relative'}}>
      <h2 style={{fontSize:17,fontWeight:600,color:C.text,marginBottom:2,letterSpacing:'-0.3px'}}>Table Relationships</h2>
      <p style={{fontSize:12.5,color:C.textMuted,marginBottom:16}}>Click a table to inspect · Hover a connection to see the join condition</p>
      {tooltip&&<div style={{position:'fixed',left:tooltip.x+14,top:tooltip.y-38,background:'#1B2432',color:'#fff',fontFamily:"'JetBrains Mono'",fontSize:12,fontWeight:500,padding:'6px 12px',borderRadius:6,pointerEvents:'none',zIndex:9999,whiteSpace:'nowrap',boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>{tooltip.label}</div>}
      <div style={{background:'#fff',borderRadius:10,border:`1px solid ${C.cardBorder}`,padding:20,boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
        <svg width="100%" viewBox="0 0 860 480" style={{display:'block',overflow:'visible'}}>
          <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#F1F5F9" strokeWidth="1"/></pattern></defs>
          <rect width="860" height="480" fill="url(#grid)" rx="6"/>
          {edges.map(e=>{
            const f=pos(e.from),t=pos(e.to),isH=hovEdge===e.key
            return(<g key={e.key}>
              <line x1={f.x+62} y1={f.y+22} x2={t.x+62} y2={t.y+22} stroke={isH?C.accent:'#CBD5E1'} strokeWidth={isH?2:1.5} strokeDasharray={isH?'none':'6,3'} style={{pointerEvents:'none',transition:'stroke .12s'}}/>
              <line x1={f.x+62} y1={f.y+22} x2={t.x+62} y2={t.y+22} stroke="transparent" strokeWidth={22} style={{cursor:'pointer'}}
                onMouseEnter={ev=>{setHovEdge(e.key);setTooltip({x:ev.clientX,y:ev.clientY,label:`${e.from} — ${e.to}  ·  ON ${e.on}`})}}
                onMouseMove={ev=>setTooltip(p=>p?{...p,x:ev.clientX,y:ev.clientY}:null)}
                onMouseLeave={()=>{setHovEdge(null);setTooltip(null)}}/>
            </g>)
          })}
          {TABLES.map(t=>{const isH=hov===t.name;return(
            <g key={t.name} style={{cursor:'pointer'}} onMouseEnter={()=>setHov(t.name)} onMouseLeave={()=>setHov(null)} onClick={()=>onTableClick(t)}>
              <rect x={t.x} y={t.y} width={125} height={44} rx={6} fill={isH?t.color:'#fff'} stroke={isH?t.color:C.cardBorder} strokeWidth={isH?1.5:1} style={{transition:'all .15s',filter:isH?`drop-shadow(0 4px 12px ${t.color}55)`:'drop-shadow(0 1px 3px rgba(0,0,0,0.08))'}}/>
              <text x={t.x+62} y={t.y+17} textAnchor="middle" style={{fontSize:11.5,fontFamily:"'JetBrains Mono'",fontWeight:600,fill:isH?'#fff':C.text}}>{t.name}</text>
              <text x={t.x+62} y={t.y+32} textAnchor="middle" style={{fontSize:9.5,fontFamily:'Inter,sans-serif',fill:isH?'rgba(255,255,255,0.75)':C.textLight}}>{t.rows} rows</text>
            </g>
          )})}
        </svg>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',borderTop:`1px solid ${C.cardBorder}`,paddingTop:12,marginTop:8}}>
          {TABLES.map(t=><div key={t.name} style={{display:'flex',alignItems:'center',gap:5,cursor:'pointer'}} onClick={()=>onTableClick(t)}>
            <div style={{width:7,height:7,borderRadius:'50%',background:t.color}}/><span style={{fontSize:11.5,color:C.textMuted,fontFamily:"'JetBrains Mono'"}}>{t.name}</span>
          </div>)}
        </div>
      </div>
    </div>
  )
}

// ── BI Integration Panel ──────────────────────────────────────────────────────
function BIIntegrationPanel({reportId,reportName}:{reportId:string,reportName:string}) {
  const [open,setOpen]=useState(false)
  const [copied,setCopied]=useState<string|null>(null)
  const base='http://localhost:3000'
  const jsonUrl=`${base}/api/export?reportId=${reportId}&format=json&token=demo`
  const csvUrl=`${base}/api/export?reportId=${reportId}&format=csv&token=demo`
  const copy=(text:string,key:string)=>{navigator.clipboard?.writeText(text);setCopied(key);setTimeout(()=>setCopied(null),1800)}
  if(!open) return(
    <button onClick={()=>setOpen(true)} style={{fontSize:11.5,color:C.accent,fontWeight:500,background:'none',border:`1px solid ${C.cardBorder}`,borderRadius:5,padding:'3px 10px',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Connect to BI</button>
  )
  return(
    <div style={{background:'#F8FAFD',border:`1px solid ${C.cardBorder}`,borderRadius:8,padding:14,marginTop:10}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <span style={{fontSize:13,fontWeight:600,color:C.text}}>Connect to BI Tools</span>
        <button onClick={()=>setOpen(false)} style={{background:'none',border:'none',fontSize:15,color:C.textLight,cursor:'pointer'}}>×</button>
      </div>
      <p style={{fontSize:12,color:C.textMuted,marginBottom:12,lineHeight:1.5}}>
        Paste the URL below into your BI tool. When Qwezy re-runs this report, your dashboard refreshes automatically on the next scheduled refresh.
      </p>
      {[
        {label:'PowerBI',desc:'Data → Get Data → Web → paste URL below',url:jsonUrl,key:'pbi'},
        {label:'Tableau',desc:'Connect → Web Data Connector → paste URL below',url:csvUrl,key:'tab'},
        {label:'Google Sheets',desc:'=IMPORTDATA("url") or use the Sheets add-in',url:csvUrl,key:'gsh'},
        {label:'Excel',desc:'Data → From Web → paste URL below',url:jsonUrl,key:'xls'},
      ].map(({label,desc,url,key})=>(
        <div key={key} style={{marginBottom:10,padding:'9px 12px',background:'#fff',border:`1px solid ${C.cardBorder}`,borderRadius:7}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
            <span style={{fontSize:12.5,fontWeight:600,color:C.text}}>{label}</span>
            <button onClick={()=>copy(url,key)} style={{fontSize:11,padding:'2px 9px',borderRadius:4,border:`1px solid ${C.cardBorder}`,background:copied===key?C.accentBg:'#fff',color:copied===key?C.accent:C.textLight,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:500}}>
              {copied===key?'Copied':'Copy URL'}
            </button>
          </div>
          <div style={{fontSize:11,color:C.textLight,marginBottom:5}}>{desc}</div>
          <div style={{fontFamily:"'JetBrains Mono'",fontSize:10.5,color:C.textMuted,background:'#F0F4F8',padding:'4px 8px',borderRadius:4,wordBreak:'break-all'}}>{url}</div>
        </div>
      ))}
      <div style={{fontSize:11.5,color:C.textMuted,padding:'8px 10px',background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:6}}>
        Live BI connections are available on Growth and Scale plans. The token shown is a demo token. Production tokens include per-report access control and usage logging.
      </div>
    </div>
  )
}

// ── Email Modal ───────────────────────────────────────────────────────────────
function EmailModal({report,cachedRows,cachedFields,onClose}:{report:any,cachedRows?:any[],cachedFields?:string[],onClose:()=>void}) {
  const [recipients,setRecipients]=useState<string[]>(['team@company.com'])
  const [inputVal,setInputVal]=useState('')
  const [subject,setSubject]=useState(`${report.name} — ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}`)
  const [personalNote,setPersonalNote]=useState('')
  const [format,setFormat]=useState<'table'|'csv'>('table')
  const [view,setView]=useState<'compose'|'preview'>('compose')
  const [sent,setSent]=useState(false)
  const inputRef=useRef<HTMLInputElement>(null)

  const addRecipient=(val:string)=>{
    const parts=val.split(/[,;\s]+/).map(s=>s.trim()).filter(s=>s.includes('@'))
    if(parts.length){setRecipients(prev=>[...new Set([...prev,...parts])]);setInputVal('')}
  }
  const removeRecipient=(email:string)=>setRecipients(prev=>prev.filter(e=>e!==email))
  const previewRows=(cachedRows||[]).slice(0,8)
  const previewFields=cachedFields||[]

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(15,25,35,0.6)',zIndex:400,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'#fff',borderRadius:10,width:'100%',maxWidth:600,maxHeight:'92vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.2)',overflow:'hidden'}}>
        {/* Header */}
        <div style={{padding:'13px 18px',borderBottom:`1px solid ${C.cardBorder}`,display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:14.5,color:C.text}}>Email Report</div>
            <div style={{fontSize:11.5,color:C.textLight,marginTop:1}}>{report.name}</div>
          </div>
          {!sent&&(
            <div style={{display:'flex',background:'#F0F4F8',borderRadius:6,overflow:'hidden',border:`1px solid ${C.cardBorder}`}}>
              {([['compose','Compose'],['preview','Preview']] as const).map(([v,l])=>(
                <button key={v} onClick={()=>setView(v)} style={{padding:'5px 13px',fontSize:12,fontWeight:500,border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif',background:view===v?C.accent:'transparent',color:view===v?'#fff':C.textMuted,transition:'all .12s'}}>{l}</button>
              ))}
            </div>
          )}
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,color:C.textLight,cursor:'pointer',lineHeight:1,padding:'0 4px'}}>×</button>
        </div>

        {sent
          ?<div style={{padding:48,textAlign:'center',flex:1}}>
            <div style={{width:52,height:52,borderRadius:'50%',background:C.accentBg,border:`2px solid ${C.accent}`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px',fontSize:22,color:C.accent}}>✓</div>
            <div style={{fontSize:16,fontWeight:600,color:C.text,marginBottom:4}}>Report sent</div>
            <div style={{fontSize:13,color:C.textMuted,marginBottom:22}}>Delivered to {recipients.length} recipient{recipients.length!==1?'s':''}</div>
            <button onClick={onClose} style={{background:C.accent,color:'#fff',border:'none',borderRadius:7,padding:'9px 22px',fontSize:13.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Done</button>
          </div>

          :view==='compose'
          ?<div style={{padding:'18px 20px',display:'flex',flexDirection:'column',gap:14,overflowY:'auto',flex:1}}>
            {/* Recipients chip input */}
            <div>
              <label style={{fontSize:10.5,fontWeight:600,color:C.textLight,display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.05em'}}>To</label>
              <div style={{borderRadius:7,border:`1.5px solid ${C.cardBorder}`,padding:'6px 9px',background:'#fff',display:'flex',flexWrap:'wrap',gap:5,cursor:'text',minHeight:42,alignItems:'center',transition:'border-color .15s'}}
                onClick={()=>inputRef.current?.focus()}>
                {recipients.map(email=>(
                  <span key={email} style={{display:'inline-flex',alignItems:'center',gap:5,background:C.accentBg,border:`1px solid ${C.accent}33`,borderRadius:4,padding:'2px 8px',fontSize:12.5,color:C.accentDark,whiteSpace:'nowrap'}}>
                    {email}
                    <button onClick={e=>{e.stopPropagation();removeRecipient(email)}} style={{background:'none',border:'none',cursor:'pointer',color:C.textLight,fontSize:14,lineHeight:1,padding:0}}>×</button>
                  </span>
                ))}
                <input ref={inputRef} value={inputVal} onChange={e=>setInputVal(e.target.value)}
                  onKeyDown={e=>{
                    if(e.key==='Enter'||e.key===','||e.key===';'){e.preventDefault();addRecipient(inputVal)}
                    if(e.key==='Backspace'&&!inputVal&&recipients.length>0)removeRecipient(recipients[recipients.length-1])
                  }}
                  onBlur={()=>{if(inputVal.trim())addRecipient(inputVal)}}
                  placeholder={recipients.length===0?'Add email addresses…':''}
                  style={{border:'none',outline:'none',fontSize:12.5,color:C.text,fontFamily:'Inter,sans-serif',minWidth:120,flex:1,background:'transparent',padding:'2px 0'}}/>
              </div>
              <div style={{fontSize:11,color:C.textLight,marginTop:4}}>Press Enter or comma after each address · Backspace to remove last</div>
            </div>

            {/* Subject */}
            <div>
              <label style={{fontSize:10.5,fontWeight:600,color:C.textLight,display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.05em'}}>Subject</label>
              <input value={subject} onChange={e=>setSubject(e.target.value)}
                style={{width:'100%',padding:'8px 11px',borderRadius:7,border:`1.5px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif',transition:'border-color .15s'}}
                onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
            </div>

            {/* Personal note */}
            <div>
              <label style={{fontSize:10.5,fontWeight:600,color:C.textLight,display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.05em'}}>Personal note <span style={{fontWeight:400,textTransform:'none'}}>(optional)</span></label>
              <textarea value={personalNote} onChange={e=>setPersonalNote(e.target.value)}
                placeholder={`Add context for recipients — e.g. "Hi team, here's the weekly breakdown. Note the Beverages category trending up this week."`}
                style={{width:'100%',padding:'9px 11px',borderRadius:7,border:`1.5px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif',resize:'vertical',minHeight:80,lineHeight:1.55,transition:'border-color .15s'}}
                onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
            </div>

            {/* Format */}
            <div>
              <label style={{fontSize:10.5,fontWeight:600,color:C.textLight,display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.05em'}}>Data format</label>
              <div style={{display:'flex',gap:7}}>
                {([['table','Results in email body'],['csv','CSV file attached']] as const).map(([v,l])=>(
                  <button key={v} onClick={()=>setFormat(v)} style={{flex:1,padding:'8px',borderRadius:6,border:'1.5px solid',fontSize:12.5,fontWeight:500,cursor:'pointer',fontFamily:'Inter,sans-serif',borderColor:format===v?C.accent:C.cardBorder,background:format===v?C.accentBg:'#fff',color:format===v?C.accent:C.textMuted,transition:'all .12s'}}>{l}</button>
                ))}
              </div>
            </div>

            <div style={{fontSize:11.5,color:'#92400E',padding:'8px 12px',background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:6,lineHeight:1.5}}>
              Sent from <strong>reports@qwezy.io</strong> with your company branding. Available on Growth ($1,500/mo) and Scale ($3,000/mo) plans.
            </div>

            <div style={{display:'flex',gap:8,paddingTop:2}}>
              <button onClick={()=>setView('preview')} style={{background:'#F0F4F8',color:C.text,border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:'9px 14px',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Preview email</button>
              <button onClick={()=>setSent(true)} disabled={recipients.length===0}
                style={{flex:1,background:recipients.length>0?C.accent:'#E3EAF2',color:recipients.length>0?'#fff':C.textLight,border:'none',borderRadius:7,padding:'9px',fontSize:13,fontWeight:600,cursor:recipients.length>0?'pointer':'default',fontFamily:'Inter,sans-serif',transition:'all .15s'}}>
                Send to {recipients.length} recipient{recipients.length!==1?'s':''}
              </button>
              <button onClick={onClose} style={{background:'#F0F4F8',color:C.textMuted,border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:'9px 14px',fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Cancel</button>
            </div>
          </div>

          /* Preview */
          :<div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column'}}>
            <div style={{background:'#F8FAFD',padding:'9px 18px',borderBottom:`1px solid ${C.cardBorder}`,fontSize:11.5,color:C.textMuted,lineHeight:1.7,flexShrink:0}}>
              <div><strong style={{color:C.text,width:52,display:'inline-block'}}>From:</strong> Qwezy Reports &lt;reports@qwezy.io&gt;</div>
              <div><strong style={{color:C.text,width:52,display:'inline-block'}}>To:</strong> {recipients.join(', ')}</div>
              <div><strong style={{color:C.text,width:52,display:'inline-block'}}>Subject:</strong> {subject}</div>
            </div>
            {/* Email body */}
            <div style={{padding:'28px 32px',fontFamily:'Inter, sans-serif',flex:1,overflowY:'auto'}}>
              <div style={{borderBottom:'2px solid #059669',paddingBottom:14,marginBottom:22,display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontFamily:"'JetBrains Mono', monospace",fontWeight:700,fontSize:17,color:'#022c22',letterSpacing:'-0.3px'}}>Qwezy</div>
                  <div style={{fontSize:11,color:'#059669',fontWeight:500,marginTop:2,textTransform:'uppercase',letterSpacing:'0.04em'}}>Query Easily</div>
                </div>
                <div style={{fontSize:11.5,color:C.textLight,textAlign:'right',lineHeight:1.5}}>
                  <div style={{fontWeight:600,color:C.text,fontSize:12}}>{report.name}</div>
                  <div>{new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
                </div>
              </div>

              <p style={{fontSize:14,color:C.text,marginBottom:16,lineHeight:1.7}}>Hi team,</p>

              {personalNote&&(
                <div style={{fontSize:13.5,color:C.text,marginBottom:20,lineHeight:1.7,padding:'12px 16px',background:'#F8FAFD',borderLeft:'3px solid #059669',borderRadius:'0 7px 7px 0'}}>
                  {personalNote}
                </div>
              )}

              <p style={{fontSize:13.5,color:C.textMuted,marginBottom:20,lineHeight:1.65}}>
                Your scheduled <strong style={{color:C.text}}>{report.schedule}</strong> report is ready.{' '}
                {format==='csv'?'The full dataset is attached as a CSV file.':'Results are shown below.'}
              </p>

              {format==='table'&&previewRows.length>0&&(
                <div style={{marginBottom:22,overflowX:'auto',borderRadius:8,overflow:'hidden',border:`1px solid ${C.cardBorder}`}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
                    <thead>
                      <tr style={{background:'#022c22'}}>
                        {previewFields.map(f=><th key={f} style={{padding:'9px 13px',textAlign:'left',color:'#fff',fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:'0.04em',whiteSpace:'nowrap'}}>{f.replace(/_/g,' ')}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row,i)=><tr key={i} style={{background:i%2===0?'#fff':'#F8FAFD',borderBottom:`1px solid ${C.cardBorder}`}}>
                        {previewFields.map(f=><td key={f} style={{padding:'8px 13px',color:C.text,whiteSpace:'nowrap'}}>{String(row[f]??'')}</td>)}
                      </tr>)}
                    </tbody>
                  </table>
                  {(cachedRows?.length||0)>8&&<div style={{fontSize:11.5,color:C.textLight,padding:'8px 13px',background:C.tableHead}}>Showing 8 of {cachedRows?.length} rows · Full dataset in attached CSV</div>}
                </div>
              )}

              {format==='csv'&&(
                <div style={{padding:'12px 14px',background:'#F8FAFD',border:`1px solid ${C.cardBorder}`,borderRadius:8,marginBottom:22,display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:38,height:38,background:C.accentBg,border:`1px solid ${C.accent}22`,borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>📎</div>
                  <div><div style={{fontSize:13,fontWeight:600,color:C.text}}>{report.name.replace(/\s+/g,'-').toLowerCase()}.csv</div><div style={{fontSize:11.5,color:C.textLight,marginTop:1}}>{cachedRows?.length||0} rows · spreadsheet-compatible</div></div>
                </div>
              )}

              <div style={{borderTop:`1px solid ${C.cardBorder}`,paddingTop:14,marginTop:4}}>
                <div style={{fontSize:12,color:C.textLight,lineHeight:1.65}}>
                  This report is scheduled to run <strong style={{color:C.text}}>{report.schedule}</strong> via Qwezy.<br/>
                  To manage your report subscriptions, visit your notification settings.
                </div>
                <div style={{fontSize:10.5,color:'#CBD5E1',marginTop:10}}>© 2026 Qwezy Inc. · reports@qwezy.io · Unsubscribe</div>
              </div>
            </div>

            <div style={{padding:'10px 18px',borderTop:`1px solid ${C.cardBorder}`,display:'flex',gap:8,background:'#F8FAFD',flexShrink:0}}>
              <button onClick={()=>setView('compose')} style={{background:'#F0F4F8',color:C.text,border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:'8px 14px',fontSize:12.5,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:500}}>Edit</button>
              <button onClick={()=>setSent(true)} disabled={recipients.length===0}
                style={{flex:1,background:C.accent,color:'#fff',border:'none',borderRadius:7,padding:'8px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                Send to {recipients.length} recipient{recipients.length!==1?'s':''}
              </button>
            </div>
          </div>}
      </div>
    </div>
  )
}

// ── Confidence Note ───────────────────────────────────────────────────────────
function ConfidenceNote({confidence,uncertainAbout,assumptions,suggestedClarification,onYes,onNo}:any) {
  const [open,setOpen]=useState(false)
  const isLow=confidence==='low'
  const color=isLow?'#DC2626':'#D97706'
  const bg=isLow?'#FEF2F2':'#FFFBEB'
  const border=isLow?'#FECACA':'#FDE68A'
  return !open
    ?<button onClick={()=>setOpen(true)} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'3px 10px',background:bg,border:`1px solid ${border}`,borderRadius:12,cursor:'pointer',fontFamily:'Inter,sans-serif',fontSize:11.5,color,fontWeight:500}}>
      {isLow?'Low confidence':'Assumptions made'} — details
    </button>
    :<div style={{background:bg,border:`1px solid ${border}`,borderRadius:8,padding:'11px 14px'}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:7}}>
        <span style={{fontSize:12.5,fontWeight:600,color}}>{isLow?'Low confidence':'Assumptions made'}</span>
        <button onClick={()=>setOpen(false)} style={{background:'none',border:'none',fontSize:12,color,cursor:'pointer',opacity:0.6}}>collapse</button>
      </div>
      {uncertainAbout&&<p style={{fontSize:12.5,color,marginBottom:6,lineHeight:1.5}}>{uncertainAbout}</p>}
      {assumptions?.length>0&&<ul style={{paddingLeft:16,marginBottom:8}}>{assumptions.map((a:string,i:number)=><li key={i} style={{fontSize:12,color,marginBottom:3,lineHeight:1.4}}>{a}</li>)}</ul>}
      {suggestedClarification&&<p style={{fontSize:12,color,marginBottom:9,fontStyle:'italic',opacity:0.85}}>{suggestedClarification}</p>}
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <span style={{fontSize:12,color,opacity:0.7}}>Was this correct?</span>
        <button onClick={()=>{onYes();setOpen(false)}} style={{fontSize:12,padding:'3px 10px',borderRadius:4,border:`1px solid ${border}`,background:'#fff',color,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:600}}>Yes</button>
        <button onClick={()=>{onNo();setOpen(false)}} style={{fontSize:12,padding:'3px 10px',borderRadius:4,border:`1px solid ${border}`,background:'#fff',color,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:600}}>No — fix it</button>
      </div>
    </div>
}

// ── Qwezy Chat Tab ────────────────────────────────────────────────────────────
// ── Follow-up Suggestions ─────────────────────────────────────────────────────
function FollowUpSuggestions({rows,fields,onAsk}:{rows:any[],fields:string[],onAsk:(q:string)=>void}) {
  const suggestions=useMemo(()=>{
    const sugs:string[]=[]
    const hasNum=fields.some(f=>String(rows[0]?.[f]??'').match(/^-?\d+(\.\d+)?$/))
    const numF=fields.find(f=>String(rows[0]?.[f]??'').match(/^-?\d+(\.\d+)?$/))
    const strF=fields.find(f=>!String(rows[0]?.[f]??'').match(/^-?\d+(\.\d+)?$/))

    if(rows.length>=10) sugs.push(`Show me just the top 5 instead`)
    if(hasNum&&numF) sugs.push(`What's the average ${numF?.replace(/_/g,' ')}?`)
    if(strF&&rows.length>1) sugs.push(`Filter to only show results where ${strF?.replace(/_/g,' ')} contains a specific value`)
    if(fields.some(f=>f.includes('country')||f.includes('region'))) sugs.push(`Break this down by country`)
    if(fields.some(f=>f.includes('date')||f.includes('month')||f.includes('year'))) sugs.push(`Show me the trend over time`)
    if(hasNum) sugs.push(`Which rows are above the average?`)
    sugs.push(`Explain what this data is telling us`)

    return sugs.slice(0,3)
  },[fields,rows])

  return(
    <div style={{marginTop:9,display:'flex',flexWrap:'wrap',gap:5}}>
      {suggestions.map(s=>(
        <button key={s} onClick={()=>onAsk(s)}
          style={{fontSize:12,padding:'4px 10px',borderRadius:5,border:`1px solid ${C.cardBorder}`,background:'#F8FAFD',color:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif',transition:'all .12s'}}
          onMouseOver={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;e.currentTarget.style.background=C.accentBg}}
          onMouseOut={e=>{e.currentTarget.style.borderColor=C.cardBorder;e.currentTarget.style.color=C.textMuted;e.currentTarget.style.background='#F8FAFD'}}>
          {s}
        </button>
      ))}
    </div>
  )
}

function QwezyTab({onAsk}:{onAsk:(q:string,conv?:Conversation)=>void}) {
  const [conversations,setConversations]=useState<Conversation[]>([
    {id:'c0',title:'New conversation',messages:[],createdAt:new Date(),updatedAt:new Date()}
  ])
  const [activeId,setActiveId]=useState('c0')
  const [input,setInput]=useState('')
  const [directSQL,setDirectSQL]=useState('SELECT *\nFROM orders\nLIMIT 10')
  const [queryMode,setQueryMode]=useState<'nl'|'sql'>('nl')
  const [loading,setLoading]=useState(false)
  const [statusStep,setStatusStep]=useState(0)
  const [sqlHeight,setSqlHeight]=useState(160)
  const [memoryNotes,setMemoryNotes]=useState<string[]>([])
  const [memInput,setMemInput]=useState('')
  const [showMem,setShowMem]=useState(false)
  const dragging=useRef(false)
  const dragY=useRef(0)
  const dragH=useRef(0)
  const bottomRef=useRef<HTMLDivElement>(null)

  const activeConv=conversations.find(c=>c.id===activeId)||conversations[0]

  const startDrag=(e:React.MouseEvent)=>{
    dragging.current=true;dragY.current=e.clientY;dragH.current=sqlHeight
    const move=(ev:MouseEvent)=>{if(dragging.current)setSqlHeight(Math.max(80,Math.min(400,dragH.current+(ev.clientY-dragY.current))))}
    const up=()=>{dragging.current=false;window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up)}
    window.addEventListener('mousemove',move);window.addEventListener('mouseup',up)
  }

  const newConversation=()=>{
    const id=`c${Date.now()}`
    const c:Conversation={id,title:'New conversation',messages:[],createdAt:new Date(),updatedAt:new Date()}
    setConversations(prev=>[c,...prev].slice(0,10))
    setActiveId(id)
    setInput('')
  }

  const sendMessage=async(text?:string,customSQL?:string)=>{
    const q=customSQL||(queryMode==='sql'?directSQL:text||input)
    if(!q?.trim()) return
    setLoading(true);setStatusStep(0);setInput('')

    const userMsg:ConvMessage={id:`m${Date.now()}`,role:'user',content:queryMode==='sql'?`SQL: ${q.split('\n')[0]}…`:q,timestamp:new Date()}

    setConversations(prev=>prev.map(c=>c.id===activeId?{...c,
      title:c.messages.length===0?(q.slice(0,40)+(q.length>40?'…':'')):c.title,
      messages:[...c.messages,userMsg],updatedAt:new Date()
    }:c).slice(0,10))

    let step=0;const st=setInterval(()=>{step++;setStatusStep(step);if(step>=STEPS.length-1)clearInterval(st)},500)

    try{
      const conv=conversations.find(c=>c.id===activeId)
      const prevMsgs=conv?.messages||[]
      const convCtx=prevMsgs.length>0
        ?`Previous messages:\n${prevMsgs.slice(-4).map(m=>`${m.role}: ${m.content}${m.sql?`\nSQL: ${m.sql}`:''}`).join('\n')}`
        :undefined

      const payload=queryMode==='sql'||customSQL
        ?{customSQL:q}
        :{question:q,memoryContext:memoryNotes.length>0?memoryNotes.join('\n'):undefined,conversationContext:convCtx}

      const res=await fetch('/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
      const data=await res.json();clearInterval(st)

      if(!res.ok){
        const errMsg:ConvMessage={id:`m${Date.now()}`,role:'assistant',content:data.error||'Query failed',timestamp:new Date()}
        setConversations(prev=>prev.map(c=>c.id===activeId?{...c,messages:[...c.messages,errMsg],updatedAt:new Date()}:c))
        return
      }

      const assistantMsg:ConvMessage={
        id:`m${Date.now()}a`,role:'assistant',
        content:`Returned ${data.rows.length} rows in ${data.duration_ms}ms`,
        sql:data.sql,rows:data.rows.slice(0,500),fields:data.fields,duration:data.duration_ms,
        confidence:data.confidence,assumptions:data.assumptions,
        uncertainAbout:data.uncertain_about,suggestedClarification:data.suggested_clarification,
        timestamp:new Date()
      }
      setConversations(prev=>prev.map(c=>c.id===activeId?{...c,messages:[...c.messages,assistantMsg],updatedAt:new Date()}:c))
    }catch(e:any){
      clearInterval(st)
      const errMsg:ConvMessage={id:`m${Date.now()}`,role:'assistant',content:e.message,timestamp:new Date()}
      setConversations(prev=>prev.map(c=>c.id===activeId?{...c,messages:[...c.messages,errMsg],updatedAt:new Date()}:c))
    }finally{setLoading(false)}
  }

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth'})},[activeConv.messages.length])

  const addMemory=(note:string)=>{if(!note.trim())return;setMemoryNotes(prev=>[...prev,note.trim()]);setMemInput('')}

  return(
    <div style={{flex:1,display:'flex',overflow:'hidden'}}>
      {/* Conversation sidebar */}
      <div style={{width:232,background:'#fff',borderRight:`1px solid ${C.cardBorder}`,display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'12px 14px',borderBottom:`1px solid ${C.cardBorder}`}}>
          <button onClick={newConversation}
            style={{width:'100%',background:C.accent,color:'#fff',border:'none',borderRadius:7,padding:'8px 12px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center',gap:6,justifyContent:'center'}}>
            <span style={{fontSize:15,fontWeight:400}}>+</span> New conversation
          </button>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'8px 8px'}}>
          <div style={{fontSize:9.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.08em',padding:'4px 6px',marginBottom:4}}>Conversations <span style={{fontWeight:400,textTransform:'none'}}>({conversations.length}/10)</span></div>
          {conversations.map(conv=>(
            <button key={conv.id} onClick={()=>setActiveId(conv.id)}
              style={{width:'100%',textAlign:'left',background:activeId===conv.id?C.accentBg:'transparent',border:'none',borderRadius:6,padding:'8px 10px',cursor:'pointer',fontFamily:'Inter,sans-serif',marginBottom:2,transition:'background .1s'}}
              onMouseOver={e=>{if(activeId!==conv.id)e.currentTarget.style.background='#F0F4F8'}}
              onMouseOut={e=>{if(activeId!==conv.id)e.currentTarget.style.background='transparent'}}>
              <div style={{fontSize:12.5,fontWeight:activeId===conv.id?600:400,color:activeId===conv.id?C.accentDark:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:2}}>{conv.title}</div>
              <div style={{fontSize:10.5,color:C.textLight}}>{conv.messages.length} message{conv.messages.length!==1?'s':''} · {conv.updatedAt.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</div>
            </button>
          ))}
        </div>

        {/* Memory section */}
        <div style={{borderTop:`1px solid ${C.cardBorder}`,padding:'10px 12px'}}>
          <button onClick={()=>setShowMem(o=>!o)} style={{display:'flex',alignItems:'center',width:'100%',background:'none',border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif',padding:0,marginBottom:showMem?8:0}}>
            <span style={{fontSize:11.5,fontWeight:600,color:C.text}}>Context notes</span>
            {memoryNotes.length>0&&<span style={{marginLeft:5,fontSize:10,color:C.accent,fontWeight:600,background:C.accentBg,padding:'1px 6px',borderRadius:3}}>{memoryNotes.length}</span>}
            <span style={{marginLeft:'auto',fontSize:10,color:C.textLight}}>{showMem?'▴':'▾'}</span>
          </button>
          {showMem&&(
            <div>
              {memoryNotes.map((n,i)=><div key={i} style={{fontSize:11,color:C.textMuted,padding:'2px 0',display:'flex',gap:4,alignItems:'flex-start'}}>
                <span style={{color:C.accent,flexShrink:0}}>—</span><span style={{lineHeight:1.4}}>{n}</span>
              </div>)}
              <div style={{display:'flex',gap:5,marginTop:6}}>
                <input value={memInput} onChange={e=>setMemInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addMemory(memInput)}}
                  placeholder='Add a note…'
                  style={{flex:1,padding:'5px 8px',borderRadius:5,border:`1px solid ${C.cardBorder}`,fontSize:11.5,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff'}}
                  onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
                <button onClick={()=>addMemory(memInput)} disabled={!memInput.trim()} style={{background:C.accent,color:'#fff',border:'none',borderRadius:5,padding:'4px 9px',fontSize:11.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',opacity:memInput.trim()?1:0.4}}>Add</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {/* Chat header — just title, no mode toggle here anymore */}
        <div style={{padding:'10px 20px',borderBottom:`1px solid ${C.cardBorder}`,display:'flex',alignItems:'center',justifyContent:'space-between',background:'#fff',flexShrink:0}}>
          <div>
            <div style={{fontSize:14,fontWeight:600,color:C.text}}>{activeConv.title}</div>
            <div style={{fontSize:11.5,color:C.textLight}}>{activeConv.messages.length} messages</div>
          </div>
        </div>

        {/* Messages */}
        <div style={{flex:1,overflowY:'auto',padding:'16px 20px',display:'flex',flexDirection:'column',gap:14}}>
          {activeConv.messages.length===0&&!loading&&(
            <div style={{textAlign:'center',paddingTop:40}}>
              <div style={{fontSize:28,fontWeight:700,color:C.text,letterSpacing:'-0.5px',marginBottom:6}}>Ask your data</div>
              <div style={{fontSize:14,color:C.textMuted,marginBottom:28}}>Type a question in plain English, or switch to SQL mode below</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:7,justifyContent:'center',maxWidth:560,margin:'0 auto'}}>
                {['Top 10 customers by total revenue','Monthly revenue for 2025','Products below reorder level','Sales by employee this year'].map(s=>(
                  <button key={s} onClick={()=>{setInput(s);setQueryMode('nl')}}
                    style={{background:'#fff',border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:'8px 14px',fontSize:13,color:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif',transition:'all .12s'}}
                    onMouseOver={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.text}}
                    onMouseOut={e=>{e.currentTarget.style.borderColor=C.cardBorder;e.currentTarget.style.color=C.textMuted}}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeConv.messages.map((msg)=>(
            <div key={msg.id} style={{display:'flex',flexDirection:'column',alignItems:msg.role==='user'?'flex-end':'flex-start',gap:4,maxWidth:'100%'}}>
              {msg.role==='user'
                ?<div style={{background:C.accent,color:'#fff',borderRadius:'12px 12px 3px 12px',padding:'9px 14px',fontSize:13.5,maxWidth:'60%',lineHeight:1.5,fontFamily:'Inter,sans-serif'}}>{msg.content}</div>
                :<div style={{width:'100%'}}>
                  <div style={{fontSize:11,color:C.textLight,marginBottom:5}}>Qwezy · {msg.timestamp.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</div>
                  {msg.sql&&(
                    <div style={{marginBottom:8}}>
                      <SQLEditor value={msg.sql} onChange={()=>{}} onRun={sql=>sendMessage(undefined,sql)} height={Math.min(sqlHeight,msg.sql.split('\n').length*21+28)}/>
                      <div onMouseDown={startDrag} style={{height:8,cursor:'ns-resize',display:'flex',alignItems:'center',justifyContent:'center',margin:'2px 0'}}>
                        <div style={{width:32,height:3,borderRadius:2,background:C.cardBorder}}/>
                      </div>
                    </div>
                  )}
                  {msg.confidence&&msg.confidence!=='high'&&(msg.uncertainAbout||msg.assumptions?.length)&&(
                    <div style={{marginBottom:8}}>
                      <ConfidenceNote confidence={msg.confidence} uncertainAbout={msg.uncertainAbout} assumptions={msg.assumptions} suggestedClarification={msg.suggestedClarification}
                        onYes={()=>addMemory('confirmed: '+(msg.suggestedClarification||msg.uncertainAbout||'prior assumption'))}
                        onNo={()=>addMemory('incorrect: '+(msg.uncertainAbout||'prior assumption'))}/>
                    </div>
                  )}
                  {msg.rows&&msg.rows.length>0&&msg.fields&&(
                    <div>
                      <div style={{fontSize:11.5,color:C.textLight,marginBottom:5}}>{msg.rows.length} rows · {msg.duration}ms{msg.confidence==='high'&&<span style={{marginLeft:6,color:C.success,fontWeight:600}}>high confidence</span>}</div>
                      <ResultsTable rows={msg.rows} fields={msg.fields}/>
                      {/* Follow-up suggestions after results */}
                      <FollowUpSuggestions rows={msg.rows} fields={msg.fields} onAsk={q=>{setInput(q);setQueryMode('nl')}}/>
                    </div>
                  )}
                  {msg.rows&&msg.rows.length===0&&<div style={{fontSize:13,color:C.textLight,padding:'8px 0'}}>Query ran successfully — no rows returned</div>}
                  {!msg.sql&&!msg.rows&&<div style={{fontSize:13.5,color:msg.content.includes('failed')||msg.content.includes('error')?C.danger:C.textMuted,padding:'4px 0'}}>{msg.content}</div>}
                </div>}
            </div>
          ))}

          {loading&&(
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              <div style={{fontSize:11,color:C.textLight}}>Qwezy</div>
              <div style={{background:'#fff',border:`1px solid ${C.cardBorder}`,borderRadius:'3px 12px 12px 12px',padding:'10px 14px',maxWidth:320}}>
                {STEPS.map((s,i)=>(
                  <div key={s} style={{display:'flex',alignItems:'center',gap:7,marginBottom:i<STEPS.length-1?6:0,opacity:i<=statusStep?1:.2,transition:'opacity .25s'}}>
                    {i<statusStep?<div style={{width:10,height:10,borderRadius:'50%',background:C.success,flexShrink:0}}/>
                      :i===statusStep?<div className="spin" style={{width:10,height:10,border:`2px solid ${C.cardBorder}`,borderTop:`2px solid ${C.accent}`,borderRadius:'50%',flexShrink:0}}/>
                      :<div style={{width:10,height:10,borderRadius:'50%',border:`1.5px solid ${C.cardBorder}`,flexShrink:0}}/>}
                    <span style={{fontSize:12.5,color:i===statusStep?C.text:C.textLight}}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef}/>
        </div>

        {/* Unified smart input area */}
        <div style={{padding:'12px 20px',borderTop:`1px solid ${C.cardBorder}`,background:'#fff',flexShrink:0}}>
          {queryMode==='sql'&&(
            <div style={{marginBottom:8}}>
              <SQLEditor value={directSQL} onChange={setDirectSQL} onRun={sql=>sendMessage(undefined,sql)} height={sqlHeight}/>
              <div onMouseDown={startDrag} style={{height:8,cursor:'ns-resize',display:'flex',alignItems:'center',justifyContent:'center',margin:'3px 0'}}>
                <div style={{width:32,height:3,borderRadius:2,background:C.cardBorder}}/>
              </div>
            </div>
          )}

          <div style={{display:'flex',gap:8,alignItems:'flex-end'}}>
            {/* Main input */}
            <div style={{flex:1,background:'#F8FAFD',borderRadius:9,border:`1px solid ${C.cardBorder}`,overflow:'hidden',transition:'border-color .15s'}}
              onFocus={()=>{}} onBlur={()=>{}}>
              <textarea value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&queryMode==='nl'){e.preventDefault();sendMessage()}}}
                placeholder={queryMode==='sql'
                  ? 'Describe what to query in plain English, or type SQL directly — Qwezy will help complete or fix it…'
                  : 'Ask a question… (Enter to send, Shift+Enter for new line)'}
                style={{width:'100%',padding:'10px 13px',fontSize:13.5,color:C.text,background:'transparent',border:'none',resize:'none',minHeight:44,maxHeight:120,fontFamily:queryMode==='sql'?"'JetBrains Mono', monospace":'Inter,sans-serif',lineHeight:1.5}}/>
            </div>

            {/* Right column: SQL toggle + Send */}
            <div style={{display:'flex',flexDirection:'column',gap:5,flexShrink:0}}>
              <button onClick={()=>setQueryMode(m=>m==='nl'?'sql':'nl')}
                style={{background:queryMode==='sql'?C.accentBg:'#F0F4F8',color:queryMode==='sql'?C.accent:C.textMuted,border:`1px solid ${queryMode==='sql'?C.accent:C.cardBorder}`,borderRadius:6,padding:'5px 10px',fontSize:11.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',whiteSpace:'nowrap',transition:'all .15s'}}>
                {queryMode==='sql'?'SQL mode':'SQL'}
              </button>
              <button
                onClick={()=>queryMode==='sql'?sendMessage(undefined,directSQL+(input.trim()?'\n-- '+input:'')):sendMessage()}
                disabled={loading||(!input.trim()&&queryMode==='nl')}
                style={{background:(!input.trim()&&queryMode==='nl')||loading?'#E3EAF2':C.accent,color:(!input.trim()&&queryMode==='nl')||loading?C.textLight:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:13.5,fontWeight:600,cursor:(!input.trim()&&queryMode==='nl')||loading?'default':'pointer',fontFamily:'Inter,sans-serif',transition:'all .15s'}}>
                {loading?'…':queryMode==='sql'?'Run':'Send'}
              </button>
            </div>
          </div>
          <div style={{fontSize:10.5,color:C.textLight,marginTop:5}}>
            {queryMode==='nl'?'Enter to send · Shift+Enter for new line':'SQL mode · type a question above to auto-complete or fix the query · Ctrl+Enter to run'}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────
const VIZ_TYPES = [{id:'auto',label:'Auto'},{id:'bar',label:'Bar'},{id:'line',label:'Line'},{id:'pie',label:'Pie'},{id:'kpi',label:'KPI'},{id:'table',label:'Table'}]
const SIZE_OPTS = [{id:'sm',label:'Small'},{id:'md',label:'Medium'},{id:'lg',label:'Large'}]
type CustomView = {id:string,name:string,sql:string,vizType:string,size:string,w:number,h:number,shared:boolean,rows?:any[],fields?:string[],loading?:boolean}
type DashPage = {id:string,name:string,views:CustomView[]}

// ── Resizable card wrapper ────────────────────────────────────────────────────
function ResizableCard({view,onUpdate,onRemove,sharedResults,onEmail}:{view:CustomView,onUpdate:(v:Partial<CustomView>)=>void,onRemove:()=>void,sharedResults:Record<string,ReportResult>,onEmail?:()=>void}) {
  const dragRef=useRef<{startX:number,startY:number,startW:number,startH:number}|null>(null)
  const containerRef=useRef<HTMLDivElement>(null)

  const startResize=(e:React.MouseEvent)=>{
    e.preventDefault()
    dragRef.current={startX:e.clientX,startY:e.clientY,startW:view.w,startH:view.h}
    const move=(ev:MouseEvent)=>{
      if(!dragRef.current) return
      const dw=ev.clientX-dragRef.current.startX
      const dh=ev.clientY-dragRef.current.startY
      onUpdate({w:Math.max(200,dragRef.current.startW+dw),h:Math.max(120,dragRef.current.startH+dh)})
    }
    const up=()=>{dragRef.current=null;window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up)}
    window.addEventListener('mousemove',move);window.addEventListener('mouseup',up)
  }

  const eff=view.vizType==='auto'&&view.rows&&view.fields?autoViz(view.rows,view.fields):view.vizType

  return(
    <div ref={containerRef} style={{position:'relative',background:'#fff',borderRadius:9,border:`1px solid ${C.cardBorder}`,overflow:'hidden',display:'inline-flex',flexDirection:'column',width:view.w,height:view.h,flexShrink:0,boxShadow:'0 1px 4px rgba(0,0,0,0.05)'}}>
      {/* Card header */}
      <div style={{padding:'7px 10px',borderBottom:`1px solid ${C.cardBorder}`,display:'flex',alignItems:'center',gap:6,background:C.tableHead,flexShrink:0,cursor:'default',userSelect:'none'}}>
        <span style={{fontWeight:600,fontSize:12.5,color:C.text,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{view.name}</span>
        <select value={view.vizType} onChange={e=>onUpdate({vizType:e.target.value})}
          style={{fontSize:10.5,padding:'2px 4px',borderRadius:4,border:`1px solid ${C.cardBorder}`,background:'#fff',color:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif',maxWidth:60}}>
          {VIZ_TYPES.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
        <span style={{fontSize:11,color:C.textLight}}>{view.shared?'Team':'Personal'}</span>
        {onEmail&&<button onClick={onEmail} style={{background:'none',border:'none',fontSize:11,color:C.textLight,cursor:'pointer',fontFamily:'Inter,sans-serif',padding:'0 2px',fontWeight:500}}>Email</button>}
        <button onClick={onRemove} style={{background:'none',border:'none',fontSize:15,color:C.textLight,cursor:'pointer',lineHeight:1,padding:'0 2px'}}>×</button>
      </div>

      {/* Viz area */}
      <div style={{flex:1,padding:'8px 10px',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',minHeight:0}}>
        {view.loading
          ?<div style={{textAlign:'center',color:C.textLight,fontSize:12,display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
            <div className="spin" style={{width:16,height:16,border:`2px solid ${C.cardBorder}`,borderTop:`2px solid ${C.accent}`,borderRadius:'50%'}}/>
            Loading…
          </div>
          :view.rows&&view.fields&&view.rows.length>0
            ?<VizRender rows={view.rows} fields={view.fields} vizType={eff} height={view.h-80}/>
            :<div style={{textAlign:'center',color:C.textLight,fontSize:12}}>No data</div>}
      </div>

      {/* Resize handle — bottom-right corner */}
      <div onMouseDown={startResize}
        style={{position:'absolute',bottom:0,right:0,width:16,height:16,cursor:'nwse-resize',display:'flex',alignItems:'flex-end',justifyContent:'flex-end',padding:3}}>
        <svg width={10} height={10} viewBox="0 0 10 10" style={{opacity:0.3}}>
          <line x1="2" y1="9" x2="9" y2="2" stroke={C.text} strokeWidth={1.5} strokeLinecap="round"/>
          <line x1="5" y1="9" x2="9" y2="5" stroke={C.text} strokeWidth={1.5} strokeLinecap="round"/>
          <line x1="8" y1="9" x2="9" y2="8" stroke={C.text} strokeWidth={1.5} strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  )
}

// ── Dashboard Tab (multi-page) ────────────────────────────────────────────────
function DashboardTab({onAsk,onTabSwitch,sharedResults,onResultSaved}:{onAsk:(q:string)=>void,onTabSwitch:()=>void,sharedResults:Record<string,ReportResult>,onResultSaved:(id:string,result:ReportResult)=>void}) {
  const [pages,setPages]=useState<DashPage[]>([
    {id:'p1',name:'Overview',views:[
      {id:'cv1',name:'Revenue by Category',sql:`SELECT c.category_name, ROUND(SUM(od.unit_price*od.quantity*(1-od.discount)),2) AS revenue FROM order_details od JOIN products p ON od.product_id=p.product_id JOIN categories c ON p.category_id=c.category_id GROUP BY c.category_name ORDER BY revenue DESC`,vizType:'bar',size:'md',w:400,h:260,shared:true},
      {id:'cv2',name:'Top 5 Customers',sql:`SELECT c.company_name, ROUND(SUM(od.unit_price*od.quantity*(1-od.discount)),2) AS revenue FROM customers c JOIN orders o ON c.customer_id=o.customer_id JOIN order_details od ON o.order_id=od.order_id GROUP BY c.company_name ORDER BY revenue DESC LIMIT 5`,vizType:'pie',size:'sm',w:320,h:260,shared:false},
    ]},
    {id:'p2',name:'Inventory',views:[
      {id:'cv3',name:'Low Stock Products',sql:`SELECT p.product_name, p.units_in_stock, p.reorder_level FROM products p WHERE p.units_in_stock <= p.reorder_level AND p.discontinued = false ORDER BY p.units_in_stock ASC`,vizType:'table',size:'md',w:500,h:280,shared:true},
    ]},
  ])
  const [activePageId,setActivePageId]=useState('p1')
  const [editingPageId,setEditingPageId]=useState<string|null>(null)
  const [editingName,setEditingName]=useState('')
  const [refreshing,setRefreshing]=useState(false)
  const [lastRefresh,setLastRefresh]=useState<string|null>(null)
  const [emailModal,setEmailModal]=useState<{report:any,rows?:any[],fields?:string[]}|null>(null)
  const [showAdd,setShowAdd]=useState(false)
  const [newView,setNewView]=useState<Partial<CustomView>>({name:'',sql:'',vizType:'auto',w:380,h:250,shared:false})

  const activePage=pages.find(p=>p.id===activePageId)||pages[0]

  // Load view data
  const loadViews=useCallback(async(views:CustomView[],force=false)=>{
    const toLoad=force?views:views.filter(v=>!v.rows)
    for(const v of toLoad){
      setPages(prev=>prev.map(p=>({...p,views:p.views.map(cv=>cv.id===v.id?{...cv,loading:true}:cv)})))
      try{
        const res=await fetch('/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customSQL:v.sql})})
        const d=await res.json()
        if(!d.error) setPages(prev=>prev.map(p=>({...p,views:p.views.map(cv=>cv.id===v.id?{...cv,rows:d.rows,fields:d.fields,loading:false}:cv)})))
        else setPages(prev=>prev.map(p=>({...p,views:p.views.map(cv=>cv.id===v.id?{...cv,loading:false}:cv)})))
      }catch{setPages(prev=>prev.map(p=>({...p,views:p.views.map(cv=>cv.id===v.id?{...cv,loading:false}:cv)})))}
    }
    setLastRefresh(new Date().toLocaleTimeString())
  },[])

  // Load pinned reports
  useEffect(()=>{
    const missing=INITIAL_REPORTS.filter(r=>!sharedResults[r.id])
    ;(async()=>{for(const r of missing){try{const res=await fetch('/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customSQL:r.sql})});const d=await res.json();if(!d.error)onResultSaved(r.id,{rows:d.rows,fields:d.fields,ts:new Date().toLocaleTimeString(),ranAt:Date.now()})}catch{}}})()
    // Load all page views
    const allViews=pages.flatMap(p=>p.views)
    loadViews(allViews)
  },[])

  const runAll=async()=>{
    setRefreshing(true)
    await loadViews(pages.flatMap(p=>p.views),true)
    setRefreshing(false)
  }

  const addPage=()=>{
    const id=`p${Date.now()}`
    setPages(prev=>[...prev,{id,name:`Page ${prev.length+1}`,views:[]}])
    setActivePageId(id)
  }

  const removePage=(pid:string)=>{
    if(pages.length<=1) return
    setPages(prev=>prev.filter(p=>p.id!==pid))
    setActivePageId(pages.find(p=>p.id!==pid)?.id||pages[0].id)
  }

  const updateView=(viewId:string,update:Partial<CustomView>)=>{
    setPages(prev=>prev.map(p=>({...p,views:p.views.map(v=>v.id===viewId?{...v,...update}:v)})))
  }

  const removeView=(viewId:string)=>{
    setPages(prev=>prev.map(p=>({...p,views:p.views.filter(v=>v.id!==viewId)})))
  }

  const addView=async()=>{
    if(!newView.name||!newView.sql) return
    const v:CustomView={id:`cv${Date.now()}`,name:newView.name!,sql:newView.sql!,vizType:newView.vizType||'auto',size:'md',w:newView.w||380,h:newView.h||250,shared:newView.shared||false,loading:true}
    setPages(prev=>prev.map(p=>p.id===activePageId?{...p,views:[...p.views,v]}:p))
    setShowAdd(false);setNewView({name:'',sql:'',vizType:'auto',w:380,h:250,shared:false})
    try{
      const res=await fetch('/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customSQL:v.sql})})
      const d=await res.json()
      if(!d.error) setPages(prev=>prev.map(p=>({...p,views:p.views.map(cv=>cv.id===v.id?{...cv,rows:d.rows,fields:d.fields,loading:false}:cv)})))
      else setPages(prev=>prev.map(p=>({...p,views:p.views.map(cv=>cv.id===v.id?{...cv,loading:false}:cv)})))
    }catch{setPages(prev=>prev.map(p=>({...p,views:p.views.map(cv=>cv.id===v.id?{...cv,loading:false}:cv)})))}
  }

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {emailModal&&<EmailModal report={emailModal.report} cachedRows={emailModal.rows} cachedFields={emailModal.fields} onClose={()=>setEmailModal(null)}/>}

      {/* Tab bar */}
      <div style={{borderBottom:`1px solid ${C.cardBorder}`,background:'#fff',display:'flex',alignItems:'center',gap:0,flexShrink:0,paddingLeft:20,paddingRight:12}}>
        {pages.map(page=>(
          <div key={page.id} style={{display:'flex',alignItems:'center',gap:0,borderBottom:activePageId===page.id?`2px solid ${C.accent}`:'2px solid transparent',marginBottom:-1}}>
            {editingPageId===page.id
              ?<input autoFocus value={editingName} onChange={e=>setEditingName(e.target.value)}
                onBlur={()=>{setPages(prev=>prev.map(p=>p.id===page.id?{...p,name:editingName||page.name}:p));setEditingPageId(null)}}
                onKeyDown={e=>{if(e.key==='Enter'){setPages(prev=>prev.map(p=>p.id===page.id?{...p,name:editingName||page.name}:p));setEditingPageId(null)}if(e.key==='Escape')setEditingPageId(null)}}
                style={{padding:'10px 8px',fontSize:13,border:'none',outline:'none',fontFamily:'Inter,sans-serif',width:100,color:C.text,background:'transparent',fontWeight:activePageId===page.id?600:400}}/>
              :<button onClick={()=>setActivePageId(page.id)} onDoubleClick={()=>{setEditingPageId(page.id);setEditingName(page.name)}}
                style={{padding:'10px 14px',fontSize:13,fontWeight:activePageId===page.id?600:400,color:activePageId===page.id?C.text:C.textMuted,background:'none',border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif',whiteSpace:'nowrap'}}>
                {page.name}
              </button>}
            {pages.length>1&&<button onClick={()=>removePage(page.id)}
              style={{background:'none',border:'none',fontSize:13,color:C.textLight,cursor:'pointer',padding:'0 4px 0 0',lineHeight:1,opacity:activePageId===page.id?1:0.4}}>×</button>}
          </div>
        ))}
        <button onClick={addPage}
          style={{padding:'8px 12px',fontSize:13,color:C.accent,background:'none',border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:500,marginLeft:4}}>
          + Page
        </button>
        {/* Right controls */}
        <div style={{marginLeft:'auto',display:'flex',gap:7,padding:'6px 0'}}>
          <span style={{fontSize:11,color:C.textLight,alignSelf:'center'}}>Last refreshed {lastRefresh||'—'}</span>
          <button onClick={()=>setShowAdd(o=>!o)}
            style={{background:C.accent,color:'#fff',border:'none',borderRadius:6,padding:'6px 12px',fontSize:12.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
            Add view
          </button>
          <button onClick={runAll} disabled={refreshing}
            style={{display:'flex',alignItems:'center',gap:4,background:'#fff',color:C.text,border:`1px solid ${C.cardBorder}`,borderRadius:6,padding:'6px 11px',fontSize:12.5,fontWeight:500,cursor:'pointer',fontFamily:'Inter,sans-serif',opacity:refreshing?.7:1}}>
            <span className={refreshing?'spin':''} style={{display:'inline-block',fontSize:13}}>↻</span>
            {refreshing?'Refreshing…':'Refresh'}
          </button>
        </div>
      </div>

      {/* Add view panel */}
      {showAdd&&(
        <div style={{background:'#fff',borderBottom:`1px solid ${C.cardBorder}`,padding:'14px 20px',flexShrink:0}}>
          <div style={{display:'flex',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:180}}>
              <label style={{fontSize:10.5,fontWeight:600,color:C.textLight,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>Name</label>
              <input value={newView.name||''} onChange={e=>setNewView(p=>({...p,name:e.target.value}))} placeholder="e.g. Revenue Trend"
                style={{width:'100%',padding:'6px 9px',borderRadius:6,border:`1.5px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif'}}
                onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
            </div>
            <div>
              <label style={{fontSize:10.5,fontWeight:600,color:C.textLight,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>Chart</label>
              <select value={newView.vizType||'auto'} onChange={e=>setNewView(p=>({...p,vizType:e.target.value}))}
                style={{padding:'6px 9px',borderRadius:6,border:`1.5px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff',cursor:'pointer'}}>
                {VIZ_TYPES.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:10.5,fontWeight:600,color:C.textLight,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>Width</label>
              <input type="number" value={newView.w||380} onChange={e=>setNewView(p=>({...p,w:parseInt(e.target.value)||380}))} min={200} max={900} step={20}
                style={{width:80,padding:'6px 9px',borderRadius:6,border:`1.5px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif'}}/>
            </div>
            <div>
              <label style={{fontSize:10.5,fontWeight:600,color:C.textLight,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>Height</label>
              <input type="number" value={newView.h||250} onChange={e=>setNewView(p=>({...p,h:parseInt(e.target.value)||250}))} min={120} max={600} step={20}
                style={{width:80,padding:'6px 9px',borderRadius:6,border:`1.5px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif'}}/>
            </div>
            <div style={{display:'flex',gap:5,alignSelf:'flex-end',paddingBottom:1}}>
              {[['personal','Personal'],['shared','Team']].map(([v,l])=>(
                <button key={v} onClick={()=>setNewView(p=>({...p,shared:v==='shared'}))}
                  style={{padding:'6px 11px',borderRadius:6,border:'1.5px solid',fontSize:12.5,fontWeight:500,cursor:'pointer',fontFamily:'Inter,sans-serif',borderColor:(v==='shared')===!!newView.shared?C.accent:C.cardBorder,background:(v==='shared')===!!newView.shared?C.accentBg:'#fff',color:(v==='shared')===!!newView.shared?C.accent:C.textMuted}}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div style={{marginTop:10}}>
            <label style={{fontSize:10.5,fontWeight:600,color:C.textLight,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>SQL Query</label>
            <SQLEditor value={newView.sql||''} onChange={v=>setNewView(p=>({...p,sql:v}))} height={80}/>
          </div>
          <div style={{display:'flex',gap:7,marginTop:10}}>
            <button onClick={addView} style={{background:C.accent,color:'#fff',border:'none',borderRadius:6,padding:'7px 16px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Add to page</button>
            <button onClick={()=>setShowAdd(false)} style={{background:'#F0F4F8',color:C.textMuted,border:`1px solid ${C.cardBorder}`,borderRadius:6,padding:'7px 12px',fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Cancel</button>
            <span style={{fontSize:11.5,color:C.textLight,alignSelf:'center',marginLeft:4}}>Double-click a page tab to rename it · Drag the corner of any card to resize</span>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div style={{flex:1,overflow:'auto',padding:20,background:C.bg}}>
        {activePage.views.length===0
          ?<div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:14}}>
            <div style={{fontSize:15,fontWeight:600,color:C.text}}>Page is empty</div>
            <div style={{fontSize:13,color:C.textMuted}}>Add a view to get started</div>
            <button onClick={()=>setShowAdd(true)} style={{background:C.accent,color:'#fff',border:'none',borderRadius:7,padding:'9px 20px',fontSize:13.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Add first view</button>
          </div>
          :<div style={{display:'flex',flexWrap:'wrap',gap:14,alignItems:'flex-start',alignContent:'flex-start'}}>
            {activePage.views.map(view=>(
              <ResizableCard key={view.id} view={view}
                onUpdate={update=>updateView(view.id,update)}
                onRemove={()=>removeView(view.id)}
                sharedResults={sharedResults}
                onEmail={view.rows?()=>setEmailModal({report:{name:view.name,schedule:'manual',id:view.id},rows:view.rows,fields:view.fields}):undefined}/>
            ))}
          </div>}
      </div>
    </div>
  )
}

// ── Reports Tab ───────────────────────────────────────────────────────────────
function ReportsTab({sharedResults,onResultSaved}:{sharedResults:Record<string,ReportResult>,onResultSaved:(id:string,result:ReportResult)=>void}) {
  const [reports,setReports]=useState(INITIAL_REPORTS as any[])
  const [showNew,setShowNew]=useState(false)
  const [running,setRunning]=useState<string|null>(null)
  const [expanded,setExpanded]=useState<string|null>(null)
  const [emailModal,setEmailModal]=useState<{report:any,rows?:any[],fields?:string[]}|null>(null)
  const [menuOpen,setMenuOpen]=useState<string|null>(null)
  const [biPanel,setBiPanel]=useState<string|null>(null)
  const [newGroupInput,setNewGroupInput]=useState(false)
  const [newReport,setNewReport]=useState({name:'',description:'',sql:'',schedule:'weekly',refreshHours:168,shared:true,group:'Finance'})
  const existingGroups=useMemo(()=>[...new Set(reports.map((r:any)=>r.group||'General'))] as string[],[reports])

  useEffect(()=>{
    const h=()=>setMenuOpen(null)
    if(menuOpen) window.addEventListener('click',h)
    return()=>window.removeEventListener('click',h)
  },[menuOpen])

  const isStale=(report:any)=>{
    const cached=sharedResults[report.id]
    if(!cached) return true
    return (Date.now()-cached.ranAt)/1000/3600>report.refreshHours
  }

  const runReport=async(report:any,force=false)=>{
    if(!force&&!isStale(report)&&sharedResults[report.id]) return
    setRunning(report.id)
    try{
      const res=await fetch('/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customSQL:report.sql})})
      const data=await res.json()
      if(!data.error){
        onResultSaved(report.id,{rows:data.rows,fields:data.fields,ts:new Date().toLocaleTimeString(),ranAt:Date.now()})
        setReports((p:any[])=>p.map(r=>r.id===report.id?{...r,lastRun:new Date().toISOString().split('T')[0],rows:data.rows.length}:r))
        setExpanded(p=>p||report.id)
      }
    }finally{setRunning(null)}
  }

  const exportCSV=(rows:any[],fields:string[],name:string)=>{
    const csv=[fields.join(','),...rows.map(r=>fields.map(f=>JSON.stringify(r[f]??'')).join(','))].join('\n')
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`${name}.csv`;a.click()
  }

  const saveReport=()=>{
    if(!newReport.name||!newReport.sql) return
    setReports((p:any[])=>[...p,{id:`r${Date.now()}`,owner:'JD',lastRun:'Never',rows:0,...newReport}])
    setNewReport({name:'',description:'',sql:'',schedule:'weekly',refreshHours:168,shared:true,group:'Finance'})
    setShowNew(false)
  }

  const groups=useMemo(()=>{
    const g:Record<string,any[]>={}
    reports.forEach((r:any)=>{const grp=r.group||'General';if(!g[grp])g[grp]=[];g[grp].push(r)})
    return g
  },[reports])

  return(
    <div style={{padding:24,height:'100%',overflowY:'auto'}}>
      {emailModal&&<EmailModal report={emailModal.report} cachedRows={emailModal.rows} cachedFields={emailModal.fields} onClose={()=>setEmailModal(null)}/>}

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18}}>
        <div>
          <h2 style={{fontSize:18,fontWeight:700,color:C.text,letterSpacing:'-0.3px'}}>Reports</h2>
          <p style={{fontSize:12.5,color:C.textMuted,marginTop:2}}>Cached until refresh window passes · Run to force refresh</p>
        </div>
        <button onClick={()=>setShowNew(o=>!o)}
          style={{background:C.accent,color:'#fff',border:'none',borderRadius:7,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
          New report
        </button>
      </div>

      {showNew&&(
        <div className="fu" style={{background:'#fff',borderRadius:9,border:`1px solid ${C.cardBorder}`,padding:18,marginBottom:18}}>
          <h3 style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:14}}>Create new report</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
            <div>
              <label style={{fontSize:10.5,fontWeight:600,color:C.textLight,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>Report name</label>
              <input value={newReport.name} onChange={e=>setNewReport(p=>({...p,name:e.target.value}))} placeholder="e.g. Weekly Sales Summary"
                style={{width:'100%',padding:'7px 10px',borderRadius:6,border:`1.5px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif'}}
                onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
            </div>
            <div>
              <label style={{fontSize:10.5,fontWeight:600,color:C.textLight,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>Group</label>
              {newGroupInput
                ?<div style={{display:'flex',gap:5}}>
                  <input value={newReport.group} onChange={e=>setNewReport(p=>({...p,group:e.target.value}))} placeholder="New group name"
                    style={{flex:1,padding:'7px 10px',borderRadius:6,border:`1.5px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif'}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
                  <button onClick={()=>setNewGroupInput(false)} style={{padding:'7px 9px',borderRadius:6,border:`1px solid ${C.cardBorder}`,background:'#F0F4F8',cursor:'pointer',fontSize:12,color:C.textMuted,fontFamily:'Inter,sans-serif'}}>Back</button>
                </div>
                :<select value={newReport.group} onChange={e=>{if(e.target.value==='__new__'){setNewGroupInput(true);setNewReport(p=>({...p,group:''}))}else setNewReport(p=>({...p,group:e.target.value}))}}
                  style={{width:'100%',padding:'7px 10px',borderRadius:6,border:`1.5px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff',cursor:'pointer'}}>
                  {existingGroups.map(g=><option key={g} value={g}>{g}</option>)}
                  <option value="__new__">New group…</option>
                </select>}
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{fontSize:10.5,fontWeight:600,color:C.textLight,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>Description</label>
            <input value={newReport.description} onChange={e=>setNewReport(p=>({...p,description:e.target.value}))} placeholder="What does this report show?"
              style={{width:'100%',padding:'7px 10px',borderRadius:6,border:`1.5px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif'}}
              onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{fontSize:10.5,fontWeight:600,color:C.textLight,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>SQL</label>
            <SQLEditor value={newReport.sql} onChange={v=>setNewReport(p=>({...p,sql:v}))} height={100}/>
          </div>
          <div style={{display:'flex',gap:12,marginBottom:12,flexWrap:'wrap'}}>
            <div>
              <label style={{fontSize:10.5,fontWeight:600,color:C.textLight,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>Schedule</label>
              <select value={newReport.schedule} onChange={e=>{const h=e.target.value==='daily'?24:e.target.value==='weekly'?168:e.target.value==='monthly'?720:0;setNewReport(p=>({...p,schedule:e.target.value,refreshHours:h}))}}
                style={{padding:'6px 10px',borderRadius:6,border:`1.5px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff',cursor:'pointer'}}>
                <option value="daily">Daily (24h cache)</option>
                <option value="weekly">Weekly (7 day cache)</option>
                <option value="monthly">Monthly (30 day cache)</option>
                <option value="manual">Manual only</option>
              </select>
            </div>
            <div>
              <label style={{fontSize:10.5,fontWeight:600,color:C.textLight,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>Visibility</label>
              <div style={{display:'flex',gap:6}}>
                {[['personal','Personal'],['shared','Team']].map(([v,l])=>(
                  <button key={v} onClick={()=>setNewReport(p=>({...p,shared:v==='shared'}))}
                    style={{padding:'6px 11px',borderRadius:6,border:'1.5px solid',fontSize:12.5,fontWeight:500,cursor:'pointer',fontFamily:'Inter,sans-serif',borderColor:(v==='shared')===newReport.shared?C.accent:C.cardBorder,background:(v==='shared')===newReport.shared?C.accentBg:'#fff',color:(v==='shared')===newReport.shared?C.accent:C.textMuted}}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{display:'flex',gap:7}}>
            <button onClick={saveReport} style={{background:C.accent,color:'#fff',border:'none',borderRadius:6,padding:'8px 18px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Save report</button>
            <button onClick={()=>setShowNew(false)} style={{background:'#F0F4F8',color:C.textMuted,border:`1px solid ${C.cardBorder}`,borderRadius:6,padding:'8px 14px',fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Cancel</button>
          </div>
        </div>
      )}

      {Object.entries(groups).map(([groupName,groupReports])=>(
        <div key={groupName} style={{marginBottom:26}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:C.accent}}/>
            <span style={{fontWeight:700,fontSize:13.5,color:C.text}}>{groupName}</span>
            <div style={{flex:1,height:1,background:C.cardBorder}}/>
            <span style={{fontSize:11.5,color:C.textLight}}>{groupReports.length} report{groupReports.length!==1?'s':''}</span>
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {groupReports.map((report:any)=>{
              const cached=sharedResults[report.id]
              const stale=isStale(report)
              const ageH=cached?Math.max(0,Math.round((Date.now()-cached.ranAt)/1000/3600)):null

              return(
                <div key={report.id} style={{background:'#fff',borderRadius:9,border:`1px solid ${C.cardBorder}`,overflow:'visible'}}>
                  <div style={{padding:'12px 16px',display:'flex',alignItems:'flex-start',gap:10}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:4,flexWrap:'wrap'}}>
                        <span style={{fontWeight:600,fontSize:14.5,color:C.text}}>{report.name}</span>
                        <span style={{background:`${SCHED_COLOR[report.schedule]||'#94A3B8'}15`,color:SCHED_COLOR[report.schedule]||'#94A3B8',fontSize:10.5,fontWeight:600,padding:'2px 7px',borderRadius:4}}>{report.schedule}</span>
                        {report.shared
                          ?<span style={{background:C.accentBg,color:C.accent,fontSize:10.5,fontWeight:500,padding:'2px 7px',borderRadius:4}}>Team</span>
                          :<span style={{background:'#F8FAFD',color:C.textLight,fontSize:10.5,fontWeight:500,padding:'2px 7px',borderRadius:4}}>Personal</span>}
                        {cached&&stale&&<span style={{background:'#FEF3C7',color:'#D97706',fontSize:10.5,fontWeight:600,padding:'2px 7px',borderRadius:4}}>Stale</span>}
                        {cached&&!stale&&<span style={{background:C.greenBg,color:C.success,fontSize:10.5,fontWeight:600,padding:'2px 7px',borderRadius:4}}>Fresh</span>}
                        {!cached&&<span style={{background:'#F8FAFD',color:C.textLight,fontSize:10.5,padding:'2px 7px',borderRadius:4}}>Not yet run</span>}
                      </div>
                      <p style={{fontSize:12.5,color:C.textMuted,marginBottom:5}}>{report.description}</p>
                      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                        <span style={{fontSize:11,color:C.textLight}}>Last run: <strong style={{color:C.text}}>{report.lastRun}</strong></span>
                        {cached&&<span style={{fontSize:11,color:C.textLight}}>Cached: <strong style={{color:C.text}}>{ageH===0?'just now':`${ageH}h ago`}</strong></span>}
                        <span style={{fontSize:11,color:SCHED_COLOR[report.schedule]||C.textLight,fontWeight:600}}>Next: {SCHEDULE_NEXT[report.schedule]||'—'}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{display:'flex',gap:6,flexShrink:0,alignItems:'center'}}>
                      <button onClick={()=>runReport(report,true)} disabled={running===report.id}
                        style={{background:C.accent,color:'#fff',border:'none',borderRadius:6,padding:'6px 12px',fontSize:12.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center',gap:4,opacity:running===report.id?.6:1,whiteSpace:'nowrap'}}>
                        {running===report.id
                          ?<><span className="spin" style={{width:10,height:10,border:'2px solid rgba(255,255,255,.3)',borderTop:'2px solid #fff',borderRadius:'50%',display:'inline-block'}}/>Running</>
                          :stale||!cached?'Run':'Re-run'}
                      </button>
                      {cached&&(
                        <button onClick={()=>setExpanded(expanded===report.id?null:report.id)}
                          style={{background:'#F0F4F8',color:C.text,border:`1px solid ${C.cardBorder}`,borderRadius:6,padding:'6px 11px',fontSize:12.5,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:500}}>
                          {expanded===report.id?'Hide':'Results'}
                        </button>
                      )}

                      {/* Ellipsis menu */}
                      <div style={{position:'relative'}}>
                        <button onClick={e=>{e.stopPropagation();setMenuOpen(menuOpen===report.id?null:report.id)}}
                          style={{background:'#F0F4F8',border:`1px solid ${C.cardBorder}`,borderRadius:6,padding:'6px 10px',fontSize:16,cursor:'pointer',color:C.text,lineHeight:1,fontWeight:700,letterSpacing:1}}>
                          ···
                        </button>
                        {menuOpen===report.id&&(
                          <div style={{position:'absolute',right:0,top:'calc(100% + 4px)',background:'#fff',border:`1px solid ${C.cardBorder}`,borderRadius:8,boxShadow:'0 6px 20px rgba(0,0,0,0.1)',zIndex:100,minWidth:170,overflow:'hidden'}}
                            onClick={e=>e.stopPropagation()}>
                            {cached&&(
                              <button onClick={()=>{exportCSV(cached.rows,cached.fields,report.name);setMenuOpen(null)}}
                                style={{display:'block',width:'100%',padding:'9px 14px',background:'none',border:'none',fontSize:13,color:C.text,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left',transition:'background .1s'}}
                                onMouseOver={e=>e.currentTarget.style.background='#F0F7FF'} onMouseOut={e=>e.currentTarget.style.background='none'}>
                                Export CSV
                              </button>
                            )}
                            <button onClick={()=>{setEmailModal({report,rows:cached?.rows,fields:cached?.fields});setMenuOpen(null)}}
                              style={{display:'block',width:'100%',padding:'9px 14px',background:'none',border:'none',fontSize:13,color:C.text,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left',transition:'background .1s'}}
                              onMouseOver={e=>e.currentTarget.style.background='#F0F7FF'} onMouseOut={e=>e.currentTarget.style.background='none'}>
                              Email results
                            </button>
                            <button onClick={()=>{setBiPanel(biPanel===report.id?null:report.id);setMenuOpen(null)}}
                              style={{display:'block',width:'100%',padding:'9px 14px',background:'none',border:'none',fontSize:13,color:C.text,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left',transition:'background .1s'}}
                              onMouseOver={e=>e.currentTarget.style.background='#F0F7FF'} onMouseOut={e=>e.currentTarget.style.background='none'}>
                              Connect to BI tool
                            </button>
                            <div style={{height:1,background:C.cardBorder,margin:'3px 0'}}/>
                            <button onClick={()=>{setReports((p:any[])=>p.filter(r=>r.id!==report.id));setMenuOpen(null)}}
                              style={{display:'block',width:'100%',padding:'9px 14px',background:'none',border:'none',fontSize:13,color:C.danger,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left',transition:'background .1s'}}
                              onMouseOver={e=>e.currentTarget.style.background='#FEF2F2'} onMouseOut={e=>e.currentTarget.style.background='none'}>
                              Delete report
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {biPanel===report.id&&(
                    <div style={{padding:'12px 16px',borderTop:`1px solid ${C.cardBorder}`}}>
                      <BIIntegrationPanel reportId={report.id} reportName={report.name}/>
                    </div>
                  )}

                  {cached&&stale&&expanded!==report.id&&(
                    <div style={{padding:'7px 16px',background:'#FFFBEB',borderTop:'1px solid #FDE68A',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <span style={{fontSize:12,color:'#92400E'}}>Showing cached data from {cached.ts} — past refresh window</span>
                      <button onClick={()=>runReport(report,true)} style={{fontSize:12,color:'#D97706',fontWeight:600,background:'none',border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Refresh now</button>
                    </div>
                  )}

                  {cached&&expanded===report.id&&(
                    <div style={{borderTop:`1px solid ${C.cardBorder}`,padding:'12px 16px',background:C.bg}}>
                      <div style={{fontSize:11.5,color:C.textLight,marginBottom:7}}>
                        {stale?'Stale — ':'Fresh — '}cached at {cached.ts} · {cached.rows.length} rows
                      </div>
                      <ResultsTable rows={cached.rows} fields={cached.fields}/>
                    </div>
                  )}

                  {running===report.id&&!cached&&(
                    <div style={{padding:'10px 16px',background:C.bg,borderTop:`1px solid ${C.cardBorder}`,display:'flex',alignItems:'center',gap:7}}>
                      <div className="spin" style={{width:11,height:11,border:`2px solid ${C.cardBorder}`,borderTop:`2px solid ${C.accent}`,borderRadius:'50%'}}/>
                      <span style={{fontSize:12.5,color:C.textMuted}}>Running query…</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function ExplorerTab({onAsk,setDrawerTable,handleRightClick}:{onAsk:(q:string)=>void,setDrawerTable:(t:any)=>void,handleRightClick:(e:React.MouseEvent,t:any)=>void}) {
  const [search,setSearch]=useState('')
  const filtered=search?TABLES.filter(t=>t.name.includes(search.toLowerCase())||t.columns.some(c=>c.n.includes(search.toLowerCase()))):TABLES
  return(
    <div style={{padding:'20px 24px',overflowY:'auto',flex:1}}>
      <div style={{display:'flex',gap:12,marginBottom:18,flexWrap:'wrap',alignItems:'flex-end'}}>
        <div>
          <h2 style={{fontSize:18,fontWeight:700,color:C.text,letterSpacing:'-0.3px',marginBottom:2}}>Database Explorer</h2>
          <p style={{fontSize:12.5,color:C.textMuted}}>Northwind · Right-click any table for options · Click to open detail panel</p>
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:10,alignItems:'center'}}>
          {[['Tables',String(TABLES.length)],['Columns',String(ALL_COLS.length)],['Rows',TABLES.reduce((s,t)=>s+parseInt(t.rows.replace(/,/g,''),10),0).toLocaleString()]].map(([k,v])=>(
            <div key={k} style={{background:'#fff',borderRadius:7,border:`1px solid ${C.cardBorder}`,padding:'5px 12px',textAlign:'center'}}>
              <div style={{fontSize:9.5,color:C.textLight,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>{k}</div>
              <div style={{fontSize:15,fontWeight:700,color:C.text}}>{v}</div>
            </div>
          ))}
          <div style={{position:'relative'}}>
            <svg width={13} height={13} fill="none" stroke={C.textLight} strokeWidth={2} viewBox="0 0 24 24" style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)'}}>
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
            </svg>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tables and columns…"
              style={{padding:'7px 12px 7px 28px',borderRadius:7,border:`1px solid ${C.cardBorder}`,fontSize:12.5,color:C.text,fontFamily:'Inter,sans-serif',width:230,background:'#fff'}}
              onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
          </div>
        </div>
      </div>

      {search&&(
        <div style={{background:'#fff',borderRadius:8,border:`1px solid ${C.cardBorder}`,padding:'11px 14px',marginBottom:16}}>
          <div style={{fontSize:10.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>Columns matching "{search}"</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
            {ALL_COLS.filter(c=>c.n.includes(search.toLowerCase())||c.table.includes(search.toLowerCase())).map((c,i)=>(
              <div key={i} style={{display:'inline-flex',alignItems:'center',gap:4,background:C.accentBg,border:`1px solid ${C.accent}33`,borderRadius:4,padding:'2px 8px'}}>
                <span style={{width:5,height:5,borderRadius:'50%',background:TC[c.t],display:'inline-block'}}/>
                <span style={{fontFamily:"'JetBrains Mono'",fontSize:11,color:C.text,fontWeight:500}}>{c.n}</span>
                <span style={{fontSize:10,color:C.textLight}}>in {c.table}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(310px,1fr))',gap:12}}>
        {filtered.map(tbl=>(
          <div key={tbl.name} className="table-card"
            style={{background:'#fff',borderRadius:9,border:`1px solid ${C.cardBorder}`,cursor:'pointer',overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.04)',transition:'all .15s'}}
            onClick={()=>setDrawerTable(tbl)} onContextMenu={e=>handleRightClick(e,tbl)}>
            <div style={{padding:'11px 14px',borderBottom:`1px solid ${C.cardBorder}`,display:'flex',alignItems:'center',gap:9,background:C.tableHead}}>
              <div style={{width:9,height:9,borderRadius:'50%',background:tbl.color,flexShrink:0}}/>
              <span style={{fontFamily:"'JetBrains Mono'",fontWeight:700,fontSize:13.5,color:C.text,flex:1}}>{tbl.name}</span>
              <span style={{background:`${tbl.color}18`,color:tbl.color,fontSize:10.5,fontWeight:600,padding:'2px 7px',borderRadius:4}}>{tbl.rows} rows</span>
              <span style={{fontSize:11,color:C.textLight}}>↻ {tbl.refresh}</span>
            </div>
            <div style={{padding:'11px 14px'}}>
              <p style={{fontSize:12.5,color:C.textMuted,marginBottom:9,lineHeight:1.5}}>{tbl.desc}</p>
              <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:9}}>
                {tbl.teams.map(t=><span key={t} style={{background:C.accentBg,border:`1px solid ${C.accent}22`,color:C.accent,fontSize:10.5,fontWeight:500,padding:'2px 7px',borderRadius:4}}>{t}</span>)}
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:9}}>
                {tbl.columns.map(c=>(
                  <span key={c.n} style={{display:'inline-flex',alignItems:'center',gap:3,background:C.bg,border:`1px solid ${C.cardBorder}`,borderRadius:4,padding:'2px 6px'}}>
                    <span style={{width:5,height:5,borderRadius:'50%',background:TC[c.t],display:'inline-block',flexShrink:0}}/>
                    <span style={{fontFamily:"'JetBrains Mono'",fontSize:10.5,color:C.textMuted}}>{c.n}</span>
                  </span>
                ))}
              </div>
              {tbl.joins.length>0&&<div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                {tbl.joins.map(j=><span key={j.to} style={{background:'#F0F7FF',border:`1px solid ${C.accent}22`,color:C.accent,fontSize:10.5,padding:'2px 7px',borderRadius:4,fontWeight:500}}>→ {j.to}</span>)}
              </div>}
            </div>
            <div style={{padding:'7px 14px',borderTop:`1px solid ${C.cardBorder}`,background:'#FAFCFE',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <button onClick={e=>{e.stopPropagation();onAsk(tbl.sampleQ[0])}} style={{background:'none',border:'none',fontSize:11.5,color:C.accent,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:500,padding:0,textAlign:'left'}}>
                {tbl.sampleQ[0]?.slice(0,45)}{tbl.sampleQ[0]?.length>45?'…':''}
              </button>
              <span style={{fontSize:10.5,color:C.textLight}}>Right-click for more</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router=useRouter()
  const [tab,setTab]=useState<'ask'|'dashboard'|'explorer'|'relationships'|'builder'|'reports'|'stats'>('ask')
  const [sideCollapsed,setSideCollapsed]=useState(false)
  const [reportResults,setReportResults]=useState<Record<string,ReportResult>>({})
  const saveReportResult=useCallback((id:string,result:ReportResult)=>{setReportResults(prev=>({...prev,[id]:result}));reportCache[id]=result},[])

  const [sideSearch,setSideSearch]=useState('')
  const [sideExpanded,setSideExpanded]=useState<string|null>('Sales / Finance')
  const [drawerTable,setDrawerTable]=useState<any|null>(null)
  const [previewTable,setPreviewTable]=useState<any|null>(null)
  const [contextMenu,setContextMenu]=useState<{x:number,y:number,table:any}|null>(null)
  const [colSearch,setColSearch]=useState('')
  const [selCols,setSelCols]=useState<any[]>([])

  const teamGroups=useMemo(()=>{const g:Record<string,typeof TABLES>={};TABLES.forEach(t=>{if(!g[t.team])g[t.team]=[];g[t.team].push(t)});return g},[])
  const sideResults=sideSearch?ALL_COLS.filter(c=>c.n.toLowerCase().includes(sideSearch.toLowerCase())||c.table.toLowerCase().includes(sideSearch.toLowerCase())):[]
  const handleRightClick=(e:React.MouseEvent,table:any)=>{e.preventDefault();setContextMenu({x:e.clientX,y:e.clientY,table})}
  const askQuestion=(q:string)=>{setTab('ask')}
  const closeDrawer=()=>setDrawerTable(null)
  const builderCols=ALL_COLS.filter(c=>c.n.toLowerCase().includes(colSearch.toLowerCase())||c.table.toLowerCase().includes(colSearch.toLowerCase()))
  const logout=async()=>{await fetch('/api/auth',{method:'DELETE'});router.push('/auth')}
  const TABS=[['ask','Qwezy'],['dashboard','Dashboard'],['explorer','Explorer'],['relationships','Relationships'],['builder','Builder'],['reports','Reports'],['stats','Usage']] as const

  return(
    <div style={{fontFamily:'Inter,-apple-system,sans-serif',background:C.bg,height:'100vh',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {previewTable&&<PreviewModal table={previewTable} onClose={()=>setPreviewTable(null)}/>}
      {drawerTable&&<TableDrawer table={drawerTable} onClose={closeDrawer} onAsk={askQuestion} onPreview={t=>setPreviewTable(t)}/>}
      {contextMenu&&<ContextMenu {...contextMenu} onClose={()=>setContextMenu(null)} onAsk={askQuestion} onPreview={t=>setPreviewTable(t)} onDrawer={t=>setDrawerTable(t)}/>}
      {drawerTable&&<div style={{position:'fixed',inset:0,zIndex:199}} onClick={closeDrawer}/>}

      <nav style={{background:C.navBg,borderBottom:`1px solid ${C.navBorder}`,padding:'0 20px',display:'flex',alignItems:'center',height:52,position:'relative',zIndex:100,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:9,marginRight:24,paddingRight:24,borderRight:`1px solid ${C.navBorder}`}}>
          <div style={{width:28,height:28,background:'linear-gradient(135deg,#10B981,#059669)',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{color:'#fff',fontFamily:"'JetBrains Mono'",fontWeight:700,fontSize:11}}>{'{ }'}</span>
          </div>
          <span style={{fontWeight:700,fontSize:15,color:'#fff',letterSpacing:'-0.2px'}}>Qwezy</span>
        </div>
        {TABS.map(([t,label])=>(
          <button key={t} onClick={()=>setTab(t)} style={{background:'none',border:'none',padding:'0 12px',height:52,fontSize:13,fontWeight:500,color:tab===t?'#fff':C.navText,cursor:'pointer',borderBottom:tab===t?`2px solid ${C.navActive}`:'2px solid transparent',fontFamily:'Inter,sans-serif',transition:'color .15s',whiteSpace:'nowrap'}}>
            {label}
          </button>
        ))}
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:9}}>
          <div style={{display:'flex',alignItems:'center',gap:5,padding:'3px 9px',background:'rgba(16,185,129,0.12)',border:'1px solid rgba(16,185,129,0.25)',borderRadius:5}}>
            <div style={{width:5,height:5,borderRadius:'50%',background:C.navActive}}/><span style={{fontSize:11.5,color:C.navActive,fontWeight:500}}>Northwind</span>
          </div>
          <button onClick={logout} style={{background:'none',border:`1px solid ${C.navBorder}`,borderRadius:5,padding:'4px 11px',fontSize:12,color:C.navText,cursor:'pointer',fontFamily:'Inter,sans-serif',transition:'all .15s'}}
            onMouseOver={e=>{e.currentTarget.style.color='#fff';e.currentTarget.style.borderColor=C.navText}}
            onMouseOut={e=>{e.currentTarget.style.color=C.navText;e.currentTarget.style.borderColor=C.navBorder}}>Sign out</button>
          <button onClick={()=>router.push('/admin')} style={{background:'none',border:`1px solid ${C.navBorder}`,borderRadius:5,padding:'4px 11px',fontSize:12,color:C.navText,cursor:'pointer',fontFamily:'Inter,sans-serif',transition:'all .15s'}}
            onMouseOver={e=>{e.currentTarget.style.borderColor=C.navText;e.currentTarget.style.color='#fff'}}
            onMouseOut={e=>{e.currentTarget.style.borderColor=C.navBorder;e.currentTarget.style.color=C.navText}}>Admin</button>
          <div style={{width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,#10B981,#047857)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:11}}>JD</div>
        </div>
      </nav>

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        {/* Sidebar */}
        <aside style={{width:sideCollapsed?40:205,background:C.sidebar,borderRight:`1px solid ${C.sidebarBorder}`,display:'flex',flexDirection:'column',flexShrink:0,overflow:'hidden',transition:'width .2s ease'}}>
          {/* Collapse toggle + search */}
          <div style={{padding:'9px 11px',borderBottom:`1px solid ${C.sidebarBorder}`,display:'flex',alignItems:'center',gap:7}}>
            <button onClick={()=>setSideCollapsed(c=>!c)}
              title={sideCollapsed?'Expand sidebar':'Collapse sidebar'}
              style={{background:'none',border:'none',cursor:'pointer',color:C.textLight,padding:0,lineHeight:1,flexShrink:0,fontSize:14,width:18,display:'flex',alignItems:'center',justifyContent:'center'}}>
              {sideCollapsed?'›':'‹'}
            </button>
            {!sideCollapsed&&<div style={{position:'relative',flex:1}}>
              <svg width={12} height={12} fill="none" stroke={C.textLight} strokeWidth={2} viewBox="0 0 24 24" style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)'}}>
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
              </svg>
              <input value={sideSearch} onChange={e=>setSideSearch(e.target.value)} placeholder="Search columns…"
                style={{width:'100%',padding:'5px 8px 5px 24px',borderRadius:5,border:`1px solid ${C.sidebarBorder}`,fontSize:11.5,color:C.text,fontFamily:'Inter,sans-serif',background:C.bg}}/>
            </div>}
          </div>
          <div style={{flex:1,overflowY:'auto',display:sideCollapsed?'none':'flex',flexDirection:'column'}}>
            {sideSearch?(
              <div style={{padding:'9px 11px'}}>
                <div style={{fontSize:9.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:6}}>{sideResults.length} results</div>
                {sideResults.length===0?<div style={{fontSize:12,color:C.textLight}}>No columns found</div>
                :sideResults.slice(0,25).map((c,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 5px',borderRadius:5,marginBottom:2,background:C.bg}}>
                    <span style={{width:6,height:6,borderRadius:'50%',background:TC[c.t],display:'inline-block',flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontFamily:"'JetBrains Mono'",color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.n}</div><div style={{fontSize:9.5,color:C.textLight}}>{c.table}</div></div>
                  </div>
                ))}
              </div>
            ):(
              <>
                <div style={{padding:'9px 11px 4px',fontSize:9.5,fontWeight:600,color:C.textLight,letterSpacing:'0.08em',textTransform:'uppercase'}}>Tables</div>
                {Object.entries(teamGroups).map(([teamName,tables])=>(
                  <div key={teamName}>
                    <div style={{padding:'5px 11px',display:'flex',alignItems:'center',gap:6,cursor:'pointer',background:'#FAFCFE',borderTop:`1px solid ${C.sidebarBorder}`,transition:'background .1s'}}
                      onMouseOver={e=>e.currentTarget.style.background='#F0F7FF'} onMouseOut={e=>e.currentTarget.style.background='#FAFCFE'}
                      onClick={()=>setSideExpanded(sideExpanded===teamName?null:teamName)}>
                      <div style={{width:6,height:6,borderRadius:'50%',background:tables[0]?.color||'#9CA3AF',flexShrink:0}}/>
                      <span style={{fontSize:11.5,fontWeight:600,color:C.text,flex:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{teamName.split('/')[0].trim()}</span>
                      <span style={{fontSize:9,color:C.textLight}}>{tables.length}{sideExpanded===teamName?' ▲':' ▼'}</span>
                    </div>
                    {sideExpanded===teamName&&tables.map(tbl=>(
                      <div key={tbl.name}
                        style={{padding:'4px 11px 4px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',borderLeft:drawerTable?.name===tbl.name?`2px solid ${C.accent}`:`2px solid transparent`,background:drawerTable?.name===tbl.name?C.accentBg:'transparent',transition:'all .1s'}}
                        onMouseOver={e=>{if(drawerTable?.name!==tbl.name)e.currentTarget.style.background='#F0F7FF'}} onMouseOut={e=>{if(drawerTable?.name!==tbl.name)e.currentTarget.style.background='transparent'}}
                        onClick={()=>setDrawerTable(tbl)} onContextMenu={e=>handleRightClick(e,tbl)}>
                        <div><div style={{fontSize:11,fontWeight:500,color:C.text,fontFamily:"'JetBrains Mono'"}}>{tbl.name}</div><div style={{fontSize:9,color:C.textLight}}>{tbl.rows} rows</div></div>
                        <span style={{fontSize:9,color:C.accent,fontWeight:500}}>info</span>
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
          {!sideCollapsed&&<div style={{padding:'9px 11px',borderTop:`1px solid ${C.sidebarBorder}`,background:'#FAFCFE'}}>
            {[['Tables','8/8'],['Database','Northwind'],['Status','Connected']].map(([k,v])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <span style={{fontSize:10.5,color:C.textLight}}>{k}</span>
                <span style={{fontSize:10.5,fontWeight:600,color:k==='Status'?C.success:C.text}}>{v}</span>
              </div>
            ))}
          </div>}
        </aside>

        <main style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          {tab==='ask'&&<QwezyTab onAsk={q=>{setTab('ask')}}/>}
          {tab==='dashboard'&&<div style={{flex:1,overflow:'hidden'}}><DashboardTab onAsk={askQuestion} onTabSwitch={()=>setTab('reports')} sharedResults={reportResults} onResultSaved={saveReportResult}/></div>}
          {tab==='explorer'&&<ExplorerTab onAsk={askQuestion} setDrawerTable={setDrawerTable} handleRightClick={handleRightClick}/>}
          {tab==='relationships'&&<div style={{flex:1,overflowY:'auto'}}><RelationshipsDiagram onTableClick={t=>setDrawerTable(t)}/></div>}
          {tab==='builder'&&(
            <div style={{flex:1,display:'flex',overflow:'hidden'}}>
              <div style={{width:195,background:'#fff',borderRight:`1px solid ${C.sidebarBorder}`,display:'flex',flexDirection:'column',flexShrink:0}}>
                <div style={{padding:'9px 9px 6px',borderBottom:`1px solid ${C.sidebarBorder}`,background:'#FAFCFE'}}>
                  <div style={{fontSize:9.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5}}>All Columns</div>
                  <input value={colSearch} onChange={e=>setColSearch(e.target.value)} placeholder="Search…" style={{width:'100%',padding:'4px 8px',borderRadius:5,border:`1px solid ${C.sidebarBorder}`,fontSize:12,color:C.text,background:C.bg,fontFamily:'Inter,sans-serif'}}/>
                </div>
                <div style={{flex:1,overflowY:'auto',padding:'5px 7px'}}>
                  {builderCols.map((col,i)=>(
                    <div key={i} onClick={()=>{if(!selCols.find(c=>c.n===col.n&&c.table===col.table))setSelCols(p=>[...p,col])}}
                      style={{display:'flex',alignItems:'center',gap:6,padding:'5px 6px',borderRadius:5,marginBottom:2,background:C.bg,cursor:'pointer',transition:'background .1s'}}
                      onMouseOver={e=>e.currentTarget.style.background='#F0F7FF'} onMouseOut={e=>e.currentTarget.style.background=C.bg}>
                      <span style={{width:6,height:6,borderRadius:'50%',background:TC[col.t],display:'inline-block',flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:500,color:C.text,fontFamily:"'JetBrains Mono'",overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{col.n}</div><div style={{fontSize:9,color:C.textLight}}>{col.table}</div></div>
                      <span style={{color:C.accent,fontWeight:600,fontSize:13}}>+</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{flex:1,padding:20,overflowY:'auto',display:'flex',flexDirection:'column',gap:12}}>
                <div><h3 style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:2}}>Query Builder</h3><p style={{fontSize:12,color:C.textMuted}}>Click columns on the left to build a query</p></div>
                <div style={{background:'#fff',borderRadius:8,border:`2px dashed ${C.cardBorder}`,padding:14,minHeight:100,flex:1}}>
                  <div style={{fontSize:10,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:9}}>Selected Columns</div>
                  {selCols.length===0?<div style={{textAlign:'center',color:C.textLight,fontSize:13,paddingTop:12}}>Click columns on the left to add them</div>
                  :<div style={{display:'flex',flexWrap:'wrap',gap:5}}>{selCols.map((col,i)=><div key={i} style={{background:C.accentBg,border:`1px solid ${C.accent}44`,borderRadius:5,padding:'4px 9px',display:'flex',alignItems:'center',gap:5}}><span style={{width:6,height:6,borderRadius:'50%',background:TC[col.t],display:'inline-block'}}/><span style={{fontFamily:"'JetBrains Mono'",fontSize:11.5,color:C.text}}>{col.table}.{col.n}</span><button onClick={()=>setSelCols(selCols.filter(c=>!(c.n===col.n&&c.table===col.table)))} style={{background:'none',border:'none',color:C.textLight,cursor:'pointer',fontSize:14,lineHeight:1,padding:0}}>×</button></div>)}</div>}
                </div>
                {selCols.length>0&&<button onClick={()=>{setTab('ask')}} style={{background:C.accent,color:'#fff',border:'none',borderRadius:6,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',alignSelf:'flex-start'}}>Generate query</button>}
              </div>
            </div>
          )}
          {tab==='reports'&&<div style={{flex:1,overflow:'hidden'}}><ReportsTab sharedResults={reportResults} onResultSaved={saveReportResult}/></div>}
          {tab==='stats'&&(
            <div style={{flex:1,overflowY:'auto',padding:24}}>
              <div style={{marginBottom:16}}><h2 style={{fontSize:17,fontWeight:700,color:C.text}}>Usage & Health</h2><p style={{fontSize:12.5,color:C.textMuted,marginTop:2}}>Northwind Demo · March 2026</p></div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(165px,1fr))',gap:10,marginBottom:16}}>
                {[['Queries Run','—','Connected'],['Tables','8/8','All annotated'],['Response','—','Via Claude AI'],['Members','1','Demo mode']].map(([l,v,s])=>(
                  <div key={l} style={{background:'#fff',borderRadius:8,border:`1px solid ${C.cardBorder}`,padding:'13px 15px'}}>
                    <div style={{fontSize:9.5,color:C.textLight,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>{l}</div>
                    <div style={{fontSize:20,fontWeight:700,color:C.text,marginBottom:2}}>{v}</div>
                    <div style={{fontSize:11,color:C.success,fontWeight:500}}>{s}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div style={{background:'#fff',borderRadius:8,border:`1px solid ${C.cardBorder}`,padding:14}}>
                  <div style={{fontWeight:600,fontSize:13.5,color:C.text,marginBottom:11}}>Table Health</div>
                  {TABLES.map((t,i)=>(
                    <div key={t.name} style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}>
                      <span style={{fontFamily:"'JetBrains Mono'",fontSize:10.5,color:C.text,width:75,flexShrink:0}}>{t.name}</span>
                      <div style={{flex:1,height:4,background:C.bg,borderRadius:3,overflow:'hidden',border:`1px solid ${C.cardBorder}`}}><div style={{height:'100%',background:`linear-gradient(90deg,${t.color},${t.color}cc)`,borderRadius:3,width:`${85+(i*3)%15}%`}}/></div>
                      <span style={{fontSize:10.5,fontWeight:600,color:C.textMuted,width:30,textAlign:'right'}}>{85+(i*3)%15}%</span>
                    </div>
                  ))}
                </div>
                <div style={{background:C.codeBg,borderRadius:8,padding:14,border:'1px solid #21262D'}}>
                  <div style={{fontFamily:"'JetBrains Mono'",fontSize:11.5,color:'#3FB950',fontWeight:600,marginBottom:11}}>API Cost Estimate</div>
                  {[['Per NL query','~$0.03'],['Direct SQL','~$0.00'],['Follow-up','~$0.04'],['Per 100 queries','~$1.50']].map(([k,v],i)=>(
                    <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:i<3?'1px solid #21262D':'none'}}>
                      <span style={{fontSize:12.5,color:i===3?'#E6EDF3':'#484F58',fontWeight:i===3?600:400}}>{k}</span>
                      <span style={{fontSize:12.5,fontFamily:"'JetBrains Mono'",color:i===3?'#fff':'#3FB950',fontWeight:i===3?600:400}}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
