import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface SessionBody {
  access_token?: string
  refresh_token?: string
}

/**
 * Callback de autenticación.
 *
 * Soporta tres modos:
 * 1. OAuth: intercambia `code` por sesión (Google, etc.)
 * 2. Email/password GET: recibe `access_token` + `refresh_token` para
 *    setear la sesión en el servidor (workaround Safari iOS)
 * 3. Email/password POST: lo mismo, pero sin exponer tokens en la URL.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const accessToken = searchParams.get('access_token')
  const refreshToken = searchParams.get('refresh_token')
  const next = searchParams.get('next') ?? '/'

  const supabase = await createClient()

  // Modo 1: OAuth - intercambiar code por sesión
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    const desc = encodeURIComponent(error?.message ?? 'Error desconocido')
    return NextResponse.redirect(`${origin}/login?error=AuthError&error_description=${desc}`)
  }

  // Modo 2: Email/password - setear sesión desde tokens
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    const desc = encodeURIComponent(error?.message ?? 'Error desconocido')
    return NextResponse.redirect(`${origin}/login?error=SessionError&error_description=${desc}`)
  }

  // Sin parámetros - redirigir al login
  return NextResponse.redirect(`${origin}/login`)
}

export async function POST(request: Request) {
  const supabase = await createClient()

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
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}
