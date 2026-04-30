'use client'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

const C = {
  bg: '#F4F8F5',
  white: '#FFFFFF',
  surface: '#FBFDFC',
  border: '#D7E4DC',
  text: '#0F1923',
  textMuted: '#4B6358',
  textLight: '#7C9488',
  navBg: '#022C22',
  navBorder: '#064E3B',
  navText: '#6EE7B7',
  accent: '#059669',
  accentDark: '#047857',
  accentSoft: '#ECFDF5',
  accentSoftBorder: '#B7E4CC',
  blue: '#DCEEFF',
  blueText: '#1D4ED8',
  blueSoft: '#EFF6FF',
  heroBeamA: 'rgba(16,185,129,0.34)',
  heroBeamB: 'rgba(96,165,250,0.28)',
  darkSection: '#07291F',
}

type FeatureKey = 'ask' | 'explorer' | 'dashboards' | 'reports'

const HERO_QUERIES = [
  'Which invoices are over 60 days overdue?',
  'Which attorneys are below target this month?',
  'Show monthly revenue by product category',
  'Which dashboards were viewed this week?',
]

const PRODUCT_SECTIONS: {
  key: FeatureKey
  eyebrow: string
  title: string
  body: string
  bullets: string[]
}[] = [
  {
    key: 'ask',
    eyebrow: 'Ask Qwezy',
    title: 'Ask in plain English and get a real answer.',
    body:
      'Qwezy turns business questions into live SQL, then shows the answer in a clean format your team can actually use. It feels approachable for non technical users while still being useful for analysts and data teams.',
    bullets: [
      'Plain English to SQL',
      'Answer, summary, and query together',
      'Built for real company data',
    ],
  },
  {
    key: 'explorer',
    eyebrow: 'Explorer',
    title: 'Give every table the context people usually have to ask for.',
    body:
      'Explorer keeps summaries, admin notes, AI notes, table guidance, and spreadsheet mode in one place. That means less confusion, less back and forth, and faster understanding across the business.',
    bullets: [
      'Summary and admin notes',
      'AI guidance by table',
      'Open tables like a spreadsheet',
    ],
  },
  {
    key: 'dashboards',
    eyebrow: 'Dashboards',
    title: 'Turn useful answers into dashboards your team can come back to.',
    body:
      'Once a question is answered, Qwezy makes it easy to save key metrics, trends, and views so leadership and teams can stay aligned without rebuilding the work somewhere else.',
    bullets: [
      'Save KPI views',
      'Track trends over time',
      'Share live views with your team',
    ],
  },
  {
    key: 'reports',
    eyebrow: 'Reports and alerts',
    title: 'Automate the numbers people check every week anyway.',
    body:
      'Create reports and alerts from natural language or SQL and keep ownership visible. Qwezy helps teams stay proactive without living inside manual reporting cycles.',
    bullets: [
      'Scheduled reports',
      'Alerts for changes that matter',
      'Clear history and ownership',
    ],
  },
]

const PRICING = [
  {
    name: 'Starter',
    price: '$99',
    period: '/month',
    desc: 'For solo operators and small teams getting started.',
    items: ['1 workspace', 'Ask Qwezy', 'Explorer', 'Basic dashboard saving'],
    cta: 'Start now',
    featured: false,
  },
  {
    name: 'Team',
    price: '$299',
    period: '/month',
    desc: 'For growing teams that want reporting and automation.',
    items: ['Up to 10 users', 'Dashboards', 'Reports and alerts', 'Admin controls'],
    cta: 'Book a demo',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    desc: 'For larger teams with more support and custom setup.',
    items: ['SSO', 'Custom onboarding', 'Priority support', 'Flexible rollout'],
    cta: 'Talk to us',
    featured: false,
  },
]

function useTyping(strings: string[], speed = 36, pause = 1800) {
  const [index, setIndex] = useState(0)
  const [char, setChar] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const [paused, setPaused] = useState(false)
  const current = strings[index]

  useEffect(() => {
    if (paused) {
      const t = setTimeout(() => {
        setPaused(false)
        setDeleting(true)
      }, pause)
      return () => clearTimeout(t)
    }

    const t = setTimeout(() => {
      if (!deleting) {
        if (char < current.length) setChar((v) => v + 1)
        else setPaused(true)
      } else {
        if (char > 0) setChar((v) => v - 1)
        else {
          setDeleting(false)
          setIndex((v) => (v + 1) % strings.length)
        }
      }
    }, deleting ? speed / 2 : speed)

    return () => clearTimeout(t)
  }, [char, current, deleting, pause, paused, speed, strings.length])

  return current.slice(0, char)
}

function GridBackground() {
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: C.bg }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.45,
          backgroundImage:
            'repeating-linear-gradient(to right, rgba(7,41,31,0.08) 0 1px, transparent 1px 230px)',
        }}
      />
    </>
  )
}

