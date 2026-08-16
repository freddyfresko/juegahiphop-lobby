'use client'

import { useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import type { PlayerProfile } from '@/lib/types'

/**
 * Secciones del panel. Agregar una sección nueva = agregar un item aquí
 * + su página en /admin/<ruta>. La sidebar y los chips móviles se generan solos.
 */
const SECTIONS: { label: string; href: string; icon: string }[] = [
  { label: 'Catálogo de juegos', href: '/admin', icon: '🎮' },
  { label: 'Banners', href: '/admin/banners', icon: '🖼' },
  { label: 'Analytics', href: '/admin/analytics', icon: '📈' },
  { label: 'Campañas', href: '/admin/campaigns', icon: '📣' },
  { label: 'Jugadores', href: '/admin/users', icon: '👥' },
]

interface AdminShellProps {
  user: User
  profile?: PlayerProfile | null
  children: React.ReactNode
}

export default function AdminShell({ user, profile, children }: AdminShellProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleSignOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }, [router])

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  const isNewGame = pathname.startsWith('/admin/games/new')

  return (
    <div className="min-h-dvh bg-[#0a0a0a]">
      {/* Top nav del lobby (desktop arriba / móvil abajo) */}
      <Sidebar user={user} profile={profile} isAdmin />

      {/* ─── Sidebar de secciones (lg+) ─── */}
      <aside className="fixed bottom-0 left-0 top-16 z-30 hidden w-56 flex-col border-r border-white/[0.06] bg-[#0d0d0d]/95 backdrop-blur-xl lg:flex">
        <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-3">
          <div className="px-3 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
            Panel
          </div>

          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={`flex min-h-10 items-center gap-2.5 rounded-xl border-l-2 px-3.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-all ${
                isActive(s.href)
                  ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                  : 'border-transparent text-zinc-400 hover:bg-white/[0.05] hover:text-white'
              }`}
            >
              <span className="text-sm leading-none">{s.icon}</span>
              {s.label}
            </Link>
          ))}

          <div className="my-2 border-t border-white/[0.06]" />

          <Link
            href="/admin/games/new"
            className={`flex min-h-10 items-center gap-2.5 rounded-xl border border-yellow-400/20 px-3.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-all ${
              isNewGame
                ? 'bg-yellow-400/15 text-yellow-400'
                : 'bg-yellow-400/5 text-yellow-400 hover:bg-yellow-400/15'
            }`}
          >
            <span className="text-sm leading-none">＋</span>
            Nuevo juego
          </Link>
        </nav>

        {/* Usuario */}
        <div className="shrink-0 border-t border-white/[0.06] p-3">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
            <div className="truncate text-[10px] font-semibold text-zinc-400">{user.email}</div>
            <button
              onClick={handleSignOut}
              type="button"
              className="mt-2 flex w-full min-h-8 items-center justify-center rounded-lg border border-red-400/10 px-3 text-[10px] font-bold uppercase tracking-wider text-red-400/70 transition-colors hover:bg-red-400/10 hover:text-red-400"
            >
              SALIR
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Chips de secciones (móvil) ─── */}
      <nav
        aria-label="Secciones del panel"
        className="sticky top-0 z-30 flex gap-2 overflow-x-auto border-b border-white/[0.06] bg-[#0d0d0d]/95 px-3 py-2 backdrop-blur-xl lg:hidden"
      >
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              isActive(s.href)
                ? 'border-yellow-400/40 bg-yellow-400/10 text-yellow-400'
                : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 active:bg-white/[0.08]'
            }`}
          >
            <span className="text-xs leading-none">{s.icon}</span>
            {s.label}
          </Link>
        ))}
        <Link
          href="/admin/games/new"
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
            isNewGame
              ? 'border-yellow-400/40 bg-yellow-400/10 text-yellow-400'
              : 'border-yellow-400/20 bg-yellow-400/5 text-yellow-400 active:bg-yellow-400/15'
          }`}
        >
          <span className="text-xs leading-none">＋</span>
          Nuevo juego
        </Link>
      </nav>

      {/* Contenido: bajo la top nav en desktop (pl para la sidebar), bajo los chips en móvil */}
      <main className="content-with-rail lg:pl-56">{children}</main>
    </div>
  )
}
