import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  const isDev = process.env.NODE_ENV === 'development'

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                // En desarrollo (HTTP local), Secure rompe cookies
                secure: isDev ? false : options?.secure ?? true,
                // Sin domain explícito = funciona con localhost, IP LAN, o dominio real
                domain: undefined,
              }),
            )
          } catch {
            // Called from a Server Component — can ignore
          }
        },
      },
    },
  )
}
