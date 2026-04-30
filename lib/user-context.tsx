'use client'
// lib/user-context.tsx
// Single source of truth for the current user across the whole app.
// Usage: const { user, isDemo, isLoading } = useUser()

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

const NORTHWIND_COMPANY_ID = '68065cb1-48d7-4488-bd78-9e354e6fb53f'

export interface QwezyUser {
  id: string
  company_id: string
  company_name: string
  name: string
  email: string
  role: 'admin' | 'analyst' | 'viewer'
  plan: string
  db_connected: boolean
}

interface UserContextValue {
  user: QwezyUser | null
  isDemo: boolean
  isLoading: boolean
  refresh: () => Promise<void>
}

const UserContext = createContext<UserContextValue>({
  user: null,
  isDemo: false,
  isLoading: true,
  refresh: async () => {},
})

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<QwezyUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth')
      if (res.ok) {
        const data = await res.json()
        setUser(data)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const isDemo = user?.company_id === NORTHWIND_COMPANY_ID

  return (
    <UserContext.Provider value={{ user, isDemo, isLoading, refresh }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