function HeroBeam() {
  return (
    <div
      style={{
        position: 'absolute',
        left: '-6%',
        right: '-6%',
        top: 290,
        height: 280,
        transform: 'rotate(-10deg)',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          filter: 'blur(28px)',
          background: `linear-gradient(90deg, ${C.heroBeamA} 0%, ${C.heroBeamB} 50%, ${C.heroBeamA} 100%)`,
        }}
      />
    </div>
  )
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '9px 14px',
        borderRadius: 999,
        border: `1px solid ${C.border}`,
        background: 'rgba(255,255,255,0.78)',
        color: C.accent,
        fontSize: 12.5,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </div>
  )
}

function PrimaryButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: C.accent,
        color: C.white,
        border: 'none',
        borderRadius: 999,
        padding: '14px 20px',
        fontWeight: 700,
        fontSize: 15,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function SecondaryButton({ children }: { children: ReactNode }) {
  return (
    <button
      style={{
        background: 'transparent',
        color: C.accent,
        border: 'none',
        padding: '14px 6px',
        fontWeight: 700,
        fontSize: 15,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function BrowserFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: C.white,
        border: `1px solid ${C.border}`,
        borderRadius: 26,
        boxShadow: '0 26px 60px rgba(10, 35, 28, 0.10)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: 36,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          borderBottom: `1px solid ${C.border}`,
          background: '#F7FBF8',
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          {['#D1D9D5', '#D1D9D5', '#D1D9D5'].map((c, i) => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
          ))}
        </div>
        <div style={{ margin: '0 auto', width: '54%', height: 10, borderRadius: 999, background: '#E5ECE8' }} />
      </div>
      {children}
    </div>
  )
}

function Label({ children, green, blue }: { children: ReactNode; green?: boolean; blue?: boolean }) {
  const bg = green ? C.accentSoft : blue ? C.blueSoft : '#F7FAF8'
  const border = green ? C.accentSoftBorder : blue ? '#CFE2FF' : C.border
  const color = green ? C.accentDark : blue ? C.blueText : C.textMuted
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: '7px 12px',
        borderRadius: 999,
        border: `1px solid ${border}`,
        background: bg,
        color,
        fontWeight: 700,
        fontSize: 12.5,
      }}
    >
      {children}
    </div>
  )
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 18,
        border: `1px solid ${highlight ? C.accentSoftBorder : C.border}`,
        background: highlight ? C.accentSoft : '#F9FBFA',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: C.textLight,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 34, fontWeight: 800, color: C.navBg, letterSpacing: '-0.05em' }}>{value}</div>
    </div>
  )
}

