'use client'

import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { PlayerProfile } from '@/lib/types'
import Link from 'next/link'
import Logo from '@/components/Logo'

// ─── Navegación ───

const NAV_ITEMS: { label: string; href: string; icon: React.ReactNode }[] = [
  {
    label: 'INICIO',
    href: '/',
    icon: (
      <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205 3 1m1.5.5-1.5-.5M6.75 7.364V3h-3v18m3-13.636 10.5-3.819" />
      </svg>
    ),
  },
  {
    label: 'JUEGOS',
    href: '/#juegos',
    icon: (
      <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5h3.5a5 5 0 0 1 0 10h-5.5l-4.015 4.227a2.3 2.3 0 0 1-3.923-2.035l1.634-8.173a5 5 0 0 1 4.904-4.019h3.4z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 15l4.07 4.284a2.3 2.3 0 0 0 3.925-2.023l-1.6-8.232" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9v2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 10h2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h2" />
      </svg>
    ),
  },
  {
    label: 'RANKING',
    href: '/ranking',
    icon: (
      <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
      </svg>
    ),
  },
  {
    label: 'MI PERFIL',
    href: '/perfil',
    icon: (
      <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z" />
      </svg>
    ),
  },
]

interface SidebarProps {
  user: User | null
  profile?: PlayerProfile | null
  isAdmin?: boolean
}

export default function Sidebar({ user, profile, isAdmin }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSignOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }, [router])

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    if (href === '/#juegos') return pathname === '/' // sección dentro del home
    return pathname.startsWith(href)
  }

  const navLink = (item: (typeof NAV_ITEMS)[number], extraClass = '') => {
    const active = isActive(item.href)
    return (
      <a
        key={item.label}
        href={item.href}
        onClick={() => setMenuOpen(false)}
        className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-xs font-bold uppercase tracking-[0.15em] transition-all ${
          active
            ? 'border-l-2 border-yellow-400 bg-yellow-400/10 text-yellow-400'
            : 'border-l-2 border-transparent text-zinc-400 hover:bg-white/[0.05] hover:text-white'
        } ${extraClass}`}
      >
        <span className={active ? 'text-yellow-400' : 'text-zinc-500 group-hover:text-zinc-300'}>{item.icon}</span>
        {item.label}
      </a>
    )
  }

  // ─── Panel lateral (desktop y drawer móvil comparten contenido) ───

  const panelContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center border-b border-white/[0.06] px-5">
        <Link href="/" className="flex items-center" aria-label="Juega Hip Hop — Inicio">
          <Logo size="header" priority />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-5">
        {NAV_ITEMS.map((item) => navLink(item))}

        {isAdmin && (
          <a
            href="/admin"
            onClick={() => setMenuOpen(false)}
            className={`flex min-h-11 items-center gap-3 rounded-xl border-l-2 px-3.5 text-xs font-bold uppercase tracking-[0.15em] transition-all ${
              pathname.startsWith('/admin')
                ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                : 'border-transparent text-zinc-500 hover:bg-white/[0.05] hover:text-yellow-400'
            }`}
          >
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
            </svg>
            ADMIN
          </a>
        )}
      </nav>

      {/* User card */}
      <div className="shrink-0 border-t border-white/[0.06] p-3">
        {user ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
            <Link href="/perfil" className="flex items-center gap-3" onClick={() => setMenuOpen(false)}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-sm font-black text-black">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  user.email?.charAt(0).toUpperCase() || '?'
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-white">
                  {profile?.display_name || user.email?.split('@')[0] || 'USER'}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-yellow-400">
                  <span>NIVEL {profile?.level || 1}</span>
                  <span className="text-zinc-700">·</span>
                  <span className="text-zinc-400">{profile?.xp?.toLocaleString() ?? 0} XP</span>
                </div>
              </div>
            </Link>
            <button
              onClick={handleSignOut}
              className="mt-2.5 flex w-full min-h-9 items-center justify-center gap-1.5 rounded-lg border border-red-400/10 px-3 text-[10px] font-bold uppercase tracking-wider text-red-400/70 transition-colors hover:bg-red-400/10 hover:text-red-400"
              type="button"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
              SALIR
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <a
              href="/login"
              className="flex min-h-10 items-center justify-center rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-3 text-[11px] font-bold uppercase tracking-wider text-yellow-400 transition-colors hover:bg-yellow-400/20"
            >
              INICIAR SESIÓN
            </a>
            <a
              href="/login?view=register"
              className="flex min-h-10 items-center justify-center rounded-xl bg-yellow-400 px-3 text-[11px] font-black uppercase tracking-wider text-black transition-colors hover:bg-yellow-300"
            >
              CREAR CUENTA
            </a>
          </div>
        )}
      </div>
    </div>
  )

  const adminIcon = (
    <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
    </svg>
  )

  return (
    <>
      {/* ─── Desktop sidebar (lg+) ─── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/[0.06] bg-[#0d0d0d]/95 backdrop-blur-xl lg:block">
        {panelContent}
      </aside>

      {/* ─── Mobile mini sidebar (rail de iconos, siempre visible <lg) ─── */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-14 flex-col items-center border-r border-white/[0.06] bg-[#0d0d0d]/95 backdrop-blur-xl lg:hidden">
        {/* Logo */}
        <div className="safe-area-top flex h-16 w-full shrink-0 items-center justify-center">
          <Link href="/" aria-label="Juega Hip Hop — Inicio" onClick={() => setMenuOpen(false)}>
            <Logo size="sm" />
          </Link>
        </div>

        {/* Nav icons */}
        <nav className="flex w-full flex-1 flex-col items-center gap-1.5 py-3">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href)
            return (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                aria-label={item.label}
                title={item.label}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                  active
                    ? 'bg-yellow-400/10 text-yellow-400'
                    : 'text-zinc-500 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                {item.icon}
              </a>
            )
          })}

          {isAdmin && (
            <a
              href="/admin"
              onClick={() => setMenuOpen(false)}
              aria-label="ADMIN"
              title="ADMIN"
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                pathname.startsWith('/admin')
                  ? 'bg-yellow-400/10 text-yellow-400'
                  : 'text-zinc-500 hover:bg-white/[0.05] hover:text-yellow-400'
              }`}
            >
              {adminIcon}
            </a>
          )}
        </nav>

        {/* Expandir drawer */}
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menú completo"
          title="Menú completo"
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-zinc-300 transition-colors active:bg-white/[0.10]"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        {/* Usuario */}
        <div className="safe-area-bottom shrink-0 py-3">
          {user ? (
            <Link
              href="/perfil"
              onClick={() => setMenuOpen(false)}
              aria-label="Mi perfil"
              title="Mi perfil"
              className="block"
            >
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-sm font-black text-black">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  user.email?.charAt(0).toUpperCase() || '?'
                )}
              </div>
            </Link>
          ) : (
            <a
              href="/login"
              aria-label="Iniciar sesión"
              title="Iniciar sesión"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-yellow-400"
            >
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </a>
          )}
        </div>
      </aside>

      {/* ─── Mobile drawer expandido (se apoya en la mini bar) ─── */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-y-0 left-14 right-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-14 flex w-64 max-w-[calc(85vw-3.5rem)] flex-col border-l border-white/[0.08] bg-[#0d0d0d] shadow-2xl">
            {panelContent}
          </div>
        </div>
      )}
    </>
  )
}
