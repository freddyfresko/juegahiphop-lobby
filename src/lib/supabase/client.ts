'use client'

import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export function createClient() {
  // Usar configuración DEFAULT de @supabase/ssr.
  // Sin cookies personalizadas — Safari iOS tiene problemas con
  // cookies seteadas via JavaScript en ciertos contextos.
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
