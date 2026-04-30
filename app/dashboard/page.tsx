'use client'
import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts'

const C = {
  navBg:'#022C22', navBorder:'#064E3B', navText:'#6EE7B7', navActive:'#10B981',
  bg:'#F4F8F5', sidebar:'#FBFDFC', sidebarBorder:'#D7E4DC',
  card:'#FFFFFF', cardBorder:'#D7E4DC',
  accent:'#059669', accentDark:'#047857', accentBg:'#ECFDF5',
  text:'#0F1923', textMuted:'#4B6358', textLight:'#7C9488',
  success:'#10B981', danger:'#EF4444', warn:'#F59E0B',
  codeBg:'#0D1117', codeText:'#7EE787',
  tableHead:'#F7FBF8', tableRowAlt:'#FCFDFC',
  greenBg:'#ECFDF5', greenBorder:'#B7E4CC',
  chatBg:'#F3F8F5',
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
const NORTHWIND_COMPANY_ID = '68065cb1-48d7-4488-bd78-9e354e6fb53f'
const SCHEMA_COLORS = ['#F59E0B','#8B5CF6','#06B6D4','#10B981','#059669','#0EA5E9','#F97316','#EF4444','#EC4899','#14B8A6']
function schemaToTables(data:any):any[] {
  if (!data) return []
  const colType=(dt:string)=>{
    const d=(dt||'').toLowerCase()
    if(/int|serial|numeric|decimal|float|real|double|money/.test(d)) return 'num'
    if(/date|time|timestamp/.test(d)) return 'date'
    if(/bool/.test(d)) return 'bool'
    return 'str'
  }
  // Primary path: /api/schema returns { tables: [...], table_count, column_count }
  if (data.tables && Array.isArray(data.tables)) {
    return data.tables.map((t:any,i:number)=>({
      name: t.name,
      schema: t.schema||'public',
      displayName: t.displayName||t.name,
      color: t.color||SCHEMA_COLORS[i%SCHEMA_COLORS.length],
      rows: t.rows!=null?String(t.rows):'',
      refresh:'', desc:t.desc||'', teams:t.teams||[], sampleQ:t.sampleQ||[],
      joins:t.joins||[], dateField:t.dateField||'', x:t.x||0, y:t.y||0,
      columns: Array.isArray(t.columns)
        ? t.columns.map((c:any)=>({n:c.n||c.column_name||c.name||String(c), t:c.t||colType(c.data_type||c.type||'')}))
        : []
    }))
  }
  // Fallback: flat object format
  let raw:Record<string,any[]> = {}
  if (data.schema) raw = data.schema
  else Object.keys(data).forEach(k=>{ if(Array.isArray(data[k])) raw[k]=data[k] })
  return Object.entries(raw).filter(([n])=>n).map(([name,cols],i)=>({
    name, schema:'public', displayName:name,
    color:SCHEMA_COLORS[i%SCHEMA_COLORS.length],
    rows:'', refresh:'', desc:'', teams:[], sampleQ:[], joins:[], dateField:'', x:0, y:0,
    columns: Array.isArray(cols)
      ? cols.map((c:any)=>({n:c.column_name||c.name||c.n||String(c), t:colType(c.data_type||c.type||c.t||'')}))
      : []
  }))
}
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

function inferJoinCount(table:any, allTables:any[] = []) {
  if (!table) return 0
  const explicit = Array.isArray(table.joins) ? table.joins.length : 0
  const tables = allTables.length ? allTables : TABLES
  const inferred = new Set<string>()
  ;(table.columns || []).forEach((c:any)=>{
    const name = c?.n || c?.name || ''
    if (!name || name === 'id' || !name.endsWith('_id')) return
    const base = name.slice(0, -3)
    const target = tables.find((t:any)=>
      t.name !== table.name && (
        t.name === base ||
        t.name === base + 's' ||
        t.name === base + 'es' ||
        t.name.startsWith(base)
      )
    )
    if (target) inferred.add(target.name)
  })
  return Math.max(explicit, inferred.size)
}

function normalizeConversation(raw:any): Conversation {
  return {
    id: raw.id,
    title: raw.title || 'New conversation',
    createdAt: new Date(raw.createdAt || raw.created_at || new Date()),
    updatedAt: new Date(raw.updatedAt || raw.updated_at || new Date()),
    messages: (raw.messages || []).map((m:any)=>({
      id: m.id,
      role: m.role,
      content: m.content || '',
      sql: m.sql || m.sql_query || undefined,
      rows: m.rows || m.result_rows || undefined,
      fields: m.fields || m.result_fields || undefined,
      duration: m.duration ?? m.duration_ms ?? undefined,
      confidence: m.confidence || undefined,
      assumptions: m.assumptions || undefined,
      uncertainAbout: m.uncertainAbout ?? m.uncertain_about ?? null,
      suggestedClarification: m.suggestedClarification ?? m.suggested_clarification ?? null,
      rewritten: m.rewritten || false,
      timestamp: new Date(m.timestamp || m.created_at || new Date()),
    }))
  }
}


function cleanLearnedQuestion(q:string){
  return q
    .replace(/\s+/g,' ')
    .replace(/[?]{2,}/g,'?')
    .trim()
}

function isWeakLearnedQuestion(q:string){
  const s = cleanLearnedQuestion(q).toLowerCase()
  if(!s) return true
  if(s.length < 8) return true
  if(/\b(id|uuid|pk|primary key)\b/.test(s)) return true
  if(/\baverage\s+(id|bar number|account number)\b/.test(s)) return true
  if(/^[a-z]+\s+[a-z]+\s+(email|phone)$/.test(s)) return true
  return false
}

function pickBestMetric(columns:any[] = []){
  const ranked = ['revenue','amount','total','balance','hours','rate','value','fee','cost','price']
  const names = columns.map((c:any)=>String(c?.n||'').toLowerCase())
  for(const key of ranked){
    const hit = names.find((n:string)=>n.includes(key) && !n.endsWith('_id') && n !== 'id')
    if(hit) return hit
  }
  const fallback = columns.find((c:any)=>c?.t==='num' && !String(c?.n||'').toLowerCase().endsWith('_id') && String(c?.n||'').toLowerCase() !== 'id')
  return fallback?.n || null
}

function buildProfessionalStarterQuestions(liveSchema:any[] = [], recentQuestions:string[] = [], isDemo=false){
  if(isDemo){
    return ['Top 10 customers by total revenue','Monthly revenue trend for 2025','Products below reorder level','Sales by employee this year']
  }

  const starters:string[] = []
  const seen = new Set<string>()
  const add = (q:string) => {
    const cleaned = cleanLearnedQuestion(q)
    const key = cleaned.toLowerCase()
    if(!cleaned || seen.has(key) || isWeakLearnedQuestion(cleaned)) return
    seen.add(key)
    starters.push(cleaned)
  }

    const names = liveSchema.map((t:any)=>String(t?.displayName||t?.name||'').toLowerCase())
  const hasName = (part:string) => names.some((n:string)=>n.includes(part))

  if(hasName('attorneys')){
    add('Show active attorneys by role')
    add('Which attorneys have the highest billed hours this month?')
    add('Which attorneys are below target monthly hours?')
  }
  if(hasName('clients')){
    add('Which clients generate the most revenue?')
    add('Which clients have overdue invoices right now?')
  }
  if(hasName('matters')){
    add('Show open matters by practice area')
    add('Which matters have the highest billed hours this month?')
  }
  if(hasName('invoices')){
    add('Show overdue invoices by client')
    add('What is the collections trend over time?')
  }
  if(hasName('trust_accounts')){
    add('Show trust account balances by matter')
  }
  if(hasName('time_entries')){
    add('Show billable hours trend over time')
  }
  if(hasName('billing_rates')){
    add('Show billing rates by attorney and practice area')
  }

  for(const t of liveSchema.slice(0,8)){
    const columns = Array.isArray(t?.columns) ? t.columns : []
    const metric = pickBestMetric(columns)
    const lowerCols = columns.map((c:any)=>String(c?.n||'').toLowerCase())
    const entity = String(t?.name||'records').replace(/_/g,' ')
    if(metric) add(`Top ${entity} by ${String(metric).replace(/_/g,' ')}`)
    if(lowerCols.some((c:string)=>c==='status')) add(`Show active ${entity}`)
    if(lowerCols.some((c:string)=>/(date|month|year|time)$/.test(c))) add(`Show ${entity} trend over time`)
  }

  for(const q of recentQuestions){
    add(q)
  }

  return starters.slice(0,4)
}

function buildProfessionalFollowUps(rows:any[] = [], fields:string[] = []){
  const suggestions:string[] = []
  const seen = new Set<string>()
  const add = (q:string) => {
    if(!q || seen.has(q)) return
    seen.add(q)
    suggestions.push(q)
  }

  const lowerFields = fields.map(f=>String(f).toLowerCase())
  const sample = rows?.[0] || {}
  const isNumericField = (f:string) => /^-?\d+(\.\d+)?$/.test(String(sample?.[f] ?? ''))
  const nonIdNumeric = fields.find(f => isNumericField(f) && !/(^id$|_id$|number$|bar_number|account_number)/i.test(f))
  const moneyField = fields.find(f => /(amount|total|revenue|balance|rate|fee|cost|price|value)/i.test(f))
  const hoursField = fields.find(f => /(hours|time|duration|utilization)/i.test(f))
  const roleField = lowerFields.find(f => f==='role' || f.includes('title'))
  const statusField = lowerFields.find(f => f==='status' || f.includes('active'))
  const locationField = lowerFields.find(f => /(city|state|country|region)/.test(f))
  const dateField = lowerFields.find(f => /(date|month|year|time)/.test(f))
  const clientField = lowerFields.find(f => /(client|company_name|contact_name)/.test(f))
  const matterField = lowerFields.find(f => /(matter|practice_area)/.test(f))

  if(roleField) add('Break this down by role')
  if(statusField) add('Show only active records')
  if(locationField) add('Break this down by location')
  if(dateField) add('Show the trend over time')
  if(clientField && (moneyField || hoursField || nonIdNumeric)) add('Which clients are driving the most value?')
  if(matterField && (moneyField || hoursField || nonIdNumeric)) add('Which matters are contributing the most?')
  if(moneyField) add(`Show the top 10 by ${moneyField.replace(/_/g,' ')}`)
  else if(hoursField) add(`Show the top 10 by ${hoursField.replace(/_/g,' ')}`)
  else if(nonIdNumeric) add(`Show the top 10 by ${nonIdNumeric.replace(/_/g,' ')}`)
  add('Explain what this means for the business')

  return suggestions.slice(0,3)
}


function stableShuffleQuestions(items:string[], seed:number){
  const arr = [...items]
  let s = seed || 1
  const next = () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(next() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}


function OverlaySpinner({label='Loading…'}:{label?:string}) {
  return (
    <div style={{position:'absolute',inset:0,background:'rgba(246,249,252,0.72)',backdropFilter:'blur(1px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:20,pointerEvents:'none'}}>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
        <div className='spin' style={{width:22,height:22,borderRadius:'50%',border:'2px solid #D1FAE5',borderTopColor:C.accent}} />
        <span style={{fontSize:12.5,color:C.textMuted,fontFamily:'Inter,sans-serif'}}>{label}</span>
      </div>
    </div>
  )
}


function BrowserShell({children, style}:{children:any, style?:any}) {
  return (
    <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:24,boxShadow:'0 24px 54px rgba(10,35,28,0.08)',overflow:'hidden', ...style}}>
      <div style={{height:34,display:'flex',alignItems:'center',padding:'0 14px',borderBottom:`1px solid ${C.cardBorder}`,background:'#F7FBF8'}}>
        <div style={{display:'flex',gap:6}}>{['#D1D9D5','#D1D9D5','#D1D9D5'].map((c,i)=><span key={i} style={{width:8,height:8,borderRadius:'50%',background:c,display:'block'}} />)}</div>
        <div style={{margin:'0 auto',width:'44%',height:10,borderRadius:999,background:'#E5ECE8'}} />
      </div>
      {children}
    </div>
  )
}

function LandingKpi({label,value,highlight=false}:{label:string,value:string,highlight?:boolean}) {
  return (
    <div style={{padding:16,borderRadius:18,border:`1px solid ${highlight?C.greenBorder:C.cardBorder}`,background:highlight?C.greenBg:'#FBFDFC'}}>
      <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:C.textLight,marginBottom:8}}>{label}</div>
      <div style={{fontSize:34,fontWeight:800,letterSpacing:'-0.05em',color:C.navBg}}>{value}</div>
    </div>
  )
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
    <div style={{background:C.card,borderRadius:18,border:`1px solid ${C.cardBorder}`,overflow:'hidden',boxShadow:'0 12px 28px rgba(10,35,28,0.05)'}}>
      {!compact&&<div style={{padding:'10px 14px',borderBottom:`1px solid ${C.cardBorder}`,display:'flex',gap:8,alignItems:'center',background:C.tableHead}}>
        <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter rows…"
          style={{padding:'8px 11px',borderRadius:12,border:`1px solid ${C.cardBorder}`,fontSize:12.5,color:C.text,fontFamily:'Inter,sans-serif',width:150,background:'#fff'}}/>
        <span style={{fontSize:11.5,color:C.textLight}}>{data.length}/{rows.length} rows</span>
        {sort&&<span style={{fontSize:11.5,color:C.accent,marginLeft:4}}>Sorted by {sort.replace(/_/g,' ')} {dir==='asc'?'↑':'↓'} · <button onClick={()=>setSort(null)} style={{background:'none',border:'none',color:C.textLight,cursor:'pointer',fontSize:11,fontFamily:'Inter,sans-serif'}}>clear</button></span>}
      </div>}
      <div style={{overflowX:'auto',maxHeight:compact?180:300}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead style={{position:'sticky',top:0,zIndex:1}}>
            <tr style={{background:C.tableHead}}>
              {fields.filter(f=>vis.includes(f)).map(f=><th key={f} onClick={()=>toggleSort(f)}
                style={{padding:compact?'8px 10px':'10px 14px',textAlign:'left',fontSize:10.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',whiteSpace:'nowrap',cursor:'pointer',userSelect:'none',borderBottom:`1px solid ${C.cardBorder}`}}
                onMouseOver={e=>(e.currentTarget.style.color=C.accent)} onMouseOut={e=>(e.currentTarget.style.color=C.textLight)}>
                {f.replace(/_/g,' ')} {sort===f?(dir==='asc'?'↑':'↓'):''}
              </th>)}
            </tr>
          </thead>
          <tbody>
            {data.map((row,i)=><tr key={i} style={{borderTop:`1px solid #F1F5F9`,background:i%2===0?'#fff':C.tableRowAlt}}
              onMouseOver={e=>(e.currentTarget.style.background='#F0F7FF')} onMouseOut={e=>(e.currentTarget.style.background=i%2===0?'#fff':C.tableRowAlt)}>
              {fields.filter(f=>vis.includes(f)).map(f=><td key={f} style={{padding:compact?'8px 10px':'10px 14px',fontSize:12.5,color:C.text,whiteSpace:'nowrap'}}>
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
function TableDrawer({table,onClose,onAsk,onPreview,allTables=[]}:{table:any,onClose:()=>void,onAsk:(q:string)=>void,onPreview:(t:any)=>void,allTables?:any[]}) {
  const joinCount = inferJoinCount(table, allTables)
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
          {[['Rows',table.rows],['Refresh',table.refresh],['Joins',String(joinCount)]].map(([k,v])=>(
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
    fetch('/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customSQL:`SELECT * FROM ${table.schema&&table.schema!=='public'?table.schema+'.'+table.name:table.name}${table.dateField?' ORDER BY '+table.dateField+' DESC':''} LIMIT 100`})})
      .then(r=>r.json()).then(d=>{if(d.error)setErr(d.error);else{setRows(d.rows);setFields(d.fields)}})
      .catch(e=>setErr(e.message)).finally(()=>setLoading(false))
  },[table.name])
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(15,25,35,0.6)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'#fff',borderRadius:10,width:'100%',maxWidth:920,maxHeight:'88vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
        <div style={{padding:'12px 18px',borderBottom:`1px solid ${C.cardBorder}`,display:'flex',alignItems:'center',gap:9}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:table.color}}/>
          <span style={{fontFamily:"'JetBrains Mono'",fontWeight:600,fontSize:14,color:C.text}}>{table.name}</span>
          <span style={{fontSize:12,color:C.textLight}}>Top 100 rows{table.dateField?` · ordered by ${table.dateField} DESC`:''}</span>
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

// ── Table Info Panel (Snowflake-style) ────────────────────────────────────────
// Shown on hover in sidebar, right-click in sidebar/explorer/schema
const TABLE_META: Record<string,{size:string,updated:string,owner:string,contact:string}> = {
  orders:       {size:'6.2 MB',  updated:'Today',        owner:'Sales Ops',    contact:'ops@company.com'},
  order_details:{size:'14.8 MB', updated:'Today',        owner:'Finance',      contact:'finance@company.com'},
  customers:    {size:'0.4 MB',  updated:'Weekly',       owner:'CRM Team',     contact:'crm@company.com'},
  employees:    {size:'0.1 MB',  updated:'Monthly',      owner:'HR',           contact:'hr@company.com'},
  products:     {size:'0.8 MB',  updated:'Daily',        owner:'Inventory',    contact:'inventory@company.com'},
  categories:   {size:'0.05 MB', updated:'As needed',    owner:'Product Team', contact:'product@company.com'},
  suppliers:    {size:'0.2 MB',  updated:'Monthly',      owner:'Procurement',  contact:'procurement@company.com'},
  shippers:     {size:'0.02 MB', updated:'As needed',    owner:'Logistics',    contact:'logistics@company.com'},
}

function TableInfoPanel({table,x,y,onClose,onAsk,onPreview,onGrid,onDrawer,showActions=true}:{
  table:any, x:number, y:number, onClose:()=>void,
  onAsk:(q:string)=>void, onPreview:(t:any)=>void, onGrid:(t:any)=>void, onDrawer:(t:any)=>void,
  showActions?:boolean
}) {
  type RuleType = 'metric'|'interpretation'|'formatting'|'exclusion'|'preferred_field'|'join_note'|'general_note'
  type RuleRow = { id:string, type:RuleType, target:string, value:string }

  const [activeTab,setActiveTab]=useState<'summary'|'admin'|'ai_notes'>('summary')
  const [metaLoading,setMetaLoading]=useState(false)
  const [metaSaving,setMetaSaving]=useState(false)
  const [canEditMeta,setCanEditMeta]=useState(false)
  const [selectedCol,setSelectedCol]=useState<string>('')
  const [tableMeta,setTableMeta]=useState<any>({ summary:'', owner:'', point_of_contact:'', teams:[], preferred_metric_logic:'', additional_notes:'', rules:[] })
  const [columnMeta,setColumnMeta]=useState<Record<string, any>>({})

  const schema = table?.schema || 'public'
  const joinCount = inferJoinCount(table)
  const panelW = 420

  useEffect(()=>{
    const close=(e:MouseEvent)=>{
      const el=document.getElementById('table-info-panel')
      if(el && !el.contains(e.target as Node)) onClose()
    }
    const t=setTimeout(()=>document.addEventListener('mousedown', close), 100)
    return()=>{ clearTimeout(t); document.removeEventListener('mousedown', close) }
  },[onClose])

  useEffect(()=>{
    let cancelled = false
    ;(async()=>{
      try{
        setMetaLoading(true)
        const res = await fetch(`/api/metadata?table=${encodeURIComponent(table.name)}&schema=${encodeURIComponent(schema)}`, { cache:'no-store' })
        const data = await res.json().catch(()=>({}))
        if(cancelled) return
        if(res.ok){
          setCanEditMeta(!!data?.canEdit)
          setTableMeta({
            summary: data?.tableMeta?.summary || table?.desc || '',
            owner: data?.tableMeta?.owner || '',
            point_of_contact: data?.tableMeta?.point_of_contact || '',
            teams: Array.isArray(data?.tableMeta?.teams) ? data.tableMeta.teams : (table?.teams || []),
            preferred_metric_logic: data?.tableMeta?.preferred_metric_logic || '',
            additional_notes: data?.tableMeta?.additional_notes || '',
            rules: Array.isArray(data?.tableMeta?.rules) ? data.tableMeta.rules.map((r:any)=>({ id:r.id || crypto.randomUUID(), type:r.type || 'general_note', target:r.target || '', value:r.value || '' })) : [],
          })
          setColumnMeta(data?.columnMeta || {})
        }
        setSelectedCol(prev=>prev || table?.columns?.[0]?.n || '')
      } finally {
        if(!cancelled) setMetaLoading(false)
      }
    })()
    return()=>{cancelled=true}
  },[table?.name, schema])

  const saveMetadata = async()=>{
    try{
      setMetaSaving(true)
      const payload = {
        table: table.name,
        schema,
        tableMeta: {
          summary: tableMeta.summary || '',
          owner: tableMeta.owner || '',
          point_of_contact: tableMeta.point_of_contact || '',
          teams: Array.isArray(tableMeta.teams) ? tableMeta.teams : String(tableMeta.teams || '').split(',').map((s:string)=>s.trim()).filter(Boolean),
          preferred_metric_logic: tableMeta.preferred_metric_logic || '',
          additional_notes: tableMeta.additional_notes || '',
          rules: Array.isArray(tableMeta.rules) ? tableMeta.rules : [],
        },
        columnMeta,
      }
      const res = await fetch('/api/metadata', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      })
      const data = await res.json().catch(()=>({}))
      if(!res.ok) throw new Error(data?.error || 'Failed to save metadata')
    }catch(err:any){
      alert(err?.message || 'Failed to save metadata')
    }finally{
      setMetaSaving(false)
    }
  }

  const updateRule = (id:string, patch:Partial<RuleRow>)=> setTableMeta((m:any)=>({...m, rules:(m.rules||[]).map((r:RuleRow)=>r.id===id?{...r,...patch}:r)}))
  const addRule = ()=> setTableMeta((m:any)=>({...m, rules:[...(m.rules||[]), { id:crypto.randomUUID(), type:'metric', target:'', value:'' }]}))
  const removeRule = (id:string)=> setTableMeta((m:any)=>({...m, rules:(m.rules||[]).filter((r:RuleRow)=>r.id!==id)}))

  const selectedColumnMeta = columnMeta[selectedCol] || { description:'', ai_notes:'', preferred_label:'', display_format:'', synonyms:[] }
  const recommended = table?.sampleQ?.length ? table.sampleQ : [`Show me all ${table.name}`, `What does ${table.name} track?`, `Which ${table.name} records matter most?`]
  const right = 0
  const top = 49

  return(
    <div id="table-info-panel" style={{ position:'fixed', right, top:58, bottom:18, width:panelW, background:'#fff', border:`1px solid ${C.cardBorder}`, borderRadius:24, boxShadow:'0 24px 54px rgba(10,35,28,0.10)', zIndex:600, overflow:'hidden', fontFamily:'Inter,sans-serif', display:'flex', flexDirection:'column' }} onClick={e=>e.stopPropagation()}>
      <div className="browserBar" style={{height:40,borderBottom:`1px solid ${C.cardBorder}`}}>
        <div style={{display:'flex',gap:6,marginRight:8}}><span style={{width:8,height:8,borderRadius:'50%',background:'#D1D9D5',display:'block'}}></span><span style={{width:8,height:8,borderRadius:'50%',background:'#D1D9D5',display:'block'}}></span><span style={{width:8,height:8,borderRadius:'50%',background:'#D1D9D5',display:'block'}}></span></div>
        <div style={{width:8,height:8,borderRadius:'50%',background:table.color,flexShrink:0}}/>
        <span style={{fontSize:12.5,fontWeight:800,color:C.text,fontFamily:"'JetBrains Mono'",flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{table.name}</span>
        <button onClick={onClose} style={{background:'none',border:'none',color:C.textLight,cursor:'pointer',fontSize:14,lineHeight:1,padding:0}}>×</button>
      </div>

      <div style={{display:'flex',borderBottom:`1px solid ${C.cardBorder}`,background:'#FAFAFA'}}>
        <button onClick={()=>setActiveTab('summary')} style={{flex:1,padding:'9px 0',fontSize:12,fontWeight:600,color:activeTab==='summary'?C.accent:C.textLight,background:'none',border:'none',borderBottom:`2px solid ${activeTab==='summary'?C.accent:'transparent'}`,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Summary</button>
        <button onClick={()=>setActiveTab('admin')} style={{flex:1,padding:'9px 0',fontSize:12,fontWeight:600,color:activeTab==='admin'?C.accent:C.textLight,background:'none',border:'none',borderBottom:`2px solid ${activeTab==='admin'?C.accent:'transparent'}`,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Admin</button>
        <button onClick={()=>setActiveTab('ai_notes')} style={{flex:1,padding:'9px 0',fontSize:12,fontWeight:600,color:activeTab==='ai_notes'?C.accent:C.textLight,background:'none',border:'none',borderBottom:`2px solid ${activeTab==='ai_notes'?C.accent:'transparent'}`,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>AI Notes</button>
      </div>

      <div style={{flex:1,overflowY:activeTab==='ai_notes'?'hidden':'auto',padding:'14px 14px 18px',position:'relative'}}>
        {metaLoading && <OverlaySpinner label='Loading table details…' />}

        {!metaLoading && activeTab==='summary' && (
          <div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
              {[[ 'Rows', table.rows || '—' ], [ 'Joins', String(joinCount) ]].map(([k,v])=>(
                <div key={String(k)} style={{background:'#FBFDFC',border:`1px solid ${C.cardBorder}`,borderRadius:16,padding:'12px 12px'}}>
                  <div style={{fontSize:10,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:700,marginBottom:4}}>{k}</div>
                  <div style={{fontSize:14,fontWeight:700,color:C.text}}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{fontSize:10.5,fontWeight:700,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>Columns</div>
            <div style={{background:'#FBFDFC',border:`1px solid ${C.cardBorder}`,borderRadius:16,overflow:'hidden',marginBottom:14}}>
              {(table.columns||[]).map((c:any,i:number)=>(
                <div key={c.n} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderTop:i?`1px solid ${C.cardBorder}`:'none'}}>
                  <span style={{width:7,height:7,borderRadius:'50%',background:TC[c.t]||'#8A9BB0',flexShrink:0}}/>
                  <span style={{fontSize:10.5,color:TC[c.t]||C.textLight,fontFamily:"'JetBrains Mono'",width:32,flexShrink:0}}>{c.t}</span>
                  <span style={{fontFamily:"'JetBrains Mono'",fontSize:12.5,color:C.text}}>{c.n}</span>
                </div>
              ))}
            </div>

            <div style={{fontSize:10.5,fontWeight:700,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>Summary</div>
            <div style={{display:'grid',gridTemplateColumns:'140px 1fr',rowGap:8,columnGap:10,marginBottom:14}}>
              <div style={{fontSize:12,color:C.textLight}}>Name</div><div style={{fontSize:12.5,color:C.text,fontWeight:600}}>{table.name}</div>
              <div style={{fontSize:12,color:C.textLight}}>Point of contact</div><div style={{fontSize:12.5,color:C.text,fontWeight:600}}>{tableMeta.point_of_contact || '—'}</div>
              <div style={{fontSize:12,color:C.textLight}}>Team</div><div style={{fontSize:12.5,color:C.text,fontWeight:600}}>{Array.isArray(tableMeta.teams)&&tableMeta.teams.length?tableMeta.teams.join(', '):(table.teams?.join(', ')||'—')}</div>
              <div style={{fontSize:12,color:C.textLight,alignSelf:'start'}}>Summary</div><div style={{fontSize:12.5,color:C.text,lineHeight:1.55}}>{tableMeta.summary || table.desc || 'No summary yet.'}</div>
            </div>

            <div style={{fontSize:10.5,fontWeight:700,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>Recommended questions to ask AI</div>
            <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:14}}>
              {recommended.map((q:string)=><button key={q} onClick={()=>{onAsk(q);onClose()}} style={{textAlign:'left',padding:'7px 10px',border:`1px solid ${C.cardBorder}`,borderRadius:6,background:'#fff',fontSize:12.5,color:C.textMuted,cursor:'pointer'}}>{q}</button>)}
            </div>
          </div>
        )}

        {!metaLoading && activeTab==='admin' && (
          <div style={{display:'grid',gap:12}}>
            <div>
              <div style={{fontSize:10.5,fontWeight:700,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>Summary</div>
              <textarea value={tableMeta.summary || ''} onChange={e=>setTableMeta((m:any)=>({...m,summary:e.target.value}))} placeholder='Business summary shown to everyone' style={{width:'100%',minHeight:84,padding:'10px 12px',border:`1px solid ${C.cardBorder}`,borderRadius:8,fontSize:12.5,fontFamily:'Inter,sans-serif',resize:'vertical'}}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <input value={tableMeta.point_of_contact || ''} onChange={e=>setTableMeta((m:any)=>({...m,point_of_contact:e.target.value}))} placeholder="Point of contact" style={{padding:'8px 10px',border:`1px solid ${C.cardBorder}`,borderRadius:6,fontSize:12.5}}/>
              <input value={tableMeta.owner || ''} onChange={e=>setTableMeta((m:any)=>({...m,owner:e.target.value}))} placeholder="Owner" style={{padding:'8px 10px',border:`1px solid ${C.cardBorder}`,borderRadius:6,fontSize:12.5}}/>
              <input value={Array.isArray(tableMeta.teams)?tableMeta.teams.join(', '):String(tableMeta.teams || '')} onChange={e=>setTableMeta((m:any)=>({...m,teams:e.target.value.split(',').map((s:string)=>s.trim()).filter(Boolean)}))} placeholder="Teams (comma separated)" style={{padding:'8px 10px',border:`1px solid ${C.cardBorder}`,borderRadius:6,fontSize:12.5,gridColumn:'1 / span 2'}}/>
            </div>
            <div>
              <div style={{fontSize:10.5,fontWeight:700,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>Per-column settings</div>
              <div style={{display:'grid',gridTemplateColumns:'130px 1fr',gap:10}}>
                <div style={{maxHeight:240,overflowY:'auto',border:`1px solid ${C.cardBorder}`,borderRadius:8,padding:4}}>
                  {(table.columns||[]).map((col:any)=>{
                    const active = selectedCol===col.n
                    return <button key={col.n} onClick={()=>setSelectedCol(col.n)} style={{display:'block',width:'100%',textAlign:'left',padding:'7px 8px',marginBottom:4,borderRadius:6,border:`1px solid ${active?C.accent:C.cardBorder}`,background:active?C.accentBg:'#fff',fontFamily:"'JetBrains Mono'",fontSize:11.5,color:active?C.accentDark:C.text,cursor:'pointer'}}>{col.n}</button>
                  })}
                </div>
                <div style={{display:'grid',gap:8}}>
                  <input value={selectedColumnMeta.preferred_label || ''} onChange={e=>setColumnMeta((prev:any)=>({...prev,[selectedCol]:{...(prev[selectedCol]||{}),preferred_label:e.target.value}}))} placeholder="Preferred label" style={{padding:'8px 10px',border:`1px solid ${C.cardBorder}`,borderRadius:6,fontSize:12.5}}/>
                  <input value={selectedColumnMeta.display_format || ''} onChange={e=>setColumnMeta((prev:any)=>({...prev,[selectedCol]:{...(prev[selectedCol]||{}),display_format:e.target.value}}))} placeholder="Display format" style={{padding:'8px 10px',border:`1px solid ${C.cardBorder}`,borderRadius:6,fontSize:12.5}}/>
                  <input value={Array.isArray(selectedColumnMeta.synonyms)?selectedColumnMeta.synonyms.join(', '):''} onChange={e=>setColumnMeta((prev:any)=>({...prev,[selectedCol]:{...(prev[selectedCol]||{}),synonyms:e.target.value.split(',').map((s:string)=>s.trim()).filter(Boolean)}}))} placeholder="Synonyms (comma separated)" style={{padding:'8px 10px',border:`1px solid ${C.cardBorder}`,borderRadius:6,fontSize:12.5}}/>
                  <textarea value={selectedColumnMeta.description || ''} onChange={e=>setColumnMeta((prev:any)=>({...prev,[selectedCol]:{...(prev[selectedCol]||{}),description:e.target.value}}))} placeholder="Column summary" style={{minHeight:72,padding:'8px 10px',border:`1px solid ${C.cardBorder}`,borderRadius:6,fontSize:12.5,fontFamily:'Inter,sans-serif',resize:'vertical'}}/>
                  <textarea value={selectedColumnMeta.ai_notes || ''} onChange={e=>setColumnMeta((prev:any)=>({...prev,[selectedCol]:{...(prev[selectedCol]||{}),ai_notes:e.target.value}}))} placeholder="Column AI note" style={{minHeight:72,padding:'8px 10px',border:`1px solid ${C.cardBorder}`,borderRadius:6,fontSize:12.5,fontFamily:'Inter,sans-serif',resize:'vertical'}}/>
                </div>
              </div>
            </div>
            <div style={{display:'flex',justifyContent:'flex-end'}}><button onClick={saveMetadata} disabled={metaSaving} style={{padding:'8px 14px',border:'none',borderRadius:6,background:C.accent,color:'#fff',fontWeight:600,cursor:'pointer',opacity:metaSaving?0.7:1}}>{metaSaving?'Saving…':'Save admin notes'}</button></div>
          </div>
        )}

        {!metaLoading && activeTab==='ai_notes' && (
          <div style={{display:'grid',gap:12,height:'100%',alignContent:'start'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:12.5,fontWeight:700,color:C.text}}>Rules</div>
              <button onClick={addRule} style={{padding:'6px 10px',border:`1px solid ${C.cardBorder}`,borderRadius:6,background:'#fff',fontSize:12.5,cursor:'pointer'}}>+ Add rule</button>
            </div>
            <div style={{display:'grid',gap:8}}>
              {(tableMeta.rules||[]).length===0 && <div style={{fontSize:12.5,color:C.textLight}}>No rules yet.</div>}
              {(tableMeta.rules||[]).map((rule:RuleRow)=>(
                <div key={rule.id} style={{display:'grid',gridTemplateColumns:'120px 1fr 1.3fr 32px',gap:8,alignItems:'center'}}>
                  <select value={rule.type} onChange={e=>updateRule(rule.id,{type:e.target.value as RuleType,target:'',value:''})} style={{padding:'8px 8px',border:`1px solid ${C.cardBorder}`,borderRadius:6,fontSize:12.5}}>
                    <option value='metric'>Metric</option>
                    <option value='interpretation'>Interpretation</option>
                    <option value='formatting'>Formatting</option>
                    <option value='exclusion'>Exclusion</option>
                    <option value='preferred_field'>Preferred field</option>
                    <option value='join_note'>Join note</option>
                    <option value='general_note'>General note</option>
                  </select>

                  {rule.type==='formatting' ? (
                    <select value={rule.target} onChange={e=>updateRule(rule.id,{target:e.target.value})} style={{padding:'8px 10px',border:`1px solid ${C.cardBorder}`,borderRadius:6,fontSize:12.5}}>
                      <option value=''>Select column</option>
                      <option value='all date fields'>All date fields</option>
                      <option value='all amount fields'>All amount fields</option>
                      <option value='all currency fields'>All currency fields</option>
                      {(table.columns||[]).map((col:any)=><option key={col.n} value={col.n}>{col.n}</option>)}
                    </select>
                  ) : rule.type==='preferred_field' ? (
                    <select value={rule.target} onChange={e=>updateRule(rule.id,{target:e.target.value})} style={{padding:'8px 10px',border:`1px solid ${C.cardBorder}`,borderRadius:6,fontSize:12.5}}>
                      <option value=''>Select concept / column</option>
                      <option value='client name'>Client name</option>
                      <option value='matter name'>Matter name</option>
                      <option value='status'>Status</option>
                      {(table.columns||[]).map((col:any)=><option key={col.n} value={col.n}>{col.n}</option>)}
                    </select>
                  ) : (
                    <input value={rule.target} onChange={e=>updateRule(rule.id,{target:e.target.value})} placeholder={rule.type==='metric'?'Metric name':rule.type==='interpretation'?'Phrase or term':rule.type==='exclusion'?'What to exclude':rule.type==='join_note'?'Join target':'Target'} style={{padding:'8px 10px',border:`1px solid ${C.cardBorder}`,borderRadius:6,fontSize:12.5}}/>
                  )}

                  <input value={rule.value} onChange={e=>updateRule(rule.id,{value:e.target.value})} placeholder={rule.type==='formatting'?'Format or note (e.g. MM/DD/YYYY)':rule.type==='interpretation'?'Meaning / logic':rule.type==='metric'?'How it should be calculated':rule.type==='preferred_field'?'Which field to prefer and why':rule.type==='exclusion'?'Exclusion rule':rule.type==='join_note'?'Join logic / note':'Logic / meaning / caveat'} style={{padding:'8px 10px',border:`1px solid ${C.cardBorder}`,borderRadius:6,fontSize:12.5}}/>

                  <button onClick={()=>removeRule(rule.id)} style={{width:32,height:32,border:`1px solid ${C.cardBorder}`,borderRadius:6,background:'#fff',color:C.danger,cursor:'pointer'}}>×</button>
                </div>
              ))}
            </div>
            <div>
              <div style={{fontSize:10.5,fontWeight:700,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>Additional notes</div>
              <textarea value={tableMeta.additional_notes || ''} onChange={e=>setTableMeta((m:any)=>({...m,additional_notes:e.target.value}))} placeholder='Anything unusual that should still be fed to the AI...' style={{width:'100%',minHeight:96,padding:'10px 12px',border:`1px solid ${C.cardBorder}`,borderRadius:8,fontSize:12.5,fontFamily:'Inter,sans-serif',resize:'vertical'}}/>
            </div>
            <div style={{display:'flex',justifyContent:'flex-end'}}><button onClick={saveMetadata} disabled={metaSaving} style={{padding:'8px 14px',border:'none',borderRadius:6,background:C.accent,color:'#fff',fontWeight:600,cursor:'pointer',opacity:metaSaving?0.7:1}}>{metaSaving?'Saving…':'Save AI notes'}</button></div>
          </div>
        )}
      </div>

      {showActions&&(
        <div style={{borderTop:`1px solid ${C.cardBorder}`,padding:'10px 12px',display:'flex',flexDirection:'column',gap:6,background:'#FAFAFA'}}>
          {[
            ['🗂 Open as spreadsheet', ()=>{onGrid(table);onClose()}],
            ['👁 View top 100 rows',    ()=>{onPreview(table);onClose()}],
            ['💬 Ask a question',      ()=>{onAsk(`Tell me about the ${table.name} table`);onClose()}],
                        ['📋 Copy table name',     ()=>{navigator.clipboard?.writeText(table.name);onClose()}],
          ].map(([label,fn]:any)=>(
            <button key={label} onClick={fn}
              style={{display:'flex',alignItems:'center',width:'100%',padding:'6px 4px',background:'none', border:'none',fontSize:12.5,color:C.text,cursor:'pointer',fontFamily:'Inter,sans-serif', textAlign:'left',borderRadius:4}}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ContextMenu({x,y,table,onClose,onAsk,onPreview,onDrawer,onGrid}:{x:number,y:number,table:any,onClose:()=>void,onAsk:(q:string)=>void,onPreview:(t:any)=>void,onDrawer:(t:any)=>void,onGrid:(t:any)=>void}) {
  useEffect(()=>{const h=()=>onClose();window.addEventListener('click',h);return()=>window.removeEventListener('click',h)},[])
  return(
    <div style={{position:'fixed',left:x,top:y,background:'#fff',borderRadius:7,border:`1px solid ${C.cardBorder}`,boxShadow:'0 6px 20px rgba(0,0,0,0.1)',zIndex:500,minWidth:200,overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
      <div style={{padding:'5px 11px',borderBottom:`1px solid ${C.cardBorder}`,background:C.tableHead}}>
        <span style={{fontSize:10.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em'}}>{table.name}</span>
      </div>
      {[['Open as spreadsheet',()=>{onGrid(table);onClose()}],['View top 100 rows',()=>{onPreview(table);onClose()}],['Ask a question',()=>{onAsk(`Tell me about the ${table.name} table`);onClose()}],['Copy table name',()=>{navigator.clipboard?.writeText(table.name);onClose()}]].map(([label,fn]:any)=>(
        <button key={label} onClick={fn}
          style={{display:'flex',alignItems:'center',width:'100%',padding:'8px 12px',background:'none',border:'none',fontSize:13,color:C.text,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left'}}
          onMouseOver={e=>{e.currentTarget.style.background='#FFFFFF'; e.currentTarget.style.borderColor=C.cardBorder; e.currentTarget.style.boxShadow='0 10px 24px rgba(10,35,28,0.05)'}} onMouseOut={e=>e.currentTarget.style.background='none'}>
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Relationships Diagram ─────────────────────────────────────────────────────
function RelationshipsDiagram({onTableClick,onTableContext,displayTables=TABLES}:{onTableClick:(t:any)=>void,onTableContext?:(t:any,x:number,y:number)=>void,displayTables?:any[]}) {
  const [hov,setHov]=useState<string|null>(null)
  const [hovEdge,setHovEdge]=useState<string|null>(null)
  const [tooltip,setTooltip]=useState<{x:number,y:number,label:string}|null>(null)

  // Infer relationships from column naming conventions when explicit FK joins are missing
  // e.g. billing_rates.attorney_id → attorneys.id
  const inferredEdges = useMemo(()=>{
    const allNames = new Set(displayTables.map((t:any)=>t.name))
    const edges:any[] = []
    const seen = new Set<string>()
    displayTables.forEach((t:any)=>{
      ;(t.columns||[]).forEach((c:any)=>{
        if(!c.n.endsWith('_id')||c.n==='id') return
        const base = c.n.slice(0,-3) // e.g. attorney_id → attorney
        const target = displayTables.find((t2:any)=>
          t2.name===base||t2.name===base+'s'||t2.name===base+'es'||t2.name.startsWith(base)
        )
        if(!target||target.name===t.name) return
        const key=[t.name,target.name].sort().join('—')
        if(seen.has(key)) return
        seen.add(key)
        edges.push({from:t.name,to:target.name,on:c.n,key:`${t.name}-${target.name}`})
      })
    })
    // Also use explicit joins if present
    displayTables.forEach((t:any)=>{
      ;(t.joins||[]).forEach((j:any)=>{
        const key=[t.name,j.to].sort().join('—')
        if(seen.has(key)) return
        seen.add(key)
        edges.push({from:t.name,to:j.to,on:j.on,key:`${t.name}-${j.to}`})
      })
    })
    return edges
  },[displayTables])

  const isNorthwind = displayTables===TABLES||displayTables.some((t:any)=>t.name==='order_details')

  // Real company: structured relationship list
  if(!isNorthwind) return (
    <div style={{padding:'20px 24px',fontFamily:"'Inter',sans-serif"}}>
      <h2 style={{fontSize:17,fontWeight:600,color:C.text,marginBottom:4,letterSpacing:'-0.3px'}}>Table Relationships</h2>
      <p style={{fontSize:12.5,color:C.textMuted,marginBottom:20}}>Inferred from column naming conventions · Click any table to inspect</p>
      {inferredEdges.length===0&&(
        <div style={{textAlign:'center',padding:'40px 20px',color:C.textLight,fontSize:13.5}}>No relationships detected yet — run AI analysis in Admin to configure.</div>
      )}
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {inferredEdges.map((e:any)=>{
          const fromTbl=displayTables.find((t:any)=>t.name===e.from)
          const toTbl=displayTables.find((t:any)=>t.name===e.to)
          return(
            <div key={e.key} style={{background:'#fff',borderRadius:8,border:`1px solid ${C.cardBorder}`,padding:'11px 16px',display:'flex',alignItems:'center',gap:12}}>
              <div style={{display:'flex',alignItems:'center',gap:6,minWidth:160}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:fromTbl?.color||C.accent}}/>
                <span style={{fontFamily:"'JetBrains Mono'",fontSize:12.5,fontWeight:600,color:C.text}}>{fromTbl?.displayName||e.from}</span>
              </div>
              <div style={{flex:1,display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:11,background:'#F1F5F9',padding:'2px 8px',borderRadius:4,fontFamily:"'JetBrains Mono'",color:C.textMuted}}>{e.on}</span>
                <span style={{color:C.textLight,fontSize:14}}>→</span>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:toTbl?.color||C.accent}}/>
                  <span style={{fontFamily:"'JetBrains Mono'",fontSize:12.5,fontWeight:600,color:C.text}}>{toTbl?.displayName||e.to}</span>
                </div>
                <span style={{fontSize:11,background:'#F1F5F9',padding:'2px 8px',borderRadius:4,fontFamily:"'JetBrains Mono'",color:C.textMuted}}>id</span>
              </div>
              <button onClick={()=>onTableClick(fromTbl||{name:e.from})}
                style={{fontSize:11,padding:'4px 10px',borderRadius:5,border:`1px solid ${C.cardBorder}`,background:'#fff',color:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif',flexShrink:0}}>
                Inspect
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )

  // Northwind: original SVG diagram
  const edges=displayTables.flatMap((t:any)=>(t.joins||[]).map((j:any)=>({from:t.name,to:j.to,on:j.on,key:`${t.name}-${j.to}`}))).filter((e:any,i:number,arr:any[])=>arr.findIndex((x:any)=>(x.from===e.from&&x.to===e.to)||(x.from===e.to&&x.to===e.from))===i)
  const pos=(name:string)=>displayTables.find((t:any)=>t.name===name)||{x:0,y:0,color:C.accent}
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
            <g key={t.name} style={{cursor:'pointer'}} onMouseEnter={()=>setHov(t.name)} onMouseLeave={()=>setHov(null)} onClick={()=>onTableClick(t)} onContextMenu={ev=>{ev.preventDefault();if(onTableContext)onTableContext(t,ev.clientX,ev.clientY)}}>

              <rect x={t.x} y={t.y} width={125} height={44} rx={6} fill={isH?t.color:'#fff'} stroke={isH?t.color:C.cardBorder} strokeWidth={isH?1.5:1}/>
              <text x={t.x+62} y={t.y+17} textAnchor="middle" style={{fontSize:11.5,fontFamily:"'JetBrains Mono'",fontWeight:600,fill:isH?'#fff':C.text}}>{t.name}</text>
              <text x={t.x+62} y={t.y+32} textAnchor="middle" style={{fontSize:9.5,fontFamily:'Inter,sans-serif',fill:isH?'rgba(255,255,255,0.75)':C.textLight}}>{t.rows} rows</text>
            </g>
          )})}
        </svg>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',borderTop:`1px solid ${C.cardBorder}`,paddingTop:12,marginTop:8}}>
          {displayTables.map((t:any)=><div key={t.name} style={{display:'flex',alignItems:'center',gap:5,cursor:'pointer'}} onClick={()=>onTableClick(t)} onContextMenu={ev=>{ev.preventDefault();if(onTableContext)onTableContext(t,ev.clientX,ev.clientY)}}>
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
  const suggestions=useMemo(()=>buildProfessionalFollowUps(rows, fields),[fields,rows])
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
function QwezyTab({onAsk,initialInput='',onInputConsumed,isDemo=true,dbConnected=true,liveSchema=[]}:{onAsk:(q:string,conv?:Conversation)=>void,initialInput?:string,onInputConsumed?:()=>void,isDemo?:boolean,dbConnected?:boolean,liveSchema?:any[]}) {
  const [conversations,setConversations]=useState<Conversation[]>([])
  const [activeId,setActiveId]=useState('')
  const [recentQuestions,setRecentQuestions]=useState<string[]>([])
  const [starterShuffleSeed] = useState(() => Date.now())
  const [conversationsLoaded,setConversationsLoaded]=useState(false)
  const [conversationsError,setConversationsError]=useState('')
  const [sidebarMenu,setSidebarMenu]=useState<{x:number,y:number,id:string}|null>(null)
  const skipNextSyncRef=useRef(true)

  // Load recent team questions on mount
  useEffect(()=>{
    if(!isDemo){
      fetch('/api/query-history').then(r=>r.ok?r.json():null).then(d=>{
        if(d?.questions?.length>0){ const qs=d.questions.map((q:string)=>cleanLearnedQuestion(q)).filter((q:string)=>q && !isWeakLearnedQuestion(q)); setRecentQuestions(qs) }
      }).catch(()=>{})
    }
  },[isDemo])

  const createConversationOnServer = useCallback(async (title='New conversation') => {
    const res = await fetch('/api/conversations', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ title })
    })
    if (!res.ok) throw new Error('Failed to create conversation')
    const data = await res.json()
    return normalizeConversation(data.conversation)
  }, [])

  const syncConversationToServer = useCallback(async (conv:Conversation) => {
    await fetch('/api/conversations', {
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        id: conv.id,
        title: conv.title,
        messages: conv.messages.map(m=>({
          id:m.id,
          role:m.role,
          content:m.content,
          sql:m.sql,
          rows:m.rows,
          fields:m.fields,
          duration:m.duration,
          confidence:m.confidence,
          assumptions:m.assumptions,
          uncertainAbout:m.uncertainAbout,
          suggestedClarification:m.suggestedClarification,
          rewritten:m.rewritten,
          timestamp:m.timestamp,
        }))
      })
    })
  }, [])

  const refreshUsageMetrics = useCallback(async()=>{
    try{
      const res = await fetch('/api/usage', { cache:'no-store' })
      if(!res.ok) return
      const data = await res.json()
      window.dispatchEvent(new CustomEvent('qwezy:usage-updated', { detail: { count: data?.count ?? null } }))
    }catch{}
  },[])

  useEffect(()=>{
    let cancelled = false
    ;(async ()=>{
      try{
        const res = await fetch('/api/conversations', { cache: 'no-store' })
        const data = await res.json().catch(()=>({}))
        if(!res.ok) throw new Error(data?.error || 'Failed to load conversations')
        if (cancelled) return
        setConversationsError(data?.messages_error || '')
        const loaded = (data.conversations || []).map(normalizeConversation)
        if (loaded.length > 0) {
          setConversations(loaded)
          setActiveId(prev=>loaded.some((c:any)=>c.id===prev)?prev:loaded[0].id)
        } else {
          const fresh = await createConversationOnServer()
          if (cancelled) return
          setConversations([fresh])
          setActiveId(fresh.id)
        }
      }catch(err:any){
        if (cancelled) return
        console.error('Failed to load conversations:', err)
        setConversationsError(err?.message || 'Failed to load conversations')
        setConversations([])
        setActiveId('')
      }finally{
        if (!cancelled) setConversationsLoaded(true)
      }
    })()
    return()=>{cancelled=true}
  },[createConversationOnServer])
  const [input,setInput]=useState('')
  useEffect(()=>{if(initialInput){setInput(initialInput);if(onInputConsumed)onInputConsumed()}},[initialInput])
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
  const rotatedRecentQuestions = useMemo(()=>{
    if(recentQuestions.length===0) return []
    return stableShuffleQuestions(recentQuestions, starterShuffleSeed).slice(0, 4)
  },[recentQuestions,starterShuffleSeed])

  useEffect(()=>{
    if(!conversationsLoaded || !activeId) return
    const active = conversations.find(c=>c.id===activeId)
    if(!active) return
    if(skipNextSyncRef.current){
      skipNextSyncRef.current = false
      return
    }
    const timer = setTimeout(()=>{
      syncConversationToServer(active).catch(()=>{})
    }, 450)
    return ()=>clearTimeout(timer)
  },[conversations,activeId,conversationsLoaded,syncConversationToServer])

  const deleteConversation=async(id:string)=>{
    const remaining=conversations.filter(c=>c.id!==id)
    setConversations(remaining)
    try{
      await fetch(`/api/conversations?id=${id}`, { method:'DELETE' })
    }catch{}
    if(remaining.length===0){
      try{
        const fresh = await createConversationOnServer()
        skipNextSyncRef.current = true
        setConversations([fresh])
        setActiveId(fresh.id)
      }catch{
        console.error('Failed to create replacement conversation')
        setConversations([])
        setActiveId('')
      }
    } else if(activeId===id) {
      setActiveId(remaining[0].id)
    }
  }

  const renameConversation=async(id:string)=>{
    const conv = conversations.find(c=>c.id===id)
    if(!conv) return
    const next = window.prompt('Rename conversation', conv.title)
    const trimmed = (next || '').trim()
    if(!trimmed || trimmed === conv.title) return
    setConversations(prev=>prev.map(c=>c.id===id?{...c,title:trimmed,updatedAt:new Date()}:c))
  }

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

  const newConversation=async()=>{
    try{
      const c = await createConversationOnServer()
      skipNextSyncRef.current = true
      setConversations(prev=>[c,...prev].slice(0,15))
      setActiveId(c.id)
      setInput('')
    }catch{
      console.error('Failed to create conversation')
      return
    }
  }

  const sendMessage=async(text?:string,customSQL?:string)=>{
    const q=customSQL||(queryMode==='sql'?directSQL:text||input)
    if(!q?.trim()) return
    if(!isDemo&&!dbConnected){
      const noDbMsg:ConvMessage={id:`m${Date.now()}`,role:'assistant',content:'Connect your database first to start querying your data.',timestamp:new Date()}
      setConversations(prev=>prev.map(c=>c.id===activeId?{...c,messages:[...c.messages,{id:`m${Date.now()}u`,role:'user',content:q,timestamp:new Date()},noDbMsg],updatedAt:new Date()}:c))
      return
    }
    setLoading(true);setStatusStep(0);setInput('')

    const ctrl=new AbortController()
    abortRef.current=ctrl

    const userMsg:ConvMessage={id:`m${Date.now()}`,role:'user',content:queryMode==='sql'?`SQL: ${q.split('\n')[0]}…`:q,timestamp:new Date()}
    setConversations(prev=>prev.map(c=>c.id===activeId?{...c,
      title:(c.title==='New conversation' && c.messages.length===0)?(q.slice(0,40)+(q.length>40?'…':'')):c.title,
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
          refreshUsageMetrics()
          return
        }
      }

      if(!res.ok){
        const errMsg:ConvMessage={id:`m${Date.now()}`,role:'assistant',content:data.error||'Query failed',timestamp:new Date()}
        setConversations(prev=>prev.map(c=>c.id===activeId?{...c,messages:[...c.messages,errMsg],updatedAt:new Date()}:c))
        return
      }

      if(data.answer){
        const textMsg:ConvMessage={id:`m${Date.now()}a`,role:'assistant',content:data.answer,confidence:data.confidence,assumptions:data.assumptions,timestamp:new Date()}
        setConversations(prev=>prev.map(c=>c.id===activeId?{...c,messages:[...c.messages,textMsg],updatedAt:new Date()}:c))
        refreshUsageMetrics()
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
      refreshUsageMetrics()
      if(!isDemo) fetch('/api/query-history').then(r=>r.ok?r.json():null).then(d=>{ if(d?.questions?.length>0){ const qs=d.questions.map((q:string)=>cleanLearnedQuestion(q)).filter((q:string)=>q && !isWeakLearnedQuestion(q)); setRecentQuestions(qs) } }).catch(()=>{})
    }catch(e:any){
      clearInterval(st)
      if(e.name!=='AbortError'){
        const errMsg:ConvMessage={id:`m${Date.now()}`,role:'assistant',content:e.message,timestamp:new Date()}
        setConversations(prev=>prev.map(c=>c.id===activeId?{...c,messages:[...c.messages,errMsg],updatedAt:new Date()}:c))
      }
    }finally{setLoading(false);abortRef.current=null}
  }

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth'})},[activeConv?.messages.length])
  const addMemory=(note:string)=>{if(!note.trim())return;setMemoryNotes(prev=>[...prev,note.trim()]);setMemInput('')}

  return(
    <div style={{flex:1,display:'flex',overflow:'hidden',position:'relative',background:C.bg}}>
      <div style={{width:252,background:'#F8FBF9',borderRight:`1px solid ${C.cardBorder}`,display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'14px',borderBottom:`1px solid ${C.cardBorder}`}}>
          <button onClick={newConversation} style={{width:'100%',background:C.accent,color:'#fff',border:'none',borderRadius:14,padding:'12px',fontSize:13.5,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>+ New conversation</button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'10px 10px 14px'}}>
          {!!conversationsError&&(
            <div style={{margin:'0 4px 10px',padding:'10px 12px',borderRadius:12,background:'#FEF2F2',border:'1px solid #FECACA',color:C.danger,fontSize:11.5,lineHeight:1.45}}>
              {conversationsError}
            </div>
          )}
          {conversations.map(c=>(
            <div key={c.id} onClick={()=>setActiveId(c.id)} onContextMenu={e=>{e.preventDefault();setSidebarMenu({x:e.clientX,y:e.clientY,id:c.id})}}
              style={{padding:'12px 14px',cursor:'pointer',border:`1px solid ${c.id===activeId?C.greenBorder:C.cardBorder}`,background:c.id===activeId?C.greenBg:'#fff',borderRadius:16,display:'flex',alignItems:'center',gap:8,marginBottom:8,boxShadow:c.id===activeId?'0 10px 24px rgba(10,35,28,0.05)':'none'}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12.8,fontWeight:700,color:c.id===activeId?C.accentDark:C.text,marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.title}</div>
                <div style={{fontSize:11,color:C.textLight}}>{c.messages.length} messages · {c.updatedAt.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</div>
              </div>
            </div>
          ))}
        </div>
        {sidebarMenu&&(
          <>
            <div onClick={()=>setSidebarMenu(null)} style={{position:'fixed',inset:0,zIndex:299}} />
            <div style={{position:'fixed',left:sidebarMenu.x,top:sidebarMenu.y,background:'#fff',border:`1px solid ${C.cardBorder}`,borderRadius:12,boxShadow:'0 10px 28px rgba(0,0,0,0.12)',zIndex:300,minWidth:160,overflow:'hidden'}}>
              <button onClick={()=>{const id=sidebarMenu.id; setSidebarMenu(null); renameConversation(id)}} style={{display:'block',width:'100%',textAlign:'left',padding:'10px 12px',background:'none',border:'none',fontSize:12.5,color:C.text,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Rename</button>
              <button onClick={()=>{const id=sidebarMenu.id; setSidebarMenu(null); deleteConversation(id)}} style={{display:'block',width:'100%',textAlign:'left',padding:'10px 12px',background:'none',border:'none',fontSize:12.5,color:C.danger,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Delete</button>
            </div>
          </>
        )}
      </div>

      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',padding:'18px 22px 18px',gap:14}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'2px 2px 0',flexShrink:0}}>
          <div>
            <div style={{fontSize:28,fontWeight:800,color:C.navBg,letterSpacing:'-0.04em'}}>{activeConv?.title||'New conversation'}</div>
            <div style={{fontSize:12.5,color:C.textMuted,marginTop:4}}>{activeConv?.messages.length||0} messages</div>
          </div>
        </div>

        <BrowserShell style={{flex:1,display:'flex',flexDirection:'column',minHeight:0}}>
          <div style={{flex:1,overflowY:'auto',padding:'22px 22px 12px',display:'flex',flexDirection:'column',gap:16}}>
            {(!activeConv || activeConv.messages.length===0)&&!loading&&(
              <div style={{textAlign:'center',padding:'34px 10px 12px'}}>
                <div style={{fontSize:34,fontWeight:800,color:C.navBg,letterSpacing:'-0.05em',marginBottom:8}}>Ask your data</div>
                <div style={{fontSize:15,color:C.textMuted,marginBottom:26,lineHeight:1.7}}>Ask in plain English and get a real answer with SQL, results, and next steps in one place.</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:10,justifyContent:'center',maxWidth:720,margin:'0 auto'}}>
                  {(()=>{
                    const questions = buildProfessionalStarterQuestions(liveSchema, rotatedRecentQuestions, isDemo)
                    return questions.map((s:string)=>(
                      <button key={s} onClick={()=>{setQueryMode('nl');sendMessage(s)}}
                        style={{background:'#fff',border:`1px solid ${C.cardBorder}`,borderRadius:999,padding:'10px 16px',fontSize:13.5,color:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:600}}>
                        {s}
                      </button>
                    ))
                  })()}
                </div>
              </div>
            )}

            {(activeConv?.messages||[]).map((msg)=>(
              <div key={msg.id} style={{display:'flex',flexDirection:'column',alignItems:msg.role==='user'?'flex-end':'flex-start',gap:6,maxWidth:'100%'}}>
                {msg.role==='user'
                  ?<div style={{background:C.accent,color:'#fff',borderRadius:'16px 16px 4px 16px',padding:'11px 16px',fontSize:14,maxWidth:'58%',lineHeight:1.55,fontFamily:'Inter,sans-serif',boxShadow:'0 10px 22px rgba(5,150,105,0.20)'}}>{msg.content}</div>
                  :<div style={{width:'100%'}}>
                    <div style={{fontSize:11.5,color:C.textLight,marginBottom:6}}>Qwezy · {msg.timestamp.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</div>
                    {msg.rewritten&&<div style={{fontSize:11.5,color:'#D97706',background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:10,padding:'6px 10px',marginBottom:8,display:'inline-block'}}>Your SQL had an error. Qwezy rewrote it to fix it.</div>}
                    {msg.sql&&(
                      <div style={{marginBottom:10}}>
                        <SQLEditor value={msg.sql} onChange={()=>{}} onRun={sql=>sendMessage(undefined,sql)} height={Math.min(sqlHeight,msg.sql.split('\n').length*21+28)}/>
                        <div onMouseDown={startDrag} style={{height:10,cursor:'ns-resize',display:'flex',alignItems:'center',justifyContent:'center',margin:'5px 0 0'}}>
                          <div style={{width:42,height:4,borderRadius:999,background:C.cardBorder}}/>
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
                      <div className="landingCard" style={{padding:16}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:10}}>
                          <div style={{fontSize:12.5,color:C.textLight}}>{msg.rows.length} rows · {msg.duration}ms{msg.confidence==='high'&&<span style={{marginLeft:6,color:C.success,fontWeight:700}}>high confidence</span>}</div>
                        </div>
                        <ResultsTable rows={msg.rows} fields={msg.fields}/>
                        <FollowUpSuggestions rows={msg.rows} fields={msg.fields} onAsk={q=>{setQueryMode('nl');sendMessage(q)}}/>
                      </div>
                    )}
                    {msg.rows&&msg.rows.length===0&&<div style={{fontSize:13.5,color:C.textLight,padding:'8px 0'}}>Query ran successfully. No rows returned.</div>}
                    {!msg.sql&&!msg.rows&&<div style={{fontSize:14,color:msg.content.includes('failed')||msg.content.includes('error')?C.danger:C.textMuted,padding:'6px 0',lineHeight:1.6}}>{msg.content}</div>}
                  </div>}
              </div>
            ))}

            {loading&&(
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <div style={{fontSize:11.5,color:C.textLight}}>Qwezy</div>
                <div className="landingSoft" style={{padding:'14px 16px',maxWidth:360}}>
                  {STEPS.map((s,i)=>(
                    <div key={s} style={{display:'flex',alignItems:'center',gap:8,marginBottom:i<STEPS.length-1?8:0,opacity:i<=statusStep?1:.25}}>
                      {i<statusStep?<div style={{width:11,height:11,borderRadius:'50%',background:C.success,flexShrink:0}}/>
                        :i===statusStep?<div style={{width:11,height:11,border:`2px solid ${C.cardBorder}`,borderTop:`2px solid ${C.accent}`,borderRadius:'50%',flexShrink:0,animation:'spin .8s linear infinite'}}/>
                        :<div style={{width:11,height:11,borderRadius:'50%',border:`1.5px solid ${C.cardBorder}`,flexShrink:0}}/>}
                      <span style={{fontSize:12.5,color:i===statusStep?C.text:C.textLight}}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          <div style={{padding:'16px 20px 18px',borderTop:`1px solid ${C.cardBorder}`,background:'#FBFDFC',flexShrink:0}}>
            {queryMode==='sql'&&(
              <div style={{marginBottom:10}}>
                <SQLEditor value={directSQL} onChange={setDirectSQL} onRun={sql=>sendMessage(undefined,sql)} height={sqlHeight}/>
                <div onMouseDown={startDrag} style={{height:10,cursor:'ns-resize',display:'flex',alignItems:'center',justifyContent:'center',margin:'5px 0 0'}}>
                  <div style={{width:42,height:4,borderRadius:999,background:C.cardBorder}}/>
                </div>
                <div style={{fontSize:11.5,color:C.textLight,marginTop:6}}>Write your own SQL. If it has errors, Qwezy will automatically rewrite and fix it for you.</div>
              </div>
            )}
            <div style={{display:'flex',gap:10,alignItems:'flex-end'}}>
              <div style={{flex:1,background:'#FFFFFF',borderRadius:16,border:`1px solid ${C.cardBorder}`,overflow:'hidden',boxShadow:'0 6px 18px rgba(10,35,28,0.03)'}}>
                <textarea value={input} onChange={e=>setInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&queryMode==='nl'){e.preventDefault();sendMessage()}}}
                  placeholder={queryMode==='sql'?'Describe what to query. Qwezy will help complete or fix the SQL above…':'Ask a question… (Enter to send, Shift+Enter for new line)'}
                  style={{width:'100%',padding:'13px 14px',fontSize:14,color:C.text,background:'transparent',border:'none',resize:'none',minHeight:52,maxHeight:120,fontFamily:queryMode==='sql'?"'JetBrains Mono', monospace":'Inter,sans-serif',lineHeight:1.55}}/>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6,flexShrink:0}}>
                <button onClick={()=>setQueryMode(m=>m==='nl'?'sql':'nl')}
                  style={{background:queryMode==='sql'?C.accentBg:'#fff',color:queryMode==='sql'?C.accent:C.textMuted,border:`1px solid ${queryMode==='sql'?C.accent:C.cardBorder}`,borderRadius:12,padding:'8px 12px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',whiteSpace:'nowrap'}}>
                  {queryMode==='sql'?'SQL mode':'SQL'}
                </button>
                {loading
                  ?<button onClick={stopQuery} style={{background:'#FEF2F2',color:C.danger,border:`1px solid #FECACA`,borderRadius:14,padding:'10px 14px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Stop</button>
                  :<button onClick={()=>queryMode==='sql'?sendMessage(undefined,directSQL+(input.trim()?'\n-- '+input:'')):sendMessage()} disabled={!input.trim()&&queryMode==='nl'}
                    style={{background:(!input.trim()&&queryMode==='nl')?'#DCE5DE':C.accent,color:(!input.trim()&&queryMode==='nl')?C.textLight:'#fff',border:'none',borderRadius:14,padding:'11px 18px',fontSize:13.5,fontWeight:700,cursor:(!input.trim()&&queryMode==='nl')?'default':'pointer',fontFamily:'Inter,sans-serif'}}>
                    {queryMode==='sql'?'Run':'Send'}
                  </button>}
              </div>
            </div>
            <div style={{fontSize:11,color:C.textLight,marginTop:6}}>
              {queryMode==='nl'?'Enter to send · Shift+Enter for new line':'SQL mode · Ctrl+Enter to run · errors auto-fixed by Qwezy AI'}
            </div>
          </div>
        </BrowserShell>
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
  
  // Determine tables needed — use schema-qualified names
  const tables = Array.from(new Set(selCols.map(c=>c.table)))
  const primaryTable = tables[0]
  const fqn = (tbl:string) => {
    const s = (selCols.find(c => c.table === tbl) as any)?.tableSchema
    return s&&s!=='public'?`${s}.${tbl}`:tbl
  }
  
  // Find joins
  const joins: string[] = []
  tables.slice(1).forEach(tbl => {
    const tblDef = TABLES.find(t=>t.name===tbl)
    const primaryDef = TABLES.find(t=>t.name===primaryTable)
    // Check if primary joins to this table
    const j1 = primaryDef?.joins.find(j=>j.to===tbl)
    if(j1) {
      joins.push(`JOIN ${fqn(tbl)} ON ${primaryTable}.${j1.on} = ${tbl}.${j1.on}`)
      return
    }
    // Check if this table joins to primary
    const j2 = tblDef?.joins.find(j=>j.to===primaryTable)
    if(j2) {
      joins.push(`JOIN ${fqn(tbl)} ON ${tbl}.${j2.on} = ${primaryTable}.${j2.on}`)
      return
    }
    // Try to find path through another table
    joins.push(`JOIN ${fqn(tbl)} ON true -- check join condition`)
  })
  
  const selectCols = selCols.map(c => `${c.table}.${c.n}`).join(',\n  ')
  const fromClause = fqn(primaryTable)
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

function BuilderTab({tables=TABLES,isDemo=true}:{tables?:any[],isDemo?:boolean}) {
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

  const allCols=useMemo(()=>(isDemo?TABLES:tables).flatMap((t:any)=>t.columns.map((c:any)=>({...c,table:t.name,tableSchema:t.schema||'public',team:t.team||''}))), [tables,isDemo])
  const builderCols=useMemo(()=>{
    const q=colSearch.toLowerCase()
    return allCols.filter((c:any)=>!q||c.n.includes(q)||c.table.includes(q))
  },[colSearch,allCols])

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

  if(!isDemo&&tables.length===0) return(
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:40,fontFamily:"'Inter',sans-serif",background:C.bg}}>
      <div style={{fontSize:44,marginBottom:16}}>🔌</div>
      <div style={{fontSize:17,fontWeight:700,color:C.text,marginBottom:8}}>No database connected</div>
      <div style={{fontSize:13.5,color:C.textMuted,lineHeight:1.7,maxWidth:380,marginBottom:24}}>Connect your database to start building queries with the visual query builder.</div>
      <button onClick={()=>window.location.href='/connect'} style={{background:C.accent,color:'#fff',border:'none',borderRadius:7,padding:'10px 24px',fontSize:13.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Connect database →</button>
    </div>
  )
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
          {(isDemo?TABLES:tables).map((tbl:any)=>{
            const tblCols=builderCols.filter((c:any)=>c.table===tbl.name)
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
          onMouseOut={e=>{e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='transparent'; e.currentTarget.style.boxShadow='none'}}/>
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
  const [aiSummary,setAiSummary]=useState('')
  const [aiLoading,setAiLoading]=useState(false)
  const previewRows=rows.slice(0,8)
  const inputRef=useRef<HTMLInputElement>(null)

  const generateAiSummary=async()=>{
    setAiLoading(true)
    try{
      // Build compact data preview — top 8 rows, key fields only
      const topRows=rows.slice(0,8)
      const dataLines=topRows.map((r:any)=>fields.slice(0,4).map((f:string)=>`${f.replace(/_/g,' ')}: ${r[f]}`).join(' | ')).join('\n')
      const prompt=`You are writing a short professional email note summarising a data report. No em dashes. No bullet points. Write 2 sentences maximum. Be specific with the actual numbers and names from the data. Sound like a professional analyst. Do not use the word "I". Do not include a greeting or sign-off.\n\nReport name: ${report.name}\nTotal rows: ${rows.length}\nData sample:\n${dataLines}\n\nWrite the summary now:`
      const res=await fetch('/api/narrative',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt})})
      if(res.ok){
        const d=await res.json()
        const summary=d.text||d.content||''
        if(summary){setAiSummary(summary);setNote(summary);return}
      }
      // Fallback: build from data directly without second AI call
      const topRow=rows[0]
      const highlight=fields.slice(0,2).map((f:string)=>`${f.replace(/_/g,' ')}: ${topRow?.[f]??'N/A'}`).join(', ')
      setNote(`The ${report.name} report is ready with ${rows.length} records. Top result: ${highlight}.`)
    }catch{
      setNote(`The ${report.name} report is ready with ${rows.length} records attached for your review.`)
    }finally{setAiLoading(false)}
  }

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
      <div className="browserShell" style={{width:'100%',maxWidth:760,maxHeight:'92vh',display:'flex',flexDirection:'column'}}>
        <div className="browserBar">
          <div className="browserDots"><span></span><span></span><span></span></div>
          <div style={{margin:'0 auto',fontSize:11,color:C.textLight,fontWeight:700,letterSpacing:'0.06em'}}>REPORT EMAIL</div>
        </div>
        {/* Header */}
        <div style={{padding:'16px 22px',borderBottom:`1px solid ${C.cardBorder}`,display:'flex',alignItems:'center',gap:10,background:'#FBFDFC'}}>
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
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em'}}>Personal note <span style={{fontWeight:400,textTransform:'none'}}>(optional)</span></div>
                <button onClick={generateAiSummary} disabled={aiLoading}
                  style={{fontSize:11.5,padding:'3px 10px',borderRadius:5,border:`1px solid ${C.accent}33`,background:aiLoading?'#F0F4F8':C.accentBg,color:aiLoading?C.textLight:C.accent,cursor:aiLoading?'default':'pointer',fontFamily:'Inter,sans-serif',fontWeight:600,display:'flex',alignItems:'center',gap:5}}>
                  {aiLoading?<><div style={{width:10,height:10,border:`1.5px solid ${C.cardBorder}`,borderTop:`1.5px solid ${C.accent}`,borderRadius:'50%',animation:'spin .8s linear infinite'}}/>Generating…</>:<>✨ AI summary</>}
                </button>
              </div>
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
          <div style={{flex:1,overflowY:'auto',padding:22,background:'#F4F8F5'}}>
            <div className="browserShell" style={{maxWidth:640,margin:'0 auto'}}>
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
function ReportsTab({sharedResults,onResultSaved,isDemo}:{sharedResults:Record<string,ReportResult>,onResultSaved:(id:string,result:ReportResult)=>void,isDemo:boolean}) {
  const [reports,setReports]=useState<any[]>(()=>isDemo?INITIAL_REPORTS as any[]:[])
  const [showNew,setShowNew]=useState(false)
  const [running,setRunning]=useState<string|null>(null)
  const [expanded,setExpanded]=useState<string|null>(null)
  const [emailModal,setEmailModal]=useState<{report:any,rows:any[],fields:string[]}|null>(null)
  const [menuOpen,setMenuOpen]=useState<string|null>(null)
  const [biPanel,setBiPanel]=useState<string|null>(null)
  const [newReport,setNewReport]=useState({name:'',description:'',sql:'',schedule:'weekly',refreshHours:168,shared:true,group:'Finance'})
  const existingGroups=useMemo(()=>Array.from(new Set(reports.map((r:any)=>r.group||'General'))) as string[],[reports])

  const isStale=(report:any)=>{const cached=sharedResults[report.id];if(!cached)return true;return(Date.now()-cached.ranAt)/1000/3600>report.refreshHours}

  // Load reports from API on mount
  useEffect(()=>{
    if(!isDemo){
      fetch('/api/reports').then(r=>r.ok?r.json():null).then(d=>{if(d?.reports) setReports(d.reports)}).catch(()=>{})
    }
  },[isDemo])

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

  const addReport=async()=>{
    if(!newReport.name||!newReport.sql) return
    if(isDemo){
      // Demo: local only
      const id=`r${Date.now()}`
      setReports((p:any[])=>[...p,{...newReport,id,owner:'Me',lastRun:'Never',rows:0}])
    } else {
      // Real company: save to DB
      try{
        const res=await fetch('/api/reports',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({name:newReport.name,description:newReport.description,sql:newReport.sql,
            schedule:newReport.schedule,refreshHours:newReport.refreshHours,shared:newReport.shared,group:newReport.group})})
        if(res.ok){
          // Refetch from API to get the real saved record with ID
          const refreshed=await fetch('/api/reports')
          const d=await refreshed.json()
          if(d?.reports) setReports(d.reports)
        }
      }catch{}
    }
    setNewReport({name:'',description:'',sql:'',schedule:'weekly',refreshHours:168,shared:true,group:'Finance'})
    setShowNew(false)
  }

  const deleteReport=async(id:string)=>{
    setReports((p:any[])=>p.filter(r=>r.id!==id))
    if(!isDemo){
      try{await fetch('/api/reports',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})})}catch{}
    }
  }

  return(
    <>
    <div style={{flex:1,overflowY:'auto',padding:'22px 24px',background:C.bg}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
        <div>
          <h2 style={{fontSize:30,fontWeight:800,color:C.navBg,letterSpacing:'-0.04em',marginBottom:4}}>Reports</h2>
          <p style={{fontSize:14,color:C.textMuted,lineHeight:1.7}}>Saved queries with scheduled delivery and AI summaries that explain what the data means.</p>
        </div>
        <button onClick={()=>setShowNew(s=>!s)} style={{background:C.accent,color:'#fff',border:'none',borderRadius:14,padding:'12px 18px',fontSize:13.5,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>+ New report</button>
      </div>

      {showNew&&(
        <BrowserShell style={{marginBottom:18}}>
          <div style={{padding:18}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              {[['name','Name','Monthly Revenue…'],['description','Description','Optional description…'],['group','Group','Finance']].map(([k,l,p])=>(
                <div key={k}>
                  <div style={{fontSize:11,fontWeight:700,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:5}}>{l}</div>
                  <input value={(newReport as any)[k]} onChange={e=>setNewReport(p=>({...p,[k]:e.target.value}))} placeholder={p}
                    style={{width:'100%',padding:'10px 12px',borderRadius:12,border:`1px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff'}}/>
                </div>
              ))}
              <div>
                <div style={{fontSize:11,fontWeight:700,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:5}}>Schedule</div>
                <select value={newReport.schedule} onChange={e=>setNewReport(p=>({...p,schedule:e.target.value}))}
                  style={{width:'100%',padding:'10px 12px',borderRadius:12,border:`1px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff',cursor:'pointer'}}>
                  {['daily','weekly','monthly','manual'].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:700,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:5}}>SQL Query</div>
              <SQLEditor value={newReport.sql} onChange={v=>setNewReport(p=>({...p,sql:v}))} height={96}/>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={addReport} style={{background:C.accent,color:'#fff',border:'none',borderRadius:12,padding:'10px 16px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Save report</button>
              <button onClick={()=>setShowNew(false)} style={{background:'#fff',color:C.textMuted,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:'10px 14px',fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Cancel</button>
            </div>
          </div>
        </BrowserShell>
      )}

      {!isDemo&&reports.length===0&&!showNew&&(
        <BrowserShell>
          <div style={{padding:'70px 24px',textAlign:'center'}}>
            <div style={{fontSize:18,fontWeight:800,color:C.navBg,marginBottom:8}}>No reports yet</div>
            <div style={{fontSize:14,color:C.textMuted,marginBottom:18}}>Create a saved report with scheduled delivery and AI analysis.</div>
            <button onClick={()=>setShowNew(true)} style={{background:C.accent,color:'#fff',border:'none',borderRadius:14,padding:'12px 18px',fontSize:13.5,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Create your first report</button>
          </div>
        </BrowserShell>
      )}

      {existingGroups.map(group=>(
        <div key={group} style={{marginBottom:20}}>
          <div style={{fontSize:20,fontWeight:800,color:C.navBg,marginBottom:10}}>{group}</div>
          <div style={{display:'grid',gap:16}}>
            {reports.filter((r:any)=>(r.group||'General')===group).map((report:any)=>{
              const cached=sharedResults[report.id]
              const stale=isStale(report)
              return (
                <BrowserShell key={report.id} style={{overflow:'visible'}}>
                  <div style={{padding:'18px 18px 0'}}>
                    <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'flex-start',marginBottom:14}}>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:6}}>
                          <span style={{fontSize:22,fontWeight:800,color:C.navBg,letterSpacing:'-0.03em'}}>{report.name}</span>
                          <span className="landing-chip" style={{color:SCHED_COLOR[report.schedule]||C.textLight}}>{report.schedule}</span>
                          {cached&&!stale&&<span className="landing-chip" style={{color:C.success,background:C.greenBg,borderColor:C.greenBorder}}>Fresh</span>}
                          {cached&&stale&&<span className="landing-chip" style={{color:'#D97706',background:'#FFFBEB',borderColor:'#FDE68A'}}>Stale</span>}
                        </div>
                        <p style={{fontSize:14.5,color:C.textMuted,marginBottom:8,lineHeight:1.7,maxWidth:760}}>{report.description}</p>
                        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                          <span style={{fontSize:12,color:C.textLight}}>Last run: <strong style={{color:C.text}}>{report.lastRun}</strong></span>
                          {cached&&<span style={{fontSize:12,color:C.textLight}}>Cached: <strong style={{color:C.text}}>{Math.floor((Date.now()-cached.ranAt)/1000/3600)===0?'just now':`${Math.floor((Date.now()-cached.ranAt)/1000/3600)}h ago`}</strong></span>}
                          <span style={{fontSize:12,color:SCHED_COLOR[report.schedule]||C.textLight,fontWeight:700}}>Next: {SCHEDULE_NEXT[report.schedule]||'—'}</span>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
                        <button onClick={()=>runReport(report,true)} disabled={running===report.id}
                          style={{background:C.accent,color:'#fff',border:'none',borderRadius:12,padding:'10px 14px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',opacity:running===report.id?0.6:1,whiteSpace:'nowrap'}}>
                          {running===report.id?'Running…':stale||!cached?'Run':'Re-run'}
                        </button>
                        {cached&&(
                          <button onClick={()=>setExpanded(expanded===report.id?null:report.id)}
                            style={{background:'#fff',color:C.text,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:'10px 12px',fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:600}}>
                            {expanded===report.id?'Hide':'Results'}
                          </button>
                        )}
                        <div style={{position:'relative'}}>
                          <button onClick={e=>{e.stopPropagation();setMenuOpen(menuOpen===report.id?null:report.id)}}
                            style={{background:'#fff',border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:'8px 12px',fontSize:17,cursor:'pointer',color:C.textMuted,lineHeight:1,fontWeight:700,letterSpacing:1}}>
                            ···
                          </button>
                          {menuOpen===report.id&&(
                            <div style={{position:'absolute',right:0,top:'calc(100% + 6px)',background:'#fff',border:`1px solid ${C.cardBorder}`,borderRadius:12,boxShadow:'0 12px 28px rgba(0,0,0,0.12)',zIndex:300,minWidth:170,overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
                              <button onClick={async()=>{setMenuOpen(null); if(!sharedResults[report.id])await runReport(report,true); const c=sharedResults[report.id]; if(c)setEmailModal({report,rows:c.rows,fields:c.fields})}}
                                style={{display:'flex',alignItems:'center',gap:9,width:'100%',padding:'10px 14px',background:'none',border:'none',fontSize:13,color:C.text,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left'}}>✉ Email results</button>
                              <button onClick={async()=>{setMenuOpen(null); if(!sharedResults[report.id])await runReport(report,true); const c=sharedResults[report.id]; if(c)exportCSV(c.rows,c.fields,report.name)}}
                                style={{display:'flex',alignItems:'center',gap:9,width:'100%',padding:'10px 14px',background:'none',border:'none',fontSize:13,color:C.text,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left'}}>↓ Export CSV</button>
                              <button onClick={()=>{setBiPanel(biPanel===report.id?null:report.id);setMenuOpen(null)}}
                                style={{display:'flex',alignItems:'center',gap:9,width:'100%',padding:'10px 14px',background:'none',border:'none',fontSize:13,color:C.text,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left'}}>⚡ BI Connect</button>
                              <div style={{height:1,background:C.cardBorder,margin:'3px 0'}}/>
                              <button onClick={()=>{setReports((p:any[])=>p.filter(r=>r.id!==report.id));setMenuOpen(null)}}
                                style={{display:'flex',alignItems:'center',gap:9,width:'100%',padding:'10px 14px',background:'none',border:'none',fontSize:13,color:C.danger,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left'}}>🗑 Delete report</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {cached&&(
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:16}}>
                        <LandingKpi label="Rows" value={String(cached.rows.length)} highlight />
                        <LandingKpi label="Latency" value={`${cached.rows.length?Math.max(180, cached.rows.length*12):240}ms`} />
                        <LandingKpi label="Delivery" value={report.schedule==='manual'?'Manual':'Email'} />
                      </div>
                    )}
                  </div>

                  {cached&&expanded===report.id&&(
                    <div style={{borderTop:`1px solid ${C.cardBorder}`,padding:'18px',background:'#FBFDFC'}}>
                      <div style={{display:'grid',gridTemplateColumns:'1fr',gap:14}}>
                        <div className="landingSoft" style={{padding:16}}>
                          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                            <div style={{width:28,height:28,borderRadius:'50%',background:C.accent,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800}}>✓</div>
                            <div style={{fontSize:14,fontWeight:700,color:C.text}}>AI analysis</div>
                          </div>
                          <div style={{fontSize:18,lineHeight:1.7,color:C.text}}>
                            <strong>{cached.rows.length > 0 ? `${cached.rows.length} rows returned.` : 'No rows returned.'}</strong> {cached.rows.length > 0 ? `Qwezy can email a concise summary that explains what changed and what needs attention.` : ''}
                          </div>
                        </div>
                        <ResultsTable rows={cached.rows} fields={cached.fields}/>
                      </div>
                    </div>
                  )}

                  {biPanel===report.id&&(
                    <div style={{borderTop:`1px solid ${C.cardBorder}`,padding:'16px 18px',background:'#FBFDFC'}}>
                      <div style={{fontSize:13.5,fontWeight:700,color:C.text,marginBottom:10}}>BI Tool Connection</div>
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        {[{label:'PowerBI',desc:'Data → Get Data → Web → paste URL',url:`https://qwezy.io/api/export?report=${report.id}&format=json`},{label:'Tableau',desc:'Connect → Web Data Connector → paste URL',url:`https://qwezy.io/api/export?report=${report.id}&format=csv`},{label:'Google Sheets',desc:'=IMPORTDATA("url") in any cell',url:`https://qwezy.io/api/export?report=${report.id}&format=csv`}].map(({label,desc,url})=>(
                          <div key={label} className="landingSoft" style={{padding:'12px 14px'}}>
                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                              <span style={{fontSize:13,fontWeight:700,color:C.text}}>{label}</span>
                              <button onClick={()=>navigator.clipboard?.writeText(url)} style={{fontSize:11,padding:'4px 10px',borderRadius:999,border:`1px solid ${C.cardBorder}`,background:'#fff',color:C.accent,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:700}}>Copy URL</button>
                            </div>
                            <div style={{fontSize:11.5,color:C.textLight,marginBottom:5}}>{desc}</div>
                            <div style={{fontFamily:"'JetBrains Mono'",fontSize:10.5,color:C.textMuted,background:'#fff',padding:'6px 8px',borderRadius:8,wordBreak:'break-all',border:`1px solid ${C.cardBorder}`}}>{url}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </BrowserShell>
              )
            })}
          </div>
        </div>
      ))}
    </div>
    {emailModal&&<EmailModal report={emailModal.report} rows={emailModal.rows} fields={emailModal.fields} onClose={()=>setEmailModal(null)}/>}
    </> 
  )
    }

// ── Explorer Tab ──────────────────────────────────────────────────────────────
function ExplorerTab({onAsk,setDrawerTable,handleRightClick,onInfoPanel,displayTables=TABLES}:{onAsk:(q:string)=>void,setDrawerTable:(t:any)=>void,handleRightClick:(e:React.MouseEvent,t:any)=>void,onInfoPanel:(t:any,x:number,y:number)=>void,displayTables?:any[]}) {
  const [explorerView,setExplorerView]=useState<'tables'|'schema'>('tables')
  const [search,setSearch]=useState('')
  const filtered=search?displayTables.filter((t:any)=>t.name.includes(search.toLowerCase())||t.columns.some((c:any)=>c.n.includes(search.toLowerCase()))):displayTables
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.bg}}>
      <div style={{padding:'18px 22px 0',display:'flex',alignItems:'center',justifyContent:'space-between',gap:16}}>
        <div>
          <div style={{fontSize:30,fontWeight:800,color:C.navBg,letterSpacing:'-0.04em',marginBottom:4}}>Database Explorer</div>
          <div style={{fontSize:14,color:C.textMuted}}>Click any table for details</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {[['tables','Tables'],['schema','Schema']].map(([v,l])=>(
            <button key={v} onClick={()=>setExplorerView(v as any)}
              style={{background:explorerView===v?C.accentBg:'#fff',border:`1px solid ${explorerView===v?C.greenBorder:C.cardBorder}`,padding:'10px 14px',fontSize:13.5,fontWeight:700,color:explorerView===v?C.accentDark:C.textMuted,cursor:'pointer',borderRadius:999,fontFamily:'Inter,sans-serif'}}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {explorerView==='schema'&&<div style={{flex:1,overflowY:'auto',padding:'16px 22px 22px'}}><BrowserShell><div style={{padding:20}}><RelationshipsDiagram onTableClick={t=>onInfoPanel(t,0,0)} onTableContext={(t,x,y)=>onInfoPanel(t,x,y)} displayTables={displayTables}/></div></BrowserShell></div>}
      {explorerView==='tables'&&<div style={{padding:'16px 22px 22px',overflowY:'auto',flex:1}}>
        <div style={{display:'flex',gap:12,marginBottom:18,flexWrap:'wrap',alignItems:'center'}}>
          {[['Tables',String(displayTables.length)],['Columns',String(displayTables.reduce((s:number,t:any)=>s+(t.columns?.length||0),0))]].map(([k,v],i)=>(
            <LandingKpi key={k} label={k} value={v} highlight={i===0}/>
          ))}
          <div style={{marginLeft:'auto'}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tables and columns…"
              style={{padding:'11px 14px',borderRadius:14,border:`1px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif',width:260,background:'#fff'}}
              onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(360px,1fr))',gap:16}}>
          {filtered.map((tbl:any)=>(
            <BrowserShell key={tbl.name} style={{cursor:'pointer'}} >
              <div onClick={()=>onInfoPanel(tbl,0,0)} onContextMenu={e=>{e.preventDefault();onInfoPanel(tbl,e.clientX,e.clientY)}} style={{padding:'16px 18px'}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                  <div style={{width:10,height:10,borderRadius:'50%',background:tbl.color,flexShrink:0}}/>
                  <span style={{fontFamily:"'JetBrains Mono'",fontWeight:800,fontSize:15,color:C.text,flex:1}}>{tbl.name}</span>
                  {tbl.rows&&<span className="landing-chip" style={{color:tbl.color,background:`${tbl.color}18`,borderColor:`${tbl.color}28`}}>{tbl.rows} rows</span>}
                </div>
                {tbl.teams&&tbl.teams.length>0&&<div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
                  {tbl.teams.map((t:any)=><span key={t} className="landing-chip" style={{color:C.accentDark,background:C.accentBg,borderColor:C.greenBorder}}>{t}</span>)}
                </div>}
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {tbl.columns.map((c:any)=>(
                    <span key={c.n} style={{display:'inline-flex',alignItems:'center',gap:4,background:'#FBFDFC',border:`1px solid ${C.cardBorder}`,borderRadius:999,padding:'4px 9px'}}>
                      <span style={{width:6,height:6,borderRadius:'50%',background:TC[c.t],display:'inline-block',flexShrink:0}}/>
                      <span style={{fontFamily:"'JetBrains Mono'",fontSize:11,color:C.textMuted}}>{c.n}</span>
                    </span>
                  ))}
                </div>
              </div>
            </BrowserShell>
          ))}
        </div>
      </div>}
    </div>
  )
}

// ── Alerts Tab ────────────────────────────────────────────────────────────────
type AlertRun = {id?:string,ran_at?:string,status?:'ok'|'triggered'|'error',triggered?:boolean,result_count?:number,condition_value?:number|null,message?:string|null,rows_data?:any[],fields?:string[]}
type AlertDef = {
  id:string
  name:string
  description:string
  sql:string
  sourceType:'sql'|'ai'
  prompt?:string
  detailSql?:string
  visibleColumns?:string[]
  severity:'warning'|'critical'
  conditionType:'rows_gt_zero'|'value_gt'|'value_gte'|'value_lt'|'value_lte'|'value_eq'
  conditionField?:string
  threshold?:number|null
  schedule?:string
  refreshHours?:number
  shared?:boolean
  isActive?:boolean
  lastCheckedAt?:string|null
  lastTriggeredAt?:string|null
  latestRun?:AlertRun|null
}
const DEFAULT_ALERTS:AlertDef[] = [
  {
    id:'a1',name:'Orders without ship date',severity:'warning',sourceType:'sql',conditionType:'rows_gt_zero',isActive:true,schedule:'daily',
    description:'Orders placed over 7 days ago that have not been shipped yet',
    sql:`SELECT COUNT(*) AS count FROM orders WHERE shipped_date IS NULL AND order_date < NOW() - INTERVAL '7 days'`,
    detailSql:`SELECT o.order_id, c.company_name AS customer, o.order_date, o.required_date, e.last_name AS employee, o.ship_country, o.freight FROM orders o LEFT JOIN customers c ON o.customer_id=c.customer_id LEFT JOIN employees e ON o.employee_id=e.employee_id WHERE o.shipped_date IS NULL AND o.order_date < NOW() - INTERVAL '7 days' ORDER BY o.order_date ASC LIMIT 50`,
    visibleColumns:['order_id','customer','order_date','required_date','employee','ship_country','freight']
  },
  {
    id:'a2',name:'Low stock products',severity:'critical',sourceType:'sql',conditionType:'rows_gt_zero',isActive:true,schedule:'daily',
    description:'Products at or below reorder level',
    sql:`SELECT COUNT(*) AS count FROM products WHERE units_in_stock <= reorder_level AND discontinued = false`,
    detailSql:`SELECT product_name, units_in_stock, reorder_level, unit_price FROM products WHERE units_in_stock <= reorder_level AND discontinued = false ORDER BY units_in_stock ASC LIMIT 50`,
    visibleColumns:['product_name','units_in_stock','reorder_level','unit_price']
  },
  {
    id:'a3',name:'High freight orders',severity:'warning',sourceType:'sql',conditionType:'rows_gt_zero',isActive:true,schedule:'weekly',
    description:'Orders with freight cost above 200',
    sql:`SELECT COUNT(*) AS count FROM orders WHERE freight > 200`,
    detailSql:`SELECT order_id, customer_id, order_date, shipped_date, freight, ship_country FROM orders WHERE freight > 200 ORDER BY freight DESC LIMIT 50`,
    visibleColumns:['order_id','customer_id','order_date','shipped_date','freight','ship_country']
  },
]

function getAlertAccent(alert:AlertDef){
  const neverRun = !alert.latestRun && !alert.lastCheckedAt
  if(alert.isActive===false) return {label:'inactive', color:C.textLight, bg:'#F8FAFD', border:C.cardBorder, icon:'⏸'}
  if(neverRun) return {label:'never run', color:C.textLight, bg:'#F8FAFD', border:C.cardBorder, icon:'⏺'}
  if(alert.latestRun?.triggered) {
    const color = alert.severity==='critical' ? C.danger : C.warn
    const bg = alert.severity==='critical' ? '#FEF2F2' : '#FFFBEB'
    const border = alert.severity==='critical' ? '#FECACA' : '#FDE68A'
    return {label:'triggered', color, bg, border, icon: alert.severity==='critical' ? '🔴' : '🟡'}
  }
  return {label:'ok', color:C.success, bg:'#ECFDF5', border:'#A7F3D0', icon:'✅'}
}

function visibleAlertFields(alert:AlertDef, fields:string[]){
  if(alert.visibleColumns && alert.visibleColumns.length) return fields.filter(f=>alert.visibleColumns!.includes(f))
  return fields
}

function AlertCard({alert,onRun,onEdit,onDelete}:{alert:AlertDef,onRun:(a:AlertDef)=>Promise<void>,onEdit:(a:AlertDef)=>void,onDelete:(a:AlertDef)=>Promise<void>}) {
  const [expanded,setExpanded]=useState(false)
  const [menuOpen,setMenuOpen]=useState(false)
  const [running,setRunning]=useState(false)
  const accent = getAlertAccent(alert)
  const rows = alert.latestRun?.rows_data || []
  const allFields = alert.latestRun?.fields || []
  const fields = visibleAlertFields(alert, allFields)

  useEffect(()=>{
    const close=()=>setMenuOpen(false)
    if(menuOpen)document.addEventListener('click',close)
    return()=>document.removeEventListener('click',close)
  },[menuOpen])

  const exportCSV=()=>{
    if(!rows.length)return
    const cols = fields.length?fields:allFields
    const csv=[cols.join(','),...rows.map(r=>cols.map(f=>JSON.stringify(r[f]??'')).join(','))].join('\n')
    const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download=`${alert.name}.csv`;a.click()
  }

  return(
    <div style={{borderRadius:10,border:`1px solid ${accent.border}`,overflow:'visible',background:'#fff',position:'relative',zIndex:menuOpen?50:'auto'}}>
      <div onClick={()=>setExpanded(s=>!s)} style={{background:accent.bg,padding:'14px 18px',display:'flex',gap:14,alignItems:'center',cursor:'pointer'}}>
        <div style={{width:36,height:36,borderRadius:8,background:'#fff',border:`1.5px solid ${accent.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{running?'…':accent.icon}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
            <span style={{fontSize:13.5,fontWeight:600,color:accent.color}}>{alert.name}</span>
            <span style={{fontSize:11,padding:'1px 7px',borderRadius:4,fontWeight:600,background:'#fff',color:accent.color,border:`1px solid ${accent.border}`}}>{accent.label}</span>
          </div>
          <div style={{fontSize:12.5,color:C.textMuted}}>{alert.description}</div>
          <div style={{fontSize:12,color:C.textLight,marginTop:3}}>Last checked: {alert.latestRun?.ran_at?new Date(alert.latestRun.ran_at).toLocaleString():alert.lastCheckedAt?new Date(alert.lastCheckedAt).toLocaleString():'Never'}</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
          <span style={{fontSize:13,fontWeight:700,color:accent.color}}>
            {alert.latestRun?.triggered ? `${alert.latestRun.result_count||0} affected` : accent.label==='ok' ? 'All clear' : ''}
          </span>
          <div style={{position:'relative'}} onClick={e=>e.stopPropagation()}>
            <button onClick={e=>{e.stopPropagation();setMenuOpen(s=>!s)}} style={{background:'none',border:'none',color:C.textLight,cursor:'pointer',fontSize:16,padding:'2px 6px',borderRadius:4,fontWeight:700,letterSpacing:1,lineHeight:1}}>···</button>
            {menuOpen&&(
              <div style={{position:'absolute',right:0,top:'calc(100% + 6px)',background:'#fff',border:`1px solid ${C.cardBorder}`,borderRadius:8,boxShadow:'0 12px 28px rgba(0,0,0,0.14)',zIndex:9999,minWidth:170,overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
                <button onClick={async()=>{setRunning(true); await onRun(alert).finally(()=>setRunning(false)); setMenuOpen(false)}} style={{display:'block',width:'100%',padding:'9px 14px',background:'none',border:'none',fontSize:13,color:C.text,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left'}}>▶ Run now</button>
                <button onClick={()=>{onEdit(alert);setMenuOpen(false)}} style={{display:'block',width:'100%',padding:'9px 14px',background:'none',border:'none',fontSize:13,color:C.text,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left'}}>✎ Edit alert</button>
                <button onClick={()=>{exportCSV();setMenuOpen(false)}} style={{display:'block',width:'100%',padding:'9px 14px',background:'none',border:'none',fontSize:13,color:C.text,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left'}}>⬇ Export CSV</button>
                <button onClick={async()=>{await onDelete(alert);setMenuOpen(false)}} style={{display:'block',width:'100%',padding:'9px 14px',background:'none',border:'none',fontSize:13,color:C.danger,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left'}}>🗑 Delete</button>
              </div>
            )}
          </div>
          <span style={{fontSize:11,color:C.textLight,display:'inline-block',transform:expanded?'rotate(180deg)':'rotate(0deg)',transition:'transform .2s'}}>▼</span>
        </div>
      </div>
      {expanded&&(
        <div style={{borderTop:`1px solid ${accent.border}`,background:'#FAFAFA'}}>
          <div style={{padding:'10px 14px',fontSize:12.5,color:C.textMuted,display:'flex',gap:14,flexWrap:'wrap'}}>
            <span><strong>Schedule:</strong> {alert.schedule||'daily'}</span>
            <span><strong>Source:</strong> {alert.sourceType||'sql'}</span>
            <span><strong>Condition:</strong> {alert.conditionType}{alert.threshold!=null?` ${alert.threshold}`:''}</span>
          </div>
          {rows.length===0
            ?<div style={{padding:'14px 18px',fontSize:13,color:C.textMuted}}>No saved results yet. Use Run now to test.</div>
            :<div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
                <thead><tr style={{background:C.tableHead}}>{fields.map(f=><th key={f} style={{padding:'8px 14px',textAlign:'left',fontSize:11,color:C.textLight,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.04em',borderBottom:`1px solid ${C.cardBorder}`,whiteSpace:'nowrap'}}>{f.replace(/_/g,' ')}</th>)}</tr></thead>
                <tbody>{rows.slice(0,50).map((r,i)=><tr key={i} style={{background:i%2===0?'#fff':'#F8FAFD',borderBottom:`1px solid #F1F5F9`}}>{fields.map(f=><td key={f} style={{padding:'7px 14px',color:C.text,whiteSpace:'nowrap',fontSize:13}}>{typeof r[f]==='number'?Number(r[f]).toLocaleString():String(r[f]??'')}</td>)}</tr>)}</tbody>
              </table>
            </div>}
        </div>
      )}
    </div>
  )
}

function AlertsTab({isDemo}:{isDemo:boolean}) {
  const [alerts,setAlerts]=useState<AlertDef[]>(()=>isDemo?DEFAULT_ALERTS:[])
  const [loading,setLoading]=useState(!isDemo)
  const [showAdd,setShowAdd]=useState(false)
  const [saving,setSaving]=useState(false)
  const [previewing,setPreviewing]=useState(false)
  const [error,setError]=useState('')
  const [newAlert,setNewAlert]=useState<any>({
    id:'',name:'',description:'',sourceType:'ai',prompt:'',sql:'',detailSql:'',severity:'warning',conditionType:'rows_gt_zero',conditionField:'',threshold:'',schedule:'daily',refreshHours:24,shared:false,isActive:true,visibleColumns:[]
  })
  const [preview,setPreview]=useState<{sql:string,rows:any[],fields:string[]} | null>(null)

  const loadAlerts = useCallback(async()=>{
    if(isDemo){ setAlerts(DEFAULT_ALERTS); return }
    setLoading(true)
    try{
      const res = await fetch('/api/alerts', { cache:'no-store' })
      const data = await res.json()
      if(!res.ok) throw new Error(data?.error||'Failed to load alerts')
      const loaded = Array.isArray(data.alerts) ? data.alerts : []
      setAlerts(loaded.length ? loaded : DEFAULT_ALERTS)
    }catch(e:any){
      setError(e.message || 'Failed to load alerts')
      setAlerts(DEFAULT_ALERTS)
    }
    finally{ setLoading(false) }
  },[isDemo])

  useEffect(()=>{ loadAlerts() },[loadAlerts])

  const evaluateCondition = (rows:any[], fields:string[], conditionType:string, conditionField?:string, threshold?:any) => {
    const numThreshold = threshold===''||threshold==null ? null : Number(threshold)
    const count = rows.length
    let conditionValue:any = count
    let triggered = false
    if(conditionType==='rows_gt_zero') triggered = count > 0
    else {
      const field = conditionField || fields.find(f=>/^count$|^value$|^total$|^amount$/i.test(f)) || fields[0]
      const raw = rows[0]?.[field]
      conditionValue = raw==null ? null : Number(raw)
      if(conditionValue!=null && numThreshold!=null){
        if(conditionType==='value_gt') triggered = conditionValue > numThreshold
        if(conditionType==='value_gte') triggered = conditionValue >= numThreshold
        if(conditionType==='value_lt') triggered = conditionValue < numThreshold
        if(conditionType==='value_lte') triggered = conditionValue <= numThreshold
        if(conditionType==='value_eq') triggered = conditionValue === numThreshold
      }
    }
    return { triggered, conditionValue, result_count: count }
  }

  const runPreview = async()=>{
    setError('')
    setPreviewing(true)
    try{
      let sql = newAlert.sql?.trim()
      if(newAlert.sourceType==='ai'){
        const res = await fetch('/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:newAlert.prompt})})
        const data = await res.json()
        if(!res.ok) throw new Error(data?.error||'Failed to generate alert SQL')
        sql = data.sql || ''
        if(!sql) throw new Error('Could not generate alert SQL')
      }
      const detailSql = (newAlert.detailSql || sql).trim()
      const res2 = await fetch('/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customSQL:detailSql})})
      const data2 = await res2.json()
      if(!res2.ok) throw new Error(data2?.error || 'Failed to preview alert')
      const fields = data2.fields || []
      const rows = data2.rows || []
      setNewAlert((p:any)=>({...p, sql, detailSql: detailSql || sql, visibleColumns: p.visibleColumns?.length?p.visibleColumns:fields}))
      setPreview({sql, rows, fields})
    }catch(e:any){ setError(e.message||'Preview failed'); setPreview(null) }
    finally{ setPreviewing(false) }
  }

  const saveAlert = async()=>{
    if(!(newAlert.name||'').trim() || !(newAlert.sql||preview?.sql||'').trim()) return
    setSaving(true); setError('')
    try{
      const payload = {
        name:newAlert.name, description:newAlert.description, sourceType:newAlert.sourceType, prompt:newAlert.prompt,
        sql:newAlert.sql || preview?.sql, detailSql:newAlert.detailSql || preview?.sql,
        conditionType:newAlert.conditionType, conditionField:newAlert.conditionField || null,
        threshold:newAlert.threshold===''?null:Number(newAlert.threshold), schedule:newAlert.schedule,
        refreshHours:Number(newAlert.refreshHours)||24, shared:!!newAlert.shared, isActive:!!newAlert.isActive,
        severity:newAlert.severity, visibleColumns:newAlert.visibleColumns||preview?.fields||[]
      }
      const url = '/api/alerts'
      const method = newAlert.id ? 'PATCH' : 'POST'
      const body = method==='PATCH' ? {...payload, id:newAlert.id} : payload
      const res = await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      const data = await res.json()
      if(!res.ok) throw new Error(data?.error || 'Failed to save alert')
      setShowAdd(false)
      setPreview(null)
      setNewAlert({id:'',name:'',description:'',sourceType:'ai',prompt:'',sql:'',detailSql:'',severity:'warning',conditionType:'rows_gt_zero',conditionField:'',threshold:'',schedule:'daily',refreshHours:24,shared:false,isActive:true,visibleColumns:[]})
      await loadAlerts()
    }catch(e:any){ setError(e.message||'Failed to save alert') }
    finally{ setSaving(false) }
  }

  const runAlertNow = async(alert:AlertDef)=>{
    const sql = (alert.detailSql || alert.sql || '').trim()
    const res = await fetch('/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customSQL:sql})})
    const data = await res.json()
    if(!res.ok) throw new Error(data?.error || 'Failed to run alert')
    const fields = data.fields || []
    const rows = data.rows || []
    const evald = evaluateCondition(rows, fields, alert.conditionType, alert.conditionField, alert.threshold)
    const now = new Date().toISOString()
    const runStatus: 'triggered' | 'ok' = evald.triggered ? 'triggered' : 'ok'
    
    const patch = {
      id: alert.id,
      lastCheckedAt: now,
      lastTriggeredAt: evald.triggered ? now : null,
      run: {
        status: runStatus,
        triggered: evald.triggered,
        result_count: evald.result_count,
        condition_value: evald.conditionValue,
        message: evald.triggered ? 'Condition met' : 'All clear',
        rows_data: rows,
        fields,
        ran_at: now,
      }
    }

    if(isDemo){
      setAlerts(prev=>prev.map(a=>a.id===alert.id?{...a,lastCheckedAt:now,lastTriggeredAt:evald.triggered?now:null,latestRun:patch.run}:a))
      return
    }

    try{
      const res2 = await fetch('/api/alerts',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(patch)})
      const data2 = await res2.json()
      if(!res2.ok) throw new Error(data2?.error || 'Failed to save alert run')
      await loadAlerts()
    }catch{
      setAlerts(prev=>prev.map(a=>a.id===alert.id?{...a,lastCheckedAt:now,lastTriggeredAt:evald.triggered?now:null,latestRun:patch.run}:a))
    }
  }

  const editAlert = (a:AlertDef)=>{
    setNewAlert({
      id:a.id,name:a.name,description:a.description||'',sourceType:a.sourceType||'sql',prompt:a.prompt||'',sql:a.sql||'',detailSql:a.detailSql||a.sql||'',
      severity:a.severity||'warning',conditionType:a.conditionType||'rows_gt_zero',conditionField:a.conditionField||'',threshold:a.threshold??'',schedule:a.schedule||'daily',refreshHours:a.refreshHours||24,
      shared:!!a.shared,isActive:a.isActive!==false,visibleColumns:a.visibleColumns||a.latestRun?.fields||[]
    })
    setPreview(a.latestRun ? { sql:a.sql, rows:a.latestRun.rows_data||[], fields:a.latestRun.fields||[] } : null)
    setShowAdd(true)
  }

  const deleteAlert = async(a:AlertDef)=>{
    const res = await fetch('/api/alerts',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:a.id})})
    const data = await res.json().catch(()=>({}))
    if(!res.ok) throw new Error(data?.error || 'Failed to delete alert')
    await loadAlerts()
  }

  return(
    <div>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:2}}>Alerts</div>
          <div style={{fontSize:12.5,color:C.textMuted}}>Saved conditions with trigger history. Page load shows latest status only. Use Run now to test.</div>
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:8}}>
          <button onClick={loadAlerts} style={{fontSize:12.5,padding:'6px 16px',borderRadius:6,border:`1px solid ${C.cardBorder}`,background:'#fff',color:C.text,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:600}}>Refresh</button>
          <button onClick={()=>{setShowAdd(s=>!s); setError('')}} style={{fontSize:12.5,padding:'6px 16px',borderRadius:6,border:'none',background:C.accent,color:'#fff',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:600}}>+ Add alert</button>
        </div>
      </div>

      {showAdd&&(
        <div style={{background:C.accentBg,border:`1px solid ${C.greenBorder}`,borderRadius:10,padding:'16px 18px',marginBottom:16,display:'flex',flexDirection:'column',gap:10}}>
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            <button onClick={()=>setNewAlert((p:any)=>({...p,sourceType:'ai'}))} style={{padding:'6px 12px',borderRadius:6,border:`1px solid ${newAlert.sourceType==='ai'?C.accent:C.cardBorder}`,background:newAlert.sourceType==='ai'?C.accentBg:'#fff',color:newAlert.sourceType==='ai'?C.accent:C.textMuted,cursor:'pointer'}}>AI</button>
            <button onClick={()=>setNewAlert((p:any)=>({...p,sourceType:'sql'}))} style={{padding:'6px 12px',borderRadius:6,border:`1px solid ${newAlert.sourceType==='sql'?C.accent:C.cardBorder}`,background:newAlert.sourceType==='sql'?C.accentBg:'#fff',color:newAlert.sourceType==='sql'?C.accent:C.textMuted,cursor:'pointer'}}>SQL</button>
          </div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:180}}><div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>Alert name</div><input value={newAlert.name} onChange={e=>setNewAlert((p:any)=>({...p,name:e.target.value}))} style={{width:'100%',padding:'7px 10px',borderRadius:6,border:`1px solid ${C.cardBorder}`}}/></div>
            <div style={{width:150}}><div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>Severity</div><select value={newAlert.severity} onChange={e=>setNewAlert((p:any)=>({...p,severity:e.target.value}))} style={{width:'100%',padding:'7px 10px',borderRadius:6,border:`1px solid ${C.cardBorder}`,background:'#fff'}}><option value='warning'>Warning</option><option value='critical'>Critical</option></select></div>
            <div style={{width:180}}><div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>Schedule</div><select value={newAlert.schedule} onChange={e=>setNewAlert((p:any)=>({...p,schedule:e.target.value}))} style={{width:'100%',padding:'7px 10px',borderRadius:6,border:`1px solid ${C.cardBorder}`,background:'#fff'}}><option value='daily'>Daily</option><option value='weekly'>Weekly</option><option value='manual'>Manual</option></select></div>
          </div>
          <div><div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>Description</div><input value={newAlert.description} onChange={e=>setNewAlert((p:any)=>({...p,description:e.target.value}))} style={{width:'100%',padding:'7px 10px',borderRadius:6,border:`1px solid ${C.cardBorder}`}}/></div>
          {newAlert.sourceType==='ai'
            ?<div><div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>Describe the alert</div><textarea value={newAlert.prompt} onChange={e=>setNewAlert((p:any)=>({...p,prompt:e.target.value}))} rows={3} placeholder='e.g. alert me when overdue invoices exceed 25' style={{width:'100%',padding:'7px 10px',borderRadius:6,border:`1px solid ${C.cardBorder}`,fontSize:13}}/></div>
            :<div><div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>SQL</div><textarea value={newAlert.sql} onChange={e=>setNewAlert((p:any)=>({...p,sql:e.target.value}))} rows={4} style={{width:'100%',padding:'7px 10px',borderRadius:6,border:`1px solid ${C.cardBorder}`,fontFamily:"'JetBrains Mono',monospace"}}/></div>}
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <div style={{width:180}}><div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>Condition</div><select value={newAlert.conditionType} onChange={e=>setNewAlert((p:any)=>({...p,conditionType:e.target.value}))} style={{width:'100%',padding:'7px 10px',borderRadius:6,border:`1px solid ${C.cardBorder}`,background:'#fff'}}><option value='rows_gt_zero'>Rows &gt; 0</option><option value='value_gt'>Value &gt;</option><option value='value_gte'>Value &gt;=</option><option value='value_lt'>Value &lt;</option><option value='value_lte'>Value &lt;=</option><option value='value_eq'>Value =</option></select></div>
            {newAlert.conditionType!=='rows_gt_zero'&&<><div style={{width:180}}><div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>Condition field</div><input value={newAlert.conditionField} onChange={e=>setNewAlert((p:any)=>({...p,conditionField:e.target.value}))} placeholder='e.g. count' style={{width:'100%',padding:'7px 10px',borderRadius:6,border:`1px solid ${C.cardBorder}`}}/></div><div style={{width:120}}><div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>Threshold</div><input value={newAlert.threshold} onChange={e=>setNewAlert((p:any)=>({...p,threshold:e.target.value}))} style={{width:'100%',padding:'7px 10px',borderRadius:6,border:`1px solid ${C.cardBorder}`}}/></div></>}
            <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:C.text}}><input type='checkbox' checked={!!newAlert.shared} onChange={e=>setNewAlert((p:any)=>({...p,shared:e.target.checked}))}/> Share with company</label>
            <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:C.text}}><input type='checkbox' checked={!!newAlert.isActive} onChange={e=>setNewAlert((p:any)=>({...p,isActive:e.target.checked}))}/> Active</label>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <button onClick={runPreview} disabled={previewing} style={{padding:'7px 14px',borderRadius:6,border:`1px solid ${C.cardBorder}`,background:'#fff',color:C.text,fontSize:13,fontWeight:600,cursor:'pointer'}}> {previewing?'Previewing…':'Preview'} </button>
            <button onClick={saveAlert} disabled={saving || !(newAlert.name||'').trim() || !(newAlert.sql||preview?.sql||'').trim()} style={{padding:'7px 18px',borderRadius:6,border:'none',background:C.accent,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer'}}> {saving?'Saving…':(newAlert.id?'Update alert':'Save alert')} </button>
            <button onClick={()=>{setShowAdd(false);setPreview(null);setError('')}} style={{padding:'7px 12px',borderRadius:6,border:`1px solid ${C.cardBorder}`,background:'#fff',color:C.textMuted,fontSize:13,cursor:'pointer'}}>Cancel</button>
          </div>
          {error&&<div style={{padding:'8px 10px',borderRadius:6,background:'#FEF2F2',color:C.danger,fontSize:12.5}}>{error}</div>}
          {preview&&(
            <div style={{background:'#fff',border:`1px solid ${C.cardBorder}`,borderRadius:8,overflow:'hidden'}}>
              <div style={{padding:'10px 12px',borderBottom:`1px solid ${C.cardBorder}`,fontSize:12.5,fontWeight:600,color:C.text}}>SQL preview</div>
              <div style={{padding:12}}><SQLEditor value={preview.sql} onChange={(v)=>{setPreview((p:any)=>p?({...p,sql:v}):p); setNewAlert((p:any)=>({...p,sql:v}))}} height={120} /></div>
              <div style={{padding:'0 12px 12px'}}>
                <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>Columns to show</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:10}}>
                  {preview.fields.map((f:string)=><label key={f} style={{display:'flex',alignItems:'center',gap:6,fontSize:12.5,color:C.text}}><input type='checkbox' checked={(newAlert.visibleColumns||[]).includes(f)} onChange={e=>setNewAlert((p:any)=>({...p,visibleColumns:e.target.checked?[...(p.visibleColumns||[]),f]:(p.visibleColumns||[]).filter((x:string)=>x!==f)}))}/>{f.replace(/_/g,' ')}</label>)}
                </div>
                <ResultsTable rows={preview.rows} fields={visibleAlertFields(newAlert, preview.fields)} compact={false}/>
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? <div style={{fontSize:13,color:C.textLight}}>Loading alerts…</div> : <div style={{display:'flex',flexDirection:'column',gap:10}}>{alerts.map(a=><AlertCard key={a.id} alert={a} onRun={runAlertNow} onEdit={editAlert} onDelete={deleteAlert} />)}</div>}
    </div>
  )
}
// ── Dashboard Tab ─────────────────────────────────────────────────────────────
const PRESET_QUERIES = [
  { id:'d1', name:'Revenue by Category', sql:`SELECT c.category_name, ROUND(SUM(od.unit_price*od.quantity*(1-od.discount)),0) AS revenue FROM order_details od JOIN products p ON od.product_id=p.product_id JOIN categories c ON p.category_id=c.category_id GROUP BY c.category_name ORDER BY revenue DESC`, viz:'bar', w:460, h:260 },
  { id:'d2', name:'Top 10 Customers', sql:`SELECT c.company_name, ROUND(SUM(od.unit_price*od.quantity*(1-od.discount)),0) AS revenue FROM customers c JOIN orders o ON c.customer_id=o.customer_id JOIN order_details od ON o.order_id=od.order_id GROUP BY c.company_name ORDER BY revenue DESC LIMIT 10`, viz:'table', w:460, h:260 },
  { id:'d3', name:'Monthly Orders 2026', sql:`SELECT TO_CHAR(order_date,'Mon') AS month, COUNT(*) AS orders FROM orders WHERE EXTRACT(YEAR FROM order_date)=2026 GROUP BY EXTRACT(MONTH FROM order_date), TO_CHAR(order_date,'Mon') ORDER BY EXTRACT(MONTH FROM order_date)`, viz:'line', w:440, h:260 },
  { id:'d4', name:'Orders by Month & Shipper', sql:`SELECT TO_CHAR(o.order_date,'Mon') AS month, COUNT(CASE WHEN s.company_name='Federal Shipping' THEN 1 END) AS "Federal Shipping", COUNT(CASE WHEN s.company_name='Speedy Express' THEN 1 END) AS "Speedy Express", COUNT(CASE WHEN s.company_name='United Package' THEN 1 END) AS "United Package" FROM orders o JOIN shippers s ON o.ship_via=s.shipper_id GROUP BY EXTRACT(MONTH FROM o.order_date), TO_CHAR(o.order_date,'Mon') ORDER BY EXTRACT(MONTH FROM o.order_date)`, viz:'stacked', w:1390, h:300 },
]
const PRESET_KPIS = [
  { id:'k1', name:'Total Revenue', sql:`SELECT ROUND(SUM(unit_price*quantity*(1-discount)),0) AS value FROM order_details`, prefix:'$' },
  { id:'k2', name:'Total Orders', sql:`SELECT COUNT(*) AS value FROM orders`, prefix:'' },
  { id:'k3', name:'Total Customers', sql:`SELECT COUNT(*) AS value FROM customers`, prefix:'' },
  { id:'k4', name:'Avg Order Value', sql:`SELECT ROUND(AVG(t),0) AS value FROM (SELECT SUM(od.unit_price*od.quantity*(1-od.discount)) AS t FROM orders o JOIN order_details od ON o.order_id=od.order_id GROUP BY o.order_id) x`, prefix:'$' },
]

type DashView = {id:string,name:string,sql:string,viz:'bar'|'line'|'stacked'|'table'|'kpi',w:number,h:number,color?:string,gx?:number,gy?:number,gw?:number,gh?:number,shared?:boolean,rows?:any[],fields?:string[],builder?:{mode?:'visual'|'sql',xCol?:string,yCol?:string,agg?:'SUM'|'COUNT'|'AVG'|'MIN'|'MAX',limit?:number}}
type DashPage = {id:string,name:string,shared?:boolean,createdBy?:string,views:DashView[]}

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

  if(viz==='stacked'){
    // fields[0] = X axis label, fields[1..n] = stack segments
    const stackKeys=fields.slice(1)
    if(!fields.length||!rows.length) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:height,color:C.textLight,fontSize:13}}>No data</div>
    return(
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} margin={{top:4,right:8,left:0,bottom:30}}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
          <XAxis dataKey={lk} tick={{fontSize:10,fill:C.textLight}} angle={-20} textAnchor="end"/>
          <YAxis tick={{fontSize:10,fill:C.textLight}} tickFormatter={(v:any)=>Number(v).toLocaleString()}/>
          <Tooltip formatter={(v:any)=>Number(v).toLocaleString()}/>
          <Legend wrapperStyle={{fontSize:11,paddingTop:8}}/>
          {stackKeys.map((k,i)=><Bar key={k} dataKey={k} stackId="a" fill={GREEN_SHADES[i%GREEN_SHADES.length]} radius={i===stackKeys.length-1?[3,3,0,0]:[0,0,0,0]}/>)}
        </BarChart>
      </ResponsiveContainer>
    )
  }
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
  const [w,setW]=useState(340) // ← default width per KPI card (px)
  const [h,setH]=useState(100)  // ← default height per KPI card (px)
  // Max: w capped at 600px, h capped at 240px (see onMove below)
  const startRef=useRef<{mx:number,my:number,sw:number,sh:number}|null>(null)
  useEffect(()=>{
    fetch('/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customSQL:kpi.sql})})
      .then(r=>r.json()).then(d=>{if(!d.error&&d.rows?.[0])setVal(String(Object.values(d.rows[0])[0]))}).catch(()=>{})
  },[kpi.id])
  const onCornerMouseDown=(e:React.MouseEvent)=>{
    e.preventDefault();e.stopPropagation()
    startRef.current={mx:e.clientX,my:e.clientY,sw:w,sh:h}
    const onMove=(ev:MouseEvent)=>{
      ev.preventDefault()
      if(!startRef.current)return
      setW(snap(Math.max(140,Math.min(600,startRef.current.sw+(ev.clientX-startRef.current.mx)))))
      setH(snap(Math.max(70,Math.min(240,startRef.current.sh+(ev.clientY-startRef.current.my)))))
    }
    const onUp=()=>{startRef.current=null;window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp)}
    window.addEventListener('mousemove',onMove);window.addEventListener('mouseup',onUp)
  }
  const fontSize=Math.round(32*(h/90))
  return(
    <div style={{position:'relative',background:'#fff',borderRadius:10,border:`1px solid ${C.cardBorder}`,padding:'14px 18px',width:w,height:h,flexShrink:0,overflow:'hidden',boxSizing:'border-box',display:'flex',flexDirection:'column',justifyContent:'center'}}>
      <div style={{fontSize:10.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>{kpi.name}</div>
      <div style={{fontSize:Math.max(18,Math.min(52,fontSize)),fontWeight:800,color:C.text,letterSpacing:'-0.5px',lineHeight:1}}>
        {val===null?<span style={{color:C.textLight,fontSize:18,fontWeight:400}}>—</span>:`${kpi.prefix}${Number(val).toLocaleString()}`}
      </div>
      <div onMouseDown={onCornerMouseDown} title="Drag to resize"
        style={{position:'absolute',bottom:0,right:0,width:20,height:20,cursor:'se-resize',zIndex:10,display:'flex',alignItems:'flex-end',justifyContent:'flex-end',padding:'3px',userSelect:'none'}}>
        <svg width="11" height="11" viewBox="0 0 11 11" style={{display:'block',opacity:.35}}>
          <line x1="9" y1="1" x2="1" y2="9" stroke={C.textLight} strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="9" y1="5" x2="5" y2="9" stroke={C.textLight} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  )
}

// ── Resizable DashCard ────────────────────────────────────────────────────────
const SNAP=20 // snap grid in px
function snap(n:number){return Math.round(n/SNAP)*SNAP}

function DashCard({view,onRemove,onEdit}:{view:DashView,onRemove:()=>void,onEdit:()=>void}) {
  const [rows,setRows]=useState<any[]>(view.rows||[])
  const [fields,setFields]=useState<string[]>(view.fields||[])
  const [loading,setLoading]=useState(!view.rows?.length)
  const [menuOpen,setMenuOpen]=useState(false)
  const [w,setW]=useState(view.w)
  const [h,setH]=useState(view.h)
  const startRef=useRef<{mx:number,my:number,sw:number,sh:number}|null>(null)

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

  const onCornerMouseDown=(e:React.MouseEvent)=>{
    e.preventDefault()
    e.stopPropagation()
    startRef.current={mx:e.clientX,my:e.clientY,sw:w,sh:h}
    const onMove=(ev:MouseEvent)=>{
      ev.preventDefault()
      if(!startRef.current)return
      const newW=snap(Math.max(240,Math.min(1320,startRef.current.sw+(ev.clientX-startRef.current.mx))))
      const newH=snap(Math.max(140,Math.min(800,startRef.current.sh+(ev.clientY-startRef.current.my))))
      setW(newW)
      setH(newH)
    }
    const onUp=()=>{
      startRef.current=null
      window.removeEventListener('mousemove',onMove)
      window.removeEventListener('mouseup',onUp)
    }
    window.addEventListener('mousemove',onMove)
    window.addEventListener('mouseup',onUp)
  }

  // For table viz: scale font/padding with card size
  const tableScale=Math.max(0.8,Math.min(1.6,w/440))

  return(
    <div style={{position:'relative',display:'flex',flexDirection:'column',background:'#fff',borderRadius:20,border:`1px solid ${C.cardBorder}`,boxShadow:'0 16px 36px rgba(10,35,28,0.06)',width:w===9999?'100%':w,flexShrink:0,boxSizing:'border-box',overflow:'hidden'}}>
      {/* Header */}
      <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.cardBorder}`,display:'flex',alignItems:'center',gap:8,background:'#F7FBF8',flexShrink:0}}>
        <span style={{fontSize:12.5,fontWeight:600,color:C.text,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{view.name}</span>
        <div style={{position:'relative'}}>
          <button onClick={e=>{e.stopPropagation();setMenuOpen(s=>!s)}}
            style={{background:'none',border:'none',color:C.textLight,cursor:'pointer',fontSize:16,lineHeight:1,padding:'2px 6px',borderRadius:4,fontWeight:700,letterSpacing:1}}
            onMouseOver={e=>e.currentTarget.style.background='#E5E7EB'} onMouseOut={e=>e.currentTarget.style.background='none'}>···</button>
          {menuOpen&&(
            <div style={{position:'absolute',right:0,top:'calc(100% + 4px)',background:'#fff',border:`1px solid ${C.cardBorder}`,borderRadius:8,boxShadow:'0 8px 24px rgba(0,0,0,0.12)',zIndex:300,minWidth:148,overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
              <button onClick={()=>{onEdit();setMenuOpen(false)}} style={{display:'block',width:'100%',padding:'9px 14px',background:'none',border:'none',fontSize:13,color:C.text,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left'}}
                onMouseOver={e=>{e.currentTarget.style.background='#FFFFFF'; e.currentTarget.style.borderColor=C.cardBorder; e.currentTarget.style.boxShadow='0 10px 24px rgba(10,35,28,0.05)'}} onMouseOut={e=>e.currentTarget.style.background='none'}>✏️ Edit visual</button>
              <div style={{height:1,background:C.cardBorder}}/>
              <button onClick={()=>{onRemove();setMenuOpen(false)}} style={{display:'block',width:'100%',padding:'9px 14px',background:'none',border:'none',fontSize:13,color:C.danger,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left'}}
                onMouseOver={e=>e.currentTarget.style.background='#FEF2F2'} onMouseOut={e=>e.currentTarget.style.background='none'}>🗑 Remove</button>
            </div>
          )}
        </div>
      </div>

      {/* Chart area — fills exact h, no padding eating height */}
      <div style={{width:'100%',height:h,overflow:'hidden',flexShrink:0}}>
        {loading
          ?<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',gap:8,color:C.textLight,fontSize:13}}>
            <div style={{width:14,height:14,border:`2px solid ${C.cardBorder}`,borderTop:`2px solid ${C.accent}`,borderRadius:'50%',animation:'spin .8s linear infinite'}}/>Loading…
          </div>
          :view.viz==='table'
            ?<div style={{overflowY:'auto',overflowX:'auto',height:'100%'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:Math.round(12*tableScale)}}>
                <thead style={{position:'sticky',top:0,zIndex:1}}>
                  <tr style={{background:C.tableHead}}>
                    {fields.map(f=><th key={f} style={{padding:`${Math.round(6*tableScale)}px ${Math.round(10*tableScale)}px`,textAlign:'left',fontSize:Math.round(10*tableScale),color:C.textLight,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.04em',borderBottom:`1px solid ${C.cardBorder}`,whiteSpace:'nowrap'}}>{f.replace(/_/g,' ')}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r,i)=><tr key={i} style={{background:i%2===0?'#fff':C.tableRowAlt,borderBottom:`1px solid #F1F5F9`}}>
                    {fields.map(f=><td key={f} style={{padding:`${Math.round(5*tableScale)}px ${Math.round(10*tableScale)}px`,color:C.text,whiteSpace:'nowrap',fontSize:Math.round(12*tableScale)}}>{typeof r[f]==='number'?Number(r[f]).toLocaleString():String(r[f]??'')}</td>)}
                  </tr>)}
                </tbody>
              </table>
            </div>
            :<ViewChart viz={view.viz} rows={rows} fields={fields} color={view.color||C.accent} height={h}/>}
      </div>

      {/* Corner resize handle */}
      <div
        onMouseDown={onCornerMouseDown}
        title="Drag to resize"
        style={{
          position:'absolute',bottom:0,right:0,
          width:20,height:20,
          cursor:'se-resize',
          zIndex:10,
          display:'flex',alignItems:'flex-end',justifyContent:'flex-end',
          padding:'3px',
          userSelect:'none',
        }}>
        {/* Three diagonal lines — classic resize indicator */}
        <svg width="11" height="11" viewBox="0 0 11 11" style={{display:'block',opacity:.45}}>
          <line x1="9" y1="1" x2="1" y2="9" stroke={C.textLight} strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="9" y1="5" x2="5" y2="9" stroke={C.textLight} strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="9" y1="9" x2="9" y2="9" stroke={C.textLight} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  )
}

// ── Visual Builder Modal ──────────────────────────────────────────────────────
// Fully click-based. No drag. Simple and reliable.
function VisualBuilder({onSave,onClose,existing=null,tables=TABLES}:{onSave:(v:DashView)=>void,onClose:()=>void,existing?:DashView|null,tables?:any[]}) {
  // mode: 'visual' = click fields | 'sql' = paste SQL
  const [mode,setMode]=useState<'visual'|'sql'>(existing?.builder?.mode || (existing?'sql':'visual'))
  const [name,setName]=useState(existing?.name||'')
  const [viz,setViz]=useState<DashView['viz']>(existing?.viz||'bar')
  const [xCol,setXCol]=useState<string>(existing?.builder?.xCol||'')   // "table.col"
  const [yCol,setYCol]=useState<string>(existing?.builder?.yCol||'')
  const [agg,setAgg]=useState<'SUM'|'COUNT'|'AVG'|'MIN'|'MAX'>(existing?.builder?.agg||'SUM')
  const [limit,setLimit]=useState(existing?.builder?.limit||50)
  const [customSQL,setCustomSQL]=useState(existing?.sql||'')
  const [colSearch,setColSearch]=useState('')
  // preview
  const [previewRows,setPreviewRows]=useState<any[]>(existing?.rows||[])
  const [previewFields,setPreviewFields]=useState<string[]>(existing?.fields||[])
  const [previewLoading,setPreviewLoading]=useState(false)
  const [previewErr,setPreviewErr]=useState('')
  const previewTimer=useRef<any>(null)

  const allCols=useMemo(()=>tables.flatMap((t:any)=> (t.columns||[]).map((c:any)=>({...c,table:t.name,team:t.team, schema:t.schema||'public'}))),[tables])
  const filteredCols=useMemo(()=>allCols.filter((c:any)=>!colSearch||c.n.toLowerCase().includes(colSearch.toLowerCase())||c.table.toLowerCase().includes(colSearch.toLowerCase())),[allCols,colSearch])

  // Build SQL from visual picks
  const builtSQL=useMemo(()=>{
    if(mode==='sql'||!xCol)return ''
    const [xTable,xField]=xCol.split('.')
    const xMeta=(tables||TABLES).find((t:any)=>t.name===xTable)
    const q=(tableName:string)=>{
      const meta=(tables||TABLES).find((t:any)=>t.name===tableName)
      return meta?.schema && meta.schema !== 'public' ? `${meta.schema}.${meta.name}` : tableName
    }
    const primary=q(xTable)
    const xExpr=`${primary}.${xField}`
    if(yCol){
      const [yTable,yField]=yCol.split('.')
      const yPrimary=q(yTable)
      const yExpr=`${yPrimary}.${yField}`
      const needJoin=yTable!==xTable
      const joinDef=needJoin?xMeta?.joins?.find((j:any)=>j.to===yTable):null
      const joinSQL=needJoin&&joinDef?`\nJOIN ${yPrimary} ON ${primary}.${joinDef.on} = ${yPrimary}.${joinDef.on}`:''
      if(needJoin&&!joinDef) return ''
      if(viz==='kpi'){
        return `SELECT ${agg}(${yExpr}) AS value\nFROM ${primary}${joinSQL}`
      }
      return `SELECT\n  ${xExpr} AS ${xField},\n  ${agg}(${yExpr}) AS ${agg.toLowerCase()}_${yField}\nFROM ${primary}${joinSQL}\nGROUP BY ${xExpr}\nORDER BY 2 DESC\nLIMIT ${limit}`
    }
    if(viz==='kpi') return `SELECT COUNT(*) AS value FROM ${primary}`
    return `SELECT\n  ${xExpr} AS ${xField},\n  COUNT(*) AS count\nFROM ${primary}\nGROUP BY ${xExpr}\nORDER BY 2 DESC\nLIMIT ${limit}`
  },[mode,xCol,yCol,agg,limit,viz,tables])

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
      builder:{
        mode,
        xCol,
        yCol,
        agg,
        limit,
      },
    })
    onClose()
  }

  const VIZ_TYPES:[DashView['viz'],string][]=[['bar','Bar'],['line','Line'],['stacked','Stacked Bar'],['table','Table'],['kpi','KPI']]

  const ColButton=({col}:{col:any})=>{
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
                {tables.map((tbl:any)=>{
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
              <div style={{flex:1,padding:16,overflow:'hidden',minHeight:200}}>
                {previewRows.length>0&&<ViewChart viz={viz} rows={previewRows} fields={previewFields} height={220}/>}
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
function PresetCard({preset,onEdit,fullWidth=false}:{preset:any,onEdit:()=>void,fullWidth?:boolean}) {
  const view:DashView={id:preset.id,name:preset.name,sql:preset.sql,viz:preset.viz as any,w:fullWidth?9999:preset.w,h:preset.h}
  return(
    <div style={fullWidth?{width:'100%'}:{}}>
      <DashCard view={view} onRemove={()=>{}} onEdit={onEdit}/>
    </div>
  )
}



// ── Dashboard Tab ─────────────────────────────────────────────────────────────


function DashboardTab({sharedResults,onResultSaved,isDemo,tables=TABLES}:{sharedResults:Record<string,ReportResult>,onResultSaved:(id:string,r:ReportResult)=>void,isDemo:boolean,tables?:any[]}) {
  const [pages,setPages]=useState<DashPage[]>([{id:'overview',name:'Overview',views:[]}])
  const [activePage,setActivePage]=useState('overview')
  const [renamingPage,setRenamingPage]=useState<string|null>(null)
  const [builder,setBuilder]=useState<{open:boolean,editing:DashView|null}>({open:false,editing:null})
  const [customViews,setCustomViews]=useState<DashView[]>([])
  const [showAlerts,setShowAlerts]=useState(false)
  const [dashLoading,setDashLoading]=useState(false)
  const [dashSaving,setDashSaving]=useState(false)
  const [dashUnsaved,setDashUnsaved]=useState(false)
  const [aiPrompt,setAiPrompt]=useState('')
  const [aiGenerating,setAiGenerating]=useState(false)
  const [dashError,setDashError]=useState('')
  const [draggingId,setDraggingId]=useState<string|null>(null)

  const isOverview=activePage==='overview'&&!showAlerts

  useEffect(()=>{
    setDashLoading(true)
    fetch('/api/dashboard').then(r=>r.ok?r.json():null).then(d=>{
      if(!d) return
      setCustomViews(Array.isArray(d.customViews)?d.customViews:[])
      if(Array.isArray(d.pages)&&d.pages.length>0){
        const realPages=d.pages.filter((p:any)=>p.id!=='overview')
        setPages([{id:'overview',name:'Overview',views:[]}, ...realPages])
      }
    }).catch(()=>{}).finally(()=>setDashLoading(false))
  },[])

  const saveDashboard=async()=>{
    setDashSaving(true)
    setDashError('')
    try{
      const res=await fetch('/api/dashboard',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({customViews,pages:pages.filter((p:any)=>p.id!=='overview')})})
      const d=await res.json().catch(()=>null)
      if(!res.ok) throw new Error(d?.error || 'Failed to save dashboard')
      setDashUnsaved(false)
    }catch(e:any){
      setDashError(e?.message || 'Failed to save dashboard')
    }finally{setDashSaving(false)}
  }

  const currentPage=pages.find(p=>p.id===activePage)||pages[0]
  const currentViews=isOverview?customViews:currentPage.views

  const setCurrentViews = (updater:(views:DashView[])=>DashView[])=>{
    if(isOverview) setCustomViews(prev=>updater(prev))
    else setPages(prev=>prev.map(pg=>pg.id===activePage?{...pg,views:updater(pg.views)}:pg))
    setDashUnsaved(true)
  }

  const moveView = (fromId:string, toId:string)=>{
    if(fromId===toId) return
    setCurrentViews(prev=>{
      const arr=[...prev]
      const fromIndex=arr.findIndex(v=>v.id===fromId)
      const toIndex=arr.findIndex(v=>v.id===toId)
      if(fromIndex<0||toIndex<0) return prev
      const [moved]=arr.splice(fromIndex,1)
      arr.splice(toIndex,0,moved)
      return arr
    })
  }

  const inferVizFromPrompt=(prompt:string):DashView['viz']=>{
    const p=prompt.toLowerCase()
    if(p.includes('line')) return 'line'
    if(p.includes('table')) return 'table'
    if(p.includes('kpi') || p.includes('single number') || p.includes('total ')) return 'kpi'
    if(p.includes('stacked')) return 'stacked'
    return 'bar'
  }

  const generateAiCard=async()=>{
    const q=aiPrompt.trim()
    if(!q || aiGenerating) return
    setAiGenerating(true)
    setDashError('')
    try{
      const res=await fetch('/api/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q})})
      const d=await res.json().catch(()=>null)
      if(!res.ok || d?.error) throw new Error(d?.error || 'Failed to generate visual')
      const view:DashView={id:`v${Date.now()}`,name:q.length>42?q.slice(0,42)+'…':q,sql:d.sql||'',viz:inferVizFromPrompt(q),w:460,h:260,rows:(d.rows||[]).slice(0,500),fields:d.fields||[]}
      setCurrentViews(prev=>[view,...prev]); setAiPrompt('')
    }catch(e:any){ setDashError(e?.message || 'Failed to generate visual') }
    finally{ setAiGenerating(false) }
  }

  const openBuilder=(existing:DashView|null=null)=>setBuilder({open:true,editing:existing})
  const closeBuilder=()=>setBuilder({open:false,editing:null})
  const saveView=(view:DashView)=>{ if(builder.editing) setCurrentViews(prev=>prev.map(v=>v.id===view.id?view:v)); else setCurrentViews(prev=>[...prev,view]) }
  const removeView=(id:string)=> setCurrentViews(prev=>prev.filter(v=>v.id!==id))
  const addPage=()=>{ const id=`p${Date.now()}`; const name=`Page ${pages.length}`; setPages(p=>[...p,{id,name,views:[]}]); setActivePage(id); setDashUnsaved(true) }
  const deletePage=(id:string)=>{ setPages(p=>p.filter(pg=>pg.id!==id)); if(activePage===id)setActivePage('overview'); setDashUnsaved(true) }
  const renamePage=(id:string,name:string)=>{ setPages(p=>p.map(pg=>pg.id===id?{...pg,name}:pg)); setRenamingPage(null); setDashUnsaved(true) }

  const renderViewList=(views:DashView[])=>(
    <div style={{display:'flex',flexWrap:'wrap',gap:16}}>
      {views.map(v=>(
        <div key={v.id} draggable onDragStart={()=>setDraggingId(v.id)} onDragEnd={()=>setDraggingId(null)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault(); if(draggingId) moveView(draggingId, v.id); setDraggingId(null)}}
          style={{opacity:draggingId===v.id?0.55:1, transition:'opacity .15s'}}>
          <DashCard view={v} onRemove={()=>removeView(v.id)} onEdit={()=>openBuilder(v)}/>
        </div>
      ))}
    </div>
  )

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.bg}}>
      <div style={{padding:'22px 24px 0',display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
        <div>
          <div className="sectionTitle" style={{marginBottom:6}}>Dashboards</div>
          <div style={{fontSize:14,color:C.textMuted,lineHeight:1.7}}>Turn useful answers into saved views your team can come back to.</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          {dashUnsaved&&<button onClick={saveDashboard} disabled={dashSaving} style={{fontSize:12.5,padding:'10px 16px',borderRadius:12,border:`1px solid ${C.accent}`,background:'#fff',color:C.accent,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:700,whiteSpace:'nowrap',opacity:dashSaving?0.6:1}}>{dashSaving?'Saving…':'Save layout'}</button>}
          <button onClick={()=>openBuilder(null)} style={{fontSize:13,padding:'12px 18px',borderRadius:14,border:'none',background:C.accent,color:'#fff',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:700,whiteSpace:'nowrap'}}>+ Add visual</button>
        </div>
      </div>

      <div style={{padding:'16px 24px 24px',flex:1,overflowY:'auto'}}>
        <div className="browserShell" style={{overflow:'visible'}}>
          <div className="browserBar">
            <div className="browserDots"><span></span><span></span><span></span></div>
            <div style={{margin:'0 auto',display:'flex',gap:10,alignItems:'center'}}>
              {pages.map(pg=>(
                <div key={pg.id} style={{display:'flex',alignItems:'center'}}>
                  <div onClick={()=>{setActivePage(pg.id);setShowAlerts(false)}} style={{padding:'8px 14px',cursor:'pointer',fontSize:13,fontWeight:700,color:activePage===pg.id?C.navBg:C.textMuted,background:activePage===pg.id?'#FFFFFF':'transparent',border:`1px solid ${activePage===pg.id?C.cardBorder:'transparent'}`,borderRadius:12,whiteSpace:'nowrap'}}>
                    {renamingPage===pg.id
                      ?<input autoFocus defaultValue={pg.name} onBlur={e=>renamePage(pg.id,e.target.value||pg.name)}
                          onKeyDown={e=>{if(e.key==='Enter')renamePage(pg.id,(e.target as HTMLInputElement).value||pg.name);if(e.key==='Escape')setRenamingPage(null)}}
                          onClick={e=>e.stopPropagation()}
                          style={{fontSize:13,border:'none',outline:'none',width:80,fontFamily:'Inter,sans-serif',background:'none',color:C.text}}/>
                      :<span onDoubleClick={e=>{e.stopPropagation();if(pg.id!=='overview')setRenamingPage(pg.id)}}>{pg.name}</span>}
                  </div>
                  {pg.id!=='overview'&&activePage===pg.id&&<button onClick={e=>{e.stopPropagation();deletePage(pg.id)}} style={{background:'none',border:'none',color:C.textLight,cursor:'pointer',fontSize:14,padding:'0 4px',lineHeight:1}}>×</button>}
                </div>
              ))}
              <button onClick={addPage} style={{padding:'8px 14px',fontSize:13,color:C.textMuted,background:'transparent',border:`1px solid ${C.cardBorder}`,borderRadius:12,cursor:'pointer',fontFamily:'Inter,sans-serif',whiteSpace:'nowrap'}}>+ Page</button>
              <button onClick={()=>{setShowAlerts(s=>!s);setActivePage('overview')}} style={{padding:'8px 14px',fontSize:13,fontWeight:700,color:showAlerts?C.danger:C.textMuted,background:showAlerts?'#FEF2F2':'transparent',border:`1px solid ${showAlerts?'#FECACA':C.cardBorder}`,borderRadius:12,cursor:'pointer',fontFamily:'Inter,sans-serif',whiteSpace:'nowrap'}}>Alerts</button>
            </div>
          </div>

          <div style={{padding:'18px 18px 0', background:'#FBFDFC'}}>
            {!showAlerts&&(
              <div className="landingCard" style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:700,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em'}}>AI card builder</div>
                <input value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') generateAiCard()}} placeholder="monthly revenue by practice area"
                  style={{flex:'1 1 340px',minWidth:260,padding:'11px 12px',borderRadius:12,border:`1px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff'}}/>
                <button onClick={generateAiCard} disabled={!aiPrompt.trim() || aiGenerating}
                  style={{padding:'11px 16px',borderRadius:12,border:'none',background:C.accent,color:'#fff',cursor:'pointer',fontFamily:'Inter,sans-serif',fontSize:13,fontWeight:700,opacity:(!aiPrompt.trim() || aiGenerating)?0.55:1}}>
                  {aiGenerating?'Generating…':'Generate card'}
                </button>
                <button onClick={()=>openBuilder(null)} style={{padding:'11px 14px',borderRadius:12,border:`1px solid ${C.cardBorder}`,background:'#fff',color:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif',fontSize:13,fontWeight:700}}>
                  Advanced
                </button>
              </div>
            )}
            {!!dashError && <div style={{marginBottom:12,padding:'10px 12px',borderRadius:12,background:'#FEF2F2',border:'1px solid #FECACA',color:C.danger,fontSize:12.5,lineHeight:1.5}}>{dashError}</div>}

            <div style={{padding:'6px 2px 20px',minHeight:540}}>
              {showAlerts&&<AlertsTab isDemo={isDemo}/>}
              {!showAlerts&&isOverview&&(
                <>

                  {!isDemo&&customViews.length===0&&!dashLoading&&(
                    <div className="landingCard" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'70px 24px',textAlign:'center'}}>
                      <div style={{fontSize:18,fontWeight:800,color:C.navBg,marginBottom:8}}>No visuals yet</div>
                      <div style={{fontSize:14,color:C.textMuted,lineHeight:1.7,maxWidth:420,marginBottom:22}}>Start with the AI builder above or click Advanced to build a dashboard visual manually.</div>
                      <button onClick={generateAiCard} disabled={!aiPrompt.trim() || aiGenerating} style={{background:C.accent,color:'#fff',border:'none',borderRadius:14,padding:'12px 22px',fontSize:13.5,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',opacity:(!aiPrompt.trim() || aiGenerating)?0.55:1}}>{aiGenerating?'Generating…':'Generate first visual'}</button>
                    </div>
                  )}
                  {isDemo&&customViews.length===0&&(
                    <>
                      <div style={{display:'flex',gap:12,marginBottom:20,flexWrap:'wrap'}}>
                        {PRESET_KPIS.map(kpi=><KpiCard key={kpi.id} kpi={kpi}/>)}
                      </div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:14,marginBottom:14}}>
                        {PRESET_QUERIES.slice(0,3).map(preset=>(
                          <PresetCard key={preset.id} preset={preset} onEdit={()=>openBuilder({id:preset.id,name:preset.name,sql:preset.sql,viz:preset.viz as any,w:preset.w,h:preset.h})}/>
                        ))}
                      </div>
                      <div style={{marginBottom:customViews.length?20:0, maxWidth:1350}}>
                        <PresetCard key={PRESET_QUERIES[3].id} preset={PRESET_QUERIES[3]} onEdit={()=>openBuilder({id:PRESET_QUERIES[3].id,name:PRESET_QUERIES[3].name,sql:PRESET_QUERIES[3].sql,viz:PRESET_QUERIES[3].viz as any,w:PRESET_QUERIES[3].w,h:PRESET_QUERIES[3].h})}/>
                      </div>
                    </>
                  )}
                  {customViews.length>0&&<div>{renderViewList(customViews)}</div>}
                </>
              )}
              {!showAlerts&&!isOverview&&(currentViews.length===0
                ?<div className="landingCard" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'70px 24px',textAlign:'center'}}>
                  <div style={{fontSize:18,fontWeight:800,color:C.navBg,marginBottom:8}}>Empty page</div>
                  <div style={{fontSize:14,color:C.textMuted,marginBottom:20}}>Add a visual to start building this dashboard page.</div>
                  <button onClick={()=>openBuilder(null)} style={{background:C.accent,color:'#fff',border:'none',borderRadius:14,padding:'12px 22px',fontSize:13.5,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Add visual</button>
                </div>
                :renderViewList(currentViews))}
            </div>
          </div>
        </div>
      </div>

      {builder.open&&<VisualBuilder onSave={saveView} onClose={closeBuilder} existing={builder.editing} tables={tables}/>}
    </div>
  )
}



// ── Tutorial Overlay ──────────────────────────────────────────────────────────
// ── Tutorial Overlay ──────────────────────────────────────────────────────────
const TOUR_STEPS = [
  { tab:'ask', icon:'💬', title:'Ask your data anything',
    body:'Type a question in plain English at the bottom — "Top 10 customers by revenue" or "Products below reorder level". Qwezy writes the SQL and runs it instantly.',
    tip:'Try the starter questions on screen, or switch to SQL mode for direct queries.' },
  { tab:'builder', icon:'🔧', title:'Build queries without code',
    body:'Click columns on the left to add them to your query. Set filters, group by, and ordering. Qwezy writes the SQL for you — click "View SQL" to inspect it.',
    tip:'Use the resize handle at the bottom of the results panel to make it taller.' },
  { tab:'dashboard', icon:'📊', title:'Build live dashboards',
    body:'The Overview page loads KPIs and charts automatically. Click "+ Add visual" to create your own. Pick X and Y fields, choose a chart type, and see a live preview before adding.',
    tip:'Drag the bar at the bottom of any card to resize it. Click ··· to edit or remove.' },
  { tab:'reports', icon:'📋', title:'Schedule and share reports',
    body:'Save any SQL as a report with a schedule. Run it on demand or automatically. Use ··· to email results to your team, export CSV, or connect to PowerBI and Tableau.',
    tip:'Email and CSV auto-run the query first if no cached data exists.' },
  { tab:'explorer', icon:'🔍', title:'Explore your database',
    body:'Browse every table and column. Click a table card for details, sample questions and join paths. Right-click for quick actions. Click "View top 100 rows" to preview instantly.',
    tip:'Use the search bar to find any field across all tables at once.' },
]

function TourOverlay({onFinish,onTabSwitch}:{onFinish:()=>void,onTabSwitch:(tab:string)=>void}) {
  const [step,setStep]=useState(0)
  const current=TOUR_STEPS[step]
  const isLast=step===TOUR_STEPS.length-1

  const goTo=(i:number)=>{setStep(i);onTabSwitch(TOUR_STEPS[i].tab)}
  const next=()=>isLast?onFinish():goTo(step+1)
  const prev=()=>step>0&&goTo(step-1)

  return(
    <div style={{position:'fixed',inset:0,zIndex:1000,pointerEvents:'none'}}>
      <div style={{position:'absolute',inset:0,background:'rgba(2,44,34,0.6)',pointerEvents:'all'}} onClick={e=>e.stopPropagation()}/>
      <div style={{position:'absolute',bottom:28,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:500,pointerEvents:'all',padding:'0 16px'}}>
        <div style={{background:'#fff',borderRadius:14,boxShadow:'0 20px 56px rgba(0,0,0,0.28)',overflow:'hidden'}}>
          <div style={{height:3,background:'#E5E7EB'}}>
            <div style={{height:'100%',background:C.accent,transition:'width .3s',width:`${((step+1)/TOUR_STEPS.length)*100}%`}}/>
          </div>
          <div style={{padding:'20px 22px 16px'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
              <div style={{fontSize:22,flexShrink:0}}>{current.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:10.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:1}}>Step {step+1} of {TOUR_STEPS.length}</div>
                <div style={{fontSize:15,fontWeight:700,color:C.text,letterSpacing:'-0.2px'}}>{current.title}</div>
              </div>
              <div style={{display:'flex',gap:4}}>
                {TOUR_STEPS.map((_,i)=>(
                  <div key={i} onClick={()=>goTo(i)} style={{width:i===step?18:7,height:7,borderRadius:4,background:i===step?C.accent:i<step?C.greenBorder:'#E5E7EB',transition:'all .2s',cursor:'pointer'}}/>
                ))}
              </div>
            </div>
            <p style={{fontSize:13.5,color:C.textMuted,lineHeight:1.7,marginBottom:10}}>{current.body}</p>
            <div style={{background:C.accentBg,border:`1px solid ${C.greenBorder}`,borderRadius:7,padding:'8px 12px',marginBottom:16,display:'flex',gap:8,alignItems:'flex-start'}}>
              <span style={{fontSize:13,flexShrink:0}}>💡</span>
              <span style={{fontSize:12.5,color:C.accentDark,lineHeight:1.55}}>{current.tip}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <button onClick={onFinish} style={{fontSize:12.5,color:C.textLight,background:'none',border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif',textDecoration:'underline',textUnderlineOffset:2}}>Skip tour</button>
              <div style={{flex:1}}/>
              {step>0&&<button onClick={prev} style={{background:'#F0F4F8',color:C.text,border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:'8px 16px',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>← Back</button>}
              <button onClick={next} style={{background:C.accent,color:'#fff',border:'none',borderRadius:7,padding:'8px 22px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                {isLast?'Get started →':'Next →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}



// ── Table Grid View (// ── Table Grid View (Airtable-style) ─────────────────────────────────────────
const IS_ADMIN = true // TODO: wire to real auth role

type GridMsg = {id:string,role:'user'|'assistant',text:string,loading?:boolean,tableData?:{rows:any[],fields:string[]},followUps?:string[]}

function TableGridView({table,onClose,dataAccess}:{table:any,onClose:()=>void,dataAccess:boolean}) {
  const [rows,setRows]=useState<any[]>([])
  const [fields,setFields]=useState<string[]>([])
  const [loading,setLoading]=useState(true)
  const [err,setErr]=useState('')
  const [unlocked,setUnlocked]=useState(false)
  const [editCell,setEditCell]=useState<{row:number,field:string}|null>(null)
  const [editVal,setEditVal]=useState('')
  const [sortField,setSortField]=useState<string|null>(null)
  const [sortDir,setSortDir]=useState<'asc'|'desc'>('asc')
  const [filters,setFilters]=useState<{field:string,op:string,val:string}[]>([])
  const [showFilter,setShowFilter]=useState(false)
  const [colWidths,setColWidths]=useState<Record<string,number>>({})
  const [newRowMode,setNewRowMode]=useState(false)
  const [newRow,setNewRow]=useState<Record<string,string>>({})
  const [rowContextMenu,setRowContextMenu]=useState<{x:number,y:number,rowIdx:number}|null>(null)
  // Chat state
  const [showChat,setShowChat]=useState(false)
  const [chatMsgs,setChatMsgs]=useState<GridMsg[]>([])
  const [chatInput,setChatInput]=useState('')
  const [chatLoading,setChatLoading]=useState(false)
  const chatBottomRef=useRef<HTMLDivElement>(null)
  const colDragRef=useRef<{field:string,startX:number,startW:number}|null>(null)
  const inputRef=useRef<HTMLInputElement>(null)

  useEffect(()=>{
    const qualifiedTable = table?.schema && table.schema !== 'public'
      ? `${table.schema}.${table.name}`
      : table.name
    fetch('/api/query',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({customSQL:`SELECT * FROM ${qualifiedTable} LIMIT 500`})
    })
      .then(r=>r.json())
      .then(d=>{if(d.error)setErr(d.error);else{setRows(d.rows||[]);setFields(d.fields||[])}})
      .catch(e=>setErr(e.message))
      .finally(()=>setLoading(false))
  },[table.name, table.schema])

  useEffect(()=>{if(editCell)setTimeout(()=>inputRef.current?.focus(),50)},[editCell])
  useEffect(()=>{const close=()=>setRowContextMenu(null);if(rowContextMenu)document.addEventListener('click',close);return()=>document.removeEventListener('click',close)},[rowContextMenu])
  useEffect(()=>{chatBottomRef.current?.scrollIntoView({behavior:'smooth'})},[chatMsgs])

  const colW=(f:string)=>colWidths[f]||Math.max(120,Math.min(240,f.length*10+60))

  const displayed=useMemo(()=>{
    let r=[...rows]
    filters.forEach(f=>{
      if(!f.field||!f.val)return
      r=r.filter(row=>{
        const v=String(row[f.field]??'').toLowerCase(),fv=f.val.toLowerCase()
        if(f.op==='contains')return v.includes(fv)
        if(f.op==='equals')return v===fv
        if(f.op==='starts with')return v.startsWith(fv)
        if(f.op==='>') return Number(row[f.field])>Number(f.val)
        if(f.op==='<') return Number(row[f.field])<Number(f.val)
        return true
      })
    })
    if(sortField) r.sort((a,b)=>{const c=String(a[sortField]??'').localeCompare(String(b[sortField]??''),undefined,{numeric:true});return sortDir==='asc'?c:-c})
    return r
  },[rows,filters,sortField,sortDir])

  const commitEdit=()=>{
    if(!editCell)return
    setRows(prev=>prev.map((r,i)=>i===editCell.row?{...r,[editCell.field]:editVal}:r))
    setEditCell(null)
  }

  const startColResize=(e:React.MouseEvent,field:string)=>{
    e.preventDefault();e.stopPropagation()
    colDragRef.current={field,startX:e.clientX,startW:colW(field)}
    const move=(ev:MouseEvent)=>{if(colDragRef.current)setColWidths(p=>({...p,[colDragRef.current!.field]:Math.max(60,colDragRef.current!.startW+(ev.clientX-colDragRef.current!.startX))}))}
    const up=()=>{colDragRef.current=null;window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up)}
    window.addEventListener('mousemove',move);window.addEventListener('mouseup',up)
  }

  const toggleSort=(f:string)=>{if(sortField===f)setSortDir(d=>d==='asc'?'desc':'asc');else{setSortField(f);setSortDir('asc')}}
  const addRow=()=>{const r:Record<string,string>={};fields.forEach(f=>r[f]=newRow[f]||'');setRows(p=>[...p,r]);setNewRow({});setNewRowMode(false)}
  const deleteRow=(idx:number)=>{setRows(p=>p.filter((_,i)=>i!==idx));setRowContextMenu(null)}
  const CELL_H=36

  const sendChat=async()=>{
    const q=chatInput.trim()
    if(!q||chatLoading)return
    setChatInput('')
    setChatMsgs(p=>[...p,
      {id:`m${Date.now()}`,role:'user',text:q},
      {id:`m${Date.now()}t`,role:'assistant',text:'',loading:true}
    ])
    setChatLoading(true)
    try{
      // Always run the query first to get real data
      const qRes=await fetch('/api/query',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          question:`About the ${table.name} table: ${q}`,
          conversationContext:`The user is viewing the ${table.name} table. Columns: ${fields.join(', ')}. ${rows.length} rows loaded.`
        })})
      const qData=await qRes.json()

      if(qData.error){
        setChatMsgs(p=>p.filter(m=>!m.loading).concat({id:`m${Date.now()}e`,role:'assistant',text:`I couldn't run that: ${qData.error}`}))
        return
      }

      const resultRows:any[]=qData.rows||[]
      const resultFields:string[]=qData.fields||[]

      if(!dataAccess){
        // DATA OFF — return raw table results, no narrative
        if(resultRows.length===0){
          setChatMsgs(p=>p.filter(m=>!m.loading).concat({id:`m${Date.now()}a`,role:'assistant',text:'No results found.'}))
        } else {
          setChatMsgs(p=>p.filter(m=>!m.loading).concat({
            id:`m${Date.now()}a`,role:'assistant',
            text:`${resultRows.length} row${resultRows.length!==1?'s':''} returned`,
            tableData:{rows:resultRows.slice(0,20),fields:resultFields}
          }))
        }
        return
      }

      // DATA ON — ask Anthropic to narrate the results in plain English
      if(resultRows.length===0){
        setChatMsgs(p=>p.filter(m=>!m.loading).concat({id:`m${Date.now()}a`,role:'assistant',text:'I didn\'t find any matching results for that.'}))
        return
      }

      // Build a compact data summary to pass as context
      const dataSummary=resultRows.slice(0,15).map((r:any)=>
        resultFields.map((f:string)=>`${f}=${r[f]}`).join(', ')
      ).join(' | ')

      // Second call: ask for a conversational sentence answer
      const narrativeRes=await fetch('/api/query',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          question:q,
          conversationContext:`You are answering a question about data from the "${table.name}" table. The query returned ${resultRows.length} row(s). Here is the data: ${dataSummary}. Answer the user's question in 1-2 natural conversational sentences using the actual names and numbers from the data. Do not use bullet points or lists. Sound like a helpful human analyst.`
        })})
      const nData=await narrativeRes.json()

      // The narrative call may come back as rows (if it ran a query) or as a text response
      // We check for a text-like single-row result first
      let narrative=''
      if(nData.rows?.length===1){
        const firstRow=nData.rows[0]
        const vals=Object.values(firstRow)
        if(vals.length===1&&typeof vals[0]==='string'&&(vals[0] as string).length>20){
          narrative=vals[0] as string
        }
      }
      // Fallback: build a clear sentence from the actual data ourselves
      if(!narrative){
        if(resultRows.length===1){
          const row=resultRows[0]
          narrative=`Based on the data: ${resultFields.map(f=>`${f.replace(/_/g,' ')} is ${row[f]}`).join(', ')}.`
        } else {
          narrative=`I found ${resultRows.length} results. The top result: ${resultFields.map(f=>`${f.replace(/_/g,' ')} is ${resultRows[0][f]}`).join(', ')}.`
        }
      }

      // Generate 2-3 contextual follow-up suggestions
      const followUps:string[]=[]
      if(resultRows.length>0){
        const flds=resultFields.slice(0,3).join(', ')
        if(resultRows.length===1) followUps.push(`Show all ${table.name}`,`What else is notable here?`)
        else{
          followUps.push(`What's the average?`)
          if(resultFields.some((f:string)=>f.toLowerCase().includes('date')||f.toLowerCase().includes('month'))) followUps.push('Show the trend over time')
          else followUps.push(`Show the bottom 5 instead`)
          if(resultRows.length>5) followUps.push(`Filter to just the top 3`)
        }
      }
      setChatMsgs(p=>p.filter(m=>!m.loading).concat({id:`m${Date.now()}a`,role:'assistant',text:narrative,followUps:followUps.slice(0,3)}))

    }catch(e:any){
      setChatMsgs(p=>p.filter(m=>!m.loading).concat({id:`m${Date.now()}e`,role:'assistant',text:'Something went wrong. Please try again.'}))
    }finally{setChatLoading(false)}
  }

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:'#fff'}}>
      {/* Toolbar */}
      <div style={{padding:'8px 16px',borderBottom:`1px solid ${C.cardBorder}`,display:'flex',alignItems:'center',gap:10,background:'#fff',flexShrink:0}}>
        <button onClick={onClose} style={{background:'none',border:'none',color:C.textLight,cursor:'pointer',fontSize:13,padding:'4px 8px',borderRadius:5,fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center',gap:4}}
          onMouseOver={e=>e.currentTarget.style.background='#F0F4F8'} onMouseOut={e=>e.currentTarget.style.background='none'}>← Back</button>
        <div style={{width:1,height:20,background:C.cardBorder}}/>
        <div style={{display:'flex',alignItems:'center',gap:7}}>
          <div style={{width:9,height:9,borderRadius:'50%',background:table.color}}/>
          <span style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:"'JetBrains Mono'"}}>{table.name}</span>
          {!loading&&<span style={{fontSize:12,color:C.textLight}}>{displayed.length} rows</span>}
        </div>
        <div style={{flex:1}}/>
        {/* Filter */}
        <button onClick={()=>setShowFilter(s=>!s)}
          style={{fontSize:12.5,padding:'5px 12px',borderRadius:6,border:`1.5px solid ${showFilter?C.accent:C.cardBorder}`,background:showFilter?C.accentBg:'#fff',color:showFilter?C.accent:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:500,display:'flex',alignItems:'center',gap:5}}>
          ⊞ Filter{filters.filter(f=>f.val).length>0&&<span style={{background:C.accent,color:'#fff',borderRadius:10,fontSize:10,padding:'1px 6px',fontWeight:700}}>{filters.filter(f=>f.val).length}</span>}
        </button>
        {/* Ask button */}
        <button onClick={()=>setShowChat(s=>!s)}
          style={{fontSize:12.5,padding:'5px 12px',borderRadius:6,border:`1.5px solid ${showChat?C.accent:C.cardBorder}`,background:showChat?C.accentBg:'#fff',color:showChat?C.accent:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:500,display:'flex',alignItems:'center',gap:5}}>
          💬 Ask
        </button>
        {/* Unlock / Lock toggle */}
        {IS_ADMIN&&(
          <button onClick={()=>{setUnlocked(s=>!s);if(unlocked){setEditCell(null);setNewRowMode(false)}}}
            style={{fontSize:12.5,padding:'5px 12px',borderRadius:6,border:`1.5px solid ${unlocked?C.warn:C.cardBorder}`,background:unlocked?'#FFFBEB':'#fff',color:unlocked?'#B45309':C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:600,display:'flex',alignItems:'center',gap:5}}>
            {unlocked?'🔓 Editing':'🔒 Locked'}
          </button>
        )}
        {/* Add row — only when unlocked */}
        {IS_ADMIN&&unlocked&&(
          <button onClick={()=>setNewRowMode(true)} style={{fontSize:12.5,padding:'5px 14px',borderRadius:6,border:'none',background:C.accent,color:'#fff',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:600}}>+ Add row</button>
        )}
      </div>

      {/* Unlock banner */}
      {IS_ADMIN&&!unlocked&&(
        <div style={{padding:'6px 16px',background:'#FFFBEB',borderBottom:'1px solid #FDE68A',display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
          <span style={{fontSize:12,color:'#92400E'}}>🔒 This table is locked — click <strong>Locked</strong> in the toolbar to enable editing</span>
        </div>
      )}
      {IS_ADMIN&&unlocked&&(
        <div style={{padding:'6px 16px',background:'#ECFDF5',borderBottom:'1px solid #A7F3D0',display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
          <span style={{fontSize:12,color:'#065F46'}}>🔓 Editing enabled — click any cell to edit · Right-click a row to delete</span>
        </div>
      )}

      {/* Filter bar */}
      {showFilter&&(
        <div style={{padding:'8px 16px',borderBottom:`1px solid ${C.cardBorder}`,background:'#FAFAFA',display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',flexShrink:0}}>
          {filters.map((f,i)=>(
            <div key={i} style={{display:'flex',gap:5,alignItems:'center',background:'#fff',border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:'4px 8px'}}>
              <select value={f.field} onChange={e=>setFilters(p=>p.map((fi,j)=>j===i?{...fi,field:e.target.value}:fi))} style={{border:'none',fontSize:12,color:C.text,fontFamily:"'JetBrains Mono'",background:'transparent',cursor:'pointer',outline:'none'}}>
                {fields.map(field=><option key={field}>{field}</option>)}
              </select>
              <select value={f.op} onChange={e=>setFilters(p=>p.map((fi,j)=>j===i?{...fi,op:e.target.value}:fi))} style={{border:'none',fontSize:12,color:C.textMuted,fontFamily:'Inter,sans-serif',background:'transparent',cursor:'pointer',outline:'none'}}>
                {['contains','equals','starts with','>','<'].map(op=><option key={op}>{op}</option>)}
              </select>
              <input value={f.val} onChange={e=>setFilters(p=>p.map((fi,j)=>j===i?{...fi,val:e.target.value}:fi))} placeholder="value"
                style={{border:'none',fontSize:12,width:90,outline:'none',color:C.text,fontFamily:'Inter,sans-serif'}}/>
              <button onClick={()=>setFilters(p=>p.filter((_,j)=>j!==i))} style={{background:'none',border:'none',color:C.textLight,cursor:'pointer',fontSize:14,lineHeight:1}}>×</button>
            </div>
          ))}
          <button onClick={()=>setFilters(p=>[...p,{field:fields[0]||'',op:'contains',val:''}])} style={{fontSize:12,color:C.accent,background:C.accentBg,border:`1px solid ${C.accent}33`,borderRadius:5,padding:'4px 10px',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:500}}>+ Add filter</button>
          {filters.length>0&&<button onClick={()=>setFilters([])} style={{fontSize:12,color:C.textLight,background:'none',border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif',textDecoration:'underline'}}>Clear all</button>}
        </div>
      )}

      {/* Main area: grid + optional chat panel */}
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>

        {/* Grid */}
        <div style={{flex:1,overflow:'auto',position:'relative'}}>
          {loading&&<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:C.textLight,fontSize:13,gap:8}}><div style={{width:14,height:14,border:`2px solid ${C.cardBorder}`,borderTop:`2px solid ${C.accent}`,borderRadius:'50%',animation:'spin .8s linear infinite'}}/>Loading…</div>}
          {err&&<div style={{padding:20,color:C.danger,fontSize:13}}>{err}</div>}
          {!loading&&!err&&(
            <table style={{borderCollapse:'collapse',tableLayout:'fixed',minWidth:'100%'}}>
              <thead style={{position:'sticky',top:0,zIndex:10}}>
                <tr style={{background:C.tableHead}}>
                  <th style={{width:44,minWidth:44,padding:'0 8px',borderBottom:`2px solid ${C.cardBorder}`,borderRight:`1px solid ${C.cardBorder}`,color:C.textLight,fontSize:11,fontWeight:500,textAlign:'center',userSelect:'none'}}>#</th>
                  {fields.map(f=>(
                    <th key={f} style={{width:colW(f),minWidth:colW(f),maxWidth:colW(f),padding:0,borderBottom:`2px solid ${C.cardBorder}`,borderRight:`1px solid ${C.cardBorder}`,position:'relative',userSelect:'none'}}>
                      <div style={{display:'flex',alignItems:'center',height:CELL_H,paddingLeft:10}}>
                        <button onClick={()=>toggleSort(f)} style={{flex:1,background:'none',border:'none',cursor:'pointer',textAlign:'left',fontSize:11.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.04em',fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center',gap:4,height:'100%'}}>
                          {f.replace(/_/g,' ')}{sortField===f&&<span style={{color:C.accent}}>{sortDir==='asc'?'↑':'↓'}</span>}
                        </button>
                        <div onMouseDown={e=>startColResize(e,f)} style={{width:6,height:'100%',cursor:'col-resize',position:'absolute',right:0,top:0,zIndex:1}}
                          onMouseOver={e=>e.currentTarget.style.background='rgba(5,150,105,0.3)'} onMouseOut={e=>{e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='transparent'; e.currentTarget.style.boxShadow='none'}}/>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((row,i)=>(
                  <tr key={i} style={{background:i%2===0?'#fff':'#FAFCFE'}}
                    onContextMenu={IS_ADMIN&&unlocked?e=>{e.preventDefault();setRowContextMenu({x:e.clientX,y:e.clientY,rowIdx:i})}:undefined}>
                    <td style={{width:44,textAlign:'center',fontSize:11,color:C.textLight,borderBottom:`1px solid #F1F5F9`,borderRight:`1px solid ${C.cardBorder}`,height:CELL_H,userSelect:'none'}}>{i+1}</td>
                    {fields.map(f=>{
                      const isEditing=editCell?.row===i&&editCell?.field===f
                      const val=String(row[f]??'')
                      const isNum=!!val.match(/^-?\d+(\.\d+)?$/)
                      return(
                        <td key={f} style={{width:colW(f),maxWidth:colW(f),height:CELL_H,padding:0,borderBottom:`1px solid #F1F5F9`,borderRight:`1px solid ${C.cardBorder}`,position:'relative',overflow:'hidden'}}
                          onClick={IS_ADMIN&&unlocked?()=>{setEditCell({row:i,field:f});setEditVal(val)}:undefined}>
                          {isEditing
                            ?<input ref={inputRef} value={editVal} onChange={e=>setEditVal(e.target.value)} onBlur={commitEdit}
                                onKeyDown={e=>{if(e.key==='Enter')commitEdit();if(e.key==='Escape')setEditCell(null)}}
                                style={{width:'100%',height:'100%',padding:'0 10px',border:'none',outline:`2px solid ${C.accent}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff',position:'absolute',top:0,left:0,zIndex:5,boxSizing:'border-box'}}/>
                            :<div style={{padding:'0 10px',fontSize:13,color:C.text,height:CELL_H,display:'flex',alignItems:'center',overflow:'hidden',cursor:IS_ADMIN&&unlocked?'text':'default'}}>
                              {isNum?<span style={{fontFamily:"'JetBrains Mono'",fontSize:12,color:C.accentDark,fontWeight:500}}>{Number(val).toLocaleString()}</span>:val}
                            </div>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {newRowMode&&IS_ADMIN&&unlocked&&(
                  <tr style={{background:'#F0F7FF'}}>
                    <td style={{textAlign:'center',fontSize:11,color:C.accent,borderBottom:`1px solid ${C.cardBorder}`,borderRight:`1px solid ${C.cardBorder}`,height:CELL_H}}>*</td>
                    {fields.map(f=>(
                      <td key={f} style={{borderBottom:`1px solid ${C.cardBorder}`,borderRight:`1px solid ${C.cardBorder}`,padding:0,height:CELL_H}}>
                        <input value={newRow[f]||''} onChange={e=>setNewRow(p=>({...p,[f]:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&addRow()} placeholder={f}
                          style={{width:'100%',height:'100%',padding:'0 10px',border:'none',outline:'none',fontSize:13,color:C.text,fontFamily:'Inter,sans-serif',background:'transparent',boxSizing:'border-box'}}/>
                      </td>
                    ))}
                  </tr>
                )}
                <tr>
                  <td colSpan={fields.length+1} style={{padding:'6px 12px',borderTop:`1px solid ${C.cardBorder}`,background:newRowMode?'#F0F7FF':'#fff'}}>
                    {newRowMode&&IS_ADMIN&&unlocked
                      ?<div style={{display:'flex',gap:6}}>
                        <button onClick={addRow} style={{fontSize:12.5,background:C.accent,color:'#fff',border:'none',borderRadius:5,padding:'5px 14px',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:600}}>Save row</button>
                        <button onClick={()=>{setNewRowMode(false);setNewRow({})}} style={{fontSize:12.5,background:'#fff',color:C.textMuted,border:`1px solid ${C.cardBorder}`,borderRadius:5,padding:'5px 10px',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Cancel</button>
                      </div>
                      :IS_ADMIN&&unlocked
                        ?<button onClick={()=>setNewRowMode(true)} style={{fontSize:12.5,color:C.textLight,background:'none',border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center',gap:5}}
                            onMouseOver={e=>e.currentTarget.style.color=C.accent} onMouseOut={e=>e.currentTarget.style.color=C.textLight}>+ Add a row</button>
                        :null}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Side chat panel */}
        {showChat&&(
          <div style={{width:300,borderLeft:`1px solid ${C.cardBorder}`,display:'flex',flexDirection:'column',background:'#fff',flexShrink:0}}>
            {/* Chat header */}
            <div style={{padding:'10px 14px',borderBottom:`1px solid ${C.cardBorder}`,display:'flex',alignItems:'center',gap:8,background:C.navBg,flexShrink:0}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:dataAccess?C.success:'#94A3B8',boxShadow:dataAccess?'0 0 0 2px rgba(16,185,129,0.3)':'none'}}/>
              <span style={{fontSize:13,fontWeight:600,color:'#fff',flex:1}}>Ask about {table.name}</span>

              <button onClick={()=>setShowChat(false)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.5)',cursor:'pointer',fontSize:16,lineHeight:1}}>×</button>
            </div>
            {/* Messages */}
            <div style={{flex:1,overflowY:'auto',padding:'12px 12px',display:'flex',flexDirection:'column',gap:10}}>
              {chatMsgs.length===0&&(
                <div style={{textAlign:'center',paddingTop:20}}>
                  <div style={{fontSize:22,marginBottom:8}}>💬</div>
                  <div style={{fontSize:12.5,color:C.textMuted,lineHeight:1.6,marginBottom:14}}>Ask anything about this table</div>
                  <div style={{display:'flex',flexDirection:'column',gap:5}}>
                    {[`How many rows are in ${table.name}?`,`What's the most common value?`,`Show me a summary`].map(s=>(
                      <button key={s} onClick={()=>{setChatInput(s);setTimeout(()=>sendChat(),50)}}
                        style={{fontSize:11.5,padding:'6px 10px',borderRadius:6,border:`1px solid ${C.cardBorder}`,background:'#F8FAFD',color:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left',lineHeight:1.4}}
                        onMouseOver={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.text}}
                        onMouseOut={e=>{e.currentTarget.style.borderColor=C.cardBorder;e.currentTarget.style.color=C.textMuted}}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatMsgs.map(msg=>(
                <div key={msg.id} style={{display:'flex',flexDirection:'column',alignItems:msg.role==='user'?'flex-end':'flex-start'}}>
                  {msg.loading
                    ?<div style={{background:'#F0F4F8',borderRadius:'8px 8px 8px 2px',padding:'10px 12px',display:'flex',gap:4,alignItems:'center'}}>
                      {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:'50%',background:C.textLight,animation:`bounce .8s ${i*0.15}s infinite alternate`}}/>)}
                    </div>
                    :msg.role==='user'
                      ?<div style={{background:C.accent,color:'#fff',borderRadius:'12px 12px 2px 12px',padding:'8px 12px',fontSize:13,maxWidth:'90%',lineHeight:1.5,wordBreak:'break-word'}}>{msg.text}</div>
                      :msg.tableData
                        ?<div style={{background:'#F0F4F8',borderRadius:'2px 12px 12px 12px',padding:'8px 10px',maxWidth:'100%',overflow:'hidden'}}>
                          <div style={{fontSize:12,color:C.textMuted,marginBottom:6}}>{msg.text}</div>
                          <div style={{overflowX:'auto',borderRadius:6,border:`1px solid ${C.cardBorder}`}}>
                            <table style={{borderCollapse:'collapse',fontSize:11.5,width:'100%',background:'#fff'}}>
                              <thead><tr style={{background:C.tableHead}}>
                                {msg.tableData.fields.map(f=><th key={f} style={{padding:'5px 8px',textAlign:'left',fontWeight:600,color:C.textLight,textTransform:'uppercase',fontSize:10,letterSpacing:'0.04em',borderBottom:`1px solid ${C.cardBorder}`,whiteSpace:'nowrap'}}>{f.replace(/_/g,' ')}</th>)}
                              </tr></thead>
                              <tbody>{msg.tableData.rows.map((r,i)=>(
                                <tr key={i} style={{background:i%2===0?'#fff':'#FAFCFE'}}>
                                  {msg.tableData!.fields.map(f=><td key={f} style={{padding:'4px 8px',color:C.text,borderBottom:`1px solid #F1F5F9`,whiteSpace:'nowrap',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis'}}>{String(r[f]??'')}</td>)}
                                </tr>
                              ))}</tbody>
                            </table>
                          </div>
                        </div>
                        :<div style={{display:'flex',flexDirection:'column',gap:5,maxWidth:'95%'}}>
                          <div style={{background:'#F0F4F8',color:C.text,borderRadius:'2px 12px 12px 12px',padding:'8px 12px',fontSize:13,lineHeight:1.6,wordBreak:'break-word',whiteSpace:'pre-wrap'}}>{msg.text}</div>
                          {msg.followUps&&msg.followUps.length>0&&(
                            <div style={{display:'flex',flexWrap:'wrap',gap:5,paddingLeft:2}}>
                              {msg.followUps.map((s,i)=>(
                                <button key={i} onClick={()=>{setChatInput(s);setTimeout(()=>sendChat(),50)}}
                                  style={{fontSize:11.5,padding:'3px 9px',borderRadius:10,border:`1px solid ${C.cardBorder}`,background:'#fff',color:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif',whiteSpace:'nowrap'}}
                                  onMouseOver={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent}}
                                  onMouseOut={e=>{e.currentTarget.style.borderColor=C.cardBorder;e.currentTarget.style.color=C.textMuted}}>
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>}
                </div>
              ))}
              <div ref={chatBottomRef}/>
            </div>
            {/* Input */}
            <div style={{padding:'10px 12px',borderTop:`1px solid ${C.cardBorder}`,background:'#fff',flexShrink:0}}>
              <div style={{display:'flex',gap:6,alignItems:'flex-end',background:'#F8FAFD',borderRadius:8,border:`1.5px solid ${C.cardBorder}`,padding:'6px 8px'}}>
                <textarea value={chatInput} onChange={e=>setChatInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat()}}}
                  placeholder={`Ask about ${table.name}…`} rows={2}
                  style={{flex:1,border:'none',background:'transparent',fontSize:13,color:C.text,fontFamily:'Inter,sans-serif',resize:'none',outline:'none',lineHeight:1.5}}/>
                <button onClick={sendChat} disabled={!chatInput.trim()||chatLoading}
                  style={{background:chatInput.trim()&&!chatLoading?C.accent:'#E5E7EB',color:chatInput.trim()&&!chatLoading?'#fff':C.textLight,border:'none',borderRadius:6,padding:'6px 10px',fontSize:13,cursor:'pointer',flexShrink:0,fontWeight:600,fontFamily:'Inter,sans-serif'}}>
                  ↑
                </button>
              </div>
              <div style={{fontSize:10.5,color:C.textLight,marginTop:4}}>Enter to send · Shift+Enter for new line</div>
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div style={{padding:'5px 16px',borderTop:`1px solid ${C.cardBorder}`,background:'#FAFAFA',display:'flex',gap:16,alignItems:'center',flexShrink:0}}>
        <span style={{fontSize:11,color:C.textLight}}>{displayed.length} of {rows.length} rows</span>
        {sortField&&<span style={{fontSize:11,color:C.accent}}>Sorted by {sortField} {sortDir==='asc'?'↑':'↓'} · <button onClick={()=>setSortField(null)} style={{background:'none',border:'none',color:C.textLight,cursor:'pointer',fontSize:11,fontFamily:'Inter,sans-serif',textDecoration:'underline'}}>clear</button></span>}
        <span style={{fontSize:11,color:unlocked?C.warn:C.textLight,fontWeight:500,marginLeft:'auto'}}>{unlocked?'🔓 Editing enabled':'🔒 Read only'}</span>
      </div>

      {/* Row context menu */}
      {rowContextMenu&&(
        <div style={{position:'fixed',left:rowContextMenu.x,top:rowContextMenu.y,background:'#fff',border:`1px solid ${C.cardBorder}`,borderRadius:7,boxShadow:'0 6px 20px rgba(0,0,0,0.1)',zIndex:600,minWidth:160,overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
          <button onClick={()=>deleteRow(rowContextMenu.rowIdx)} style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'9px 14px',background:'none',border:'none',fontSize:13,color:C.danger,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left'}}
            onMouseOver={e=>e.currentTarget.style.background='#FEF2F2'} onMouseOut={e=>e.currentTarget.style.background='none'}>🗑 Delete row</button>
        </div>
      )}

      <style>{`@keyframes bounce{to{transform:translateY(-4px);opacity:.4}}`}</style>
    </div>
  )
}











// ── Admin Page ────────────────────────────────────────────────────────────────
function InviteButton({email,role,onDone}:{email:string,role:string,onDone:()=>void}) {
  const [loading,setLoading]=useState(false)
  const [status,setStatus]=useState<'idle'|'ok'|'error'>('idle')
  const [msg,setMsg]=useState('')

  const send=async()=>{
    if(!email.trim()||!email.includes('@')){setMsg('Enter a valid email');setStatus('error');return}
    setLoading(true);setStatus('idle')
    try{
      const res=await fetch('/api/invite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,name:email.split('@')[0],role:role.toLowerCase()})})
      const d=await res.json()
      if(!res.ok)throw new Error(d.error)
      setStatus('ok');setMsg('Invite sent!')
      setTimeout(()=>{setStatus('idle');setMsg('');onDone()},1500)
    }catch(e:any){setStatus('error');setMsg(e.message||'Failed to send invite')}
    finally{setLoading(false)}
  }

  return(
    <div style={{display:'flex',flexDirection:'column',gap:4}}>
      <button onClick={send} disabled={loading||status==='ok'}
        style={{padding:'7px 16px',borderRadius:6,border:'none',background:status==='ok'?C.success:loading?'#E5E7EB':C.accent,color:loading?C.textLight:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',minWidth:96}}>
        {loading?'Sending…':status==='ok'?'✓ Sent':'Send invite'}
      </button>
      {msg&&<div style={{fontSize:11.5,color:status==='error'?C.danger:C.success,fontWeight:500}}>{msg}</div>}
    </div>
  )
}


// ── Add / Onboard Database Modal ──────────────────────────────────────────────
const DB_TYPES = [
  {id:'postgres',label:'PostgreSQL',icon:'🐘'},
  {id:'neon',label:'Neon',icon:'⚡'},
  {id:'supabase',label:'Supabase',icon:'🦸'},
  {id:'mysql',label:'MySQL',icon:'🐬'},
  {id:'snowflake',label:'Snowflake',icon:'❄️'},
  {id:'mssql',label:'SQL Server',icon:'🟦'},
]

function AddDatabaseModal({onClose}:{onClose:()=>void}) {
  const [step,setStep]=useState<'connect'|'testing'|'done'>('connect')
  const [dbType,setDbType]=useState('')
  const [mode,setMode]=useState<'url'|'form'>('url')
  const [urlStr,setUrlStr]=useState('')
  const [host,setHost]=useState(''); const [port,setPort]=useState('5432')
  const [dbName,setDbName]=useState(''); const [user,setUser]=useState(''); const [pass,setPass]=useState('')
  const [ssl,setSsl]=useState(true)
  const [testResult,setTestResult]=useState<{ok:boolean,error?:string,db_name?:string,table_count?:number,latency_ms?:number}|null>(null)
  const [saving,setSaving]=useState(false)
  const [saveError,setSaveError]=useState('')
  const [saved,setSaved]=useState(false)

  const buildConnStr=()=>{
    if(mode==='url')return urlStr.trim()
    if(!host||!dbName)return ''
    const sslP=ssl?'?sslmode=require':''
    const auth=user?`${encodeURIComponent(user)}${pass?':'+encodeURIComponent(pass):''}@`:''
    return `postgresql://${auth}${host}:${port||5432}/${dbName}${sslP}`
  }

  const canTest=dbType&&(mode==='url'?urlStr.trim().length>10:!!(host&&dbName))

  const test=async()=>{
    setStep('testing');setTestResult(null);setSaveError('')
    try{
      const res=await fetch('/api/test-connection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({connectionString:buildConnStr(),ssl})})
      const d=await res.json()
      setTestResult(d)
    }catch{setTestResult({ok:false,error:'Network error — try again'})}
    setStep('connect')
  }

  const save=async()=>{
    setSaving(true);setSaveError('')
    try{
      const res=await fetch('/api/company',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({db_connection_string:buildConnStr()})})
      const d=await res.json()
      if(!res.ok)throw new Error(d.error||'Failed to save')
      setSaved(true)
      setTimeout(()=>onClose(),1800)
    }catch(e:any){setSaveError(e.message)}
    setSaving(false)
  }

  const inp=(val:string,set:(v:string)=>void,ph:string,type='text')=>(
    <input value={val} onChange={e=>set(e.target.value)} placeholder={ph} type={type}
      style={{width:'100%',padding:'8px 11px',borderRadius:7,border:`1.5px solid ${C.cardBorder}`,fontSize:13.5,color:C.text,fontFamily:"'JetBrains Mono',monospace",background:'#fff'}}
      onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.cardBorder}/>
  )

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(10,20,30,0.72)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'#fff',borderRadius:12,width:'100%',maxWidth:560,boxShadow:'0 24px 64px rgba(0,0,0,0.22)',overflow:'hidden',fontFamily:'Inter,sans-serif'}}>

        {/* Header */}
        <div style={{padding:'16px 20px',borderBottom:`1px solid ${C.cardBorder}`,background:'#FAFAFA',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontWeight:700,fontSize:15,color:C.text}}>Connect a database</div>
            <div style={{fontSize:12.5,color:C.textMuted,marginTop:2}}>Read-only access only — Qwezy never writes to your data</div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <button onClick={onClose} style={{fontSize:12.5,color:C.textLight,background:'none',border:`1px solid ${C.cardBorder}`,borderRadius:6,padding:'5px 12px',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Save & finish later</button>
            <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,color:C.textLight,cursor:'pointer',lineHeight:1}}>×</button>
          </div>
        </div>

        <div style={{padding:'20px',display:'flex',flexDirection:'column',gap:16}}>

          {/* DB type selector */}
          <div>
            <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Database type</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
              {DB_TYPES.map(d=>(
                <button key={d.id} onClick={()=>setDbType(d.id)}
                  style={{padding:'9px 8px',borderRadius:8,border:'1.5px solid',cursor:'pointer',fontFamily:'Inter,sans-serif',fontSize:13,fontWeight:500,display:'flex',alignItems:'center',gap:7,
                    borderColor:dbType===d.id?C.accent:C.cardBorder,background:dbType===d.id?C.accentBg:'#fff',color:dbType===d.id?C.accentDark:C.textMuted}}>
                  <span style={{fontSize:17}}>{d.icon}</span>{d.label}
                </button>
              ))}
            </div>
          </div>

          {dbType&&<>
            {/* Mode toggle */}
            <div style={{display:'flex',gap:4,padding:'3px',background:'#F0F4F8',borderRadius:7,width:'fit-content'}}>
              {(['url','form'] as const).map(m=>(
                <button key={m} onClick={()=>setMode(m)}
                  style={{padding:'5px 14px',borderRadius:5,border:'none',cursor:'pointer',fontFamily:'Inter,sans-serif',fontSize:12.5,fontWeight:500,
                    background:mode===m?'#fff':undefined,color:mode===m?C.text:C.textLight,boxShadow:mode===m?'0 1px 3px rgba(0,0,0,0.1)':undefined}}>
                  {m==='url'?'Connection URL':'Connection form'}
                </button>
              ))}
            </div>

            {mode==='url'
              ?<div>
                <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>Connection URL</div>
                {inp(urlStr,setUrlStr,'postgresql://user:password@host/database?sslmode=require')}
                <div style={{fontSize:11.5,color:C.textLight,marginTop:4}}>Format: postgresql://user:pass@host:port/dbname</div>
              </div>
              :<div style={{display:'flex',flexDirection:'column',gap:10}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 80px',gap:10}}>
                  <div><div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>Host</div>{inp(host,setHost,'db.example.com')}</div>
                  <div><div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>Port</div>{inp(port,setPort,'5432')}</div>
                </div>
                <div><div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>Database name</div>{inp(dbName,setDbName,'production')}</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div><div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>Username</div>{inp(user,setUser,'readonly_user')}</div>
                  <div><div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>Password</div>{inp(pass,setPass,'••••••••','password')}</div>
                </div>
              </div>}

            {/* SSL toggle */}
            <div style={{display:'flex',alignItems:'center',gap:9,padding:'9px 12px',background:'#F8FAFD',borderRadius:7,border:`1px solid ${C.cardBorder}`}}>
              <button onClick={()=>setSsl(s=>!s)} style={{width:34,height:18,borderRadius:9,border:'none',cursor:'pointer',background:ssl?C.accent:'#CBD5E1',position:'relative',flexShrink:0,transition:'background .2s'}}>
                <div style={{width:12,height:12,borderRadius:'50%',background:'#fff',position:'absolute',top:3,left:ssl?19:3,transition:'left .2s'}}/>
              </button>
              <span style={{fontSize:13,color:C.text}}>Require SSL / TLS</span>
            </div>

            {/* Test result */}
            {testResult&&(
              <div style={{padding:'11px 14px',borderRadius:8,border:`1px solid ${testResult.ok?C.greenBorder:'#FECACA'}`,background:testResult.ok?C.accentBg:'#FEF2F2',fontSize:13}}>
                {testResult.ok
                  ?<span style={{color:C.accent,fontWeight:600}}>✓ Connected — {testResult.table_count} tables found ({testResult.latency_ms}ms) · {testResult.db_name}</span>
                  :<span style={{color:C.danger,fontWeight:500}}>✗ {testResult.error}</span>}
              </div>
            )}

            {saveError&&<div style={{padding:'10px 12px',background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:7,fontSize:13,color:C.danger}}>{saveError}</div>}
            {saved&&<div style={{padding:'10px 12px',background:C.accentBg,border:`1px solid ${C.greenBorder}`,borderRadius:7,fontSize:13,color:C.accent,fontWeight:600}}>✓ Database saved — reloading your workspace…</div>}
          </>}

          <div style={{padding:'9px 12px',background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:7,fontSize:12.5,color:'#92400E'}}>
            We recommend a dedicated read-only database user. Credentials are AES-256 encrypted.
          </div>
        </div>

        {/* Footer */}
        <div style={{padding:'14px 20px',borderTop:`1px solid ${C.cardBorder}`,background:'#FAFAFA',display:'flex',gap:8,justifyContent:'flex-end',alignItems:'center'}}>
          <button onClick={onClose} style={{background:'#fff',color:C.textMuted,border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:'8px 16px',fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
            Exit without saving
          </button>
          <button onClick={test} disabled={!canTest||step==='testing'||saved}
            style={{background:'#F0F4F8',color:C.text,border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:'8px 16px',fontSize:13,fontWeight:500,cursor:canTest?'pointer':'default',fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center',gap:6}}>
            {step==='testing'?<><div style={{width:11,height:11,border:`2px solid ${C.cardBorder}`,borderTop:`2px solid ${C.accent}`,borderRadius:'50%',animation:'spin .7s linear infinite'}}/>Testing…</>:'Test connection'}
          </button>
          <button onClick={save} disabled={!testResult?.ok||saving||saved}
            style={{background:testResult?.ok&&!saving&&!saved?C.accent:'#E5E7EB',color:testResult?.ok&&!saving&&!saved?'#fff':C.textLight,border:'none',borderRadius:7,padding:'8px 20px',fontSize:13,fontWeight:600,cursor:testResult?.ok?'pointer':'default',fontFamily:'Inter,sans-serif'}}>
            {saving?'Saving…':saved?'Saved ✓':'Save & connect'}
          </button>
        </div>
      </div>
    </div>
  )
}


function AdminPage({dataAccess,setDataAccess,onReplayTour,aiConfigured=false,tableCount=0,companyName='',dbConnected=false}:{dataAccess:boolean,setDataAccess:(v:boolean)=>void,onReplayTour:()=>void,aiConfigured?:boolean,tableCount?:number,companyName?:string,dbConnected?:boolean}) {
  const [USERS,setUSERS]=useState<any[]>([])
  const [usageCount,setUsageCount]=useState(0)
  const [plan,setPlan]=useState('Starter')
  const [refreshingUsage,setRefreshingUsage]=useState(false)

  const refreshTeam = useCallback(async()=>{
    try{
      const d = await fetch('/api/team', { cache:'no-store' }).then(r=>r.ok?r.json():null)
      const list=d?.users||d?.members||[]
      setUSERS(list.map((m:any)=>({
        name:m.name||m.email,
        email:m.email,
        role:m.role?.charAt(0).toUpperCase()+m.role?.slice(1)||'Viewer',
        status:m.status==='active'?'Active':'Inactive',
        lastSeen:m.last_seen?new Date(m.last_seen).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'Never',
        queries:m.queries||0,
        initials:(m.name||m.email).split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()
      })))
    }catch{}
  },[])

  const refreshUsage = useCallback(async(forcedCount?:number|null)=>{
    if(typeof forcedCount==='number'){
      setUsageCount(forcedCount)
      return
    }
    try{
      setRefreshingUsage(true)
      const d = await fetch('/api/usage', { cache:'no-store' }).then(r=>r.ok?r.json():null)
      if(d?.count!=null) setUsageCount(d.count)
    }catch{}
    finally{ setRefreshingUsage(false) }
  },[])

  const refreshAdminStats = useCallback(async(forcedCount?:number|null)=>{
    await Promise.all([refreshUsage(forcedCount), refreshTeam()])
  },[refreshUsage, refreshTeam])

  useEffect(()=>{
    refreshAdminStats()
    fetch('/api/auth').then(r=>r.ok?r.json():null).then(d=>{
      if(d?.plan) setPlan(d.plan.charAt(0).toUpperCase()+d.plan.slice(1))
    }).catch(()=>{})

    const onUsageUpdated=(ev:any)=>refreshAdminStats(ev?.detail?.count)
    const onFocus=()=>refreshAdminStats()
    window.addEventListener('qwezy:usage-updated', onUsageUpdated)
    window.addEventListener('focus', onFocus)
    return ()=>{
      window.removeEventListener('qwezy:usage-updated', onUsageUpdated)
      window.removeEventListener('focus', onFocus)
    }
  },[refreshAdminStats])
  const ROLES=[
    {role:'Admin',desc:'Full access — manage settings, users, data, and all queries',color:C.accent},
    {role:'Editor',desc:'Can query, build dashboards, run reports, and edit grid data',color:'#3B82F6'},
    {role:'Viewer',desc:'Read-only — can query and view dashboards but cannot edit data',color:'#8B5CF6'},
  ]
  const [inviteEmail,setInviteEmail]=useState('')
  const [inviteRole,setInviteRole]=useState('Viewer')
  const [showInvite,setShowInvite]=useState(false)

  const PLAN_LIMITS={queries:500,resetDate:new Date(new Date().getFullYear(),new Date().getMonth()+1,1).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
  const usedPct=Math.round((usageCount/PLAN_LIMITS.queries)*100)

  return(
    <div style={{flex:1,overflowY:'auto',background:C.bg}}>
      <div style={{maxWidth:900,margin:'0 auto',padding:'28px 24px'}}>

        {/* Page header */}
        <div style={{marginBottom:28}}>
          <div style={{fontSize:20,fontWeight:800,color:C.text,letterSpacing:'-0.3px',marginBottom:4}}>Admin Settings</div>
          <div style={{fontSize:13.5,color:C.textMuted}}>Manage your workspace, team, and AI settings</div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>

          {/* Usage this cycle */}
          <div style={{background:'#fff',borderRadius:10,border:`1px solid ${C.cardBorder}`,padding:'18px 20px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}><div style={{fontSize:11,fontWeight:700,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.07em'}}>Usage this cycle</div><button onClick={()=>refreshAdminStats()} style={{fontSize:11.5,padding:'4px 10px',borderRadius:6,border:`1px solid ${C.cardBorder}`,background:'#fff',color:C.textMuted,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{refreshingUsage?'Refreshing…':'Refresh'}</button></div>
            <div style={{display:'flex',alignItems:'flex-end',gap:6,marginBottom:10}}>
              <span style={{fontSize:36,fontWeight:800,color:C.text,letterSpacing:'-1px',lineHeight:1}}>{usageCount.toLocaleString()}</span>
              <span style={{fontSize:14,color:C.textLight,marginBottom:4}}>/ {PLAN_LIMITS.queries} queries</span>
            </div>
            <div style={{height:6,background:'#E5E7EB',borderRadius:3,overflow:'hidden',marginBottom:8}}>
              <div style={{height:'100%',width:`${usedPct}%`,background:usedPct>80?C.danger:usedPct>60?C.warn:C.accent,borderRadius:3,transition:'width .4s'}}/>
            </div>
            <div style={{fontSize:12,color:C.textLight}}>Resets {PLAN_LIMITS.resetDate} · <span style={{color:usedPct>80?C.danger:C.textLight,fontWeight:500}}>{usedPct}% used</span></div>
          </div>

          {/* Plan */}
          <div style={{background:'#fff',borderRadius:10,border:`1px solid ${C.cardBorder}`,padding:'18px 20px'}}>
            <div style={{fontSize:11,fontWeight:700,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:14}}>Plan</div>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
              <div style={{fontSize:22,fontWeight:800,color:C.text}}>{plan}</div>
              <span style={{fontSize:11,padding:'2px 8px',borderRadius:4,background:C.accentBg,color:C.accent,fontWeight:700,border:`1px solid ${C.greenBorder}`}}>Active</span>
            </div>
            {[['Queries / month','500'],['Team seats','5'],['Databases','1'],['Data access AI','Included']].map(([k,v])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                <span style={{fontSize:12.5,color:C.textMuted}}>{k}</span>
                <span style={{fontSize:12.5,fontWeight:600,color:C.text}}>{v}</span>
              </div>
            ))}
            <button style={{marginTop:12,width:'100%',padding:'7px',borderRadius:6,border:`1px solid ${C.accent}`,background:'#fff',color:C.accent,fontSize:12.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}
              onMouseOver={e=>e.currentTarget.style.background=C.accentBg} onMouseOut={e=>e.currentTarget.style.background='#fff'}>
              Upgrade plan
            </button>
          </div>
        </div>

        {/* AI Settings */}
        <div style={{background:'#fff',borderRadius:10,border:`1px solid ${C.cardBorder}`,padding:'18px 20px',marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:16}}>AI Settings</div>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16}}>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:4}}>Read Data</div>
              <div style={{fontSize:13,color:C.textMuted,lineHeight:1.6}}>When enabled, Qwezy AI reads actual data values and responds in natural conversational language — "Your top customer is Ernst Handel with $48,837." When disabled, AI returns raw query results as a table without interpretation.</div>
            </div>
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6,flexShrink:0}}>
              <div onClick={()=>setDataAccess(!dataAccess)}
                style={{width:44,height:24,borderRadius:12,background:dataAccess?C.accent:'#CBD5E1',cursor:'pointer',position:'relative',transition:'background .2s',flexShrink:0}}>
                <div style={{width:20,height:20,borderRadius:'50%',background:'#fff',position:'absolute',top:2,left:dataAccess?22:2,transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
              </div>
              <span style={{fontSize:12,fontWeight:600,color:dataAccess?C.accent:C.textLight}}>{dataAccess?'Enabled':'Disabled'}</span>
            </div>
          </div>
        </div>

        {/* Team */}
        <div style={{background:'#fff',borderRadius:10,border:`1px solid ${C.cardBorder}`,padding:'18px 20px',marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:700,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.07em'}}>Team members</div>
            <button onClick={()=>setShowInvite(s=>!s)}
              style={{fontSize:12.5,padding:'5px 14px',borderRadius:6,border:'none',background:C.accent,color:'#fff',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:600}}>+ Invite</button>
          </div>
          {showInvite&&(
            <div style={{background:C.accentBg,border:`1px solid ${C.greenBorder}`,borderRadius:8,padding:'14px 16px',marginBottom:16,display:'flex',gap:8,alignItems:'flex-end',flexWrap:'wrap'}}>
              <div style={{flex:1,minWidth:200}}>
                <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:5}}>Email</div>
                <input value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="colleague@company.com"
                  style={{width:'100%',padding:'7px 10px',borderRadius:6,border:`1px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif'}}/>
              </div>
              <div style={{width:140}}>
                <div style={{fontSize:11,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:5}}>Role</div>
                <select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}
                  style={{width:'100%',padding:'7px 10px',borderRadius:6,border:`1px solid ${C.cardBorder}`,fontSize:13,color:C.text,fontFamily:'Inter,sans-serif',background:'#fff'}}>
                  {['Viewer','Editor','Admin'].map(r=><option key={r}>{r}</option>)}
                </select>
              </div>
              <InviteButton email={inviteEmail} role={inviteRole} onDone={()=>{setShowInvite(false);setInviteEmail('')}}/>
            </div>
          )}
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{borderBottom:`2px solid ${C.cardBorder}`}}>
                {['Member','Role','Status','Last active','Queries this cycle'].map(h=>(
                  <th key={h} style={{padding:'6px 10px',textAlign:'left',fontSize:10.5,fontWeight:700,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.05em',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {USERS.map((u,i)=>(
                <tr key={u.email} style={{borderBottom:`1px solid #F1F5F9`,background:i%2===0?'#fff':'#FAFCFE'}}>
                  <td style={{padding:'10px 10px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:32,height:32,borderRadius:'50%',background:C.accentBg,border:`1.5px solid ${C.greenBorder}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:C.accent,flexShrink:0}}>{u.initials}</div>
                      <div>
                        <div style={{fontSize:13,fontWeight:500,color:C.text}}>{u.name}</div>
                        <div style={{fontSize:11,color:C.textLight}}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{padding:'10px 10px'}}>
                    <span style={{fontSize:12,padding:'2px 8px',borderRadius:4,fontWeight:600,
                      background:u.role==='Admin'?C.accentBg:u.role==='Editor'?'#EFF6FF':'#F5F3FF',
                      color:u.role==='Admin'?C.accent:u.role==='Editor'?'#3B82F6':'#8B5CF6',
                      border:`1px solid ${u.role==='Admin'?C.greenBorder:u.role==='Editor'?'#BFDBFE':'#DDD6FE'}`}}>{u.role}</span>
                  </td>
                  <td style={{padding:'10px 10px'}}><div style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:6,height:6,borderRadius:'50%',background:u.status==='Active'?C.success:'#CBD5E1'}}/><span style={{fontSize:12.5,color:C.text}}>{u.status}</span></div></td>
                  <td style={{padding:'10px 10px',fontSize:12.5,color:C.textMuted}}>{u.lastSeen}</td>
                  <td style={{padding:'10px 10px',fontFamily:"'JetBrains Mono'",fontSize:12.5,color:C.accentDark,fontWeight:500}}>{u.queries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Role permissions */}
        <div style={{background:'#fff',borderRadius:10,border:`1px solid ${C.cardBorder}`,padding:'18px 20px',marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:14}}>Role permissions</div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {ROLES.map(r=>(
              <div key={r.role} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'10px 14px',borderRadius:8,border:`1px solid ${C.cardBorder}`,background:'#FAFAFA'}}>
                <span style={{fontSize:12,padding:'2px 8px',borderRadius:4,fontWeight:700,background:'#fff',border:`1.5px solid ${r.color}`,color:r.color,flexShrink:0,marginTop:1}}>{r.role}</span>
                <span style={{fontSize:13,color:C.textMuted,lineHeight:1.55}}>{r.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Database connection */}
        <div style={{background:'#fff',borderRadius:10,border:`1px solid ${C.cardBorder}`,padding:'18px 20px',marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.07em'}}>Database connection</div>
            <button onClick={()=>window.location.href='/connect'}
              style={{fontSize:12.5,padding:'5px 14px',borderRadius:6,border:'none',background:C.accent,color:'#fff',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:600}}>
              {dbConnected?'Reconnect':'Connect database →'}
            </button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {[
              ['Database', companyName||'—'],
              ['Tables', tableCount>0?`${tableCount} tables`:'—'],
              ['Status', dbConnected?'Connected':'Not connected'],
              ['AI Prompt', aiConfigured?'Configured ✓':'Not yet analysed'],
            ].map(([k,v])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'8px 12px',background:'#F8FAFD',borderRadius:7,border:`1px solid ${C.cardBorder}`}}>
                <span style={{fontSize:12.5,color:C.textMuted}}>{k}</span>
                <span style={{fontSize:12.5,fontWeight:600,color:k==='Status'?(dbConnected?C.success:C.danger):k==='AI Prompt'&&aiConfigured?C.success:C.text}}>{v}</span>
              </div>
            ))}
          </div>
          <button onClick={async(e)=>{
              const btn=e.currentTarget;btn.textContent='Analysing your database…';btn.style.opacity='0.7'
              try{
                const r=await fetch('/api/company/analyse',{method:'POST'})
                const d=await r.json()
                btn.textContent=r.ok?`✓ ${d.message||'Analysis complete — AI is now configured'}`:`Error: ${d.error}`
              }catch{btn.textContent='Something went wrong — try again'}
              btn.style.opacity='1'
            }}
            style={{marginTop:12,width:'100%',padding:'8px',borderRadius:6,border:`1px solid ${C.accent}`,background:aiConfigured?C.accentBg:'#fff',color:C.accent,fontSize:12.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',transition:'all 0.2s'}}>
            {aiConfigured?'Re-run AI analysis':'Run AI analysis on your database'}
          </button>
        </div>

        {/* System health */}
        <div style={{background:'#fff',borderRadius:10,border:`1px solid ${C.cardBorder}`,padding:'18px 20px',marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:14}}>System health</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:10}}>
            {[
              ['Queries Run',String(usageCount),'This cycle'],
              ['Tables',tableCount>0?String(tableCount):'—',dbConnected?'Connected':'Not connected'],
              ['AI Response',aiConfigured?'Active':'Setup needed',aiConfigured?'Via Qwezy AI':'Run analysis above'],
              ['Members',String(USERS.length),USERS.length===1?'1 user':`${USERS.length} users`],
            ].map(([l,v,s])=>(
              <div key={l} style={{background:'#F8FAFD',borderRadius:8,border:`1px solid ${C.cardBorder}`,padding:'11px 13px'}}>
                <div style={{fontSize:9.5,color:C.textLight,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>{l}</div>
                <div style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:1}}>{v}</div>
                <div style={{fontSize:11,color:C.success,fontWeight:500}}>{s}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Help */}
        <div style={{background:'#fff',borderRadius:10,border:`1px solid ${C.cardBorder}`,padding:'18px 20px'}}>
          <div style={{fontSize:11,fontWeight:700,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:14}}>Help</div>
          <button onClick={onReplayTour}
            style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:7,border:`1px solid ${C.cardBorder}`,background:'#F8FAFD',cursor:'pointer',fontFamily:'Inter,sans-serif',width:'100%',textAlign:'left'}}
            onMouseOver={e=>e.currentTarget.style.background=C.accentBg} onMouseOut={e=>e.currentTarget.style.background='#F8FAFD'}>
            <span style={{fontSize:18}}>🎯</span>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:C.text}}>Replay product tour</div>
              <div style={{fontSize:12,color:C.textMuted}}>Walk through Qwezy features step by step</div>
            </div>
          </button>
        </div>

      </div>
    </div>
  )
}


// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router=useRouter()
  const [tab,setTab]=useState<string>('ask')
  const [showTour,setShowTour]=useState(false)
  const [isDemo,setIsDemo]=useState<boolean|null>(null)
  const [liveSchema,setLiveSchema]=useState<any[]>([])
  const [schemaLoading,setSchemaLoading]=useState(false)
  const [dbName,setDbName]=useState('')
  const [dbConnected,setDbConnected]=useState(false)
  const [aiConfigured,setAiConfigured]=useState(false)

  // Determine demo vs real company user
  useEffect(()=>{
    fetch('/api/auth')
      .then(r=>r.ok?r.json():null)
      .then(d=>{
        if(!d){setIsDemo(false);return}
        // Handle both flat { company_id } and nested { user: { company_id } } response shapes
        const profile = d.company_id ? d : (d.user || {})
        const companyId = profile.company_id
        const demo = companyId===NORTHWIND_COMPANY_ID
        setIsDemo(demo)
        if(profile.company_name) setDbName(profile.company_name)
        if(profile.db_connected) setDbConnected(true)
        if(profile.ai_configured) setAiConfigured(true)
        if(!demo){
          setSchemaLoading(true)
          fetch('/api/schema')
            .then(r=>r.ok?r.json():null)
            .then(data=>{ if(data) setLiveSchema(schemaToTables(data)) })
            .catch(()=>{})
            .finally(()=>setSchemaLoading(false))
        }
      })
      .catch(()=>setIsDemo(false))
  },[])

  // Show connect prompt if user's company has no DB connected (read from auth)
  useEffect(()=>{
    if(isDemo===false){
      // isDemo resolved to false — check if db_connected
      fetch('/api/auth').then(r=>r.ok?r.json():null).then(d=>{
        const profile = d?.company_id ? d : (d?.user || {})
        if(d && !profile.db_connected) setShowConnectPrompt(true)
      }).catch(()=>{})
    }
  },[isDemo])

  // Sync tab + tour from sessionStorage after mount (avoids SSR hydration mismatch)
  useEffect(()=>{
    try{
      const savedTab=sessionStorage.getItem('qwezy_tab')
      if(savedTab)setTab(savedTab)
      try{const tourDone=localStorage.getItem('qwezy_tour_done_v2');if(tourDone!=='1')setShowTour(true)}catch{}
    }catch{}
  },[])
  const [drawerTable,setDrawerTable]=useState<any>(null)
  const [previewTable,setPreviewTable]=useState<any>(null)
  const [contextMenu,setContextMenu]=useState<{x:number,y:number,table:any}|null>(null)
  const [sideCollapsed,setSideCollapsed]=useState(false)
  const [sideWidth,setSideWidth]=useState(200)
  const [reportResults,setReportResults]=useState<Record<string,ReportResult>>(()=>reportCache)
  const [askQ,setAskQ]=useState('')
  const [gridTable,setGridTable]=useState<any>(null)
  const [showAdmin,setShowAdmin]=useState(false)
  const [showConnectPrompt,setShowConnectPrompt]=useState(false)
  const [infoPanel,setInfoPanel]=useState<{table:any,x:number,y:number}|null>(null)
  const [dataAccess,setDataAccess]=useState(true)
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
  ]

  const appBootLoading = isDemo===null || schemaLoading
  
  return(
    <div style={{fontFamily:'Inter,-apple-system,sans-serif',display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden',background:C.bg,position:'relative'}}>
      {appBootLoading && <OverlaySpinner label='Loading workspace…' />}
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        .spin{animation:spin .8s linear infinite}
        .landingCard{background:#FFFFFF;border:1px solid #D7E4DC;border-radius:20px;box-shadow:0 16px 36px rgba(10,35,28,0.06)}
        .landingSoft{background:#FBFDFC;border:1px solid #D7E4DC;border-radius:18px}
        .landing-chip{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;border:1px solid #D7E4DC;background:#fff;font-size:12px;font-weight:700}
        .browserShell{background:#FFFFFF;border:1px solid #D7E4DC;border-radius:24px;box-shadow:0 24px 54px rgba(10,35,28,0.08);overflow:hidden}
        .browserBar{height:34px;display:flex;align-items:center;padding:0 14px;border-bottom:1px solid #D7E4DC;background:#F7FBF8}
        .browserDots{display:flex;gap:6px}
        .browserDots span{width:8px;height:8px;border-radius:999px;background:#D1D9D5;display:block}
        .browserPill{display:inline-flex;align-items:center;padding:7px 12px;border-radius:999px;border:1px solid #D7E4DC;background:#fff;font-size:12.5px;font-weight:700;color:#4B6358}
        .sectionTitle{font-size:28px;font-weight:800;letter-spacing:-0.04em;color:#022C22}
      `}</style>

      {/* Navbar */}
      <nav style={{background:C.navBg,borderBottom:`1px solid ${C.navBorder}`,height:54,display:'flex',alignItems:'center',paddingLeft:18,paddingRight:18,gap:0,flexShrink:0,boxShadow:'0 1px 0 rgba(255,255,255,0.03) inset'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginRight:16,paddingRight:14,borderRight:`1px solid ${C.navBorder}`}}>
          <div style={{width:24,height:24,background:'linear-gradient(135deg,#10B981,#059669)',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{color:'#fff',fontFamily:"'JetBrains Mono'",fontWeight:700,fontSize:10}}>{'{ }'}</span>
          </div>
          <span style={{fontWeight:700,fontSize:14,color:'#fff',letterSpacing:'-0.2px'}}>Qwezy</span>
          <span style={{fontSize:11,color:C.navText,padding:'2px 6px',background:'rgba(16,185,129,0.15)',borderRadius:4,fontWeight:600}}>Demo</span>
        </div>
        <div style={{display:'flex',gap:1,flex:1,overflow:'hidden'}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>{setTab(t.id);setGridTable(null)}}
              style={{background:'none',border:'none',padding:'0 14px',height:54,fontSize:13,fontWeight:700,color:tab===t.id?'#fff':C.navText,cursor:'pointer',borderBottom:tab===t.id?`2px solid ${C.navActive}`:'2px solid transparent',fontFamily:'Inter,sans-serif',whiteSpace:'nowrap',letterSpacing:'-0.01em'}}>
              {t.label}
            </button>
          ))}
        </div>

        <button onClick={()=>setTab('admin')} style={{fontSize:12.5,color:tab==='admin'?'#fff':C.navText,background:'none',border:`1px solid ${C.navBorder}`,borderRadius:5,padding:'4px 10px',cursor:'pointer',fontFamily:'Inter,sans-serif',flexShrink:0,marginRight:6}}>Admin</button>
        <button onClick={signOut} style={{fontSize:12.5,color:C.navText,background:'none',border:`1px solid ${C.navBorder}`,borderRadius:5,padding:'4px 11px',cursor:'pointer',fontFamily:'Inter,sans-serif',flexShrink:0}}>Sign out</button>
      </nav>

      {/* Main layout */}
      <div style={{flex:1,display:'flex',overflow:'hidden',position:'relative'}}>

        {/* Sidebar */}
        <aside style={{width:sideCollapsed?24:sideWidth,background:'#F8FBF9',borderRight:`1px solid ${C.sidebarBorder}`,display:'flex',flexDirection:'column',flexShrink:0,overflow:'hidden',transition:'width .15s',position:'relative'}}>
          {!sideCollapsed&&(
            <>

              <div style={{padding:'11px 12px 8px',borderBottom:`1px solid ${C.sidebarBorder}`,background:'#FBFDFC',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{fontSize:9.5,fontWeight:600,color:C.textLight,textTransform:'uppercase',letterSpacing:'0.07em'}}>Tables</span>
                <button onClick={()=>setSideCollapsed(true)} style={{background:'none',border:'none',fontSize:14,color:C.textLight,cursor:'pointer',lineHeight:1}}>‹</button>
              </div>

              <div style={{flex:1,overflowY:'auto',padding:'5px 7px'}}>
                {(()=>{
                  const displayTables=isDemo?TABLES:liveSchema
                  if(schemaLoading) return <div style={{padding:'20px 10px',textAlign:'center',color:C.textLight,fontSize:12}}>Loading tables…</div>
                  if(!isDemo&&displayTables.length===0) return (
                    <div style={{padding:'16px 10px',textAlign:'center'}}>
                      <div style={{fontSize:22,marginBottom:6}}>🔌</div>
                      <div style={{fontSize:11.5,color:C.textMuted,lineHeight:1.6,marginBottom:10}}>No database connected</div>
                      <button onClick={()=>window.location.href='/onboarding'}
                        style={{fontSize:11,padding:'5px 12px',borderRadius:5,border:'none',background:C.accent,color:'#fff',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:600}}>
                        Connect database →
                      </button>
                    </div>
                  )
                  return displayTables.map((tbl:any) => (
                    <div
                      key={tbl.name}
                      style={{display:'flex',alignItems:'center',gap:8,padding:'10px 10px',borderRadius:14,marginBottom:6,cursor:'pointer',border:'1px solid transparent'}}
                      onClick={() => gridTable ? setGridTable(tbl) : setInfoPanel({table:tbl,x:0,y:0})}
                      onDoubleClick={() => setGridTable(tbl)}
                      onContextMenu={e=>{e.preventDefault();setInfoPanel({table:tbl,x:e.clientX,y:e.clientY})}}
                      onMouseOver={e=>{e.currentTarget.style.background='#FFFFFF'; e.currentTarget.style.borderColor=C.cardBorder; e.currentTarget.style.boxShadow='0 10px 24px rgba(10,35,28,0.05)'}}
                      onMouseOut={e=>{e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='transparent'; e.currentTarget.style.boxShadow='none'}}
                    >
                      <div style={{width:7,height:7,borderRadius:'50%',background:tbl.color,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11.5,fontWeight:500,color:C.text,fontFamily:"'JetBrains Mono'",overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tbl.name}</div>
                        {tbl.rows&&<div style={{fontSize:9.5,color:C.textLight}}>{tbl.rows} rows</div>}
                      </div>
                    </div>
                  ))
                })()}
              </div>

              
              <div style={{padding:'9px 11px',borderTop:`1px solid ${C.sidebarBorder}`,background:'#FAFCFE'}}>
                {(()=>{
                  const dt=isDemo?TABLES:liveSchema
                  const connected=isDemo||dt.length>0
                  return [
                    ['Tables', isDemo?`${TABLES.length}/${TABLES.length}`:String(dt.length)],
                    ['Database', isDemo?'Northwind':dbName||'—'],
                    ['Status', connected?'Connected':'Not connected']
                  ].map(([k,v])=>(
                    <div key={k} style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                      <span style={{fontSize:10.5,color:C.textLight}}>{k}</span>
                      <span style={{fontSize:10.5,fontWeight:600,color:k==='Status'?(connected?C.success:C.danger):C.text}}>{v}</span>
                    </div>
                  ))
                })()}
              </div>
              {/* Sidebar resize */}
              <div onMouseDown={startSideDrag} style={{position:'absolute',right:0,top:0,bottom:0,width:5,cursor:'ew-resize',zIndex:10}}
                onMouseOver={e=>e.currentTarget.style.background='rgba(5,150,105,0.2)'}
                onMouseOut={e=>{e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='transparent'; e.currentTarget.style.boxShadow='none'}}/>
            </>
          )}
          {sideCollapsed&&(
            <button onClick={()=>setSideCollapsed(false)} title="Expand sidebar"
              style={{width:'100%',flex:1,background:'none',border:'none',color:C.textLight,cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',paddingTop:12}}>›</button>
          )}
        </aside>

        {/* Main content */}
        <main style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          {gridTable&&<TableGridView table={gridTable} onClose={()=>setGridTable(null)} dataAccess={dataAccess}/>}
          {!gridTable&&<>
          {tab==='ask'&&isDemo!==null&&<QwezyTab onAsk={q=>{setAskQ(q)}} initialInput={askQ} onInputConsumed={()=>setAskQ('')} isDemo={!!isDemo} dbConnected={isDemo===true||dbConnected} liveSchema={liveSchema}/>}
          {tab==='builder'&&isDemo!==null&&<BuilderTab tables={isDemo===true?TABLES:liveSchema} isDemo={!!isDemo}/>}
          {tab==='dashboard'&&isDemo!==null&&<DashboardTab sharedResults={reportResults} onResultSaved={saveReportResult} isDemo={!!isDemo} tables={isDemo===true?TABLES:liveSchema}/>}
          {tab==='explorer'&&isDemo!==null&&!schemaLoading&&<ExplorerTab onAsk={askQuestion} setDrawerTable={setDrawerTable} handleRightClick={handleRightClick} onInfoPanel={(t,x,y)=>setInfoPanel({table:t,x,y})} displayTables={isDemo===true?TABLES:liveSchema}/>}
          {tab==='reports'&&isDemo!==null&&<div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}><ReportsTab sharedResults={reportResults} onResultSaved={saveReportResult} isDemo={!!isDemo}/></div>}
          {tab==='admin'&&(
            <AdminPage dataAccess={dataAccess} setDataAccess={setDataAccess} onReplayTour={()=>{setShowTour(true);try{localStorage.removeItem('qwezy_tour_done_v2')}catch{}}} aiConfigured={aiConfigured} tableCount={liveSchema.length} companyName={dbName} dbConnected={dbConnected}/>
          )}

          </>}
        </main>
      </div>

      {/* Overlays */}
      {infoPanel&&<TableInfoPanel table={infoPanel.table} x={infoPanel.x} y={infoPanel.y} onClose={()=>setInfoPanel(null)} onAsk={askQuestion} onPreview={t=>{setPreviewTable(t);setInfoPanel(null)}} onGrid={t=>{setGridTable(t);setInfoPanel(null)}} onDrawer={t=>{setDrawerTable(t);setInfoPanel(null)}}/> }
      {drawerTable&&<>
        <div onClick={()=>setDrawerTable(null)} style={{position:'fixed',inset:0,zIndex:199}}/>
        <TableDrawer table={drawerTable} allTables={isDemo===true?TABLES:liveSchema} onClose={()=>setDrawerTable(null)} onAsk={askQuestion} onPreview={t=>{setPreviewTable(t);setDrawerTable(null)}}/>
      </>}
      {previewTable&&<PreviewModal table={previewTable} onClose={()=>setPreviewTable(null)}/>}

      {showConnectPrompt&&(
        <div style={{position:'fixed',inset:0,background:'rgba(10,20,30,0.6)',zIndex:800,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:12,width:'100%',maxWidth:480,boxShadow:'0 24px 64px rgba(0,0,0,0.2)',overflow:'hidden',fontFamily:'Inter,sans-serif'}}>
            <div style={{padding:'24px 24px 20px',textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:12}}>🔌</div>
              <div style={{fontSize:18,fontWeight:800,color:C.text,letterSpacing:'-0.3px',marginBottom:8}}>Connect your database</div>
              <div style={{fontSize:14,color:C.textMuted,lineHeight:1.65,marginBottom:24}}>
                Your workspace is ready but you haven't connected a database yet. Connect now to start querying your real data in plain English.
              </div>
              <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                <button onClick={()=>setShowConnectPrompt(false)}
                  style={{background:'#fff',color:C.textMuted,border:`1px solid ${C.cardBorder}`,borderRadius:7,padding:'10px 20px',fontSize:13.5,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                  Not now
                </button>
                <button onClick={()=>{setShowConnectPrompt(false);window.location.href='/connect'}}
                  style={{background:C.accent,color:'#fff',border:'none',borderRadius:7,padding:'10px 24px',fontSize:13.5,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                  Connect database →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showTour&&<TourOverlay onFinish={()=>{setShowTour(false);setTab('ask');try{localStorage.setItem('qwezy_tour_done_v2','1')}catch{}}} onTabSwitch={t=>setTab(t)}/>}
    </div>
  )
}