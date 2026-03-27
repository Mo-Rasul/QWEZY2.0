'use client'
import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid, PieChart, Pie } from 'recharts'

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

type ConvMessage = {
  id: string; role: 'user'|'assistant'; content: string
  sql?: string; rows?: any[]; fields?: string[]; duration?: number
  confidence?: string; assumptions?: string[]; uncertainAbout?: string|null
  suggestedClarification?: string|null; timestamp: Date; rewritten?: boolean
}
type Conversation = {id:string; title:string; messages:ConvMessage[]; createdAt:Date; updatedAt:Date}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatSQL(sql: string): string {
  if (!sql) return ''
  return sql
    .replace(/\b(SELECT|FROM|WHERE|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|OUTER JOIN|GROUP BY|ORDER BY|HAVING|LIMIT|OFFSET|ON|AND|OR|AS|UNION|INSERT|UPDATE|DELETE|WITH|CASE|WHEN|THEN|ELSE|END)\b/gi,
      (m) => '\n' + m.toUpperCase())
    .replace(/,\s*/g, ',\n  ')
    .replace(/^\n/, '')
    .split('\n').map(l => l.trim()).filter(Boolean).join('\n')
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
          <button onClick={copySQL} style={{fontSize:11,padding:'2px 9px',borderRadius:4,border:'1px solid #30363D',background:'transparent',color:copied?'#3FB950':'#8B949E',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
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
  useEffect(()=>setVis(fields),[fields])
  const toggleSort=(c:string)=>{if(sort===c)setDir(d=>d==='asc'?'desc':'asc');else{setSort(c);setDir('asc')}}
  const data=useMemo(()=>{
    let r=rows
    if(filter)r=r.filter(row=>Object.values(row).some(v=>String(v).toLowerCase().includes(filter.toLowerCase())))
    if(sort)r=[...r].sort((a,b)=>{const cmp=String(a[sort]).localeCompare(String(b[sort]),undefined,{numeric:true});return dir==='asc'?cmp:-cmp})
    return r
  },[rows,filter,sort,dir])
  return(
    <div style={{background:C.card,borderRadius:8,border:`1px solid ${C.cardBorder}`,overflow:'hidden'}}>
      {!compact&&<div style={{padding:'7px 12px',borderBottom:`1px solid ${C.cardBorder}`,display:'flex',gap:8,alignItems:'center',background:C.tableHead}}>
        <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter rows…"
          style={{padding:'4px 9px',borderRadius:5,border:`1px solid ${C.cardBorder}`,fontSize:12,color:C.text,fontFamily:'Inter,sans-serif',width:150,background:'#fff'}}/>
        <span style={{fontSize:11.5,color:C.textLight}}>{data.length}/{rows.length} rows</span>
        {sort&&<span style={{fontSize:11.5,color:C.accent,marginLeft:4}}>Sorted by {sort.replace(/_/g,' ')} {dir==='asc'?'↑':'↓'} · <button onClick={()=>setSort(null)} style={{background:'none',border:'none',color:C.textLight,cursor:'pointer',fontSize:11,fontFamily:'Inter,sans-serif'}}>clear</button></span>}
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
            {data.map((row,i)=><tr key={i} style={{borderTop:`1px solid #F1F5F9`,background:i%2===0?'#fff':C.tableRowAlt}}
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

// ── Table Drawer ──────────────────────────────────────────────────────────────
function TableDrawer({table,onClose,onAsk,onPreview}:{table:any,onClose:()=>void,onAsk:(q:string)=>void,onPreview:(t:any)=>void}) {
  return(
    <div style={{position:'fixed',right:0,top:0,bottom:0,width:340,background:'#fff',boxShadow:'-4px 0 24px rgba(0,0,0,0.1)',zIndex:200,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{padding:'12px 18px',borderBottom:`1px solid ${C.cardBorder}`,display:'flex',alignItems:'center',gap:9,background:C.tableHead}}>
        <div style={{width:9,height:9,borderRadius:'50%',background:table.color}}/>
        <span style={{fontFamily:"'JetBrains Mono'",fontWeight:700,fontSize:14,color:C.text,flex:1}}>{table.name}</span>
        <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,color:C.textLight,cursor:'pointer'}}>×</button>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'14px 18px'}}>
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
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>Sample Questions</div>
          {table.sampleQ.map((q:string)=>(
            <button key={q} onClick={()=>{onAsk(q);onClose()}}
              style={{width:'100%',textAlign:'left',background:'#fff',border:`1px solid ${C.cardBorder}`,borderRadius:6,padding:'7px 11px',fontSize:12.5,color:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif',marginBottom:3}}
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
          style={{display:'flex',alignItems:'center',width:'100%',padding:'8px 12px',background:'none',border:'none',fontSize:13,color:C.text,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left'}}
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
              <line x1={f.x+62} y1={f.y+22} x2={t.x+62} y2={t.y+22} stroke={isH?C.accent:'#CBD5E1'} strokeWidth={isH?2:1.5} strokeDasharray={isH?'none':'6,3'} style={{pointerEvents:'none'}}/>
              <line x1={f.x+62} y1={f.y+22} x2={t.x+62} y2={t.y+22} stroke="transparent" strokeWidth={22} style={{cursor:'pointer'}}
                onMouseEnter={ev=>{setHovEdge(e.key);setTooltip({x:ev.clientX,y:ev.clientY,label:`${e.from} — ${e.to}  ·  ON ${e.on}`})}}
                onMouseMove={ev=>setTooltip(p=>p?{...p,x:ev.clientX,y:ev.clientY}:null)}
                onMouseLeave={()=>{setHovEdge(null);setTooltip(null)}}/>
            </g>)
          })}
          {TABLES.map(t=>{const isH=hov===t.name;return(
            <g key={t.name} style={{cursor:'pointer'}} onMouseEnter={()=>setHov(t.name)} onMouseLeave={()=>setHov(null)} onClick={()=>onTableClick(t)}>
              <rect x={t.x} y={t.y} width={125} height={44} rx={6} fill={isH?t.color:'#fff'} stroke={isH?t.color:C.cardBorder} strokeWidth={isH?1.5:1}/>
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

// ── Follow-up Suggestions ─────────────────────────────────────────────────────
function FollowUpSuggestions({rows,fields,onAsk}:{rows:any[],fields:string[],onAsk:(q:string)=>void}) {
  const suggestions=useMemo(()=>{
    const sugs:string[]=[]
    const hasNum=fields.some(f=>String(rows[0]?.[f]??'').match(/^-?\d+(\.\d+)?$/))
    const numF=fields.find(f=>String(rows[0]?.[f]??'').match(/^-?\d+(\.\d+)?$/))
    const strF=fields.find(f=>!String(rows[0]?.[f]??'').match(/^-?\d+(\.\d+)?$/))
    if(rows.length>=10) sugs.push('Show me just the top 5 instead')
    if(hasNum&&numF) sugs.push(`What's the average ${numF?.replace(/_/g,' ')}?`)
    if(strF&&rows.length>1) sugs.push(`Filter to only show results where ${strF?.replace(/_/g,' ')} contains a specific value`)
    if(fields.some(f=>f.includes('country')||f.includes('region'))) sugs.push('Break this down by country')
    if(fields.some(f=>f.includes('date')||f.includes('month')||f.includes('year'))) sugs.push('Show me the trend over time')
    if(hasNum) sugs.push('Which rows are above the average?')
    sugs.push('Explain what this data is telling us')
    return sugs.slice(0,3)
  },[fields,rows])
  return(
    <div style={{marginTop:9,display:'flex',flexWrap:'wrap',gap:5}}>
      {suggestions.map(s=>(
        <button key={s} onClick={()=>onAsk(s)}
          style={{fontSize:12,padding:'4px 10px',borderRadius:5,border:`1px solid ${C.cardBorder}`,background:'#F8FAFD',color:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif'}}
          onMouseOver={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;e.currentTarget.style.background=C.accentBg}}
          onMouseOut={e=>{e.currentTarget.style.borderColor=C.cardBorder;e.currentTarget.style.color=C.textMuted;e.currentTarget.style.background='#F8FAFD'}}>
          {s}
        </button>
      ))}
    </div>
  )
}

// ── Qwezy Chat Tab ────────────────────────────────────────────────────────────
function QwezyTab({onAsk}:{onAsk:(q:string,conv?:Conversation)=>void}) {
  const [conversations,setConversations]=useState<Conversation[]>(()=>{
    try {
      const saved=sessionStorage.getItem('qwezy_convs')
      if(saved){
        const parsed=JSON.parse(saved)
        return parsed.map((c:any)=>({...c,createdAt:new Date(c.createdAt),updatedAt:new Date(c.updatedAt),messages:c.messages.map((m:any)=>({...m,timestamp:new Date(m.timestamp)}))}))
      }
    } catch {}
    return [{id:'c0',title:'New conversation',messages:[],createdAt:new Date(),updatedAt:new Date()}]
  })
  const [activeId,setActiveId]=useState(()=>{
    try { return sessionStorage.getItem('qwezy_active_id')||'c0' } catch { return 'c0' }
  })
  const [input,setInput]=useState('')
  const [directSQL,setDirectSQL]=useState('SELECT *\nFROM orders\nLIMIT 10')
  const [queryMode,setQueryMode]=useState<'nl'|'sql'>('nl')
  const [loading,setLoading]=useState(false)
  const [statusStep,setStatusStep]=useState(0)
  const [sqlHeight,setSqlHeight]=useState(160)
  const [resultsHeight,setResultsHeight]=useState(300)
  const [memoryNotes,setMemoryNotes]=useState<string[]>([])
  const [memInput,setMemInput]=useState('')
  const [showMem,setShowMem]=useState(false)
  const abortRef=useRef<AbortController|null>(null)
  const dragging=useRef(false)
  const dragY=useRef(0)
  const dragH=useRef(0)
  const bottomRef=useRef<HTMLDivElement>(null)

  const activeConv=conversations.find(c=>c.id===activeId)||conversations[0]

  // Persist to sessionStorage
  useEffect(()=>{
    try {
      sessionStorage.setItem('qwezy_convs',JSON.stringify(conversations))
      sessionStorage.setItem('qwezy_active_id',activeId)
    } catch {}
  },[conversations,activeId])

  const startDrag=(e:React.MouseEvent)=>{
    dragging.current=true;dragY.current=e.clientY;dragH.current=sqlHeight
    const move=(ev:MouseEvent)=>{if(dragging.current)setSqlHeight(Math.max(80,Math.min(400,dragH.current+(ev.clientY-dragY.current))))}
    const up=()=>{dragging.current=false;window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up)}
    window.addEventListener('mousemove',move);window.addEventListener('mouseup',up)
  }

  const stopQuery=()=>{
    abortRef.current?.abort()
    abortRef.current=null
    setLoading(false)
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

    const ctrl=new AbortController()
    abortRef.current=ctrl

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

      const isCustomSQL = queryMode==='sql'||!!customSQL
      const payload = isCustomSQL ? {customSQL:q} : {question:q,memoryContext:memoryNotes.length>0?memoryNotes.join('\n'):undefined,conversationContext:convCtx}

      const res=await fetch('/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:ctrl.signal})
      const data=await res.json();clearInterval(st)

      // If SQL errored and it was custom SQL, try AI rewrite
      if(!res.ok && isCustomSQL && data.error) {
        const rewriteRes = await fetch('/api/query',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({question:`Fix this SQL that errored: ${data.error}\nOriginal SQL:\n${q}`,memoryContext:'Return working SQL only'}),
          signal:ctrl.signal
        })
        const rewriteData = await rewriteRes.json()
        if(!rewriteData.error && rewriteData.sql) {
          const assistantMsg:ConvMessage={
            id:`m${Date.now()}a`,role:'assistant',
            content:`Returned ${rewriteData.rows?.length||0} rows in ${rewriteData.duration_ms}ms`,
            sql:formatSQL(rewriteData.sql),rows:rewriteData.rows?.slice(0,500),fields:rewriteData.fields,
            duration:rewriteData.duration_ms,confidence:rewriteData.confidence,
            assumptions:rewriteData.assumptions,timestamp:new Date(),rewritten:true
          }
          setConversations(prev=>prev.map(c=>c.id===activeId?{...c,messages:[...c.messages,assistantMsg],updatedAt:new Date()}:c))
          return
        }
      }

      if(!res.ok){
        const errMsg:ConvMessage={id:`m${Date.now()}`,role:'assistant',content:data.error||'Query failed',timestamp:new Date()}
        setConversations(prev=>prev.map(c=>c.id===activeId?{...c,messages:[...c.messages,errMsg],updatedAt:new Date()}:c))
        return
      }

      const assistantMsg:ConvMessage={
        id:`m${Date.now()}a`,role:'assistant',
        content:`Returned ${data.rows?.length||0} rows in ${data.duration_ms}ms`,
        sql:formatSQL(data.sql),rows:data.rows?.slice(0,500),fields:data.fields,duration:data.duration_ms,
        confidence:data.confidence,assumptions:data.assumptions,
        uncertainAbout:data.uncertain_about,suggestedClarification:data.suggested_clarification,
        timestamp:new Date()
      }
      setConversations(prev=>prev.map(c=>c.id===activeId?{...c,messages:[...c.messages,assistantMsg],updatedAt:new Date()}:c))
    }catch(e:any){
      clearInterval(st)
      if(e.name!=='AbortError'){
        const errMsg:ConvMessage={id:`m${Date.now()}`,role:'assistant',content:e.message,timestamp:new Date()}
        setConversations(prev=>prev.map(c=>c.id===activeId?{...c,messages:[...c.messages,errMsg],updatedAt:new Date()}:c))
      }
    }finally{setLoading(false);abortRef.current=null}
  }

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth'})},[activeConv.messages.length])
  const addMemory=(note:string)=>{if(!note.trim())return;setMemoryNotes(prev=>[...prev,note.trim()]);setMemInput('')}

  return(
    <div style={{flex:1,display:'flex',overflow:'hidden'}}>
      {/* Conversation sidebar */}
      <div style={{width:232,background:'#fff',borderRight:`1px solid ${C.cardBorder}`,display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'12px 14px',borderBottom:`1px solid ${C.cardBorder}`}}>
          <button onClick={newConversation} style={{width:'100%',background:C.accent,color:'#fff',border:'none',borderRadius:7,padding:'8px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>+ New conversation</button>
        </div>
        <div style={{flex:1,overflowY:'auto'}}>
          {conversations.map(c=>(
            <div key={c.id} onClick={()=>setActiveId(c.id)}
              style={{padding:'9px 14px',cursor:'pointer',borderBottom:`1px solid ${C.cardBorder}`,background:c.id===activeId?C.accentBg:'transparent'}}
              onMouseOver={e=>{if(c.id!==activeId)e.currentTarget.style.background='#F8FAFD'}} onMouseOut={e=>{if(c.id!==activeId)e.currentTarget.style.background='transparent'}}>
              <div style={{fontSize:12.5,fontWeight:c.id===activeId?600:400,color:c.id===activeId?C.accent:C.text,marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.title}</div>
              <div style={{fontSize:10.5,color:C.textLight}}>{c.messages.length} msg · {c.updatedAt.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</div>
            </div>
          ))}
        </div>
        {memoryNotes.length>0&&(
          <div style={{padding:'9px 14px',borderTop:`1px solid ${C.cardBorder}`,background:'#FFFBEB'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
              <span style={{fontSize:10,fontWeight:600,color:'#92400E',textTransform:'uppercase',letterSpacing:'0.05em'}}>Session memory ({memoryNotes.length})</span>
              <button onClick={()=>setShowMem(s=>!s)} style={{fontSize:10,color:'#D97706',background:'none',border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{showMem?'hide':'show'}</button>
            </div>
            {showMem&&memoryNotes.map((n,i)=><div key={i} style={{fontSize:11,color:'#92400E',marginBottom:2,paddingLeft:6,borderLeft:'2px solid #FDE68A',lineHeight:1.4}}>{n}</div>)}
          </div>
        )}
      </div>

      {/* Main chat area */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{padding:'9px 20px',borderBottom:`1px solid ${C.cardBorder}`,background:'#fff',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
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
                    style={{background:'#fff',border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:'8px 14px',fontSize:13,color:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif'}}
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
                  {msg.rewritten&&<div style={{fontSize:11.5,color:'#D97706',background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:6,padding:'4px 10px',marginBottom:6,display:'inline-block'}}>Your SQL had an error — Qwezy rewrote it to fix it</div>}
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
                  <div key={s} style={{display:'flex',alignItems:'center',gap:7,marginBottom:i<STEPS.length-1?6:0,opacity:i<=statusStep?1:.2}}>
                    {i<statusStep?<div style={{width:10,height:10,borderRadius:'50%',background:C.success,flexShrink:0}}/>
                      :i===statusStep?<div style={{width:10,height:10,border:`2px solid ${C.cardBorder}`,borderTop:`2px solid ${C.accent}`,borderRadius:'50%',flexShrink:0,animation:'spin .8s linear infinite'}}/>
                      :<div style={{width:10,height:10,borderRadius:'50%',border:`1.5px solid ${C.cardBorder}`,flexShrink:0}}/>}
                    <span style={{fontSize:12.5,color:i===statusStep?C.text:C.textLight}}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Input area */}
        <div style={{padding:'12px 20px',borderTop:`1px solid ${C.cardBorder}`,background:'#fff',flexShrink:0}}>
          {queryMode==='sql'&&(
            <div style={{marginBottom:8}}>
              <SQLEditor value={directSQL} onChange={setDirectSQL} onRun={sql=>sendMessage(undefined,sql)} height={sqlHeight}/>
              <div onMouseDown={startDrag} style={{height:8,cursor:'ns-resize',display:'flex',alignItems:'center',justifyContent:'center',margin:'3px 0'}}>
                <div style={{width:32,height:3,borderRadius:2,background:C.cardBorder}}/>
              </div>
              <div style={{fontSize:11,color:C.textLight,marginBottom:6}}>Write your own SQL — if it has errors, Qwezy will automatically rewrite and fix it for you</div>
            </div>
          )}
          <div style={{display:'flex',gap:8,alignItems:'flex-end'}}>
            <div style={{flex:1,background:'#F8FAFD',borderRadius:9,border:`1px solid ${C.cardBorder}`,overflow:'hidden'}}>
              <textarea value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&queryMode==='nl'){e.preventDefault();sendMessage()}}}
                placeholder={queryMode==='sql'?'Describe what to query — Qwezy will help complete or fix the SQL above…':'Ask a question… (Enter to send, Shift+Enter for new line)'}
                style={{width:'100%',padding:'10px 13px',fontSize:13.5,color:C.text,background:'transparent',border:'none',resize:'none',minHeight:44,maxHeight:120,fontFamily:queryMode==='sql'?"'JetBrains Mono', monospace":'Inter,sans-serif',lineHeight:1.5}}/>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:5,flexShrink:0}}>
              <button onClick={()=>setQueryMode(m=>m==='nl'?'sql':'nl')}
                style={{background:queryMode==='sql'?C.accentBg:'#F0F4F8',color:queryMode==='sql'?C.accent:C.textMuted,border:`1px solid ${queryMode==='sql'?C.accent:C.cardBorder}`,borderRadius:6,padding:'5px 10px',fontSize:11.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',whiteSpace:'nowrap'}}>
                {queryMode==='sql'?'SQL mode':'SQL'}
              </button>
              {loading
                ?<button onClick={stopQuery} style={{background:'#FEF2F2',color:C.danger,border:`1px solid #FECACA`,borderRadius:8,padding:'8px 12px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Stop</button>
                :<button onClick={()=>queryMode==='sql'?sendMessage(undefined,directSQL+(input.trim()?'\n-- '+input:'')):sendMessage()} disabled={!input.trim()&&queryMode==='nl'}
                  style={{background:(!input.trim()&&queryMode==='nl')?'#E3EAF2':C.accent,color:(!input.trim()&&queryMode==='nl')?C.textLight:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:13.5,fontWeight:600,cursor:(!input.trim()&&queryMode==='nl')?'default':'pointer',fontFamily:'Inter,sans-serif'}}>
                  {queryMode==='sql'?'Run':'Send'}
                </button>}
            </div>
          </div>
          <div style={{fontSize:10.5,color:C.textLight,marginTop:5}}>
            {queryMode==='nl'?'Enter to send · Shift+Enter for new line':'SQL mode · Ctrl+Enter to run · errors auto-fixed by Qwezy AI'}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Builder Tab — Drag & Drop ─────────────────────────────────────────────────
type BuilderCol = {n:string,t:string,table:string,team:string}
type BuilderFilter = {id:string,col:string,op:string,val:string}
type BuilderOrderBy = {col:string,dir:'ASC'|'DESC'}

const FILTER_OPS = ['=','!=','>','<','>=','<=','LIKE','NOT LIKE','IS NULL','IS NOT NULL']

function buildSQL(
  selCols: BuilderCol[],
  filters: BuilderFilter[],
  groupBys: BuilderCol[],
  orderBys: BuilderOrderBy[],
  limit: number|''
): string {
  if (selCols.length === 0) return ''
  
  // Determine tables needed
  const tables = Array.from(new Set(selCols.map(c=>c.table)))
  const primaryTable = tables[0]
  
  // Find joins
  const joins: string[] = []
  tables.slice(1).forEach(tbl => {
    const tblDef = TABLES.find(t=>t.name===tbl)
    const primaryDef = TABLES.find(t=>t.name===primaryTable)
    // Check if primary joins to this table
    const j1 = primaryDef?.joins.find(j=>j.to===tbl)
    if(j1) {
      joins.push(`JOIN ${tbl} ON ${primaryTable}.${j1.on} = ${tbl}.${j1.on}`)
      return
    }
    // Check if this table joins to primary
    const j2 = tblDef?.joins.find(j=>j.to===primaryTable)
    if(j2) {
      joins.push(`JOIN ${tbl} ON ${tbl}.${j2.on} = ${primaryTable}.${j2.on}`)
      return
    }
    // Try to find path through another table
    joins.push(`JOIN ${tbl} ON true -- check join condition`)
  })
  
  const selectCols = selCols.map(c => `${c.table}.${c.n}`).join(',\n  ')
  const fromClause = primaryTable
  const joinClause = joins.length > 0 ? '\n' + joins.join('\n') : ''
  
  const activeFilters = filters.filter(f=>f.col&&f.val!==''&&!['IS NULL','IS NOT NULL'].includes(f.op))
  const nullFilters = filters.filter(f=>f.col&&['IS NULL','IS NOT NULL'].includes(f.op))
  const allFilters = [
    ...activeFilters.map(f=>`${f.col} ${f.op} '${f.val}'`),
    ...nullFilters.map(f=>`${f.col} ${f.op}`)
  ]
  const whereClause = allFilters.length > 0 ? `\nWHERE ${allFilters.join('\n  AND ')}` : ''
  
  const groupByClause = groupBys.length > 0 ? `\nGROUP BY ${groupBys.map(c=>`${c.table}.${c.n}`).join(', ')}` : ''
  const orderByClause = orderBys.length > 0 ? `\nORDER BY ${orderBys.map(o=>`${o.col} ${o.dir}`).join(', ')}` : ''
  const limitClause = limit !== '' && limit > 0 ? `\nLIMIT ${limit}` : ''
  
  return `SELECT\n  ${selectCols}\nFROM ${fromClause}${joinClause}${whereClause}${groupByClause}${orderByClause}${limitClause}`
}

function BuilderTab() {
  const [colSearch,setColSearch]=useState('')
  const [selCols,setSelCols]=useState<BuilderCol[]>([])
  const [groupBys,setGroupBys]=useState<BuilderCol[]>([])
  const [orderBys,setOrderBys]=useState<BuilderOrderBy[]>([])
  const [filters,setFilters]=useState<BuilderFilter[]>([])
  const [limit,setLimit]=useState<number|''>(100)
  const [rows,setRows]=useState<any[]>([])
  const [fields,setFields]=useState<string[]>([])
  const [running,setRunning]=useState(false)
  const [error,setError]=useState('')
  const [showSQL,setShowSQL]=useState(false)
  const [sqlCopied,setSqlCopied]=useState(false)
  const [panelWidth,setPanelWidth]=useState(220)
  const [resultsHeight,setResultsHeight]=useState(280)
  const dragPanel=useRef(false)
  const dragResults=useRef(false)
  const abortRef=useRef<AbortController|null>(null)

  const builderCols=useMemo(()=>{
    const q=colSearch.toLowerCase()
    return ALL_COLS.filter(c=>!q||c.n.includes(q)||c.table.includes(q))
  },[colSearch])

  const generatedSQL = useMemo(()=>buildSQL(selCols,filters,groupBys,orderBys,limit),[selCols,filters,groupBys,orderBys,limit])

  const addCol=(col:BuilderCol)=>{
    if(!selCols.find(c=>c.n===col.n&&c.table===col.table)) setSelCols(p=>[...p,col])
  }

  const removeCol=(col:BuilderCol)=>{
    setSelCols(p=>p.filter(c=>!(c.n===col.n&&c.table===col.table)))
    setGroupBys(p=>p.filter(c=>!(c.n===col.n&&c.table===col.table)))
    setOrderBys(p=>p.filter(o=>o.col!==`${col.table}.${col.n}`))
  }

  const addFilter=()=>setFilters(p=>[...p,{id:Date.now().toString(),col:selCols[0]?`${selCols[0].table}.${selCols[0].n}`:'',op:'=',val:''}])
  const removeFilter=(id:string)=>setFilters(p=>p.filter(f=>f.id!==id))
  const updateFilter=(id:string,key:string,val:string)=>setFilters(p=>p.map(f=>f.id===id?{...f,[key]:val}:f))

  const toggleGroupBy=(col:BuilderCol)=>{
    setGroupBys(p=>p.find(c=>c.n===col.n&&c.table===col.table)?p.filter(c=>!(c.n===col.n&&c.table===col.table)):[...p,col])
  }

  const toggleOrderBy=(colStr:string)=>{
    const existing=orderBys.find(o=>o.col===colStr)
    if(existing) {
      if(existing.dir==='ASC') setOrderBys(p=>p.map(o=>o.col===colStr?{...o,dir:'DESC'}:o))
      else setOrderBys(p=>p.filter(o=>o.col!==colStr))
    } else {
      setOrderBys(p=>[...p,{col:colStr,dir:'ASC'}])
    }
  }

  const runQuery=async()=>{
    if(!generatedSQL) return
    setRunning(true);setError('')
    const ctrl=new AbortController();abortRef.current=ctrl
    try{
      const res=await fetch('/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customSQL:generatedSQL}),signal:ctrl.signal})
      const data=await res.json()
      if(data.error){setError(data.error)}
      else{setRows(data.rows||[]);setFields(data.fields||[])}
    }catch(e:any){if(e.name!=='AbortError')setError(e.message)
    }finally{setRunning(false);abortRef.current=null}
  }

  const stopQuery=()=>{abortRef.current?.abort();setRunning(false)}

  const copySQL=()=>{navigator.clipboard?.writeText(generatedSQL);setSqlCopied(true);setTimeout(()=>setSqlCopied(false),1600)}

  // Panel resize
  const startPanelDrag=(e:React.MouseEvent)=>{
    dragPanel.current=true
    const startX=e.clientX, startW=panelWidth
    const move = (ev: MouseEvent) => {
      if (dragPanel.current) {
        setPanelWidth(
          Math.max(160, Math.min(360, startW + (ev.clientX - startX)))
        )
      }
    }
    const up=()=>{dragPanel.current=false;window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up)}
    window.addEventListener('mousemove',move);window.addEventListener('mouseup',up)
  }

  // Results resize
  const startResultsDrag=(e:React.MouseEvent)=>{
    dragResults.current=true
    const startY=e.clientY, startH=resultsHeight
    const move=(ev:MouseEvent)=>{if(dragResults.current)setResultsHeight(Math.max(120,Math.min(600,startH-(ev.clientY-startY))))}
    const up=()=>{dragResults.current=false;window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up)}
    window.addEventListener('mousemove',move);window.addEventListener('mouseup',up)
  }

  const colColStr=(col:BuilderCol)=>`${col.table}.${col.n}`

  return(
    <div style={{flex:1,display:'flex',overflow:'hidden',background:C.bg}}>
      {/* Column sidebar */}
      <div style={{width:panelWidth,background:'#fff',borderRight:`1px solid ${C.sidebarBorder}`,display:'flex',flexDirection:'column',flexShrink:0,position:'relative'}}>
        <div style={{padding:'9px 9px 6px',borderBottom:`1px solid ${C.sidebarBorder}`,background:'#FAFCFE'}}>
          <div style={{fontSize:9.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5}}>Drag or click to add</div>
          <input value={colSearch} onChange={e=>setColSearch(e.target.value)} placeholder="Search columns…"
            style={{width:'100%',padding:'4px 8px',borderRadius:5,border:`1px solid ${C.sidebarBorder}`,fontSize:12,color:C.text,background:C.bg,fontFamily:'Inter,sans-serif'}}/>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'5px 7px'}}>
          {TABLES.map(tbl=>{
            const tblCols=builderCols.filter(c=>c.table===tbl.name)
            if(tblCols.length===0) return null
            return(
              <div key={tbl.name} style={{marginBottom:8}}>
                <div style={{fontSize:9.5,fontWeight:700,color:tbl.color,textTransform:'uppercase',letterSpacing:'0.06em',padding:'4px 6px',marginBottom:2}}>{tbl.name}</div>
                {tblCols.map((col,i)=>{
                  const selected=!!selCols.find(c=>c.n===col.n&&c.table===col.table)
                  return(
                    <div key={i}
                      draggable
                      onDragStart={e=>{e.dataTransfer.setData('col',JSON.stringify(col));e.dataTransfer.effectAllowed='copy'}}
                      onClick={()=>selected?removeCol(col):addCol(col)}
                      style={{display:'flex',alignItems:'center',gap:6,padding:'5px 6px',borderRadius:5,marginBottom:1,
                        background:selected?C.accentBg:C.bg,cursor:'pointer',border:selected?`1px solid ${C.accent}44`:'1px solid transparent'}}
                      onMouseOver={e=>!selected&&(e.currentTarget.style.background='#F0F7FF')}
                      onMouseOut={e=>!selected&&(e.currentTarget.style.background=C.bg)}>
                      <span style={{width:6,height:6,borderRadius:'50%',background:TC[col.t],display:'inline-block',flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,fontWeight:500,color:selected?C.accent:C.text,fontFamily:"'JetBrains Mono'",overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{col.n}</div>
                      </div>
                      {selected?<span style={{color:C.accent,fontSize:11,fontWeight:700}}>✓</span>:<span style={{color:C.textLight,fontSize:13}}>+</span>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
        {/* Panel resize handle */}
        <div onMouseDown={startPanelDrag} style={{position:'absolute',right:0,top:0,bottom:0,width:5,cursor:'ew-resize',zIndex:10}}
          onMouseOver={e=>e.currentTarget.style.background='rgba(5,150,105,0.2)'}
          onMouseOut={e=>e.currentTarget.style.background='transparent'}/>
      </div>

      {/* Builder canvas */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {/* Top toolbar */}
        <div style={{padding:'10px 16px',borderBottom:`1px solid ${C.sidebarBorder}`,background:'#fff',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',flexShrink:0}}>
          <span style={{fontSize:13,fontWeight:600,color:C.text}}>Query Builder</span>
          <div style={{flex:1}}/>
          {generatedSQL&&(
            <>
              <button onClick={()=>setShowSQL(s=>!s)}
                style={{fontSize:12.5,padding:'5px 12px',borderRadius:6,border:`1px solid ${C.cardBorder}`,background:'#fff',color:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                {showSQL?'Hide SQL':'View SQL'}
              </button>
              {running
                ?<button onClick={stopQuery} style={{fontSize:12.5,padding:'5px 14px',borderRadius:6,border:`1px solid #FECACA`,background:'#FEF2F2',color:C.danger,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:600}}>Stop</button>
                :<button onClick={runQuery} style={{fontSize:12.5,padding:'5px 18px',borderRadius:6,border:'none',background:C.accent,color:'#fff',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:600}}>
                  {running?'Running…':'Run query'}
                </button>}
            </>
          )}
        </div>

        {/* SQL popup */}
        {showSQL&&generatedSQL&&(
          <div style={{margin:'10px 16px',background:C.codeBg,borderRadius:8,border:'1px solid #21262D',overflow:'hidden',flexShrink:0}}>
            <div style={{padding:'7px 12px',borderBottom:'1px solid #21262D',display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontFamily:"'JetBrains Mono'",fontSize:10.5,color:'#8B949E',flex:1}}>Generated SQL</span>
              <button onClick={copySQL} style={{fontSize:11,padding:'2px 9px',borderRadius:4,border:'1px solid #30363D',background:'transparent',color:sqlCopied?'#3FB950':'#8B949E',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{sqlCopied?'Copied':'Copy'}</button>
              <button onClick={()=>setShowSQL(false)} style={{fontSize:13,background:'none',border:'none',color:'#8B949E',cursor:'pointer'}}>×</button>
            </div>
            <pre style={{fontFamily:"'JetBrains Mono'",fontSize:12,color:'#E6EDF3',padding:'12px 14px',margin:0,overflowX:'auto',maxHeight:200}}>{generatedSQL}</pre>
          </div>
        )}

        <div style={{flex:1,overflowY:'auto',padding:'12px 16px',display:'flex',flexDirection:'column',gap:12}}>
          {/* Selected columns */}
          <div style={{background:'#fff',borderRadius:8,border:`1px solid ${C.cardBorder}`,overflow:'hidden'}}>
            <div style={{padding:'8px 12px',borderBottom:`1px solid ${C.cardBorder}`,background:C.tableHead,fontSize:10.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span>Selected columns ({selCols.length})</span>
              {selCols.length>0&&<button onClick={()=>setSelCols([])} style={{fontSize:10.5,color:C.danger,background:'none',border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Clear all</button>}
            </div>
            <div style={{padding:'10px 12px',minHeight:48,display:'flex',flexWrap:'wrap',gap:6}}
              onDragOver={e=>e.preventDefault()}
              onDrop={e=>{try{const col=JSON.parse(e.dataTransfer.getData('col'));addCol(col)}catch{}}}>
              {selCols.length===0
                ?<div style={{fontSize:12.5,color:C.textLight,padding:'4px 0'}}>Drag or click columns from the left panel to add them here</div>
                :selCols.map((col,i)=>(
                  <div key={i} style={{background:C.accentBg,border:`1px solid ${C.accent}44`,borderRadius:6,padding:'4px 10px',display:'flex',alignItems:'center',gap:6}}>
                    <span style={{width:6,height:6,borderRadius:'50%',background:TC[col.t],display:'inline-block',flexShrink:0}}/>
                    <span style={{fontFamily:"'JetBrains Mono'",fontSize:11.5,color:C.text}}>{col.table}.{col.n}</span>
                    <button onClick={()=>removeCol(col)} style={{background:'none',border:'none',color:C.textLight,cursor:'pointer',fontSize:14,lineHeight:1,padding:0,marginLeft:2}}>×</button>
                  </div>
                ))}
            </div>
          </div>

          {selCols.length>0&&(
            <>
              {/* Filters */}
              <div style={{background:'#fff',borderRadius:8,border:`1px solid ${C.cardBorder}`,overflow:'hidden'}}>
                <div style={{padding:'8px 12px',borderBottom:filters.length>0?`1px solid ${C.cardBorder}`:'none',background:C.tableHead,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:10.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em'}}>Filters ({filters.length})</span>
                  <button onClick={addFilter} style={{fontSize:11.5,color:C.accent,background:C.accentBg,border:`1px solid ${C.accent}33`,borderRadius:5,padding:'3px 9px',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:500}}>+ Add filter</button>
                </div>
                {filters.map(f=>(
                  <div key={f.id} style={{display:'flex',gap:8,padding:'8px 12px',borderBottom:`1px solid ${C.cardBorder}`,alignItems:'center',flexWrap:'wrap'}}>
                    <select value={f.col} onChange={e=>updateFilter(f.id,'col',e.target.value)}
                      style={{padding:'5px 8px',borderRadius:5,border:`1px solid ${C.cardBorder}`,fontSize:12,color:C.text,fontFamily:"'JetBrains Mono'",background:'#fff',cursor:'pointer'}}>
                      {selCols.map(c=><option key={colColStr(c)} value={colColStr(c)}>{colColStr(c)}</option>)}
                    </select>
                    <select value={f.op} onChange={e=>updateFilter(f.id,'op',e.target.value)}
                      style={{padding:'5px 8px',borderRadius:5,border:`1px solid ${C.cardBorder}`,fontSize:12,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff',cursor:'pointer'}}>
                      {FILTER_OPS.map(op=><option key={op}>{op}</option>)}
                    </select>
                    {!['IS NULL','IS NOT NULL'].includes(f.op)&&(
                      <input value={f.val} onChange={e=>updateFilter(f.id,'val',e.target.value)} placeholder="value"
                        style={{flex:1,minWidth:80,padding:'5px 8px',borderRadius:5,border:`1px solid ${C.cardBorder}`,fontSize:12,color:C.text,fontFamily:'Inter,sans-serif'}}/>
                    )}
                    <button onClick={()=>removeFilter(f.id)} style={{background:'none',border:'none',color:C.textLight,cursor:'pointer',fontSize:16,lineHeight:1,padding:0,flexShrink:0}}>×</button>
                  </div>
                ))}
                {filters.length===0&&<div style={{padding:'8px 12px',fontSize:12,color:C.textLight}}>No filters — showing all rows</div>}
              </div>

              {/* Group by + Order by + Limit */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 120px',gap:10}}>
                <div style={{background:'#fff',borderRadius:8,border:`1px solid ${C.cardBorder}`,overflow:'hidden'}}>
                  <div style={{padding:'7px 12px',borderBottom:`1px solid ${C.cardBorder}`,background:C.tableHead,fontSize:10.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em'}}>Group by</div>
                  <div style={{padding:'8px 12px',display:'flex',flexWrap:'wrap',gap:4}}>
                    {selCols.map((col,i)=>{
                      const active=!!groupBys.find(c=>c.n===col.n&&c.table===col.table)
                      return(
                        <button key={i} onClick={()=>toggleGroupBy(col)}
                          style={{fontSize:11,padding:'3px 9px',borderRadius:5,border:'1px solid',cursor:'pointer',fontFamily:"'JetBrains Mono'",
                            borderColor:active?C.accent:C.cardBorder,background:active?C.accentBg:'#F8FAFD',color:active?C.accent:C.textLight,fontWeight:active?600:400}}>
                          {col.n}
                        </button>
                      )
                    })}
                    {selCols.length===0&&<span style={{fontSize:12,color:C.textLight}}>Add columns first</span>}
                  </div>
                </div>
                <div style={{background:'#fff',borderRadius:8,border:`1px solid ${C.cardBorder}`,overflow:'hidden'}}>
                  <div style={{padding:'7px 12px',borderBottom:`1px solid ${C.cardBorder}`,background:C.tableHead,fontSize:10.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em'}}>Order by</div>
                  <div style={{padding:'8px 12px',display:'flex',flexWrap:'wrap',gap:4}}>
                    {selCols.map((col,i)=>{
                      const colStr=colColStr(col)
                      const ob=orderBys.find(o=>o.col===colStr)
                      return(
                        <button key={i} onClick={()=>toggleOrderBy(colStr)}
                          style={{fontSize:11,padding:'3px 9px',borderRadius:5,border:'1px solid',cursor:'pointer',fontFamily:"'JetBrains Mono'",
                            borderColor:ob?C.accent:C.cardBorder,background:ob?C.accentBg:'#F8FAFD',color:ob?C.accent:C.textLight,fontWeight:ob?600:400}}>
                          {col.n}{ob?` ${ob.dir==='ASC'?'↑':'↓'}`:''}
                        </button>
                      )
                    })}
                    {selCols.length===0&&<span style={{fontSize:12,color:C.textLight}}>Add columns first</span>}
                  </div>
                </div>
                <div style={{background:'#fff',borderRadius:8,border:`1px solid ${C.cardBorder}`,overflow:'hidden'}}>
                  <div style={{padding:'7px 12px',borderBottom:`1px solid ${C.cardBorder}`,background:C.tableHead,fontSize:10.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em'}}>Limit</div>
                  <div style={{padding:'8px 12px'}}>
                    <input type="number" value={limit} onChange={e=>setLimit(e.target.value===''?'':parseInt(e.target.value))} min={0} max={50000} placeholder="No limit"
                      style={{width:'100%',padding:'5px 8px',borderRadius:5,border:`1px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif'}}/>
                  </div>
                </div>
              </div>
            </>
          )}

          {selCols.length===0&&(
            <div style={{textAlign:'center',paddingTop:40,color:C.textLight}}>
              <div style={{fontSize:36,marginBottom:12}}>⬅</div>
              <div style={{fontSize:14,fontWeight:500,color:C.text,marginBottom:6}}>Start by selecting columns</div>
              <div style={{fontSize:13}}>Drag or click columns from the panel on the left</div>
            </div>
          )}
        </div>

        {/* Results */}
        {(rows.length>0||error)&&(
          <div style={{flexShrink:0,borderTop:`1px solid ${C.cardBorder}`}}>
            <div onMouseDown={startResultsDrag} style={{height:6,cursor:'ns-resize',background:'#F0F4F8',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <div style={{width:40,height:3,borderRadius:2,background:C.cardBorder}}/>
            </div>
            <div style={{height:resultsHeight,overflow:'auto',background:'#fff'}}>
              <div style={{padding:'8px 16px',borderBottom:`1px solid ${C.cardBorder}`,fontSize:11.5,color:C.textLight,background:C.tableHead}}>
                {rows.length} rows returned
              </div>
              {error&&<div style={{padding:14,color:C.danger,background:'#FEF2F2',fontSize:13}}>{error}</div>}
              {rows.length>0&&<ResultsTable rows={rows} fields={fields}/>}
            </div>
          </div>
        )}
        {running&&!rows.length&&(
          <div style={{padding:'12px 16px',borderTop:`1px solid ${C.cardBorder}`,display:'flex',alignItems:'center',gap:7,background:'#fff',flexShrink:0}}>
            <div style={{width:11,height:11,border:`2px solid ${C.cardBorder}`,borderTop:`2px solid ${C.accent}`,borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
            <span style={{fontSize:12.5,color:C.textMuted}}>Running query…</span>
            <button onClick={stopQuery} style={{fontSize:12,color:C.danger,background:'none',border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif',marginLeft:8}}>Stop</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Email Modal ───────────────────────────────────────────────────────────────
function EmailModal({report,rows,fields,onClose}:{report:any,rows:any[],fields:string[],onClose:()=>void}) {
  const [recipientInput,setRecipientInput]=useState('')
  const [recipients,setRecipients]=useState<string[]>(['team@company.com'])
  const [subject,setSubject]=useState(`${report.name} — ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}`)
  const [note,setNote]=useState('')
  const [view,setView]=useState<'compose'|'preview'>('compose')
  const [sent,setSent]=useState(false)
  const previewRows=rows.slice(0,8)
  const inputRef=useRef<HTMLInputElement>(null)

  const addRecipient=(val:string)=>{
    const parts=val.split(/[,;\s]+/).map(s=>s.trim()).filter(s=>s.includes('@'))
    if(parts.length){setRecipients(prev=>Array.from(new Set([...prev,...parts])));setRecipientInput('')}
  }
  const removeRecipient=(r:string)=>setRecipients(prev=>prev.filter(e=>e!==r))
  const handleRecipientKey=(e:React.KeyboardEvent<HTMLInputElement>)=>{
    if(['Enter','Tab',',',';'].includes(e.key)){e.preventDefault();addRecipient(recipientInput)}
    if(e.key==='Backspace'&&!recipientInput&&recipients.length>0) setRecipients(prev=>prev.slice(0,-1))
  }

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(15,25,35,0.65)',zIndex:400,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'#fff',borderRadius:12,width:'100%',maxWidth:660,maxHeight:'92vh',display:'flex',flexDirection:'column',boxShadow:'0 24px 64px rgba(0,0,0,0.25)',overflow:'hidden'}}>
        {/* Header */}
        <div style={{padding:'14px 20px',borderBottom:`1px solid ${C.cardBorder}`,display:'flex',alignItems:'center',gap:10}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:15,color:C.text}}>Email report</div>
            <div style={{fontSize:12,color:C.textLight,marginTop:1}}>{report.name}</div>
          </div>
          <div style={{display:'flex',gap:6}}>
            {(['compose','preview'] as const).map(v=>(
              <button key={v} onClick={()=>setView(v)}
                style={{fontSize:12.5,padding:'5px 14px',borderRadius:6,border:'1.5px solid',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:500,textTransform:'capitalize',
                  borderColor:view===v?C.accent:C.cardBorder,background:view===v?C.accentBg:'#fff',color:view===v?C.accent:C.textMuted}}>
                {v==='compose'?'Compose':'Preview email'}
              </button>
            ))}
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,color:C.textLight,cursor:'pointer',marginLeft:4}}>×</button>
        </div>

        {sent?(
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:40,textAlign:'center'}}>
            <div style={{width:64,height:64,borderRadius:'50%',background:C.accentBg,border:`2px solid ${C.accent}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,marginBottom:20}}>✓</div>
            <div style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:8}}>Report sent</div>
            <div style={{fontSize:13.5,color:C.textMuted,marginBottom:6}}>Delivered to {recipients.length} recipient{recipients.length!==1?'s':''}</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5,justifyContent:'center',marginBottom:24,maxWidth:400}}>
              {recipients.map(r=><span key={r} style={{background:C.accentBg,color:C.accent,fontSize:12,padding:'2px 9px',borderRadius:4,border:`1px solid ${C.accent}33`}}>{r}</span>)}
            </div>
            <button onClick={onClose} style={{background:C.accent,color:'#fff',border:'none',borderRadius:8,padding:'10px 24px',fontSize:13.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Done</button>
          </div>
        ):view==='compose'?(
          <div style={{flex:1,overflowY:'auto',padding:'20px 24px',display:'flex',flexDirection:'column',gap:16}}>
            {/* Recipients */}
            <div>
              <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>To</div>
              <div onClick={()=>inputRef.current?.focus()}
                style={{minHeight:44,padding:'6px 10px',borderRadius:8,border:`1.5px solid ${C.cardBorder}`,cursor:'text',display:'flex',flexWrap:'wrap',gap:5,alignItems:'center'}}
                onFocus={e=>(e.currentTarget.style.borderColor=C.accent)} onBlur={e=>(e.currentTarget.style.borderColor=C.cardBorder)}>
                {recipients.map(r=>(
                  <span key={r} style={{background:C.accentBg,color:C.accent,fontSize:12.5,padding:'3px 8px',borderRadius:5,border:`1px solid ${C.accent}33`,display:'flex',alignItems:'center',gap:5}}>
                    {r}
                    <button onClick={()=>removeRecipient(r)} style={{background:'none',border:'none',color:C.accent,cursor:'pointer',fontSize:13,lineHeight:1,padding:0,opacity:.7}}>×</button>
                  </span>
                ))}
                <input ref={inputRef} value={recipientInput} onChange={e=>setRecipientInput(e.target.value)} onKeyDown={handleRecipientKey} onBlur={()=>recipientInput&&addRecipient(recipientInput)}
                  placeholder={recipients.length===0?'Enter email addresses…':'Add more…'}
                  style={{flex:1,minWidth:140,border:'none',outline:'none',fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif',background:'transparent'}}/>
              </div>
              <div style={{fontSize:11,color:C.textLight,marginTop:4}}>Press Enter, Tab, or comma to add · Paste multiple addresses at once</div>
            </div>

            {/* Subject */}
            <div>
              <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>Subject</div>
              <input value={subject} onChange={e=>setSubject(e.target.value)}
                style={{width:'100%',padding:'9px 12px',borderRadius:8,border:`1.5px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif'}}
                onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
            </div>

            {/* Personal note */}
            <div>
              <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>Personal note <span style={{fontWeight:400,textTransform:'none'}}>(optional — appears at the top of the email)</span></div>
              <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3}
                placeholder="Hi team, here's the weekly report. Key highlight: revenue is up 12% this month. Let me know if you have questions."
                style={{width:'100%',padding:'9px 12px',borderRadius:8,border:`1.5px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif',resize:'vertical',lineHeight:1.6}}
                onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
            </div>

            {/* Data preview */}
            <div style={{background:'#F8FAFD',border:`1px solid ${C.cardBorder}`,borderRadius:8,overflow:'hidden'}}>
              <div style={{padding:'8px 12px',borderBottom:`1px solid ${C.cardBorder}`,fontSize:11.5,fontWeight:600,color:C.text,display:'flex',justifyContent:'space-between'}}>
                <span>Data preview</span>
                <span style={{color:C.textLight,fontWeight:400}}>{rows.length} rows total · showing first 8</span>
              </div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead><tr style={{background:'#022c22'}}>{fields.map(f=><th key={f} style={{padding:'7px 10px',textAlign:'left',color:'#fff',fontWeight:600,fontSize:10.5,textTransform:'uppercase',letterSpacing:'0.04em',whiteSpace:'nowrap'}}>{f.replace(/_/g,' ')}</th>)}</tr></thead>
                  <tbody>{previewRows.map((row,i)=><tr key={i} style={{background:i%2===0?'#fff':'#F8FAFD',borderBottom:`1px solid ${C.cardBorder}`}}>{fields.map(f=><td key={f} style={{padding:'6px 10px',color:C.text,whiteSpace:'nowrap'}}>{String(row[f]??'')}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </div>
          </div>
        ):(
          /* Email preview — professional branded template */
          <div style={{flex:1,overflowY:'auto',padding:20,background:'#F4F6F9'}}>
            <div style={{maxWidth:540,margin:'0 auto',background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 2px 12px rgba(0,0,0,0.08)'}}>
              {/* Email header */}
              <div style={{background:'#022c22',padding:'20px 28px',display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:32,height:32,background:'linear-gradient(135deg,#10B981,#059669)',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:'#fff',fontFamily:'monospace',fontWeight:700}}>{'{ }'}</div>
                <div>
                  <div style={{color:'#fff',fontWeight:800,fontSize:17,letterSpacing:'-0.2px'}}>Qwezy</div>
                  <div style={{color:'#6EE7B7',fontSize:11,marginTop:1}}>Data Intelligence</div>
                </div>
                <div style={{marginLeft:'auto',textAlign:'right'}}>
                  <div style={{color:'rgba(255,255,255,0.5)',fontSize:11}}>{new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</div>
                </div>
              </div>
              {/* Email body */}
              <div style={{padding:'28px 32px'}}>
                <div style={{fontSize:11.5,color:C.textLight,marginBottom:4}}>To: <strong style={{color:C.text}}>{recipients.join(', ')}</strong></div>
                <div style={{fontSize:11.5,color:C.textLight,marginBottom:20}}>Subject: <strong style={{color:C.text}}>{subject}</strong></div>
                {note&&(
                  <div style={{fontSize:14,color:C.text,lineHeight:1.7,padding:'14px 16px',background:'#F8FAFD',borderLeft:`3px solid ${C.accent}`,borderRadius:'0 8px 8px 0',marginBottom:22}}>
                    {note}
                  </div>
                )}
                <div style={{fontSize:13,color:C.textMuted,marginBottom:18,lineHeight:1.65}}>
                  Your <strong style={{color:C.text}}>{report.schedule}</strong> report is ready. {rows.length} rows returned.
                </div>
                <div style={{borderRadius:8,overflow:'hidden',border:`1px solid ${C.cardBorder}`,marginBottom:22}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
                    <thead><tr style={{background:'#022c22'}}>{fields.map(f=><th key={f} style={{padding:'9px 12px',textAlign:'left',color:'#fff',fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:'0.04em'}}>{f.replace(/_/g,' ')}</th>)}</tr></thead>
                    <tbody>{previewRows.map((row,i)=><tr key={i} style={{background:i%2===0?'#fff':'#F8FAFD',borderBottom:`1px solid ${C.cardBorder}`}}>{fields.map(f=><td key={f} style={{padding:'8px 12px',color:C.text}}>{String(row[f]??'')}</td>)}</tr>)}</tbody>
                  </table>
                  {rows.length>8&&<div style={{fontSize:11,color:C.textLight,padding:'7px 12px',background:C.tableHead,borderTop:`1px solid ${C.cardBorder}`}}>Showing 8 of {rows.length} rows · full data available in Qwezy</div>}
                </div>
                <div style={{borderTop:`1px solid ${C.cardBorder}`,paddingTop:16,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontSize:11.5,color:C.textLight,lineHeight:1.6}}>
                    Sent via <strong style={{color:C.text}}>Qwezy</strong> · Scheduled {report.schedule}<br/>
                    <span style={{color:C.textLight}}>admin@qwezy.io</span>
                  </div>
                  <div style={{fontSize:10.5,color:'#CBD5E1',textAlign:'right'}}>© 2026 Qwezy Inc.</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {!sent&&(
          <div style={{padding:'12px 20px',borderTop:`1px solid ${C.cardBorder}`,display:'flex',gap:8,background:'#FAFAFA',alignItems:'center'}}>
            <div style={{fontSize:12,color:C.textLight,flex:1}}>
              {recipients.length} recipient{recipients.length!==1?'s':''} · {rows.length} rows
            </div>
            <button onClick={()=>setView(view==='compose'?'preview':'compose')}
              style={{background:'#fff',color:C.textMuted,border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:'8px 16px',fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
              {view==='compose'?'Preview email':'← Back to compose'}
            </button>
            <button onClick={()=>setSent(true)} disabled={recipients.length===0}
              style={{background:recipients.length>0?C.accent:'#E5E7EB',color:recipients.length>0?'#fff':C.textLight,border:'none',borderRadius:7,padding:'8px 24px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
              Send to {recipients.length} recipient{recipients.length!==1?'s':''}
            </button>
          </div>
        )}
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
  const [emailModal,setEmailModal]=useState<{report:any,rows:any[],fields:string[]}|null>(null)
  const [menuOpen,setMenuOpen]=useState<string|null>(null)
  const [biPanel,setBiPanel]=useState<string|null>(null)
  const [newReport,setNewReport]=useState({name:'',description:'',sql:'',schedule:'weekly',refreshHours:168,shared:true,group:'Finance'})
  const existingGroups=useMemo(()=>Array.from(new Set(reports.map((r:any)=>r.group||'General'))) as string[],[reports])

  const isStale=(report:any)=>{const cached=sharedResults[report.id];if(!cached)return true;return(Date.now()-cached.ranAt)/1000/3600>report.refreshHours}

  useEffect(()=>{
    const h=()=>setMenuOpen(null)
    if(menuOpen) window.addEventListener('click',h)
    return()=>window.removeEventListener('click',h)
  },[menuOpen])

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

  const addReport=()=>{
    if(!newReport.name||!newReport.sql) return
    const id=`r${Date.now()}`
    setReports((p:any[])=>[...p,{...newReport,id,owner:'Me',lastRun:'Never',rows:0}])
    setNewReport({name:'',description:'',sql:'',schedule:'weekly',refreshHours:168,shared:true,group:'Finance'})
    setShowNew(false)
  }

  return(
    <>
    <div style={{flex:1,overflowY:'auto',padding:'16px 20px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <div>
          <h2 style={{fontSize:17,fontWeight:700,color:C.text,marginBottom:2}}>Reports</h2>
          <p style={{fontSize:12.5,color:C.textMuted}}>Saved queries with scheduled delivery</p>
        </div>
        <button onClick={()=>setShowNew(s=>!s)} style={{background:C.accent,color:'#fff',border:'none',borderRadius:7,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>+ New report</button>
      </div>

      {showNew&&(
        <div style={{background:'#fff',borderRadius:9,border:`1.5px solid ${C.accent}`,padding:16,marginBottom:16}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            {[['name','Name','Monthly Revenue…'],['description','Description','Optional description…'],['group','Group','Finance']].map(([k,l,p])=>(
              <div key={k}>
                <div style={{fontSize:10.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:3}}>{l}</div>
                <input value={(newReport as any)[k]} onChange={e=>setNewReport(p=>({...p,[k]:e.target.value}))} placeholder={p}
                  style={{width:'100%',padding:'7px 10px',borderRadius:6,border:`1px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif'}}/>
              </div>
            ))}
            <div>
              <div style={{fontSize:10.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:3}}>Schedule</div>
              <select value={newReport.schedule} onChange={e=>setNewReport(p=>({...p,schedule:e.target.value}))}
                style={{width:'100%',padding:'7px 10px',borderRadius:6,border:`1px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff',cursor:'pointer'}}>
                {['daily','weekly','monthly','manual'].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:3}}>SQL Query</div>
            <SQLEditor value={newReport.sql} onChange={v=>setNewReport(p=>({...p,sql:v}))} height={80}/>
          </div>
          <div style={{display:'flex',gap:7}}>
            <button onClick={addReport} style={{background:C.accent,color:'#fff',border:'none',borderRadius:6,padding:'7px 16px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Save report</button>
            <button onClick={()=>setShowNew(false)} style={{background:'#F0F4F8',color:C.textMuted,border:`1px solid ${C.cardBorder}`,borderRadius:6,padding:'7px 12px',fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Cancel</button>
          </div>
        </div>
      )}

      {existingGroups.map(groupName=>{
        const groupReports=reports.filter((r:any)=>(r.group||'General')===groupName)
        return(
          <div key={groupName} style={{marginBottom:20}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
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
                  <div key={report.id} style={{background:'#fff',borderRadius:9,border:`1px solid ${C.cardBorder}`}}>
                    <div style={{padding:'12px 16px',display:'flex',alignItems:'flex-start',gap:10}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:4,flexWrap:'wrap'}}>
                          <span style={{fontWeight:600,fontSize:14.5,color:C.text}}>{report.name}</span>
                          <span style={{background:`${SCHED_COLOR[report.schedule]||'#94A3B8'}15`,color:SCHED_COLOR[report.schedule]||'#94A3B8',fontSize:10.5,fontWeight:600,padding:'2px 7px',borderRadius:4}}>{report.schedule}</span>
                          {cached&&!stale&&<span style={{background:C.greenBg,color:C.success,fontSize:10.5,fontWeight:600,padding:'2px 7px',borderRadius:4}}>Fresh</span>}
                          {cached&&stale&&<span style={{background:'#FEF3C7',color:'#D97706',fontSize:10.5,fontWeight:600,padding:'2px 7px',borderRadius:4}}>Stale</span>}
                          {!cached&&<span style={{background:'#F8FAFD',color:C.textLight,fontSize:10.5,padding:'2px 7px',borderRadius:4}}>Not run</span>}
                        </div>
                        <p style={{fontSize:12.5,color:C.textMuted,marginBottom:5}}>{report.description}</p>
                        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                          <span style={{fontSize:11,color:C.textLight}}>Last run: <strong style={{color:C.text}}>{report.lastRun}</strong></span>
                          {cached&&<span style={{fontSize:11,color:C.textLight}}>Cached: <strong style={{color:C.text}}>{ageH===0?'just now':`${ageH}h ago`}</strong></span>}
                          <span style={{fontSize:11,color:SCHED_COLOR[report.schedule]||C.textLight,fontWeight:600}}>Next: {SCHEDULE_NEXT[report.schedule]||'—'}</span>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:6,flexShrink:0,alignItems:'center'}}>
                        <button onClick={()=>runReport(report,true)} disabled={running===report.id}
                          style={{background:C.accent,color:'#fff',border:'none',borderRadius:6,padding:'6px 12px',fontSize:12.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',opacity:running===report.id?.6:1,whiteSpace:'nowrap'}}>
                          {running===report.id?'Running…':stale||!cached?'Run':'Re-run'}
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
                            style={{background:'#F0F4F8',border:`1px solid ${C.cardBorder}`,borderRadius:6,padding:'5px 10px',fontSize:17,cursor:'pointer',color:C.textMuted,lineHeight:1,fontWeight:700,letterSpacing:1}}>
                            ···
                          </button>
                          {menuOpen===report.id&&(
                            <div style={{position:'absolute',right:0,top:'calc(100% + 4px)',background:'#fff',border:`1px solid ${C.cardBorder}`,borderRadius:8,boxShadow:'0 6px 20px rgba(0,0,0,0.12)',zIndex:100,minWidth:170,overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
                              <button onClick={async()=>{
                                  setMenuOpen(null)
                                  if(!sharedResults[report.id])await runReport(report,true)
                                  const c=sharedResults[report.id]
                                  if(c)setEmailModal({report,rows:c.rows,fields:c.fields})
                                }}
                                style={{display:'flex',alignItems:'center',gap:9,width:'100%',padding:'9px 14px',background:'none',border:'none',fontSize:13,color:C.text,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left'}}
                                onMouseOver={e=>e.currentTarget.style.background='#F0F7FF'} onMouseOut={e=>e.currentTarget.style.background='none'}>
                                ✉ Email results
                              </button>
                              <button onClick={async()=>{
                                  setMenuOpen(null)
                                  if(!sharedResults[report.id])await runReport(report,true)
                                  const c=sharedResults[report.id]
                                  if(c)exportCSV(c.rows,c.fields,report.name)
                                }}
                                style={{display:'flex',alignItems:'center',gap:9,width:'100%',padding:'9px 14px',background:'none',border:'none',fontSize:13,color:C.text,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left'}}
                                onMouseOver={e=>e.currentTarget.style.background='#F0F7FF'} onMouseOut={e=>e.currentTarget.style.background='none'}>
                                ↓ Export CSV
                              </button>
                              <button onClick={()=>{setBiPanel(biPanel===report.id?null:report.id);setMenuOpen(null)}}
                                style={{display:'flex',alignItems:'center',gap:9,width:'100%',padding:'9px 14px',background:'none',border:'none',fontSize:13,color:C.text,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left'}}
                                onMouseOver={e=>e.currentTarget.style.background='#F0F7FF'} onMouseOut={e=>e.currentTarget.style.background='none'}>
                                ⚡ BI Connect
                              </button>
                              <div style={{height:1,background:C.cardBorder,margin:'3px 0'}}/>
                              <button onClick={()=>{setReports((p:any[])=>p.filter(r=>r.id!==report.id));setMenuOpen(null)}}
                                style={{display:'flex',alignItems:'center',gap:9,width:'100%',padding:'9px 14px',background:'none',border:'none',fontSize:13,color:C.danger,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left'}}
                                onMouseOver={e=>e.currentTarget.style.background='#FEF2F2'} onMouseOut={e=>e.currentTarget.style.background='none'}>
                                🗑 Delete report
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {cached&&expanded===report.id&&(
                      <div style={{borderTop:`1px solid ${C.cardBorder}`,padding:'12px 16px',background:C.bg}}>
                        <div style={{fontSize:11.5,color:C.textLight,marginBottom:7}}>{stale?'Stale — ':'Fresh — '}cached at {cached.ts} · {cached.rows.length} rows</div>
                        <ResultsTable rows={cached.rows} fields={cached.fields}/>
                      </div>
                    )}
                    {biPanel===report.id&&(
                      <div style={{borderTop:`1px solid ${C.cardBorder}`,padding:'12px 16px',background:'#F8FAFD'}}>
                        <div style={{fontSize:12.5,fontWeight:600,color:C.text,marginBottom:10}}>BI Tool Connection</div>
                        <div style={{display:'flex',flexDirection:'column',gap:8}}>
                          {[{label:'PowerBI',desc:'Data → Get Data → Web → paste URL',url:`https://qwezy.io/api/export?report=${report.id}&format=json`},{label:'Tableau',desc:'Connect → Web Data Connector → paste URL',url:`https://qwezy.io/api/export?report=${report.id}&format=csv`},{label:'Google Sheets',desc:'=IMPORTDATA("url") in any cell',url:`https://qwezy.io/api/export?report=${report.id}&format=csv`}].map(({label,desc,url})=>(
                            <div key={label} style={{background:'#fff',border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:'10px 12px'}}>
                              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
                                <span style={{fontSize:12.5,fontWeight:600,color:C.text}}>{label}</span>
                                <button onClick={()=>navigator.clipboard?.writeText(url)} style={{fontSize:11,padding:'2px 9px',borderRadius:4,border:`1px solid ${C.cardBorder}`,background:C.accentBg,color:C.accent,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:500}}>Copy URL</button>
                              </div>
                              <div style={{fontSize:11,color:C.textLight,marginBottom:4}}>{desc}</div>
                              <div style={{fontFamily:"'JetBrains Mono'",fontSize:10,color:C.textMuted,background:'#F0F4F8',padding:'3px 7px',borderRadius:4,wordBreak:'break-all'}}>{url}</div>
                            </div>
                          ))}
                          <div style={{fontSize:11.5,color:'#92400E',padding:'8px 10px',background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:6}}>Live BI connections available on Growth and Scale plans.</div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
        {emailModal&&<EmailModal report={emailModal.report} rows={emailModal.rows} fields={emailModal.fields} onClose={()=>setEmailModal(null)}/>}
      </> 
      )
    }

// ── Explorer Tab ──────────────────────────────────────────────────────────────
function ExplorerTab({onAsk,setDrawerTable,handleRightClick}:{onAsk:(q:string)=>void,setDrawerTable:(t:any)=>void,handleRightClick:(e:React.MouseEvent,t:any)=>void}) {
  const [search,setSearch]=useState('')
  const filtered=search?TABLES.filter(t=>t.name.includes(search.toLowerCase())||t.columns.some(c=>c.n.includes(search.toLowerCase()))):TABLES
  return(
    <div style={{padding:'20px 24px',overflowY:'auto',flex:1}}>
      <div style={{display:'flex',gap:12,marginBottom:18,flexWrap:'wrap',alignItems:'flex-end'}}>
        <div>
          <h2 style={{fontSize:18,fontWeight:700,color:C.text,letterSpacing:'-0.3px',marginBottom:2}}>Database Explorer</h2>
          <p style={{fontSize:12.5,color:C.textMuted}}>Northwind · Right-click any table for options</p>
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:10,alignItems:'center'}}>
          {[['Tables',String(TABLES.length)],['Columns',String(ALL_COLS.length)],['Rows',TABLES.reduce((s,t)=>s+parseInt(t.rows.replace(/,/g,''),10),0).toLocaleString()]].map(([k,v])=>(
            <div key={k} style={{background:'#fff',borderRadius:7,border:`1px solid ${C.cardBorder}`,padding:'5px 12px',textAlign:'center'}}>
              <div style={{fontSize:9.5,color:C.textLight,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>{k}</div>
              <div style={{fontSize:15,fontWeight:700,color:C.text}}>{v}</div>
            </div>
          ))}
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tables and columns…"
            style={{padding:'7px 12px',borderRadius:7,border:`1px solid ${C.cardBorder}`,fontSize:12.5,color:C.text,fontFamily:'Inter,sans-serif',width:220,background:'#fff'}}
            onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(310px,1fr))',gap:12}}>
        {filtered.map(tbl=>(
          <div key={tbl.name}
            style={{background:'#fff',borderRadius:9,border:`1px solid ${C.cardBorder}`,cursor:'pointer',overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}
            onClick={()=>setDrawerTable(tbl)} onContextMenu={e=>handleRightClick(e,tbl)}>
            <div style={{padding:'11px 14px',borderBottom:`1px solid ${C.cardBorder}`,display:'flex',alignItems:'center',gap:9,background:C.tableHead}}>
              <div style={{width:9,height:9,borderRadius:'50%',background:tbl.color,flexShrink:0}}/>
              <span style={{fontFamily:"'JetBrains Mono'",fontWeight:700,fontSize:13.5,color:C.text,flex:1}}>{tbl.name}</span>
              <span style={{background:`${tbl.color}18`,color:tbl.color,fontSize:10.5,fontWeight:600,padding:'2px 7px',borderRadius:4}}>{tbl.rows} rows</span>
            </div>
            <div style={{padding:'11px 14px'}}>
              <p style={{fontSize:12.5,color:C.textMuted,marginBottom:9,lineHeight:1.5}}>{tbl.desc}</p>
              <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:9}}>
                {tbl.teams.map(t=><span key={t} style={{background:C.accentBg,border:`1px solid ${C.accent}22`,color:C.accent,fontSize:10.5,fontWeight:500,padding:'2px 7px',borderRadius:4}}>{t}</span>)}
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                {tbl.columns.map(c=>(
                  <span key={c.n} style={{display:'inline-flex',alignItems:'center',gap:3,background:C.bg,border:`1px solid ${C.cardBorder}`,borderRadius:4,padding:'2px 6px'}}>
                    <span style={{width:5,height:5,borderRadius:'50%',background:TC[c.t],display:'inline-block',flexShrink:0}}/>
                    <span style={{fontFamily:"'JetBrains Mono'",fontSize:10.5,color:C.textMuted}}>{c.n}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────
const PRESET_QUERIES = [
  { id:'d1', name:'Revenue by Category', sql:`SELECT c.category_name, ROUND(SUM(od.unit_price*od.quantity*(1-od.discount)),0) AS revenue FROM order_details od JOIN products p ON od.product_id=p.product_id JOIN categories c ON p.category_id=c.category_id GROUP BY c.category_name ORDER BY revenue DESC`, viz:'bar', w:460, h:240 },
  { id:'d2', name:'Top 10 Customers', sql:`SELECT c.company_name, ROUND(SUM(od.unit_price*od.quantity*(1-od.discount)),0) AS revenue FROM customers c JOIN orders o ON c.customer_id=o.customer_id JOIN order_details od ON o.order_id=od.order_id GROUP BY c.company_name ORDER BY revenue DESC LIMIT 10`, viz:'table', w:440, h:240 },
  { id:'d3', name:'Orders by Country', sql:`SELECT ship_country, COUNT(*) AS orders FROM orders GROUP BY ship_country ORDER BY orders DESC LIMIT 8`, viz:'bar', w:360, h:240 },
  { id:'d4', name:'Orders by Shipper', sql:`SELECT s.company_name AS shipper, COUNT(o.order_id) AS orders FROM orders o JOIN shippers s ON o.ship_via=s.shipper_id GROUP BY s.company_name`, viz:'pie', w:320, h:240 },
]
const PRESET_KPIS = [
  { id:'k1', name:'Total Revenue', sql:`SELECT ROUND(SUM(unit_price*quantity*(1-discount)),0) AS value FROM order_details`, prefix:'$' },
  { id:'k2', name:'Total Orders', sql:`SELECT COUNT(*) AS value FROM orders`, prefix:'' },
  { id:'k3', name:'Total Customers', sql:`SELECT COUNT(*) AS value FROM customers`, prefix:'' },
  { id:'k4', name:'Avg Order Value', sql:`SELECT ROUND(AVG(t),0) AS value FROM (SELECT SUM(od.unit_price*od.quantity*(1-od.discount)) AS t FROM orders o JOIN order_details od ON o.order_id=od.order_id GROUP BY o.order_id) x`, prefix:'$' },
]

type DashView = {id:string,name:string,sql:string,viz:'bar'|'line'|'pie'|'table'|'kpi',w:number,h:number,color?:string,rows?:any[],fields?:string[]}
type DashPage = {id:string,name:string,views:DashView[]}

// ── Shared chart renderer ─────────────────────────────────────────────────────
function ViewChart({viz,rows,fields,color=C.accent,height=200}:{viz:string,rows:any[],fields:string[],color?:string,height?:number}) {
  const lk=fields[0]||'', vk=fields[1]||''
  if(!rows.length) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height,color:C.textLight,fontSize:13}}>No data</div>
  if(viz==='kpi') return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:44,fontWeight:800,color,letterSpacing:'-1px',lineHeight:1}}>{Number(Object.values(rows[0]||{})[0]||0).toLocaleString()}</div>
        <div style={{fontSize:11,color:C.textLight,marginTop:6,fontWeight:500}}>{fields[0]?.replace(/_/g,' ')}</div>
      </div>
    </div>
  )
  if(viz==='table') return(
    <div style={{overflowY:'auto',height}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
        <thead><tr style={{background:C.tableHead}}>{fields.map(f=><th key={f} style={{padding:'5px 8px',textAlign:'left',fontSize:10.5,color:C.textLight,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.04em',borderBottom:`1px solid ${C.cardBorder}`,whiteSpace:'nowrap'}}>{f.replace(/_/g,' ')}</th>)}</tr></thead>
        <tbody>{rows.map((r,i)=><tr key={i} style={{background:i%2===0?'#fff':C.tableRowAlt}}>{fields.map(f=><td key={f} style={{padding:'5px 8px',color:C.text,whiteSpace:'nowrap',borderBottom:`1px solid #F1F5F9`}}>{typeof r[f]==='number'?Number(r[f]).toLocaleString():String(r[f]??'')}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
  if(viz==='pie') return(
    <ResponsiveContainer width="100%" height={height}>
      <PieChart><Pie data={rows} dataKey={vk} nameKey={lk} cx="50%" cy="50%" outerRadius="68%" label={({name,percent}:any)=>`${String(name).slice(0,12)} ${(percent*100).toFixed(0)}%`} labelLine={false}>
        {rows.map((_,i)=><Cell key={i} fill={GREEN_SHADES[i%GREEN_SHADES.length]}/>)}
      </Pie><Tooltip formatter={(v:any)=>Number(v).toLocaleString()}/></PieChart>
    </ResponsiveContainer>
  )
  if(viz==='line') return(
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{top:4,right:8,left:0,bottom:20}}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
        <XAxis dataKey={lk} tick={{fontSize:10,fill:C.textLight}} angle={-15} textAnchor="end"/>
        <YAxis tick={{fontSize:10,fill:C.textLight}} tickFormatter={(v:any)=>Number(v).toLocaleString()}/>
        <Tooltip formatter={(v:any)=>Number(v).toLocaleString()}/>
        <Line type="monotone" dataKey={vk} stroke={color} strokeWidth={2.5} dot={false}/>
      </LineChart>
    </ResponsiveContainer>
  )
  return(
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{top:4,right:8,left:0,bottom:30}}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
        <XAxis dataKey={lk} tick={{fontSize:10,fill:C.textLight}} angle={-20} textAnchor="end"/>
        <YAxis tick={{fontSize:10,fill:C.textLight}} tickFormatter={(v:any)=>Number(v).toLocaleString()}/>
        <Tooltip formatter={(v:any)=>Number(v).toLocaleString()}/>
        <Bar dataKey={vk} radius={[3,3,0,0]}>{rows.map((_,i)=><Cell key={i} fill={GREEN_SHADES[i%GREEN_SHADES.length]}/>)}</Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({kpi}:{kpi:any}) {
  const [val,setVal]=useState<string|null>(null)
  useEffect(()=>{
    fetch('/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customSQL:kpi.sql})})
      .then(r=>r.json()).then(d=>{if(!d.error&&d.rows?.[0])setVal(String(Object.values(d.rows[0])[0]))}).catch(()=>{})
  },[kpi.id])
  return(
    <div style={{background:'#fff',borderRadius:10,border:`1px solid ${C.cardBorder}`,padding:'18px 22px',flex:1,minWidth:150}}>
      <div style={{fontSize:10.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>{kpi.name}</div>
      <div style={{fontSize:32,fontWeight:800,color:C.text,letterSpacing:'-0.5px',lineHeight:1}}>
        {val===null?<span style={{color:C.textLight,fontSize:18,fontWeight:400}}>—</span>:`${kpi.prefix}${Number(val).toLocaleString()}`}
      </div>
    </div>
  )
}

// ── Resizable DashCard ────────────────────────────────────────────────────────
function DashCard({view,onRemove,onEdit}:{view:DashView,onRemove:()=>void,onEdit:()=>void}) {
  const [rows,setRows]=useState<any[]>(view.rows||[])
  const [fields,setFields]=useState<string[]>(view.fields||[])
  const [loading,setLoading]=useState(!view.rows?.length)
  const [menuOpen,setMenuOpen]=useState(false)
  const [w,setW]=useState(view.w)
  const [h,setH]=useState(view.h)
  const drag=useRef<{sx:number,sy:number,sw:number,sh:number}|null>(null)

  useEffect(()=>{
    if(view.rows?.length){setRows(view.rows);setFields(view.fields||[]);setLoading(false);return}
    if(!view.sql)return
    setLoading(true)
    fetch('/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customSQL:view.sql})})
      .then(r=>r.json()).then(d=>{if(!d.error){setRows(d.rows||[]);setFields(d.fields||[])}}).finally(()=>setLoading(false))
  },[view.id])

  useEffect(()=>{
    const close=()=>setMenuOpen(false)
    if(menuOpen)document.addEventListener('click',close)
    return()=>document.removeEventListener('click',close)
  },[menuOpen])

  const startResize=(e:React.MouseEvent)=>{
    e.preventDefault()
    drag.current={sx:e.clientX,sy:e.clientY,sw:w,sh:h}
    const move=(ev:MouseEvent)=>{
      if(!drag.current)return
      setW(Math.max(260,Math.min(960,drag.current.sw+(ev.clientX-drag.current.sx))))
      setH(Math.max(160,Math.min(640,drag.current.sh+(ev.clientY-drag.current.sy))))
    }
    const up=()=>{drag.current=null;window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up)}
    window.addEventListener('mousemove',move);window.addEventListener('mouseup',up)
  }

  return(
    <div style={{position:'relative',display:'inline-flex',flexDirection:'column',background:'#fff',borderRadius:10,border:`1px solid ${C.cardBorder}`,boxShadow:'0 1px 4px rgba(0,0,0,0.05)',width:w,flexShrink:0}}>
      <div style={{padding:'9px 12px',borderBottom:`1px solid ${C.cardBorder}`,display:'flex',alignItems:'center',gap:8,background:C.tableHead,borderRadius:'10px 10px 0 0',flexShrink:0}}>
        <span style={{fontSize:12.5,fontWeight:600,color:C.text,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{view.name}</span>
        <div style={{position:'relative'}}>
          <button onClick={e=>{e.stopPropagation();setMenuOpen(s=>!s)}} style={{background:'none',border:'none',color:C.textLight,cursor:'pointer',fontSize:16,lineHeight:1,padding:'2px 6px',borderRadius:4,fontWeight:700,letterSpacing:1}}
            onMouseOver={e=>e.currentTarget.style.background='#E5E7EB'} onMouseOut={e=>e.currentTarget.style.background='none'}>···</button>
          {menuOpen&&(
            <div style={{position:'absolute',right:0,top:'calc(100% + 4px)',background:'#fff',border:`1px solid ${C.cardBorder}`,borderRadius:8,boxShadow:'0 8px 24px rgba(0,0,0,0.12)',zIndex:300,minWidth:148,overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
              <button onClick={()=>{onEdit();setMenuOpen(false)}} style={{display:'block',width:'100%',padding:'9px 14px',background:'none',border:'none',fontSize:13,color:C.text,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left'}}
                onMouseOver={e=>e.currentTarget.style.background='#F0F7FF'} onMouseOut={e=>e.currentTarget.style.background='none'}>✏️ Edit visual</button>
              <div style={{height:1,background:C.cardBorder}}/>
              <button onClick={()=>{onRemove();setMenuOpen(false)}} style={{display:'block',width:'100%',padding:'9px 14px',background:'none',border:'none',fontSize:13,color:C.danger,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left'}}
                onMouseOver={e=>e.currentTarget.style.background='#FEF2F2'} onMouseOut={e=>e.currentTarget.style.background='none'}>🗑 Remove</button>
            </div>
          )}
        </div>
      </div>
      <div style={{padding:12,height:h,overflow:'hidden'}}>
        {loading
          ?<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',gap:8,color:C.textLight,fontSize:13}}><div style={{width:14,height:14,border:`2px solid ${C.cardBorder}`,borderTop:`2px solid ${C.accent}`,borderRadius:'50%',animation:'spin .8s linear infinite'}}/>Loading…</div>
          :<ViewChart viz={view.viz} rows={rows} fields={fields} color={view.color||C.accent} height={h}/>}
      </div>
      {/* Resize handle */}
      <div onMouseDown={startResize} title="Drag to resize"
        style={{position:'absolute',bottom:2,right:2,width:16,height:16,cursor:'se-resize',display:'flex',alignItems:'center',justifyContent:'center',color:'#CBD5E1',fontSize:11,userSelect:'none'}}
        onMouseOver={e=>e.currentTarget.style.color=C.accent} onMouseOut={e=>e.currentTarget.style.color='#CBD5E1'}>⇲</div>
    </div>
  )
}

// ── Visual Builder Modal ──────────────────────────────────────────────────────
// Fully click-based. No drag. Simple and reliable.
function VisualBuilder({onSave,onClose,existing=null}:{onSave:(v:DashView)=>void,onClose:()=>void,existing?:DashView|null}) {
  // mode: 'visual' = click fields | 'sql' = paste SQL
  const [mode,setMode]=useState<'visual'|'sql'>(existing?'sql':'visual')
  const [name,setName]=useState(existing?.name||'')
  const [viz,setViz]=useState<DashView['viz']>(existing?.viz||'bar')
  const [xCol,setXCol]=useState<string>('')   // "table.col"
  const [yCol,setYCol]=useState<string>('')
  const [agg,setAgg]=useState<'SUM'|'COUNT'|'AVG'|'MIN'|'MAX'>('SUM')
  const [limit,setLimit]=useState(50)
  const [customSQL,setCustomSQL]=useState(existing?.sql||'')
  const [colSearch,setColSearch]=useState('')
  // preview
  const [previewRows,setPreviewRows]=useState<any[]>(existing?.rows||[])
  const [previewFields,setPreviewFields]=useState<string[]>(existing?.fields||[])
  const [previewLoading,setPreviewLoading]=useState(false)
  const [previewErr,setPreviewErr]=useState('')
  const previewTimer=useRef<any>(null)

  const filteredCols=useMemo(()=>ALL_COLS.filter(c=>!colSearch||c.n.toLowerCase().includes(colSearch.toLowerCase())||c.table.toLowerCase().includes(colSearch.toLowerCase())),[colSearch])

  // Build SQL from visual picks
  const builtSQL=useMemo(()=>{
    if(mode==='sql'||!xCol)return ''
    const [xTable,xField]=xCol.split('.')
    const primary=xTable
    let selectLine=''
    if(yCol){
      const [,yField]=yCol.split('.')
      const [yTable]=yCol.split('.')
      const needJoin=yTable!==xTable
      const joinDef=needJoin?TABLES.find(t=>t.name===xTable)?.joins.find(j=>j.to===yTable):null
      const joinSQL=needJoin&&joinDef?`\nJOIN ${yTable} ON ${xTable}.${joinDef.on} = ${yTable}.${joinDef.on}`:needJoin?`\nJOIN ${yTable} ON true -- verify`:''
      if(viz==='kpi'){
        return `SELECT ${agg}(${yCol.replace('.','.') }) AS value\nFROM ${primary}${joinSQL}`
      }
      selectLine=`${xCol},\n  ${agg}(${yCol}) AS ${agg.toLowerCase()}_${yField}`
      return `SELECT\n  ${selectLine}\nFROM ${primary}${joinSQL}\nGROUP BY ${xCol}\nORDER BY 2 DESC\nLIMIT ${limit}`
    }
    if(viz==='kpi') return `SELECT COUNT(*) AS value FROM ${primary}`
    return `SELECT\n  ${xCol},\n  COUNT(*) AS count\nFROM ${primary}\nGROUP BY ${xCol}\nORDER BY 2 DESC\nLIMIT ${limit}`
  },[mode,xCol,yCol,agg,limit,viz])

  const activeSQL=mode==='sql'?customSQL:builtSQL

  // Auto-run preview whenever activeSQL changes
  useEffect(()=>{
    if(!activeSQL.trim()){setPreviewRows([]);setPreviewFields([]);setPreviewErr('');return}
    clearTimeout(previewTimer.current)
    previewTimer.current=setTimeout(async()=>{
      setPreviewLoading(true);setPreviewErr('')
      try{
        const res=await fetch('/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customSQL:activeSQL})})
        const d=await res.json()
        if(d.error){setPreviewErr(d.error);setPreviewRows([])}
        else{setPreviewRows(d.rows||[]);setPreviewFields(d.fields||[])}
      }catch(e:any){setPreviewErr(e.message)}
      finally{setPreviewLoading(false)}
    },500)
    return()=>clearTimeout(previewTimer.current)
  },[activeSQL])

  const canSave=name.trim()&&activeSQL.trim()

  const handleSave=()=>{
    if(!canSave)return
    onSave({
      id:existing?.id||`v${Date.now()}`,
      name:name.trim(),
      sql:activeSQL,
      viz,
      w:existing?.w||460,
      h:existing?.h||240,
      rows:previewRows,
      fields:previewFields,
    })
    onClose()
  }

  const VIZ_TYPES:[DashView['viz'],string][]=[['bar','Bar'],['line','Line'],['pie','Pie'],['table','Table'],['kpi','KPI']]

  const ColButton=({col}:{col:typeof ALL_COLS[0]})=>{
    const key=`${col.table}.${col.n}`
    const isX=xCol===key, isY=yCol===key
    return(
      <div style={{display:'flex',alignItems:'center',gap:4,padding:'4px 6px',borderRadius:5,marginBottom:2,background:isX||isY?C.accentBg:'#fff',border:`1px solid ${isX||isY?C.accent:C.cardBorder}`}}>
        <span style={{width:6,height:6,borderRadius:'50%',background:TC[col.t]||'#8A9BB0',display:'inline-block',flexShrink:0}}/>
        <span style={{fontFamily:"'JetBrains Mono'",fontSize:10.5,color:C.text,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{col.n}</span>
        <button onClick={()=>setXCol(isX?'':key)} title="Set as X axis / Dimension"
          style={{fontSize:10,padding:'1px 5px',borderRadius:3,border:'1.5px solid',cursor:'pointer',fontWeight:700,fontFamily:'Inter,sans-serif',lineHeight:1.4,
            borderColor:isX?C.accent:C.cardBorder,background:isX?C.accent:'#F8FAFD',color:isX?'#fff':C.textLight}}>X</button>
        <button onClick={()=>setYCol(isY?'':key)} title="Set as Y axis / Measure"
          style={{fontSize:10,padding:'1px 5px',borderRadius:3,border:'1.5px solid',cursor:'pointer',fontWeight:700,fontFamily:'Inter,sans-serif',lineHeight:1.4,
            borderColor:isY?C.accentDark:C.cardBorder,background:isY?C.accentDark:'#F8FAFD',color:isY?'#fff':C.textLight}}>Y</button>
      </div>
    )
  }

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(10,20,30,0.7)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'#fff',borderRadius:12,width:'100%',maxWidth:940,height:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 24px 64px rgba(0,0,0,0.28)',overflow:'hidden'}}>

        {/* Header */}
        <div style={{padding:'13px 20px',borderBottom:`1px solid ${C.cardBorder}`,display:'flex',alignItems:'center',gap:12,background:'#FAFAFA',flexShrink:0}}>
          <span style={{fontWeight:700,fontSize:15,color:C.text}}>{existing?'Edit visual':'New visual'}</span>
          {/* Title input */}
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Chart title…"
            style={{flex:1,maxWidth:240,padding:'6px 11px',borderRadius:7,border:`1.5px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif'}}
            onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
          {/* Viz type */}
          <div style={{display:'flex',gap:4}}>
            {VIZ_TYPES.map(([v,l])=>(
              <button key={v} onClick={()=>setViz(v)}
                style={{padding:'5px 11px',borderRadius:6,border:'1.5px solid',cursor:'pointer',fontFamily:'Inter,sans-serif',fontSize:12,fontWeight:500,
                  borderColor:viz===v?C.accent:C.cardBorder,background:viz===v?C.accentBg:'#fff',color:viz===v?C.accent:C.textMuted}}>
                {l}
              </button>
            ))}
          </div>
          {/* Mode toggle */}
          <button onClick={()=>setMode(m=>m==='visual'?'sql':'visual')}
            style={{padding:'5px 12px',borderRadius:6,border:`1.5px solid ${mode==='sql'?C.accent:C.cardBorder}`,background:mode==='sql'?C.accentBg:'#fff',color:mode==='sql'?C.accent:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif',fontSize:12,fontWeight:500,whiteSpace:'nowrap'}}>
            {mode==='sql'?'← Visual':'SQL / Paste'}
          </button>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,color:C.textLight,cursor:'pointer',lineHeight:1,padding:'0 2px'}}>×</button>
        </div>

        {/* Body */}
        <div style={{flex:1,display:'flex',overflow:'hidden'}}>

          {/* Left — field list (only in visual mode) */}
          {mode==='visual'&&(
            <div style={{width:200,borderRight:`1px solid ${C.cardBorder}`,display:'flex',flexDirection:'column',background:'#FAFAFA',flexShrink:0}}>
              <div style={{padding:'9px 9px 6px',borderBottom:`1px solid ${C.cardBorder}`}}>
                <div style={{fontSize:9.5,fontWeight:700,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5}}>Fields — click X or Y</div>
                <input value={colSearch} onChange={e=>setColSearch(e.target.value)} placeholder="Search…"
                  style={{width:'100%',padding:'4px 8px',borderRadius:5,border:`1px solid ${C.cardBorder}`,fontSize:12,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff'}}/>
              </div>
              <div style={{flex:1,overflowY:'auto',padding:'6px 8px'}}>
                {TABLES.map(tbl=>{
                  const cols=filteredCols.filter(c=>c.table===tbl.name)
                  if(!cols.length)return null
                  return(
                    <div key={tbl.name} style={{marginBottom:10}}>
                      <div style={{fontSize:9,fontWeight:700,color:tbl.color,textTransform:'uppercase',letterSpacing:'0.06em',padding:'2px 5px',marginBottom:3}}>{tbl.name}</div>
                      {cols.map(col=><ColButton key={`${col.table}.${col.n}`} col={col}/>)}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Right — config + preview */}
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

            {/* Config row */}
            <div style={{padding:'12px 18px',borderBottom:`1px solid ${C.cardBorder}`,background:'#fff',flexShrink:0,display:'flex',flexDirection:'column',gap:10}}>
              {mode==='visual'?(
                <div style={{display:'flex',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
                  {/* X / Y summary */}
                  <div style={{display:'flex',gap:8}}>
                    <div style={{background:xCol?C.accentBg:'#F8FAFD',border:`1.5px solid ${xCol?C.accent:C.cardBorder}`,borderRadius:7,padding:'7px 12px',minWidth:140}}>
                      <div style={{fontSize:9.5,fontWeight:700,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>X axis</div>
                      {xCol?<span style={{fontFamily:"'JetBrains Mono'",fontSize:12,color:C.accent,fontWeight:600}}>{xCol}</span>:<span style={{fontSize:12,color:'#9CA3AF'}}>Click X on a field</span>}
                    </div>
                    <div style={{background:yCol?'#EFF6FF':'#F8FAFD',border:`1.5px solid ${yCol?'#3B82F6':C.cardBorder}`,borderRadius:7,padding:'7px 12px',minWidth:140}}>
                      <div style={{fontSize:9.5,fontWeight:700,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Y axis</div>
                      {yCol?<span style={{fontFamily:"'JetBrains Mono'",fontSize:12,color:'#3B82F6',fontWeight:600}}>{yCol}</span>:<span style={{fontSize:12,color:'#9CA3AF'}}>Click Y on a field</span>}
                    </div>
                  </div>
                  {/* Agg */}
                  {yCol&&viz!=='table'&&(
                    <div>
                      <div style={{fontSize:9.5,fontWeight:700,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>Aggregation</div>
                      <div style={{display:'flex',gap:4}}>
                        {(['SUM','COUNT','AVG','MIN','MAX'] as const).map(a=>(
                          <button key={a} onClick={()=>setAgg(a)}
                            style={{padding:'4px 9px',borderRadius:5,border:'1.5px solid',cursor:'pointer',fontFamily:"'JetBrains Mono',monospace",fontSize:10.5,fontWeight:700,
                              borderColor:agg===a?C.accent:C.cardBorder,background:agg===a?C.accent:'#fff',color:agg===a?'#fff':C.textLight}}>
                            {a}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Limit */}
                  {viz!=='kpi'&&(
                    <div>
                      <div style={{fontSize:9.5,fontWeight:700,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>Limit</div>
                      <input type="number" value={limit} onChange={e=>setLimit(Math.max(1,parseInt(e.target.value)||50))} min={1} max={5000}
                        style={{width:72,padding:'5px 8px',borderRadius:5,border:`1.5px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif'}}/>
                    </div>
                  )}
                </div>
              ):(
                <div>
                  <div style={{fontSize:10.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:5}}>SQL — paste or write any query</div>
                  <textarea value={customSQL} onChange={e=>setCustomSQL(e.target.value)} rows={5} placeholder={'SELECT category_name, SUM(revenue) AS total\nFROM ...\nGROUP BY category_name\nORDER BY total DESC'}
                    style={{width:'100%',padding:'9px 12px',borderRadius:7,border:`1.5px solid ${C.cardBorder}`,fontSize:12.5,color:C.text,fontFamily:"'JetBrains Mono',monospace",resize:'vertical',lineHeight:1.65,background:'#FAFAFA'}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
                </div>
              )}
            </div>

            {/* Preview panel */}
            <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column',background:'#F8FAFD'}}>
              <div style={{padding:'8px 18px',display:'flex',alignItems:'center',gap:8,background:'#fff',borderBottom:`1px solid ${C.cardBorder}`,flexShrink:0}}>
                <span style={{fontSize:12,fontWeight:600,color:C.text}}>Preview</span>
                {previewLoading&&<div style={{width:11,height:11,border:`2px solid ${C.cardBorder}`,borderTop:`2px solid ${C.accent}`,borderRadius:'50%',animation:'spin .8s linear infinite'}}/>}
                {!previewLoading&&previewRows.length>0&&<span style={{fontSize:11.5,color:C.textLight}}>{previewRows.length} rows</span>}
                {previewErr&&<span style={{fontSize:11.5,color:C.danger,flex:1}}>{previewErr}</span>}
                {!activeSQL&&!previewLoading&&!previewErr&&<span style={{fontSize:11.5,color:C.textLight}}>Select fields above to see a preview</span>}
              </div>
              <div style={{flex:1,padding:16,overflow:'hidden'}}>
                {previewRows.length>0&&<ViewChart viz={viz} rows={previewRows} fields={previewFields} height={undefined as any}/>}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{padding:'12px 20px',borderTop:`1px solid ${C.cardBorder}`,display:'flex',gap:8,alignItems:'center',background:'#FAFAFA',flexShrink:0}}>
          <span style={{flex:1,fontSize:11.5,color:C.textLight}}>
            {!name.trim()?'Give your chart a title above'
              :!activeSQL?'Select X field to generate SQL'
              :previewRows.length>0?`Ready — ${previewRows.length} rows`
              :previewLoading?'Running preview…':''}
          </span>
          <button onClick={onClose} style={{background:'#fff',color:C.textMuted,border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:'8px 18px',fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Cancel</button>
          <button onClick={handleSave} disabled={!canSave}
            style={{background:canSave?C.accent:'#E5E7EB',color:canSave?'#fff':C.textLight,border:'none',borderRadius:7,padding:'8px 26px',fontSize:13,fontWeight:600,cursor:canSave?'pointer':'default',fontFamily:'Inter,sans-serif'}}>
            {existing?'Save changes':'Add to dashboard'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Preset chart card with edit menu ─────────────────────────────────────────
function PresetCard({preset,onEdit}:{preset:any,onEdit:()=>void}) {
  const [rows,setRows]=useState<any[]>([])
  const [fields,setFields]=useState<string[]>([])
  const [loading,setLoading]=useState(true)
  const [menuOpen,setMenuOpen]=useState(false)

  useEffect(()=>{
    fetch('/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customSQL:preset.sql})})
      .then(r=>r.json()).then(d=>{if(!d.error){setRows(d.rows||[]);setFields(d.fields||[])}}).finally(()=>setLoading(false))
  },[preset.id])

  useEffect(()=>{
    const close=()=>setMenuOpen(false)
    if(menuOpen)document.addEventListener('click',close)
    return()=>document.removeEventListener('click',close)
  },[menuOpen])

  return(
    <div style={{background:'#fff',borderRadius:10,border:`1px solid ${C.cardBorder}`,overflow:'hidden',width:preset.w,flexShrink:0}}>
      <div style={{padding:'9px 12px',borderBottom:`1px solid ${C.cardBorder}`,display:'flex',alignItems:'center',gap:8,background:C.tableHead}}>
        <span style={{fontSize:12.5,fontWeight:600,color:C.text,flex:1}}>{preset.name}</span>
        <div style={{position:'relative'}}>
          <button onClick={e=>{e.stopPropagation();setMenuOpen(s=>!s)}} style={{background:'none',border:'none',color:C.textLight,cursor:'pointer',fontSize:16,lineHeight:1,padding:'2px 6px',fontWeight:700,letterSpacing:1}}
            onMouseOver={e=>e.currentTarget.style.background='#E5E7EB'} onMouseOut={e=>e.currentTarget.style.background='none'}>···</button>
          {menuOpen&&(
            <div style={{position:'absolute',right:0,top:'calc(100% + 4px)',background:'#fff',border:`1px solid ${C.cardBorder}`,borderRadius:8,boxShadow:'0 8px 24px rgba(0,0,0,0.12)',zIndex:300,minWidth:148,overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
              <button onClick={()=>{onEdit();setMenuOpen(false)}} style={{display:'block',width:'100%',padding:'9px 14px',background:'none',border:'none',fontSize:13,color:C.text,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left'}}
                onMouseOver={e=>e.currentTarget.style.background='#F0F7FF'} onMouseOut={e=>e.currentTarget.style.background='none'}>✏️ Edit visual</button>
            </div>
          )}
        </div>
      </div>
      <div style={{padding:12,height:preset.h}}>
        {loading
          ?<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:C.textLight,fontSize:13}}>Loading…</div>
          :<ViewChart viz={preset.viz} rows={rows} fields={fields} height={preset.h}/>}
      </div>
    </div>
  )
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────
function DashboardTab({sharedResults,onResultSaved}:{sharedResults:Record<string,ReportResult>,onResultSaved:(id:string,r:ReportResult)=>void}) {
  const [pages,setPages]=useState<DashPage[]>([{id:'overview',name:'Overview',views:[]}])
  const [activePage,setActivePage]=useState('overview')
  const [renamingPage,setRenamingPage]=useState<string|null>(null)
  const [builder,setBuilder]=useState<{open:boolean,editing:DashView|null}>({open:false,editing:null})
  const [customViews,setCustomViews]=useState<DashView[]>([]) // for overview page

  const isOverview=activePage==='overview'
  const currentPage=pages.find(p=>p.id===activePage)||pages[0]
  const currentViews=isOverview?customViews:currentPage.views

  const openBuilder=(existing:DashView|null=null)=>setBuilder({open:true,editing:existing})
  const closeBuilder=()=>setBuilder({open:false,editing:null})

  const saveView=(view:DashView)=>{
    if(builder.editing){
      // update existing
      if(isOverview) setCustomViews(p=>p.map(v=>v.id===view.id?view:v))
      else setPages(p=>p.map(pg=>pg.id===activePage?{...pg,views:pg.views.map(v=>v.id===view.id?view:v)}:pg))
    } else {
      // add new
      if(isOverview) setCustomViews(p=>[...p,view])
      else setPages(p=>p.map(pg=>pg.id===activePage?{...pg,views:[...pg.views,view]}:pg))
    }
  }

  const removeView=(id:string)=>{
    if(isOverview) setCustomViews(p=>p.filter(v=>v.id!==id))
    else setPages(p=>p.map(pg=>pg.id===activePage?{...pg,views:pg.views.filter(v=>v.id!==id)}:pg))
  }

  const addPage=()=>{
    const id=`p${Date.now()}`
    const name=`Page ${pages.length}`
    setPages(p=>[...p,{id,name,views:[]}])
    setActivePage(id)
  }

  const deletePage=(id:string)=>{
    setPages(p=>p.filter(pg=>pg.id!==id))
    if(activePage===id)setActivePage('overview')
  }

  const renamePage=(id:string,name:string)=>{
    setPages(p=>p.map(pg=>pg.id===id?{...pg,name}:pg))
    setRenamingPage(null)
  }

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.bg}}>
      {/* Tab bar */}
      <div style={{background:'#fff',borderBottom:`1px solid ${C.cardBorder}`,display:'flex',alignItems:'center',padding:'0 16px',flexShrink:0,overflowX:'auto'}}>
        {pages.map(pg=>(
          <div key={pg.id} style={{display:'flex',alignItems:'center',flexShrink:0,borderBottom:`2px solid ${activePage===pg.id?C.accent:'transparent'}`,marginRight:2}}>
            <div onClick={()=>setActivePage(pg.id)}
              style={{padding:'11px 10px',cursor:'pointer',fontSize:13,fontWeight:activePage===pg.id?600:400,color:activePage===pg.id?C.accent:C.textMuted,whiteSpace:'nowrap'}}>
              {renamingPage===pg.id
                ?<input autoFocus defaultValue={pg.name}
                    onBlur={e=>renamePage(pg.id,e.target.value||pg.name)}
                    onKeyDown={e=>{if(e.key==='Enter')renamePage(pg.id,(e.target as HTMLInputElement).value||pg.name);if(e.key==='Escape')setRenamingPage(null)}}
                    onClick={e=>e.stopPropagation()}
                    style={{fontSize:13,border:'none',borderBottom:`1px solid ${C.accent}`,outline:'none',width:80,fontFamily:'Inter,sans-serif',background:'none',color:C.text}}/>
                :<span onDoubleClick={e=>{e.stopPropagation();if(pg.id!=='overview')setRenamingPage(pg.id)}}>{pg.name}</span>}
            </div>
            {pg.id!=='overview'&&activePage===pg.id&&(
              <button onClick={e=>{e.stopPropagation();deletePage(pg.id)}} style={{background:'none',border:'none',color:C.textLight,cursor:'pointer',fontSize:13,padding:'0 4px',lineHeight:1}}
                onMouseOver={e=>e.currentTarget.style.color=C.danger} onMouseOut={e=>e.currentTarget.style.color=C.textLight}>×</button>
            )}
          </div>
        ))}
        <button onClick={addPage} style={{padding:'10px 12px',fontSize:13,color:C.textLight,background:'none',border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif',flexShrink:0,whiteSpace:'nowrap'}}>+ Page</button>
        <div style={{marginLeft:'auto',paddingLeft:12,flexShrink:0}}>
          <button onClick={()=>openBuilder(null)} style={{fontSize:12.5,padding:'6px 16px',borderRadius:6,border:'none',background:C.accent,color:'#fff',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:600,whiteSpace:'nowrap'}}>+ Add visual</button>
        </div>
      </div>

      {/* Canvas */}
      <div style={{flex:1,overflowY:'auto',padding:20}}>
        {isOverview&&(
          <>
            <div style={{display:'flex',gap:12,marginBottom:20,flexWrap:'wrap'}}>
              {PRESET_KPIS.map(kpi=><KpiCard key={kpi.id} kpi={kpi}/>)}
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:14,marginBottom:customViews.length?20:0}}>
              {PRESET_QUERIES.map(p=>(
                <PresetCard key={p.id} preset={p} onEdit={()=>openBuilder({id:p.id,name:p.name,sql:p.sql,viz:p.viz as any,w:p.w,h:p.h})}/>
              ))}
            </div>
            {customViews.length>0&&(
              <div>
                <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:12}}>Custom visuals</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:14}}>
                  {customViews.map(v=><DashCard key={v.id} view={v} onRemove={()=>removeView(v.id)} onEdit={()=>openBuilder(v)}/>)}
                </div>
              </div>
            )}
          </>
        )}
        {!isOverview&&(
          currentViews.length===0
            ?<div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',paddingTop:80,textAlign:'center'}}>
              <div style={{fontSize:44,marginBottom:16}}>📊</div>
              <div style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:8}}>Empty page</div>
              <div style={{fontSize:13,color:C.textMuted,marginBottom:24}}>Double-click the tab to rename · Click "Add visual" to get started</div>
              <button onClick={()=>openBuilder(null)} style={{background:C.accent,color:'#fff',border:'none',borderRadius:8,padding:'10px 24px',fontSize:13.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Add visual</button>
            </div>
            :<div style={{display:'flex',flexWrap:'wrap',gap:14}}>
              {currentViews.map(v=><DashCard key={v.id} view={v} onRemove={()=>removeView(v.id)} onEdit={()=>openBuilder(v)}/>)}
            </div>
        )}
      </div>

      {builder.open&&<VisualBuilder onSave={saveView} onClose={closeBuilder} existing={builder.editing}/>}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router=useRouter()
  const [tab,setTab]=useState<string>(()=>{try{return sessionStorage.getItem('qwezy_tab')||'ask'}catch{return 'ask'}})
  const [drawerTable,setDrawerTable]=useState<any>(null)
  const [previewTable,setPreviewTable]=useState<any>(null)
  const [contextMenu,setContextMenu]=useState<{x:number,y:number,table:any}|null>(null)
  const [sideCollapsed,setSideCollapsed]=useState(false)
  const [sideWidth,setSideWidth]=useState(200)
  const [reportResults,setReportResults]=useState<Record<string,ReportResult>>(()=>reportCache)
  const [askQ,setAskQ]=useState('')
  const dragSide=useRef(false)

  useEffect(()=>{try{sessionStorage.setItem('qwezy_tab',tab)}catch{}},[tab])

  const saveReportResult=(id:string,result:ReportResult)=>{
    reportCache[id]=result
    setReportResults(p=>({...p,[id]:result}))
  }

  const askQuestion=(q:string)=>{
    setAskQ(q)
    setTab('ask')
  }

  const handleRightClick=(e:React.MouseEvent,t:any)=>{
    e.preventDefault()
    setContextMenu({x:e.clientX,y:e.clientY,table:t})
  }

  const startSideDrag=(e:React.MouseEvent)=>{
    dragSide.current=true
    const startX=e.clientX,startW=sideWidth
    const move=(ev:MouseEvent)=>{if(dragSide.current)setSideWidth(Math.max(160,Math.min(320,startW+(ev.clientX-startX))))}
    const up=()=>{dragSide.current=false;window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up)}
    window.addEventListener('mousemove',move);window.addEventListener('mouseup',up)
  }

  const signOut=async()=>{
    await fetch('/api/auth',{method:'DELETE'})
    try{sessionStorage.clear()}catch{}
    router.push('/auth')
  }

  const TABS=[
    {id:'ask',label:'Ask Qwezy'},
    {id:'builder',label:'Builder'},
    {id:'dashboard',label:'Dashboards'},
    {id:'reports',label:'Reports'},
    {id:'explorer',label:'Explorer'},
    {id:'relationships',label:'Schema'},
    {id:'stats',label:'Health'},
  ]

  return(
    <div style={{fontFamily:'Inter,-apple-system,sans-serif',display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden',background:C.bg}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        .spin{animation:spin .8s linear infinite}
      `}</style>

      {/* Navbar */}
      <nav style={{background:C.navBg,borderBottom:`1px solid ${C.navBorder}`,height:48,display:'flex',alignItems:'center',paddingLeft:16,paddingRight:16,gap:0,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginRight:16,paddingRight:14,borderRight:`1px solid ${C.navBorder}`}}>
          <div style={{width:24,height:24,background:'linear-gradient(135deg,#10B981,#059669)',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{color:'#fff',fontFamily:"'JetBrains Mono'",fontWeight:700,fontSize:10}}>{'{ }'}</span>
          </div>
          <span style={{fontWeight:700,fontSize:14,color:'#fff',letterSpacing:'-0.2px'}}>Qwezy</span>
          <span style={{fontSize:11,color:C.navText,padding:'2px 6px',background:'rgba(16,185,129,0.15)',borderRadius:4,fontWeight:600}}>Demo</span>
        </div>
        <div style={{display:'flex',gap:1,flex:1,overflow:'hidden'}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{background:'none',border:'none',padding:'0 12px',height:48,fontSize:12.5,fontWeight:500,color:tab===t.id?'#fff':C.navText,cursor:'pointer',borderBottom:tab===t.id?`2px solid ${C.navActive}`:'2px solid transparent',fontFamily:'Inter,sans-serif',whiteSpace:'nowrap'}}>
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={signOut} style={{fontSize:12.5,color:C.navText,background:'none',border:`1px solid ${C.navBorder}`,borderRadius:5,padding:'4px 11px',cursor:'pointer',fontFamily:'Inter,sans-serif',flexShrink:0}}>Sign out</button>
      </nav>

      {/* Main layout */}
      <div style={{flex:1,display:'flex',overflow:'hidden',position:'relative'}}>

        {/* Sidebar */}
        <aside style={{width:sideCollapsed?0:sideWidth,background:C.sidebar,borderRight:`1px solid ${C.sidebarBorder}`,display:'flex',flexDirection:'column',flexShrink:0,overflow:'hidden',transition:sideCollapsed?'width .15s':'none',position:'relative'}}>
          {!sideCollapsed&&(
            <>
              <div style={{padding:'9px 9px 6px',borderBottom:`1px solid ${C.sidebarBorder}`,background:'#FAFCFE',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{fontSize:9.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.07em'}}>Tables</span>
                <button onClick={()=>setSideCollapsed(true)} style={{background:'none',border:'none',fontSize:14,color:C.textLight,cursor:'pointer',lineHeight:1}}>‹</button>
              </div>
              <div style={{flex:1,overflowY:'auto',padding:'5px 7px'}}>
                {TABLES.map(tbl=>(
                  <div key={tbl.name}
                    style={{display:'flex',alignItems:'center',gap:6,padding:'6px 7px',borderRadius:5,marginBottom:2,cursor:'pointer'}}
                    onClick={()=>setDrawerTable(tbl)} onContextMenu={e=>handleRightClick(e,tbl)}
                    onMouseOver={e=>e.currentTarget.style.background='#F0F7FF'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                    <div style={{width:7,height:7,borderRadius:'50%',background:tbl.color,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11.5,fontWeight:500,color:C.text,fontFamily:"'JetBrains Mono'",overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tbl.name}</div>
                      <div style={{fontSize:9.5,color:C.textLight}}>{tbl.rows} rows</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{padding:'9px 11px',borderTop:`1px solid ${C.sidebarBorder}`,background:'#FAFCFE'}}>
                {[['Tables','8/8'],['Database','Northwind'],['Status','Connected']].map(([k,v])=>(
                  <div key={k} style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontSize:10.5,color:C.textLight}}>{k}</span>
                    <span style={{fontSize:10.5,fontWeight:600,color:k==='Status'?C.success:C.text}}>{v}</span>
                  </div>
                ))}
              </div>
              {/* Sidebar resize */}
              <div onMouseDown={startSideDrag} style={{position:'absolute',right:0,top:0,bottom:0,width:5,cursor:'ew-resize',zIndex:10}}
                onMouseOver={e=>e.currentTarget.style.background='rgba(5,150,105,0.2)'}
                onMouseOut={e=>e.currentTarget.style.background='transparent'}/>
            </>
          )}
          {sideCollapsed&&(
            <button onClick={()=>setSideCollapsed(false)} style={{width:'100%',height:48,background:'none',border:'none',color:C.textLight,cursor:'pointer',fontSize:14,borderBottom:`1px solid ${C.sidebarBorder}`}}>›</button>
          )}
        </aside>

        {/* Main content */}
        <main style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          {tab==='ask'&&<QwezyTab onAsk={q=>{setAskQ(q)}}/>}
          {tab==='builder'&&<BuilderTab/>}
          {tab==='dashboard'&&<DashboardTab sharedResults={reportResults} onResultSaved={saveReportResult}/>}
          {tab==='explorer'&&<ExplorerTab onAsk={askQuestion} setDrawerTable={setDrawerTable} handleRightClick={handleRightClick}/>}
          {tab==='relationships'&&<div style={{flex:1,overflowY:'auto'}}><RelationshipsDiagram onTableClick={t=>setDrawerTable(t)}/></div>}
          {tab==='reports'&&<div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}><ReportsTab sharedResults={reportResults} onResultSaved={saveReportResult}/></div>}
          {tab==='stats'&&(
            <div style={{flex:1,overflowY:'auto',padding:24}}>
              <div style={{marginBottom:16}}><h2 style={{fontSize:17,fontWeight:700,color:C.text}}>Usage & Health</h2><p style={{fontSize:12.5,color:C.textMuted,marginTop:2}}>Northwind Demo · {new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'})}</p></div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(165px,1fr))',gap:10,marginBottom:16}}>
                {[['Queries Run','—','Connected'],['Tables','8/8','All annotated'],['Response','—','Via Qwezy AI'],['Members','1','Demo mode']].map(([l,v,s])=>(
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
                      <div style={{flex:1,height:4,background:C.bg,borderRadius:3,overflow:'hidden'}}>
                        <div style={{height:'100%',background:`linear-gradient(90deg,${t.color},${t.color}cc)`,borderRadius:3,width:`${85+(i*3)%15}%`}}/>
                      </div>
                      <span style={{fontSize:10.5,fontWeight:600,color:C.textMuted,width:30,textAlign:'right'}}>{85+(i*3)%15}%</span>
                    </div>
                  ))}
                </div>
                <div style={{background:C.codeBg,borderRadius:8,padding:14,border:'1px solid #21262D'}}>
                  <div style={{fontFamily:"'JetBrains Mono'",fontSize:11.5,color:'#3FB950',fontWeight:600,marginBottom:11}}>Query Performance</div>
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

      {/* Overlays */}
      {drawerTable&&<TableDrawer table={drawerTable} onClose={()=>setDrawerTable(null)} onAsk={askQuestion} onPreview={t=>{setPreviewTable(t);setDrawerTable(null)}}/>}
      {previewTable&&<PreviewModal table={previewTable} onClose={()=>setPreviewTable(null)}/>}
      {contextMenu&&<ContextMenu x={contextMenu.x} y={contextMenu.y} table={contextMenu.table} onClose={()=>setContextMenu(null)} onAsk={askQuestion} onPreview={t=>{setPreviewTable(t);setContextMenu(null)}} onDrawer={t=>{setDrawerTable(t);setContextMenu(null)}}/>}
    </div>
  )
}
