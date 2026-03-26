// lib/verify-master.ts
// Shared utility to verify master session token.
// Import this in master API routes instead of from the auth route.

import { NextRequest } from 'next/server'

export function verifyMasterToken(req: NextRequest): boolean {
  const token = req.cookies.get('qwezy_master_session')?.value
  if (!token) return false
  try {
    const decoded = atob(token)
    const [email] = decoded.split(':')
    return email === process.env.MASTER_EMAIL
  } catch { return false }
}
