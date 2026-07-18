import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type ResponseCookies = ReturnType<typeof NextResponse.next>['cookies']
type CookieSetOptions = Parameters<ResponseCookies['set']>[2]

type PendingCookie = {
  name: string
  value: string
  options?: CookieSetOptions
}

function withPendingCookies(response: NextResponse, pendingCookies: PendingCookie[]) {
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })
  return response
}

function createAuthClient(request: NextRequest, pendingCookies: PendingCookie[]) {
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

function loginRedirect(path: string, pendingCookies: PendingCookie[]) {
  // No usar new URL(path, request.url): en dev Next puede construir
  // http://0.0.0.0:3000, que desde iPhone no existe. Location relativo
  // conserva el host real que abrió el navegador (IP LAN o dominio prod).
  return withPendingCookies(new NextResponse(null, {
    status: 303,
    headers: { Location: path },
  }), pendingCookies)
}

export async function POST(request: NextRequest) {
  const pendingCookies: PendingCookie[] = []
  const supabase = createAuthClient(request, pendingCookies)
  const formData = await request.formData()
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return loginRedirect('/login?error=MissingCredentials', pendingCookies)
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const message = encodeURIComponent(error.message)
    const code = error.message.toLowerCase().includes('confirm')
      ? 'EmailNotConfirmed'
      : 'InvalidCredentials'
    return loginRedirect(`/login?error=${code}&error_description=${message}`, pendingCookies)
  }

  return loginRedirect('/', pendingCookies)
}