function HeroDemo({ query }: { query: string }) {
  return (
    <BrowserFrame>
      <div className="heroDemoGrid" style={{ display: 'grid', gridTemplateColumns: '1.02fr 0.98fr', minHeight: 600 }}>
        <div className="heroDemoLeft browserPad" style={{ padding: '34px 34px 28px', borderRight: `1px solid ${C.border}`, background: '#FCFDFC' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: C.accentSoft,
                border: `1px solid ${C.accentSoftBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: C.accent,
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              Q
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Qwezy Demo</div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: C.textLight, marginBottom: 10, letterSpacing: '0.05em' }}>ASK</div>
          <div
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 18,
              background: C.white,
              padding: '16px 16px',
              marginBottom: 18,
              minHeight: 88,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: 16, lineHeight: 1.55, color: C.text }}>
              {query}
              <span
                style={{
                  display: 'inline-block',
                  width: 2,
                  height: 16,
                  background: C.accent,
                  marginLeft: 4,
                  animation: 'blink 1s step-end infinite',
                }}
              />
            </div>
          </div>

          <div
            style={{
              border: `1px solid ${C.accentSoftBorder}`,
              borderRadius: 18,
              background: C.accentSoft,
              padding: '16px 16px',
              marginBottom: 18,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: C.accentDark, marginBottom: 8 }}>Highlight</div>
            <div style={{ fontSize: 16, lineHeight: 1.7, color: C.text }}>
              <strong>12 invoices</strong> are over 60 days overdue totaling <strong>$81,240</strong>. The largest balance belongs to
              <strong> Hartwell Group</strong>.
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: C.textLight, marginBottom: 10, letterSpacing: '0.05em' }}>RESULTS PREVIEW</div>
          <div className="tableWrap" style={{ border: `1px solid ${C.border}`, borderRadius: 18, overflow: 'hidden', background: C.white }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F7FBF8' }}>
                  {['Client', 'Balance', 'Aging'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 14px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: C.textLight,
                        borderBottom: `1px solid ${C.border}`,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Hartwell Group', '$19,480', '78 days'],
                  ['North Peak', '$11,250', '74 days'],
                  ['Halcyon Law', '$9,060', '66 days'],
                ].map((row, i) => (
                  <tr key={i}>
                    {row.map((val, j) => (
                      <td
                        key={j}
                        style={{
                          padding: '14px 14px',
                          fontSize: 14,
                          color: j === 1 ? C.accentDark : C.text,
                          borderBottom: i === 2 ? 'none' : `1px solid ${C.border}`,
                        }}
                      >
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="heroDemoRight browserPad" style={{ padding: '34px 34px 28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
              <Label green>Dashboard</Label>
              <Label>Report</Label>
              <Label>Alert</Label>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 16 }}>Save this as a dashboard</div>
            <div className="heroStatGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 18 }}>
              <StatCard label="Overdue balance" value="$81.2k" highlight />
              <StatCard label="Invoices" value="12" />
              <StatCard label="Largest client" value="$19.5k" />
              <StatCard label="Trend" value="+8%" />
            </div>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 18, padding: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: C.textLight,
                  marginBottom: 10,
                }}
              >
                Suggested next steps
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {['Schedule weekly finance brief', 'Create alert for balances over $10,000', 'Open source table in spreadsheet view'].map((item) => (
                  <div
                    key={item}
                    style={{
                      padding: '11px 12px',
                      borderRadius: 14,
                      border: `1px solid ${C.border}`,
                      background: C.white,
                      fontSize: 14,
                      lineHeight: 1.45,
                      color: C.textMuted,
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 20,
              paddingTop: 18,
              borderTop: `1px solid ${C.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.4 }}>Powered by governed metadata and live SQL</div>
            <button
              style={{
                background: C.navBg,
                color: C.white,
                border: 'none',
                borderRadius: 14,
                padding: '14px 18px',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                minWidth: 110,
              }}
            >
              Try demo
            </button>
          </div>
        </div>
      </div>
    </BrowserFrame>
  )
}

function AskDemo() {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ padding: 16, borderRadius: 18, border: `1px solid ${C.border}`, background: '#FCFDFC' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.textLight, marginBottom: 8 }}>Question</div>
        <div style={{ fontSize: 16, lineHeight: 1.6, color: C.text }}>Which attorneys are below their billing target this month?</div>
      </div>
      <div style={{ padding: 16, borderRadius: 18, border: `1px solid ${C.accentSoftBorder}`, background: C.accentSoft }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.accentDark, marginBottom: 8 }}>Highlight</div>
        <div style={{ fontSize: 15, lineHeight: 1.7, color: C.text }}>
          <strong>5 attorneys</strong> are below target. <strong>M. Rivera</strong> is furthest behind at <strong>71%</strong> of target.
        </div>
      </div>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 18, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F7FBF8' }}>
              {['Attorney', 'Target %', 'Hours'].map((h) => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, color: C.textLight, textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ['M. Rivera', '71%', '114'],
              ['J. Patel', '78%', '122'],
              ['A. Bloom', '83%', '129'],
            ].map((row, i) => (
              <tr key={i}>
                {row.map((v, j) => (
                  <td key={j} style={{ padding: '13px 14px', fontSize: 14, color: j === 1 ? C.accentDark : C.text, borderBottom: i === 2 ? 'none' : `1px solid ${C.border}` }}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


function AnimatedFeatureVisual({ sectionKey }: { sectionKey: FeatureKey }) {
  const [step, setStep] = useState(0)
  const [typedLen, setTypedLen] = useState(0)
  const [activeTable, setActiveTable] = useState(0)
  const [activeTab, setActiveTab] = useState(0)
  const [visibleRows, setVisibleRows] = useState(0)
  const [barHeights, setBarHeights] = useState([0,0,0,0,0,0,0])
  const [countVal, setCountVal] = useState(0)

  const question = 'Which attorneys are below their billing target this month?'

  useEffect(() => {
    if (sectionKey !== 'ask') return
    setTypedLen(0); setVisibleRows(0); setStep(0)
    let t: ReturnType<typeof setTimeout>
    let i = 0
    const type = () => {
      if (i <= question.length) { setTypedLen(i); i++; t = setTimeout(type, 26) }
      else { t = setTimeout(() => setStep(1), 250) }
    }
    t = setTimeout(type, 300)
    return () => clearTimeout(t)
  }, [sectionKey])

  useEffect(() => {
    if (sectionKey !== 'ask' || step !== 1) return
    let r = 0
    const reveal = () => { r++; setVisibleRows(r); if (r < 3) setTimeout(reveal, 260) }
    const t = setTimeout(reveal, 350)
    return () => clearTimeout(t)
  }, [sectionKey, step])

  useEffect(() => {
    if (sectionKey !== 'explorer') return
    setActiveTable(0)
    const iv = setInterval(() => setActiveTable(p => (p + 1) % 4), 1900)
    return () => clearInterval(iv)
  }, [sectionKey])

  useEffect(() => {
    if (sectionKey !== 'dashboards') return
    setBarHeights([0,0,0,0,0,0,0]); setActiveTab(0); setCountVal(0)
    const targets = [38,48,55,60,72,67,82]
    targets.forEach((target, i) => {
      setTimeout(() => setBarHeights(p => { const n=[...p]; n[i]=target; return n }), 180 + i * 85)
    })
    let c = 0
    const iv = setInterval(() => { c += 12; setCountVal(Math.min(c, 284)); if (c >= 284) clearInterval(iv) }, 16)
    const tv = setInterval(() => setActiveTab(p => (p + 1) % 3), 2400)
    return () => { clearInterval(iv); clearInterval(tv) }
  }, [sectionKey])

  useEffect(() => {
    if (sectionKey !== 'reports') return
    setStep(0)
    const t1 = setTimeout(() => setStep(1), 1000)
    const t2 = setTimeout(() => setStep(2), 2200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [sectionKey])

  const fadeIn = (delay: number) => ({
    animation: `fadeSlideIn 0.4s cubic-bezier(0.22,1,0.36,1) ${delay}s both`,
  })

  const TABLES = ['matter_billing','time_entries','client_invoices','rate_history']
  const TABLE_META = [
    { summary: 'Billing history by attorney, matter type, and effective date.', note: 'prefer attorney_name over attorney_id' },
    { summary: 'Individual time records linked to matters and billing codes.', note: 'hours field = decimal, not HH:MM' },
    { summary: 'Invoice records with status, amount, and overdue flags.', note: 'filter status=open for AR reports' },
    { summary: 'Historical rate changes by attorney and practice area.', note: 'latest effective_date = current rate' },
  ]

  if (sectionKey === 'ask') {
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={fadeIn(0)}>
          <div style={{ padding: 16, borderRadius: 18, border: `1px solid ${C.border}`, background: '#FCFDFC' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textLight, marginBottom: 8 }}>Question</div>
            <div style={{ fontSize: 15, lineHeight: 1.6, color: C.text, minHeight: 48 }}>
              {question.slice(0, typedLen)}
              <span style={{ display:'inline-block', width:2, height:'1em', background:C.accent, marginLeft:1, verticalAlign:'text-bottom', animation:'blink 0.9s step-end infinite', opacity: typedLen < question.length ? 1 : 0 }}/>
            </div>
          </div>
        </div>
        {step >= 1 && (
          <div style={fadeIn(0)}>
            <div style={{ padding: 16, borderRadius: 18, border: `1px solid ${C.accentSoftBorder}`, background: C.accentSoft }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.accentDark, marginBottom: 8 }}>Highlight</div>
              <div style={{ fontSize: 15, lineHeight: 1.7, color: C.text }}>
                <strong>5 attorneys</strong> are below target. <strong>M. Rivera</strong> is furthest behind at <strong>71%</strong> of target.
              </div>
            </div>
          </div>
        )}
        {step >= 1 && (
          <div style={fadeIn(0.1)}>
            <div className="tableWrap" style={{ border: `1px solid ${C.border}`, borderRadius: 18, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F7FBF8' }}>
                    {['Attorney','Target %','Hours'].map(h => (
                      <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, color: C.textLight, textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[['M. Rivera','71%','114'],['J. Patel','78%','122'],['A. Bloom','83%','129']].slice(0, visibleRows).map((row, i) => (
                    <tr key={i} style={{ animation: 'fadeSlideIn 0.3s ease both' }}>
                      {row.map((v, j) => (
                        <td key={j} style={{ padding: '13px 14px', fontSize: 14, color: j === 1 ? C.accentDark : C.text, borderBottom: i < visibleRows - 1 ? `1px solid ${C.border}` : 'none' }}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (sectionKey === 'explorer') {
    const meta = TABLE_META[activeTable]
    return (
      <div className="explorerDemoGrid" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 14, minHeight: 340 }}>
        <div style={fadeIn(0)}>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 18, padding: 10, background: '#FCFDFC' }}>
            {TABLES.map((item, i) => (
              <div key={item} style={{
                padding: '10px 12px', borderRadius: 10, marginBottom: 6,
                border: `1px solid ${i === activeTable ? C.accentSoftBorder : 'transparent'}`,
                background: i === activeTable ? C.accentSoft : 'transparent',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                color: i === activeTable ? C.accentDark : C.textMuted,
                transition: 'all 0.35s ease',
              }}>{item}</div>
            ))}
          </div>
        </div>
        <div key={activeTable} style={{ display: 'grid', gap: 10, animation: 'fadeSlideIn 0.3s ease both' }}>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 18, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, marginBottom: 6, textTransform: 'uppercase' }}>Summary</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.7, color: C.textMuted }}>{meta.summary}</div>
          </div>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 18, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, marginBottom: 8, textTransform: 'uppercase' }}>AI note</div>
            <div style={{ padding: '9px 12px', border: `1px solid ${C.accentSoftBorder}`, borderRadius: 10, background: C.accentSoft, fontSize: 13, color: C.accentDark, lineHeight: 1.5 }}>{meta.note}</div>
          </div>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 18, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, marginBottom: 8, textTransform: 'uppercase' }}>Columns</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {['id','attorney_id','matter_id','amount','effective_date','status'].map(col => (
                <span key={col} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#F0F4F2', color: C.textMuted }}>{col}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (sectionKey === 'dashboards') {
    const DASH_TABS = ['Overview','Finance','Operations']
    const TAB_KPIS = [
      [{ label:'Revenue', value:`$${countVal}k`, hl:true },{ label:'Invoices', value:'148', hl:false },{ label:'Alerts', value:'9', hl:false }],
      [{ label:'Collected', value:`$${countVal}k`, hl:true },{ label:'Overdue', value:'$42k', hl:false },{ label:'Pending', value:'31', hl:false }],
      [{ label:'Matters', value:'64', hl:false },{ label:'On track', value:'51', hl:true },{ label:'At risk', value:'13', hl:false }],
    ]
    const TAB_CHARTS = [
      { label:'Monthly revenue', months:['J','F','M','A','M','J','J'], scale:[1,1,1,1,1,1,1] },
      { label:'Invoices collected vs overdue', months:['J','F','M','A','M','J','J'], scale:[0.9,0.8,1,0.7,1.1,0.85,1.1] },
      { label:'Matters opened this quarter', months:['W1','W2','W3','W4','W5','W6','W7'], scale:[0.5,0.75,0.6,0.9,0.8,1,0.75] },
    ]
    const chart = TAB_CHARTS[activeTab]
    const kpis = TAB_KPIS[activeTab]
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={fadeIn(0)}>
          <div style={{ display: 'flex', gap: 4, padding: '4px', background: '#F0F4F2', borderRadius: 12 }}>
            {DASH_TABS.map((t, i) => (
              <div key={t} style={{
                flex: 1, textAlign: 'center', padding: '7px 0', borderRadius: 9, fontSize: 12.5, fontWeight: 600,
                background: i === activeTab ? '#fff' : 'transparent',
                color: i === activeTab ? C.text : C.textLight,
                boxShadow: i === activeTab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.3s ease',
              }}>{t}</div>
            ))}
          </div>
        </div>
        <div key={`kpi-${activeTab}`} className="dashboardStats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, animation: 'fadeSlideIn 0.3s ease both' }}>
          {kpis.map(({ label, value, hl }) => (
            <div key={label} style={{ padding: '12px 14px', borderRadius: 14, border: `1px solid ${hl ? C.accentSoftBorder : C.border}`, background: hl ? C.accentSoft : '#F9FBFA' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.textLight, marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: C.navBg, letterSpacing: '-0.04em' }}>{value}</div>
            </div>
          ))}
        </div>
        <div key={`chart-${activeTab}`} style={{ animation: 'fadeSlideIn 0.3s ease both' }}>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, marginBottom: 10, textTransform: 'uppercase' }}>{chart.label}</div>
            <div style={{ display: 'flex', gap: 6, height: 110 }}>
              {barHeights.map((h, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: '100%', height: `${h * chart.scale[i]}%`, borderRadius: '4px 4px 2px 2px',
                    background: i === 6 ? C.accent : '#C8EDD9',
                    transition: 'height 0.55s cubic-bezier(0.22,1,0.36,1)',
                  }} />
                  <div style={{ fontSize: 9.5, color: C.textLight }}>{chart.months[i]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Reports — 3 steps: Run → AI analyzes → Email preview
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {/* Step indicators */}
      <div style={fadeIn(0)}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {[{ n:'1', label:'Run report', done: step >= 0 },{ n:'2', label:'AI analyzes', done: step >= 1 },{ n:'3', label:'Send email', done: step >= 2 }].map(({ n, label, done }, i) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0, background: done ? C.accent : '#E8EFE9', color: done ? '#fff' : C.textLight, transition: 'all 0.4s' }}>{done && step > i ? '✓' : n}</div>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: done ? C.text : C.textLight, transition: 'color 0.4s', whiteSpace: 'nowrap' }}>{label}</span>
              </div>
              {i < 2 && <div style={{ flex: 1, height: 1, background: step > i ? C.accent : C.border, margin: '0 8px', transition: 'background 0.5s', maxWidth: 28 }}/>}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Query running → results */}
      <div style={fadeIn(0.05)}>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '9px 14px', background: '#F7FBF8', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: 12, color: C.textMuted }}>overdue_invoices</span>
            {step === 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706', background: '#FEF9EC', padding: '3px 8px', borderRadius: 999, border: '1px solid #FDE68A', display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', border: `2px solid #FDE68A`, borderTopColor: '#D97706', animation: 'spin 0.8s linear infinite' }}/>Running…
            </span>}
            {step >= 1 && <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, background: C.accentSoft, padding: '3px 8px', borderRadius: 999, border: `1px solid ${C.accentSoftBorder}`, animation: 'fadeSlideIn 0.3s ease both' }}>11 rows · 240ms</span>}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#FAFCFA' }}>
              {['Client','Amount','Days overdue'].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10.5, color: C.textLight, textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {step === 0 && <tr><td colSpan={3} style={{ padding: '18px', textAlign: 'center', color: C.textLight, fontSize: 13 }}>Fetching data…</td></tr>}
              {step >= 1 && [['Hartwell & Co','$18,400','74'],['Meridian Group','$12,900','68'],['Okafor Legal','$9,200','61']].map((row, i) => (
                <tr key={i} style={{ animation: `fadeSlideIn 0.3s ease ${i * 0.1}s both`, borderBottom: i < 2 ? `1px solid ${C.border}` : 'none' }}>
                  {row.map((v, j) => <td key={j} style={{ padding: '9px 12px', fontSize: 13, color: j === 1 ? C.accentDark : C.text, fontWeight: j === 1 ? 600 : 400 }}>{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Step 2: AI analysis */}
      {step >= 1 && (
        <div style={{ animation: 'fadeSlideIn 0.4s ease both' }}>
          <div style={{ border: `1px solid ${C.accentSoftBorder}`, borderRadius: 14, padding: 14, background: C.accentSoft }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: step >= 2 ? 10 : 0 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 800, flexShrink: 0 }}>Q</div>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.accentDark }}>AI analysis</span>
              {step === 1 && <div style={{ display: 'flex', gap: 3, marginLeft: 4 }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: C.accent, animation: `bounce 0.7s ${i*0.15}s infinite alternate` }}/>)}
              </div>}
            </div>
            {step >= 2 && (
              <div style={{ fontSize: 13.5, lineHeight: 1.7, color: C.text, animation: 'fadeSlideIn 0.4s ease both' }}>
                <strong>$40.5k at risk.</strong> Hartwell & Co is the largest exposure at $18,400 — now 74 days overdue. 3 clients slipped past 60 days this week.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Email preview */}
      {step >= 2 && (
        <div style={{ animation: 'fadeSlideIn 0.4s ease 0.15s both' }}>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ background: C.navBg, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.navText, fontWeight: 800 }}>Q</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Weekly finance brief · Mon 6:00 AM</div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)' }}>To: finance@co.com, leadership@co.com</div>
              </div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: C.navText, background: 'rgba(16,185,129,0.2)', padding: '3px 8px', borderRadius: 999 }}>Sent ✓</div>
            </div>
            <div style={{ padding: '12px 14px', background: '#fff' }}>
              <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 10, lineHeight: 1.6 }}>
                <strong style={{ color: C.text }}>This week:</strong> $40.5k in invoices past 60 days. Hartwell & Co is the largest at $18,400. <span style={{ color: C.accent, fontWeight: 600 }}>Action recommended.</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['$40.5k','At risk'],['3','Clients'],['74d','Longest']].map(([v,l]) => (
                  <div key={l} style={{ flex: 1, padding: '8px', borderRadius: 8, background: '#F7FBF8', border: `1px solid ${C.border}`, textAlign: 'center' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.navBg }}>{v}</div>
                    <div style={{ fontSize: 10, color: C.textLight, fontWeight: 600, marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PricingCard({ plan }: { plan: (typeof PRICING)[number] }) {
  return (
    <div
      style={{
        background: C.white,
        border: `1px solid ${plan.featured ? C.accentSoftBorder : C.border}`,
        borderRadius: 24,
        padding: 24,
        boxShadow: plan.featured ? '0 22px 52px rgba(5, 150, 105, 0.10)' : '0 14px 32px rgba(10,35,28,0.06)',
        position: 'relative',
      }}
    >
      {plan.featured && (
        <div style={{ position: 'absolute', top: 16, right: 16, padding: '6px 10px', borderRadius: 999, background: C.accentSoft, color: C.accentDark, fontSize: 12, fontWeight: 700 }}>
          Most popular
        </div>
      )}
      <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 10 }}>{plan.name}</div>
      <div style={{ display: 'flex', alignItems: 'end', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 42, fontWeight: 800, color: C.text, letterSpacing: '-0.05em' }}>{plan.price}</div>
        {plan.period ? <div style={{ fontSize: 15, color: C.textMuted, marginBottom: 7 }}>{plan.period}</div> : null}
      </div>
      <div style={{ fontSize: 15, lineHeight: 1.65, color: C.textMuted, marginBottom: 18 }}>{plan.desc}</div>
      <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
        {plan.items.map((item) => (
          <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5, color: C.text }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: plan.featured ? C.accent : '#9BCBB3' }} />
            {item}
          </div>
        ))}
      </div>
      <button
        style={{
          width: '100%',
          padding: '14px 18px',
          borderRadius: 999,
          border: plan.featured ? 'none' : `1px solid ${C.border}`,
          background: plan.featured ? C.navBg : C.white,
          color: plan.featured ? C.white : C.text,
          fontWeight: 700,
          fontSize: 14.5,
          cursor: 'pointer',
        }}
      >
        {plan.cta}
      </button>
    </div>
  )
}

export default function LandingPage() {
  const router = useRouter()
  const typed = useTyping(HERO_QUERIES)
  const [activeFeature, setActiveFeature] = useState<FeatureKey>('ask')

  const sectionIds = useMemo(() => PRODUCT_SECTIONS.map((s) => s.key), [])
  const activeIndex = PRODUCT_SECTIONS.findIndex((s) => s.key === activeFeature)
  const demoOffset = activeIndex <= 0 ? 0 : activeIndex * 96

  useEffect(() => {
    const elements = sectionIds
      .map((id) => document.getElementById(`feature-${id}`))
      .filter(Boolean) as HTMLElement[]

    if (!elements.length) return

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

        if (visible[0]) {
          const id = visible[0].target.getAttribute('data-feature-key') as FeatureKey
          if (id) {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => setActiveFeature(id), 120)
          }
        }
      },
      {
        rootMargin: '-28% 0px -42% 0px',
        threshold: [0.1, 0.3, 0.5],
      }
    )

    elements.forEach((el) => observer.observe(el))
    return () => {
      observer.disconnect()
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  }, [sectionIds])

  return (
    <div style={{ fontFamily: 'Inter, -apple-system, sans-serif', color: C.text, background: C.bg }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
                @keyframes fadeSlideUp{from{opacity:0;transform:translateY(36px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeSlideIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes bounce{from{transform:translateY(0)}to{transform:translateY(-4px)}}
        @media (max-width: 1180px){
          .heroGrid,.stickyWrap,.pricingGrid,.navRow,.darkGrid{grid-template-columns:1fr !important;display:grid !important}
          .navLinks{display:none !important}
          .heroMock,.tourMock{transform:none !important}
        }
        @media (max-width: 860px){
          .heroTitle{font-size:52px !important;max-width:unset !important}
          .sectionTitle{font-size:38px !important;max-width:unset !important}
          .heroDemoGrid{grid-template-columns:1fr !important}
          .heroDemoLeft{border-right:none !important;border-bottom:1px solid ${C.border} !important}
          .explorerDemoGrid{grid-template-columns:1fr !important}
          .dashboardStats{grid-template-columns:1fr 1fr 1fr !important}
          .reportGrid{grid-template-columns:1fr !important}
        }
        @media (max-width: 720px){
          .heroTitle{font-size:44px !important}
          .sectionTitle{font-size:32px !important}
          .heroDemoLeft,.heroDemoRight{padding:20px !important}
          .heroStatGrid{grid-template-columns:1fr 1fr !important}
          .heroChips{display:grid !important;grid-template-columns:1fr 1fr;gap:10px !important}
          .heroChipItem{white-space:normal !important}
          .dashboardStats{grid-template-columns:1fr 1fr !important}
        }
        @media (max-width: 640px){
          .heroGrid,.stickyWrap,.pricingGrid,.darkGrid{gap:28px !important}
          .stickyWrap{padding-top:0 !important;padding-bottom:0 !important}
          .heroTitle{font-size:40px !important;line-height:1.02 !important}
          .heroDemoGrid,.explorerDemoGrid,.dashboardBottom,.pricingGrid,.darkGrid{grid-template-columns:1fr !important}
          .heroStatGrid,.dashboardStats{grid-template-columns:1fr !important}
          .heroTopActions{flex-direction:column;align-items:flex-start !important}
          .heroTopActions button{width:100%}
          .heroChips{grid-template-columns:1fr !important}
          .mobileSafeText{font-size:16px !important}
          .browserPad{padding:16px !important}
          .tableWrap{overflow-x:auto}
        }
      `}</style>

      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <GridBackground />
        <HeroBeam />

        <header style={{ position: 'relative', zIndex: 3, borderBottom: `1px solid rgba(2,44,34,0.08)` }}>
          <div className="navRow" style={{ maxWidth: 1340, margin: '0 auto', padding: '18px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: `linear-gradient(135deg, ${C.accent}, ${C.navBg})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.white, fontWeight: 800 }}>Q</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>Qwezy</div>
            </div>
            <div className="navLinks" style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
              {[
                ['Product', '#product-tour'],
                ['How it works', '#how-it-works'],
                ['Pricing', '#pricing'],
                ['Security', '#security'],
              ].map(([label, href]) => (
                <a key={label} href={href} style={{ textDecoration: 'none', fontSize: 14.5, fontWeight: 600, color: C.textMuted }}>
                  {label}
                </a>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => router.push('/auth')} style={{ background: 'transparent', border: 'none', color: C.textMuted, fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}>Sign in</button>
              <PrimaryButton>Request access</PrimaryButton>
            </div>
          </div>
        </header>

        <section style={{ position: 'relative', zIndex: 2, maxWidth: 1340, margin: '0 auto', padding: '56px 28px 112px' }}>
          <div className="heroGrid" style={{ display: 'grid', gridTemplateColumns: '0.88fr 1.12fr', gap: 46, alignItems: 'center' }}>
            <div>
              <Chip>Built for growing data teams</Chip>
              <h1 className="heroTitle" style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.0, letterSpacing: '-0.07em', color: C.navBg, maxWidth: 560, margin: '22px 0 22px' }}>
                Make small data&nbsp;teams<br/>feel big.
              </h1>
              <p style={{ fontSize: 18, lineHeight: 1.8, color: C.textMuted, maxWidth: 560, marginBottom: 16 }}>
                Qwezy helps lean teams move faster with plain English answers, live SQL, explorer context, dashboards, reports, and alerts in one clean workspace.
              </p>
              <p style={{ fontSize: 17, lineHeight: 1.8, color: C.textMuted, maxWidth: 550, marginBottom: 26 }}>
                The page should feel easy on the eyes, not crowded. Clear messaging on the left. A strong product demo on the right.
              </p>
              <div className="heroTopActions" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
                <PrimaryButton>Start now →</PrimaryButton>
                <SecondaryButton>Try the demo →</SecondaryButton>
              </div>
              <div className="heroChips" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', maxWidth: 620 }}>
                {['Ask questions in plain English', 'Open tables as spreadsheets', 'Save dashboards and reports', 'Alert on the numbers that matter'].map((item) => (
                  <div className="heroChipItem" key={item} style={{ padding: '10px 14px', borderRadius: 999, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.72)', fontSize: 13, fontWeight: 600, color: C.textMuted, whiteSpace: 'nowrap' }}>{item}</div>
                ))}
              </div>
            </div>
            <div className="heroMock" style={{ transform: 'translateY(10px)' }}>
              <HeroDemo query={typed} />
            </div>
          </div>
        </section>
      </div>

      <section id="product-tour" style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0 }}><GridBackground /></div>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1340, margin: '0 auto', padding: '84px 28px 84px' }}>
          <div className="stickyWrap" style={{ display: 'grid', gridTemplateColumns: '0.86fr 1.14fr', gap: 64, alignItems: 'start' }}>
            <div>
              {PRODUCT_SECTIONS.map((section) => (
                <div
                  key={section.key}
                  id={`feature-${section.key}`}
                  data-feature-key={section.key}
                  style={{ minHeight: '65vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 32, paddingBottom: 32 }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.accent, marginBottom: 14 }}>{section.eyebrow}</div>
                  <h2 className="sectionTitle" style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.06, letterSpacing: '-0.06em', color: C.navBg, maxWidth: 500, marginBottom: 16 }}>
                    {section.title}
                  </h2>
                  <p style={{ fontSize: 17, lineHeight: 1.85, color: C.textMuted, marginBottom: 22 }}>{section.body}</p>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {section.bullets.map((item) => (
                      <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: C.text }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent }} />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="tourMock" style={{ position: 'sticky', top: 96, paddingTop: 32 }}>
              <BrowserFrame>
                <div className="browserPad" style={{ padding: 26 }}>
                  <div key={activeFeature} style={{ animation: 'fadeSlideIn 0.35s cubic-bezier(0.22,1,0.36,1) both' }}>
                    <AnimatedFeatureVisual sectionKey={activeFeature} />
                  </div>
                </div>
              </BrowserFrame>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" style={{ background: C.darkSection, padding: '92px 28px' }}>
        <div className="darkGrid" style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 44, alignItems: 'start' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.navText, marginBottom: 12 }}>Why teams choose Qwezy</div>
            <h2 className="sectionTitle" style={{ fontSize: 54, fontWeight: 800, lineHeight: 1.06, letterSpacing: '-0.06em', color: C.white, maxWidth: 520, marginBottom: 16 }}>
              AI answers are better when the product understands your business.
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.85, color: 'rgba(255,255,255,0.72)', maxWidth: 520, marginBottom: 24 }}>
              Qwezy combines natural language, company context, and governed metadata so people can ask better questions and trust the answer they get back.
            </p>
            <button style={{ background: C.navText, color: C.navBg, border: 'none', borderRadius: 999, padding: '14px 20px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>Explore the product →</button>
          </div>

          <div style={{ background: '#0E3A2C', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 22, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.24)' }}>
            <div style={{ display: 'flex', gap: 10, padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {['SQL', 'Tables', 'Reports', 'Alerts'].map((tab, i) => (
                <div key={tab} style={{ padding: '8px 12px', borderRadius: 999, background: i === 0 ? C.navText : 'transparent', color: i === 0 ? C.navBg : 'rgba(255,255,255,0.76)', fontSize: 13, fontWeight: 700 }}>
                  {tab}
                </div>
              ))}
            </div>
            <div style={{ padding: '20px 22px', fontFamily: "'JetBrains Mono', monospace", fontSize: 14, lineHeight: 2, color: '#C7D9D1' }}>
              <div><span style={{ color: '#8FE7C0' }}>1</span> SELECT client_name,</div>
              <div><span style={{ color: '#8FE7C0' }}>2</span> &nbsp;&nbsp;invoice_balance,</div>
              <div><span style={{ color: '#8FE7C0' }}>3</span> &nbsp;&nbsp;days_overdue</div>
              <div><span style={{ color: '#8FE7C0' }}>4</span> FROM finance.overdue_invoices</div>
              <div><span style={{ color: '#8FE7C0' }}>5</span> WHERE days_overdue &gt; 60</div>
              <div><span style={{ color: '#8FE7C0' }}>6</span> ORDER BY invoice_balance DESC;</div>
            </div>
          </div>
        </div>

        <div id="security" style={{ maxWidth: 1240, margin: '42px auto 0', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 22 }}>
          {[
            ['Built for smaller teams', 'Small teams do not need another heavy platform. Qwezy is designed to help a few people operate like a much bigger data function.'],
            ['Clear and governed', 'Context, notes, rules, and ownership stay attached to the data so answers remain useful and easier to trust.'],
          ].map(([title, body]) => (
            <div key={title} style={{ padding: '6px 0' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.white, marginBottom: 10 }}>{title}</div>
              <div style={{ fontSize: 15.5, lineHeight: 1.8, color: 'rgba(255,255,255,0.72)', maxWidth: 520 }}>{body}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0 }}><GridBackground /></div>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1240, margin: '0 auto', padding: '88px 28px 100px' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.accent, marginBottom: 10 }}>Simple pricing</div>
            <h2 className="sectionTitle" style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.06, letterSpacing: '-0.06em', color: C.navBg, marginBottom: 14 }}>
              Easy to understand.
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.8, color: C.textMuted, maxWidth: 720, margin: '0 auto' }}>
              Pick a plan based on team size and how much workflow support you need. Core Qwezy value stays simple across every plan.
            </p>
          </div>

          <div className="pricingGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 30 }}>
            {PRICING.map((plan) => (
              <PricingCard key={plan.name} plan={plan} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
