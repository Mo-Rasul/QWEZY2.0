'use client'

import { useEffect, useState } from 'react'
import DesktopLanding from '../page'

export default function MobileLanding() {
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    const blockToolAccess = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const clickable = target?.closest('a,button') as HTMLAnchorElement | HTMLButtonElement | null
      if (!clickable) return

      const href = clickable instanceof HTMLAnchorElement ? clickable.getAttribute('href') || '' : ''
      const text = (clickable.textContent || '').toLowerCase()

      const isToolAccess =
        href.includes('/auth') ||
        href.includes('/login') ||
        href.includes('/dashboard') ||
        href.includes('/app') ||
        text.includes('log in') ||
        text.includes('login') ||
        text.includes('sign in') ||
        text.includes('open qwezy') ||
        text.includes('launch') ||
        text.includes('enter app') ||
        text.includes('go to app')

      if (!isToolAccess) return

      event.preventDefault()
      event.stopPropagation()
      setBlocked(true)
    }

    document.addEventListener('click', blockToolAccess, true)
    return () => document.removeEventListener('click', blockToolAccess, true)
  }, [])

  return (
    <>
      <DesktopLanding />

      {blocked && (
        <div
          onClick={() => setBlocked(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15,25,35,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 390,
              background: '#FFFFFF',
              borderRadius: 18,
              padding: 22,
              boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
              fontFamily: 'Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 10 }}>💻</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0F1923', marginBottom: 8 }}>
              Qwezy works best on desktop
            </div>
            <div style={{ fontSize: 14.5, color: '#4B5563', lineHeight: 1.6, marginBottom: 18 }}>
              You can view the landing page on mobile, but the Qwezy tool is only available from a desktop browser.
            </div>
            <button
              onClick={() => setBlocked(false)}
              style={{
                width: '100%',
                border: 'none',
                borderRadius: 10,
                padding: '12px 14px',
                background: '#059669',
                color: '#FFFFFF',
                fontSize: 14.5,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}
