'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { useCallback, useState } from 'react'
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleSignOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }, [router])

  return (
    <header className="relative z-50 border-b border-white/[0.06] bg-black/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo + Crown */}
        <Link href="/" className="flex items-center gap-1.5 group shrink-0">
          <svg className="h-5 w-5 text-yellow-400 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 19l2-12 4 3 4-5 4 5 4-3 2 12H2zM12 5l-3 4 3-1 3 1-3-4z"/>
          </svg>
          <span className="font-archivo text-xl tracking-wide text-white transition-colors group-hover:text-yellow-400">
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
        <div className="flex items-center gap-3">
          {user ? (
            /* ✅ Usuario autenticado → avatar + perfil */
            <>
              <Link
                href="/perfil"
                className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 transition-colors hover:border-yellow-500/30"
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
              >
                SALIR
              </button>
            </>
          ) : (
            /* ❌ Invitado → botones login/registro */
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                INICIAR SESIÓN
              </Link>
              <Link
                href="/login?view=register"
                className="rounded-lg bg-yellow-400 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-black transition-colors hover:bg-yellow-300"
              >
                REGISTRO
              </Link>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex items-center justify-center text-zinc-400 md:hidden"
            aria-label="Menú"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileMenuOpen && (
        <div className="border-t border-white/[0.06] bg-black px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`text-sm font-semibold tracking-[0.15em] transition-colors ${
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
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-semibold tracking-[0.15em] text-yellow-500/70 hover:text-yellow-400"
              >
                ADMIN
              </Link>
            )}
            {user ? (
              <button
                onClick={() => { handleSignOut(); setMobileMenuOpen(false) }}
                className="mt-2 text-left text-xs text-zinc-600 transition-colors hover:text-red-400"
              >
                CERRAR SESIÓN
              </button>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm font-semibold tracking-[0.15em] text-yellow-400"
                >
                  INICIAR SESIÓN
                </Link>
                <Link
                  href="/login?view=register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm font-semibold tracking-[0.15em] text-yellow-400"
                >
                  REGISTRARSE
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
