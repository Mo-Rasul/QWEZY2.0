'use client'
// app/connect/page.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'



export default function ConnectPage() {
  const router = useRouter()
  const [connStr, setConnStr] = useState('')
  const [status, setStatus] = useState<'idle'|'testing'|'ok'|'fail'|'saving'>('idle')
  const [error, setError] = useState('')
  const [testMsg, setTestMsg] = useState('')

  const C = {
    bg: '#F6F9FC', text: '#0F1923', muted: '#4B6358', light: '#8A9BB0',
    accent: '#059669', border: '#E3EAF2', card: '#FFFFFF',
    danger: '#EF4444', success: '#059669',
  }

  const testConnection = async () => {
    const str = connStr.trim()
    if (!str) { setError('Please enter a connection string first.'); return }
    setStatus('testing'); setError(''); setTestMsg('')
    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionString: str }),
      })
      const data = await res.json()
      if (data.ok) {
        setStatus('ok')
        setTestMsg(`Connected — ${data.tableCount} table${data.tableCount !== 1 ? 's' : ''} found (${data.latency_ms}ms)`)
      } else {
        setStatus('fail')
        setError(data.error || 'Could not connect. Check the connection string and try again.')
      }
    } catch {
      setStatus('fail')
      setError('Something went wrong. Please try again.')
    }
  }

  const save = async () => {
    if (status !== 'ok') { setError('Please test the connection before saving.'); return }
    setStatus('saving'); setError('')
    try {
      const res = await fetch('/api/company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ db_connection_string: connStr.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push('/dashboard')
      } else {
        setStatus('ok')
        setError(data.error || 'Failed to save. Please try again.')
      }
    } catch {
      setStatus('ok')
      setError('Something went wrong. Please try again.')
    }
  }

  const borderColor = status === 'ok' ? C.success : status === 'fail' ? C.danger : C.border

  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter, sans-serif', padding:24 }}>
      <div style={{ width:'100%', maxWidth:520 }}>

        <div style={{ marginBottom:40, textAlign:'center' }}>
          <span style={{ fontSize:26, fontWeight:800, color:C.accent, letterSpacing:'-0.5px' }}>Qwezy</span>
        </div>

        <div style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, boxShadow:'0 4px 24px rgba(0,0,0,0.06)', padding:'40px 40px 36px' }}>
          <div style={{ fontSize:22, fontWeight:800, color:C.text, marginBottom:8, letterSpacing:'-0.3px' }}>Connect your database</div>
          <p style={{ fontSize:14, color:C.muted, lineHeight:1.7, marginBottom:32 }}>
            Paste in your PostgreSQL connection string. We'll test it before saving.
          </p>

          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:12, fontWeight:600, color:C.muted, display:'block', marginBottom:7, textTransform:'uppercase', letterSpacing:'0.05em' }}>
              Connection string
            </label>
            <textarea
              value={connStr}
              onChange={e => { setConnStr(e.target.value); setStatus('idle'); setError(''); setTestMsg('') }}
              placeholder="postgresql://user:password@host:5432/dbname"
              rows={3}
              style={{ width:'100%', padding:'11px 14px', border:`1.5px solid ${borderColor}`, borderRadius:8, fontSize:13, fontFamily:"'JetBrains Mono', monospace", color:C.text, background:'#F9FBFC', resize:'vertical', outline:'none', boxSizing:'border-box', lineHeight:1.6, transition:'border-color 0.15s' }}
            />
          </div>

          {testMsg && (
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'#ECFDF5', border:'1px solid #A7F3D0', borderRadius:7, padding:'9px 14px', marginBottom:16, fontSize:13.5, color:'#065F46' }}>
              <span>✓</span> {testMsg}
            </div>
          )}
          {error && (
            <div style={{ display:'flex', alignItems:'flex-start', gap:8, background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:7, padding:'9px 14px', marginBottom:16, fontSize:13.5, color:'#991B1B' }}>
              <span style={{ flexShrink:0 }}>✕</span> {error}
            </div>
          )}

          <div style={{ display:'flex', gap:10 }}>
            <button
              onClick={testConnection}
              disabled={status === 'testing' || status === 'saving'}
              style={{ flex:1, padding:'11px 0', borderRadius:8, border:`1.5px solid ${C.border}`, background:'#fff', color:C.text, fontSize:14, fontWeight:600, cursor: status === 'testing' || status === 'saving' ? 'not-allowed' : 'pointer', opacity: status === 'testing' || status === 'saving' ? 0.6 : 1, fontFamily:'Inter, sans-serif' }}
            >
              {status === 'testing' ? 'Testing…' : 'Test connection'}
            </button>
            <button
              onClick={save}
              disabled={status !== 'ok'}
              style={{ flex:1, padding:'11px 0', borderRadius:8, border:'none', background: status === 'ok' ? C.accent : C.border, color: status === 'ok' ? '#fff' : C.light, fontSize:14, fontWeight:700, cursor: status === 'ok' ? 'pointer' : 'not-allowed', fontFamily:'Inter, sans-serif' }}
            >
              {status === 'saving' ? 'Saving…' : 'Save & continue →'}
            </button>
          </div>

          <div style={{ marginTop:24, textAlign:'center' }}>
            <button onClick={() => router.push('/dashboard')} style={{ background:'none', border:'none', fontSize:13, color:C.light, cursor:'pointer', fontFamily:'Inter, sans-serif', textDecoration:'underline' }}>
              Skip for now — I'll connect later
            </button>
          </div>
        </div>

        <p style={{ textAlign:'center', fontSize:12.5, color:C.light, marginTop:20, lineHeight:1.6 }}>
          Need help? Reply to your welcome email and Mo will sort it out.
        </p>
      </div>
    </div>
  )
}
