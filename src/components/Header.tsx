'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import type { PlayerProfile } from '@/lib/types'
import Link from 'next/link'

const NAV_ITEMS = [
  { label: 'HOME', href: '/' },
  { label: 'JUEGOS', href: '/#juegos' },
]

interface HeaderProps {
  user: User | null
  profile?: PlayerProfile | null
  isAdmin?: boolean
}

export default function Header({ user, profile, isAdmin }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleSignOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }, [router])

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-black md:bg-black/80 md:backdrop-blur-xl">
      <div className="safe-area-top mx-auto flex h-14 items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
        {/* Logo + Crown */}
        <Link href="/" className="group flex min-h-11 shrink-0 items-center gap-1.5">
          <svg className="h-5 w-5 text-yellow-400 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 19l2-12 4 3 4-5 4 5 4-3 2 12H2zM12 5l-3 4 3-1 3 1-3-4z"/>
          </svg>
          <span className="font-archivo text-lg tracking-wide text-white transition-colors group-hover:text-yellow-400 sm:text-xl">
            JUEGAHIPHOP
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`text-xs font-semibold tracking-[0.15em] transition-colors ${
                  isActive ? 'text-yellow-400' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
          {isAdmin && (
            <Link
              href="/admin"
              className={`text-xs font-semibold tracking-[0.15em] transition-colors ${
                pathname.startsWith('/admin') ? 'text-yellow-400' : 'text-zinc-500 hover:text-yellow-400'
              }`}
            >
              ADMIN
            </Link>
          )}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <Link
                href="/perfil"
                className="flex min-h-11 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 transition-colors hover:border-yellow-500/30 sm:px-3"
              >
                <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-[10px] font-black text-black">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    user.email?.charAt(0).toUpperCase() || '?'
                  )}
                </div>
                <div className="hidden flex-col sm:flex">
                  <span className="text-[11px] leading-tight text-white">
                    {profile?.display_name || user.email?.split('@')[0] || 'USER'}
                  </span>
                  <span className="text-[10px] leading-tight text-yellow-400">
                    NIVEL {profile?.level || 1}
                  </span>
                </div>
              </Link>
              <button
                onClick={handleSignOut}
                className="hidden text-[10px] uppercase tracking-wider text-zinc-600 transition-colors hover:text-red-400 sm:block"
                type="button"
              >
                SALIR
              </button>
            </>
          ) : (
            <>
              <a
                href="/login"
                className="flex min-h-10 items-center rounded-lg border border-white/[0.08] px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-200 transition-colors active:bg-white/[0.08] sm:min-h-0 sm:py-1.5 sm:text-[11px]"
              >
                <span className="sm:hidden">ENTRAR</span>
                <span className="hidden sm:inline">INICIAR SESIÓN</span>
              </a>
              <a
                href="/login?view=register"
                className="hidden rounded-lg bg-yellow-400 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-black transition-colors hover:bg-yellow-300 sm:block"
              >
                REGISTRO
              </a>
            </>
          )}

          {/* Mobile menu: native <details> so it opens even if React click handlers fail on iOS */}
          <details className="group md:hidden">
            <summary
              aria-label="Menú"
              className="flex size-11 list-none items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-zinc-300 transition-colors active:bg-white/[0.10] [&::-webkit-details-marker]:hidden"
            >
              <svg className="h-5 w-5 group-open:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
              <svg className="hidden h-5 w-5 group-open:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </summary>
            <div className="fixed inset-x-0 top-14 z-50 border-t border-white/[0.06] bg-black px-4 py-4 shadow-2xl">
              <nav className="flex flex-col gap-2">
                {NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      className={`flex min-h-12 items-center rounded-xl border px-4 text-sm font-semibold tracking-[0.15em] transition-colors ${
                        isActive ? 'border-yellow-400/30 bg-yellow-400/10 text-yellow-400' : 'border-white/[0.06] bg-white/[0.03] text-zinc-300 active:bg-white/[0.08]'
                      }`}
                    >
                      {item.label}
                    </a>
                  )
                })}
                {isAdmin && (
                  <a
                    href="/admin"
                    className="flex min-h-12 items-center rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-4 text-sm font-semibold tracking-[0.15em] text-yellow-400"
                  >
                    ADMIN
                  </a>
                )}
                {user ? (
                  <button
                    onClick={handleSignOut}
                    className="mt-2 flex min-h-12 items-center rounded-xl border border-red-400/10 px-4 text-left text-xs font-semibold uppercase tracking-[0.15em] text-red-400/70 transition-colors active:bg-red-400/10"
                    type="button"
                  >
                    CERRAR SESIÓN
                  </button>
                ) : (
                  <>
                    <a
                      href="/login"
                      className="mt-2 flex min-h-12 items-center justify-center rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 text-sm font-bold tracking-[0.15em] text-yellow-400"
                    >
                      INICIAR SESIÓN
                    </a>
                    <a
                      href="/login?view=register"
                      className="flex min-h-12 items-center justify-center rounded-xl bg-yellow-400 px-4 text-sm font-black tracking-[0.15em] text-black"
                    >
                      REGISTRARSE
                    </a>
                  </>
                )}
              </nav>
            </div>
          </details>
        </div>
      </div>
    </header>
  )
}
