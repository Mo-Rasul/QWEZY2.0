// middleware.ts
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC = ['/', '/auth', '/master/login']
const MASTER_ONLY = ['/master']
const MOBILE_EXEMPT = ['/mobile', '/auth', '/master']

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  const ua = req.headers.get('user-agent') || ''
  const session = req.cookies.get('qwezy_session')?.value
  const masterSession = req.cookies.get('qwezy_master_session')?.value

  // Skip API routes and static files
  if (path.startsWith('/api') || path.startsWith('/_next') || path.startsWith('/favicon')) {
    return NextResponse.next()
  }

  // Mobile detection - redirect to mobile page (except exempt paths)
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  if (isMobile && !MOBILE_EXEMPT.some(p => path.startsWith(p)) && path !== '/mobile') {
    return NextResponse.redirect(new URL('/mobile', req.url))
  }

  // Master admin protection
  if (MASTER_ONLY.some(p => path.startsWith(p)) && path !== '/master/login') {
    if (!masterSession) {
      return NextResponse.redirect(new URL('/master/login', req.url))
    }
    try {
      const decoded = Buffer.from(masterSession, 'base64').toString()
      const [email] = decoded.split(':')
      if (email !== process.env.MASTER_EMAIL) {
        return NextResponse.redirect(new URL('/master/login', req.url))
      }
    } catch {
      return NextResponse.redirect(new URL('/master/login', req.url))
    }
  }

  // App auth protection
  const isPublic = PUBLIC.some(p => path === p)
  if (!session && !isPublic) {
    return NextResponse.redirect(new URL('/auth', req.url))
  }

  // Redirect logged-in users away from auth page
  if (session && path === '/auth') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
