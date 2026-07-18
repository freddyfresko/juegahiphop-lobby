import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const isDev = process.env.NODE_ENV === 'development'

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              secure: isDev ? false : options?.secure ?? true,
              domain: undefined,
            }),
          )
        },
      },
    },
  )

  // Intentar obtener usuario. Si falla la red, asumir no autenticado.
  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // Error de red/cookie inválida → tratar como no autenticado
    user = null
  }

  const pathname = request.nextUrl.pathname

  // ─── Rutas que requieren autenticación ───
  const protectedRoutes = ['/perfil', '/admin']
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route))

  // Si está en ruta protegida y no hay sesión → redirect a login
  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('reason', 'auth_required')
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
