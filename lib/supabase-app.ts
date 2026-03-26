// lib/supabase-app.ts
// App database client — used for all Qwezy metadata (users, annotations, reports etc.)
// This is SEPARATE from the customer's database (lib/db.ts)

import { createClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Browser client — uses anon key + RLS, safe to expose
export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true }
})

// Server/admin client — bypasses RLS, only use in API routes
export const supabaseAdmin = createClient(url, svc, {
  auth: { persistSession: false }
})
