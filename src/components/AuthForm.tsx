'use client'

import { createClient } from '@/lib/supabase/client'
import { useState, useCallback } from 'react'
import type { AuthView } from '@/lib/types'

interface AuthFormProps {
  initialView?: string
}

export default function AuthForm({ initialView }: AuthFormProps) {
  const [view, setView] = useState<AuthView>(initialView === 'register' ? 'register' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setLoading(true)
      setError(null)
      setMessage(null)

      const supabase = createClient()

      try {
        if (view === 'login') {
          const { data, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          })

          if (signInError) {
            setError(signInError.message)
            setLoading(false)
            return
          }

          if (!data.session) {
            setError('No se pudo crear la sesión. Intenta de nuevo.')
            setLoading(false)
            return
          }

          // Safari iOS puede no persistir bien cookies seteadas desde JS.
          // Enviamos la sesión al callback server-side para escribir cookies HTTP.
          const res = await fetch('/auth/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            }),
          })

          if (!res.ok) {
            setError('No se pudo establecer la sesión. Intenta de nuevo.')
            setLoading(false)
            return
          }

          window.location.replace('/')
        } else {
          const { error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          })

          if (signUpError) {
            setError(signUpError.message)
          } else {
            setMessage('Registro exitoso. Revisa tu correo para confirmar la cuenta.')
          }
          setLoading(false)
        }
      } catch (err) {
        setError('Error de conexión. Verifica tu red e intenta de nuevo.')
        setLoading(false)
        console.error('[AuthForm] Error:', err)
      }
    },
    [email, password, view],
  )

  const handleGoogleLogin = useCallback(async () => {
    const supabase = createClient()
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
    } catch (err) {
      setError('Error al conectar con Google. Intenta de nuevo.')
      console.error('[AuthForm] Google error:', err)
    }
  }, [])

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Correo electrónico
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.cl"
          required
          autoComplete="email"
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-zinc-700 outline-none transition-colors focus:border-yellow-500/40 focus:bg-white/[0.06]"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          minLength={6}
          autoComplete={view === 'login' ? 'current-password' : 'new-password'}
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-zinc-700 outline-none transition-colors focus:border-yellow-500/40 focus:bg-white/[0.06]"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs uppercase tracking-wider text-red-400">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-xs uppercase tracking-wider text-emerald-400">
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-black transition-all hover:bg-yellow-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'CARGANDO…' : view === 'login' ? 'INICIAR SESIÓN' : 'CREAR CUENTA'}
      </button>

      <div className="relative flex items-center gap-3 py-2">
        <div className="flex-1 border-t border-white/[0.06]" />
        <span className="text-[10px] uppercase tracking-widest text-zinc-600">o continúa con</span>
        <div className="flex-1 border-t border-white/[0.06]" />
      </div>

      <button
        type="button"
        onClick={handleGoogleLogin}
        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-white/[0.06] active:scale-[0.98]"
      >
        <span className="flex items-center justify-center gap-2">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          GOOGLE
        </span>
      </button>

      <p className="text-center text-[11px] uppercase tracking-wider text-zinc-600">
        {view === 'login' ? (
          <>
            ¿No tienes cuenta?{' '}
            <button
              type="button"
              onClick={() => { setView('register'); setError(null); setMessage(null) }}
              className="font-semibold text-yellow-400 transition-colors hover:text-yellow-300"
            >
              REGÍSTRATE
            </button>
          </>
        ) : (
          <>
            ¿Ya tienes cuenta?{' '}
            <button
              type="button"
              onClick={() => { setView('login'); setError(null); setMessage(null) }}
              className="font-semibold text-yellow-400 transition-colors hover:text-yellow-300"
            >
              INICIA SESIÓN
            </button>
          </>
        )}
      </p>
    </form>
  )
}
