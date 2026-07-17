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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // ─── Rutas que requieren autenticación ───
  // Solo perfil y admin necesitan cuenta
  const protectedRoutes = ['/perfil', '/admin']
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route))

  // Si está en ruta protegida y no hay sesión → redirect a login
  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('reason', 'auth_required')
    return NextResponse.redirect(url)
  }

  // Si está en login y ya tiene sesión → redirect al lobby
  const isAuthPage = pathname.startsWith('/login')
  if (isAuthPage && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
