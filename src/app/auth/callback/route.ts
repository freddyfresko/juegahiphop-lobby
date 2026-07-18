import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type ResponseCookies = ReturnType<typeof NextResponse.next>['cookies']
type CookieSetOptions = Parameters<ResponseCookies['set']>[2]

type PendingCookie = {
  name: string
  value: string
  options?: CookieSetOptions
}

interface SessionBody {
  access_token?: string
  refresh_token?: string
  next?: string
}

function safeNext(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

function createRouteClient(request: NextRequest, pendingCookies: PendingCookie[]) {
  const isDev = process.env.NODE_ENV === 'development'

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            pendingCookies.push({
              name,
              value,
              options: {
                ...options,
                secure: isDev ? false : options?.secure ?? true,
                domain: undefined,
              },
            })
          })
        },
      },
    },
  )
}

function withPendingCookies(response: NextResponse, pendingCookies: PendingCookie[]) {
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })
  return response
}

function redirectWithCookies(path: string, pendingCookies: PendingCookie[]) {
  // Location relativo: evita redirects a http://0.0.0.0:3000 en mobile dev.
  return withPendingCookies(new NextResponse(null, {
    status: 303,
    headers: { Location: path },
  }), pendingCookies)
}

/**
 * Callback de autenticación.
 *
 * Soporta tres modos:
 * 1. OAuth: intercambia `code` por sesión (Google, etc.)
 * 2. Email/password GET: recibe `access_token` + `refresh_token` para
 *    setear la sesión en el servidor durante navegación top-level (Safari iOS).
 * 3. Email/password POST: fallback JSON para clientes que lo necesiten.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const accessToken = searchParams.get('access_token')
  const refreshToken = searchParams.get('refresh_token')
  const next = safeNext(searchParams.get('next'))
  const pendingCookies: PendingCookie[] = []
  const supabase = createRouteClient(request, pendingCookies)

  // Modo 1: OAuth - intercambiar code por sesión
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return redirectWithCookies(next, pendingCookies)
    }
    const desc = encodeURIComponent(error?.message ?? 'Error desconocido')
    return redirectWithCookies(`/login?error=AuthError&error_description=${desc}`, pendingCookies)
  }

  // Modo 2: Email/password - setear sesión desde tokens
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (!error) {
      return redirectWithCookies(next, pendingCookies)
    }
    const desc = encodeURIComponent(error?.message ?? 'Error desconocido')
    return redirectWithCookies(`/login?error=SessionError&error_description=${desc}`, pendingCookies)
  }

  // Sin parámetros - redirigir al login
  return redirectWithCookies('/login', pendingCookies)
}

export async function POST(request: NextRequest) {
  const pendingCookies: PendingCookie[] = []
  const supabase = createRouteClient(request, pendingCookies)

  let body: SessionBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.access_token || !body.refresh_token) {
    return NextResponse.json({ error: 'Missing session tokens' }, { status: 400 })
  }

  const { error } = await supabase.auth.setSession({
    access_token: body.access_token,
    refresh_token: body.refresh_token,
  })

  if (error) {
    return withPendingCookies(NextResponse.json({ error: error.message }, { status: 401 }), pendingCookies)
  }

  return withPendingCookies(NextResponse.json({ ok: true, next: safeNext(body.next) }), pendingCookies)
}
