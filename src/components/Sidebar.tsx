'use client'

import { usePathname } from 'next/navigation'
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

const ADMIN_ICON = (
  <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
  </svg>
)

interface SidebarProps {
  user: User | null
  profile?: PlayerProfile | null
  isAdmin?: boolean
}

export default function Sidebar({ user, profile, isAdmin }: SidebarProps) {
  const pathname = usePathname()

  // Activación ESTRICTA: marca solo la página actual.
  // Las anclas tipo /#juegos (sección dentro del home) NUNCA marcan la barra,
  // así no aparecen dos dots amarillos a la vez en el home.
  const isActivePage = (href: string) => {
    if (href.includes('#')) return false
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  // Link de icono reutilizable (dot amarillo cuando activo)
  const iconLink = (
    href: string,
    label: string,
    icon: React.ReactNode,
    active: boolean,
    extraClass = '',
    hoverClass = 'active:bg-white/[0.06] active:text-zinc-300',
  ) => (
    <a
      key={label}
      href={href}
      aria-label={label}
      title={label}
      className={`relative flex items-center justify-center rounded-xl transition-all ${extraClass} ${
        active ? 'text-yellow-400' : `text-zinc-500 ${hoverClass}`
      }`}
    >
      {icon}
      {active && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-yellow-400" />}
    </a>
  )

  // Avatar de cuenta (sesión) o acceso a login (invitado)
  const accountOnPerfil = pathname.startsWith('/perfil')
  const accountSlot = user ? (
    <a
      href="/perfil"
      aria-label="Mi perfil"
      title="Mi perfil"
      className={`relative flex items-center justify-center rounded-xl transition-all ${
        accountOnPerfil ? '' : 'active:bg-white/[0.06]'
      }`}
    >
      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-sm font-black text-black ring-2 ring-yellow-400/40">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
        ) : (
          user.email?.charAt(0).toUpperCase() || '?'
        )}
      </div>
      {accountOnPerfil && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-yellow-400" />}
    </a>
  ) : (
    <a
      href="/login"
      aria-label="Iniciar sesión"
      title="Iniciar sesión"
      className="relative flex items-center justify-center rounded-xl text-zinc-500 transition-all active:bg-white/[0.06] active:text-yellow-400"
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    </a>
  )

  return (
    <>
      {/* ─── Desktop top nav (lg+, barra fija arriba) ─── */}
      <header className="fixed inset-x-0 top-0 z-40 hidden h-16 border-b border-white/[0.06] bg-[#0d0d0d]/95 backdrop-blur-xl lg:block">
        <div className="safe-area-top relative mx-auto h-full max-w-7xl px-6">
          {/* Logo — izquierda */}
          <Link
            href="/"
            aria-label="Juega Hip Hop — Inicio"
            className="absolute left-6 top-1/2 shrink-0 -translate-y-1/2"
          >
            <Logo size="header" priority />
          </Link>

          {/* Nav — centro exacto de la pantalla */}
          <nav
            aria-label="Navegación principal"
            className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1"
          >
            {NAV_ITEMS.map((item) =>
              iconLink(item.href, item.label, item.icon, isActivePage(item.href), 'h-12 w-12'),
            )}
            {isAdmin &&
              iconLink(
                '/admin',
                'ADMIN',
                ADMIN_ICON,
                pathname.startsWith('/admin'),
                'h-12 w-12',
                'active:bg-white/[0.06] active:text-yellow-400',
              )}
          </nav>

          {/* Cuenta — derecha */}
          <div className="absolute right-6 top-1/2 flex -translate-y-1/2 items-center">
            {accountSlot}
          </div>
        </div>
      </header>

      {/* ─── Mobile bottom nav (solo iconos, siempre visible <lg) ─── */}
      <nav
        aria-label="Navegación móvil"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#0d0d0d]/95 backdrop-blur-xl lg:hidden"
      >
        <div className="safe-area-bottom flex items-center px-1 py-1.5">
          {NAV_ITEMS.map((item) =>
            iconLink(item.href, item.label, item.icon, isActivePage(item.href), 'min-h-14 flex-1'),
          )}

          {isAdmin &&
            iconLink(
              '/admin',
              'ADMIN',
              ADMIN_ICON,
              pathname.startsWith('/admin'),
              'min-h-14 w-14',
              'active:bg-white/[0.06] active:text-yellow-400',
            )}

          {/* Cuenta: avatar (sesión) o acceso a login (invitado) */}
          <div className="relative flex min-h-14 w-14 shrink-0 items-center justify-center border-l border-white/[0.06]">
            {accountSlot}
          </div>
        </div>
      </nav>
    </>
  )
}
