'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import GameCard from '@/components/GameCard'
import Logo from '@/components/Logo'
import AdsterraBanner from '@/components/AdsterraBanner'
import Link from 'next/link'
import { getActiveBanners } from '@/lib/banner-utils'
import type { PlayerProfile, GameCatalogEntry, GameProgress, Banner } from '@/lib/types'
import type { User } from '@supabase/supabase-js'

/**
 * Calcula el progreso actual de un juego de forma genérica.
 */
function computeProgress(
  game: GameCatalogEntry,
  row: {
    total_plays: number
    completions_count: number | null
    progress_current: number | null
    progress_total: number | null
    progress_label: string | null
  } | null,
): GameProgress | null {
  // Progreso REAL del juego (lo manda el juego en save_progress):
  // ej: { current: 3, total: 9, label: 'Categorías' }
  if (row?.progress_total && row.progress_total > 0) {
    return {
      current: Math.min(row.progress_current ?? 0, row.progress_total),
      total: row.progress_total,
      label: row.progress_label ?? game.progress_label ?? 'Progreso',
    }
  }
  // Fallback legacy: total_items del catálogo + partidas jugadas
  const totalPlays = row?.total_plays ?? 0
  const total = game.total_items
  if (!total || total <= 0) {
    if (totalPlays <= 0) return null
    return { current: totalPlays, total: totalPlays, label: game.progress_label ?? 'Jugadas' }
  }
  const current = Math.min(totalPlays, total)
  return {
    current,
    total,
    label: game.progress_label ?? 'Progreso',
  }
}

interface LobbyClientProps {
  initialGames: GameCatalogEntry[]
  initialBanners: Banner[]
}

export default function LobbyClient({ initialGames, initialBanners }: LobbyClientProps) {
  const [debug, setDebug] = useState<string>(
    initialGames.length > 0 ? `ssr: ${initialGames.length} juegos` : 'cargando juegos',
  )
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [games, setGames] = useState<GameCatalogEntry[]>(initialGames)
  const [banners, setBanners] = useState<Banner[]>(initialBanners)
  const [progressMap, setProgressMap] = useState<Record<string, GameProgress | null>>({})
  const [loading, setLoading] = useState(initialGames.length === 0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>('todos')
  const [bannerIndex, setBannerIndex] = useState(0)
  const [bannerPaused, setBannerPaused] = useState(false)
  const [featuredIndex, setFeaturedIndex] = useState(0)
  const [featuredPaused, setFeaturedPaused] = useState(false)
  const featuredTrackRef = useRef<HTMLDivElement | null>(null)
  // Evita que el onScroll del track pise los scrolls programáticos (timer/flechas/dots)
  const featuredProgrammatic = useRef(false)

  useEffect(() => {
    if (initialGames.length > 0) {
      return
    }

    const supabase = createClient()
    const timeoutId = setTimeout(() => {
      setDebug('timeout')
      setLoading(false)
      setLoadError('La conexión está tardando más de lo esperado. ¿Seguro que hay conexión a internet?')
    }, 8000)

    // ═══ Fallback cliente si el catálogo SSR vino vacío. ═══
    ;(async () => {
      try {
        setDebug('consulta supabase...')
        const [gamesRes, bannersRes] = await Promise.all([
          supabase
            .from('games')
            .select('*')
            .in('status', ['active', 'beta', 'coming_soon'])
            .order('sort_order', { ascending: true }),
          supabase
            .from('banners')
            .select('*')
            .eq('active', true)
            .order('sort_order', { ascending: true }),
        ])
        clearTimeout(timeoutId)
        setDebug(gamesRes.error ? `error: ${gamesRes.error.message}` : `ok: ${gamesRes.data?.length ?? 0} juegos`)
        if (!gamesRes.error) {
          setGames((gamesRes.data ?? []) as GameCatalogEntry[])
          setBanners(getActiveBanners((bannersRes.data ?? []) as Banner[]))
        }
      } catch (e) {
        clearTimeout(timeoutId)
        setDebug(`excepción: ${(e as Error).message}`)
        console.warn('[Lobby] Error cargando juegos:', e)
        setLoadError('Error al cargar los juegos. Verifica tu conexión.')
      }
      setLoading(false)
    })()

    return () => clearTimeout(timeoutId)
  }, [initialGames])

  useEffect(() => {
    const supabase = createClient()

    // ═══ Verificar sesión en paralelo ═══
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u)

      // Si hay sesión, cargar perfil, progreso y admin status
      if (u) {
        Promise.all([
          supabase
            .from('player_profiles')
            .select('*')
            .eq('user_id', u.id)
            .maybeSingle(),
          supabase
            .from('game_state')
            // ⚡ Solo agregados — NO traer `state` (JSONB pesado de la Sopa):
            // computeProgress usa total_plays/progress_*, no el estado crudo.
            .select('game_id, total_plays, best_score, total_playtime_seconds, completions_count, progress_current, progress_total, progress_label')
            .eq('user_id', u.id),
          supabase
            .rpc('is_admin'),
        ]).then(([profileRes, gameStatesRes, adminRes]) => {
          setProfile(profileRes.data as PlayerProfile | null)
          // is_admin() es SECURITY DEFINER y usa el email del JWT —
          // bypasea el RLS de admin_users (la lectura directa no aplica)
          setIsAdmin(!!(adminRes.data ?? false))

          const map: Record<string, GameProgress | null> = {}
          for (const game of games) {
            const row = (gameStatesRes.data ?? []).find(
              (r: { game_id: string }) => r.game_id === game.slug,
            )
            map[game.slug] = computeProgress(
              game,
              (row as {
                total_plays: number
                completions_count: number | null
                progress_current: number | null
                progress_total: number | null
                progress_label: string | null
              }) ?? null,
            )
          }
          setProgressMap(map)
        }).catch(() => {
          // Error cargando progreso — no es crítico
        })
      }
    }).catch(() => {
      // Error verificando auth — el usuario ve el catálogo como invitado
    })
  }, [games])

  // Separar juegos disponibles y próximos
  const availableGames = games.filter((g) => g.status === 'active' || g.status === 'beta')
  const comingSoonGames = games.filter((g) => g.status === 'coming_soon')

  // Categorías únicas para filtros (ignorando el default 'games')
  const categories = useMemo(() => {
    const cats = new Set<string>()
    for (const g of availableGames) {
      if (g.category && g.category !== 'games') cats.add(g.category)
    }
    return Array.from(cats).sort()
  }, [availableGames])

  // Juegos destacados (featured) — cards horizontales grandes
  const featuredGames = availableGames.filter((g) => g.featured)
  // "TODOS LOS JUEGOS" muestra TODOS los jugables (destacados incluidos —
  // pueden aparecer también en los destacados, es intencional)
  const gridGames = availableGames

  // Filtro por categoría
  const visibleGrid = activeCategory === 'todos'
    ? gridGames
    : gridGames.filter((g) => g.category === activeCategory)

  // Banners VIGENTES ordenados por prioridad (carrusel del hero)
  const activeBanners = useMemo(() => getActiveBanners(banners), [banners])

  // Rotación automática cada 6s entre los vigentes (1 solo → queda fijo).
  // Se pausa con el mouse encima para poder leer el banner.
  // (El índice siempre va con % activeBanners.length, así queda en rango
  // aunque cambie la lista: banner vencido, nuevo banner, reorden, etc.)
  useEffect(() => {
    if (activeBanners.length <= 1 || bannerPaused) return
    const id = setInterval(() => {
      setBannerIndex((i) => (i + 1) % activeBanners.length)
    }, 6000)
    return () => clearInterval(id)
  }, [activeBanners.length, bannerPaused])

  // Banner activo del carrusel
  const heroBanner =
    activeBanners.length > 0 ? activeBanners[bannerIndex % activeBanners.length] : null

  // ─── Carrusel de DESTACADOS ───
  // Auto-rotación: cada 6s avanza al siguiente (se pausa con mouse/touch encima).
  // Solo cambia el índice; el efecto de abajo desplaza el track.
  useEffect(() => {
    if (featuredGames.length <= 1 || featuredPaused) return
    const id = setInterval(() => {
      setFeaturedIndex((i) => (i + 1) % featuredGames.length)
    }, 6000)
    return () => clearInterval(id)
  }, [featuredGames.length, featuredPaused])

  // Sincroniza el scroll del track con el índice (timer, flechas, dots, swipe)
  useEffect(() => {
    const track = featuredTrackRef.current
    if (!track || track.children.length === 0) return
    const step = (track.children[0] as HTMLElement).offsetWidth + 20 // gap-5
    const maxScroll = Math.max(track.scrollWidth - track.clientWidth, 0)
    const left = Math.min(featuredIndex * step, maxScroll)
    if (Math.abs(track.scrollLeft - left) > 4) {
      featuredProgrammatic.current = true
      track.scrollTo({ left, behavior: 'smooth' })
      window.setTimeout(() => {
        featuredProgrammatic.current = false
      }, 800)
    }
  }, [featuredIndex, featuredGames.length])

  // Swipe manual del usuario → actualiza el índice según la posición del track
  const handleFeaturedScroll = () => {
    if (featuredProgrammatic.current) return
    const track = featuredTrackRef.current
    if (!track || track.children.length === 0) return
    const step = (track.children[0] as HTMLElement).offsetWidth + 20 // gap-5
    const idx = Math.round(track.scrollLeft / step)
    if (idx !== featuredIndex) {
      setFeaturedIndex(Math.min(Math.max(idx, 0), featuredGames.length - 1))
    }
  }

  // Flechas y dots: solo cambian el índice (el efecto mueve el track)
  const goFeatured = (dir: 1 | -1) =>
    setFeaturedIndex((i) => (i + dir + featuredGames.length) % featuredGames.length)

  return (
    <div className="vignette brick-bg graffiti-spray min-h-dvh">
      <Sidebar user={user} profile={profile} isAdmin={isAdmin} />

      <div className="relative z-10 flex min-h-dvh flex-col content-with-rail">
        {/* ─── HERO COMPACTO ─── */}
        <section
          className="relative flex min-h-[300px] items-end overflow-hidden border-b border-white/[0.04] sm:min-h-[360px]"
          onMouseEnter={() => setBannerPaused(true)}
          onMouseLeave={() => setBannerPaused(false)}
        >
          {heroBanner?.image_url && (
            <>
              <div key={heroBanner.id} className="absolute inset-0 animate-fade-in">
                <img
                  src={`${heroBanner.image_url}?v=${new Date(heroBanner.updated_at).getTime()}`}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              <div
                key={`overlay-${heroBanner.id}`}
                className="absolute inset-0 animate-fade-in"
                style={{
                  background: `linear-gradient(180deg, rgba(0,0,0,${heroBanner.overlay_opacity}) 0%, rgba(0,0,0,${Number(heroBanner.overlay_opacity) + 0.3}) 100%)`,
                }}
              />
            </>
          )}

          {/* Decoración SVG lateral (sin banner) */}
          {!heroBanner?.image_url && (
            <div className="pointer-events-none absolute -right-10 bottom-0 hidden w-[220px] opacity-25 sm:block lg:right-6">
              <svg viewBox="0 0 280 500" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-auto w-full">
                <path d="M140 180 C120 180 100 190 90 210 C80 230 75 250 80 270 L70 320 C65 340 60 350 55 370 L50 410 C48 420 45 430 50 440 L55 455 L60 470 L65 480 L75 490 L90 500 L100 490 L95 475 L90 460 L85 440 L90 420 L100 380 L105 360 L110 340 L115 320 L118 300 C118 300 120 310 130 320 C140 330 150 335 155 340 L160 350 L158 370 L155 390 L150 420 L145 440 L140 460 L135 480 L140 500 L155 500 L160 480 L162 460 L165 440 L170 420 L175 390 L180 360 L185 340 L195 320 L210 300 L220 290 L225 280 L220 270 L210 265 L200 260 L195 250 L190 240 L185 230 L180 220 L175 210 L170 200 L165 190 L155 185 L150 180 Z" fill="currentColor" className="text-white/60"/>
                <circle cx="140" cy="140" r="55" fill="currentColor" className="text-white/60"/>
              </svg>
            </div>
          )}

          <div className="relative z-10 w-full px-4 pb-8 sm:px-6 sm:pb-10 lg:px-8">
            <div key={heroBanner?.id ?? 'no-banner'} className="animate-fade-in-up mx-auto max-w-6xl">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center">
                  <Logo size="sm" priority />
                </div>
                <div className="h-px flex-1 max-w-40 bg-gradient-to-r from-yellow-400/40 to-transparent" />
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400">
                  La cultura es tu mejor arma
                </span>
              </div>

              {heroBanner?.title ? (
                <>
                  <h1
                    className="font-archivo text-4xl leading-none tracking-wide min-[380px]:text-5xl sm:text-6xl"
                    style={{ color: heroBanner.text_color || '#ffffff' }}
                  >
                    {heroBanner.title.split(' ').map((word, i) =>
                      i === heroBanner.title.split(' ').length - 1 && heroBanner.title.split(' ').length > 1 ? (
                        <span key={i} style={{ color: heroBanner.accent_color || '#facc15' }}>{word}</span>
                      ) : (
                        <span key={i}>{word}{i < heroBanner.title.split(' ').length - 1 ? ' ' : ''}</span>
                      )
                    )}
                  </h1>
                  {heroBanner.subtitle && (
                    <p
                      className="mt-2 text-xs font-bold tracking-[0.25em] sm:text-sm"
                      style={{ color: heroBanner.accent_color || '#facc15' }}
                    >
                      {heroBanner.subtitle}
                    </p>
                  )}
                </>
              ) : (
                <h1 className="font-archivo text-4xl leading-none tracking-wide min-[380px]:text-5xl sm:text-6xl">
                  JUEGA <span className="text-yellow-400">HIP HOP</span>
                </h1>
              )}

              {heroBanner?.link_url && (
                <a
                  href={heroBanner.link_url}
                  className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl px-6 py-2.5 text-sm font-bold text-black transition-all hover:opacity-90 active:scale-[0.97]"
                  style={{ backgroundColor: heroBanner.accent_color || '#facc15' }}
                >
                  {heroBanner.link_label || 'JUGAR AHORA'}
                </a>
              )}
            </div>
          </div>

          {/* ─── Dots del carrusel (solo si hay más de 1 vigente) ─── */}
          {activeBanners.length > 1 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex items-center justify-center gap-2">
              {activeBanners.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBannerIndex(i)}
                  aria-label={`Ver banner ${i + 1}`}
                  className={`pointer-events-auto h-1.5 rounded-full transition-all duration-300 ${
                    i === bannerIndex % activeBanners.length
                      ? 'w-6 bg-yellow-400'
                      : 'w-1.5 bg-white/40 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          )}
        </section>

        {/* ─── CONTENIDO PRINCIPAL ─── */}
        <main id="juegos" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          {/* ─── Banner Adsterra (desktop 728x90 / móvil 300x250) ─── */}
          <div className="mb-8 flex justify-center">
            <AdsterraBanner format="728x90" className="hidden md:block" />
            <AdsterraBanner format="300x250" className="md:hidden" />
          </div>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-yellow-400/30 border-t-yellow-400" />
              <p className="text-[10px] uppercase tracking-wider text-zinc-600">Cargando juegos…</p>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="mb-4 text-3xl">📡</div>
              <p className="max-w-sm text-center text-xs uppercase tracking-wider text-zinc-500">
                {loadError}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 rounded-xl bg-yellow-400 px-6 py-2.5 text-sm font-bold text-black transition-colors hover:bg-yellow-300"
              >
                REINTENTAR
              </button>
            </div>
          ) : (
            <>
              {/* ─── Stats rápidas del jugador ─── */}
              {user && profile && (
                <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: 'NIVEL', value: profile.level ?? 1, icon: '⭐', color: 'text-yellow-400' },
                    { label: 'XP TOTAL', value: (profile.xp ?? 0).toLocaleString(), icon: '⚡', color: 'text-purple-400' },
                    { label: 'RACHA', value: profile.current_streak ?? 0, icon: '🔥', color: 'text-orange-400' },
                    { label: 'COMPLETADOS', value: profile.total_games_completed ?? 0, icon: '🏆', color: 'text-emerald-400' },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                    >
                      <span className="text-xl">{stat.icon}</span>
                      <div className="min-w-0">
                        <div className={`text-lg font-black leading-tight ${stat.color}`}>{stat.value}</div>
                        <div className="truncate text-[9px] font-semibold uppercase tracking-widest text-zinc-500">
                          {stat.label}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ─── DESTACADOS: carrusel horizontal ─── */}
              {featuredGames.length > 0 && (
                <section
                  className="mb-10"
                  onTouchStart={() => setFeaturedPaused(true)}
                  onTouchEnd={() => setFeaturedPaused(false)}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <h2 className="font-archivo text-xl tracking-wide text-white sm:text-2xl">
                      DESTACADOS <span className="text-yellow-400">🔥</span>
                    </h2>
                    <div className="h-px flex-1 bg-gradient-to-r from-yellow-400/30 to-transparent" />

                    {/* Flechas del carrusel */}
                    {featuredGames.length > 1 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => goFeatured(-1)}
                          aria-label="Anterior destacado"
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white transition-colors hover:border-yellow-400/50 hover:bg-yellow-400/10 hover:text-yellow-400"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => goFeatured(1)}
                          aria-label="Siguiente destacado"
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white transition-colors hover:border-yellow-400/50 hover:bg-yellow-400/10 hover:text-yellow-400"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Track scrolleable con scroll-snap (swipe en móvil) */}
                  <div
                    ref={featuredTrackRef}
                    onScroll={handleFeaturedScroll}
                    className="no-scrollbar -mx-4 flex snap-x snap-proximity gap-5 overflow-x-auto scroll-smooth px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
                  >
                    {featuredGames.map((game, i) => (
                      <div
                        key={game.slug}
                        className={`w-[76%] shrink-0 snap-start transition-all duration-500 sm:w-[52%] lg:w-[40%] xl:w-[32%] ${
                          i === featuredIndex ? 'opacity-100' : 'opacity-45 saturate-[0.8]'
                        }`}
                        style={{ transform: i === featuredIndex ? 'scale(1)' : 'scale(0.955)' }}
                      >
                        <FeaturedCard
                          game={game}
                          progress={progressMap[game.slug] ?? null}
                          index={i}
                          active={i === featuredIndex}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Dots */}
                  {featuredGames.length > 1 && (
                    <div className="mt-4 flex items-center justify-center gap-2">
                      {featuredGames.map((g, i) => (
                        <button
                          key={g.slug}
                          type="button"
                          onClick={() => setFeaturedIndex(i)}
                          aria-label={`Ir al destacado ${i + 1}`}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            i === featuredIndex ? 'w-6 bg-yellow-400' : 'w-1.5 bg-white/30 hover:bg-white/60'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* ─── TODOS LOS JUEGOS ─── */}
              {gridGames.length > 0 && (
                <section>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-archivo text-xl tracking-wide text-white sm:text-2xl">
                      TODOS LOS <span className="text-yellow-400">JUEGOS</span>
                    </h2>

                    {/* Filtros por categoría */}
                    {categories.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setActiveCategory('todos')}
                          className={`rounded-full border px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                            activeCategory === 'todos'
                              ? 'border-yellow-400/50 bg-yellow-400/15 text-yellow-400'
                              : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-white'
                          }`}
                          type="button"
                        >
                          Todos
                        </button>
                        {categories.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`rounded-full border px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                              activeCategory === cat
                                ? 'border-yellow-400/50 bg-yellow-400/15 text-yellow-400'
                                : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-white'
                            }`}
                            type="button"
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {!user && (
                    <p className="mb-4 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-600">
                      <span>🔒</span> Los juegos requieren cuenta — crear una es gratis y guarda tu progreso
                    </p>
                  )}

                  {visibleGrid.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/[0.06] p-10 text-center">
                      <div className="mb-2 text-3xl">🎮</div>
                      <p className="text-xs uppercase tracking-wider text-zinc-500">
                        No hay juegos en esta categoría todavía
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-5 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {visibleGrid.map((game, i) => (
                        <div key={game.slug} className="animate-fade-in-up" style={{ animationDelay: `${(i % 8) * 60}ms` }}>
                          <GameCard game={game} progress={progressMap[game.slug] ?? null} />
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* ─── PRÓXIMOS LANZAMIENTOS ─── */}
              {comingSoonGames.length > 0 && (
                <section className="mt-12">
                  <div className="mb-4 flex items-center gap-3">
                    <h2 className="font-archivo text-xl tracking-wide text-white sm:text-2xl">
                      PRÓXIMOS <span className="text-yellow-400">LANZAMIENTOS</span>
                    </h2>
                    <div className="h-px flex-1 bg-gradient-to-r from-yellow-400/30 to-transparent" />
                  </div>
                  <div className="grid grid-cols-1 gap-5 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {comingSoonGames.map((game) => (
                      <GameCard key={game.slug} game={game} progress={null} />
                    ))}
                  </div>
                </section>
              )}

              {availableGames.length === 0 && comingSoonGames.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/[0.06] p-10 text-center">
                  <div className="mb-2 text-3xl">🎮</div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500">
                    No hay juegos disponibles en este momento
                  </p>
                </div>
              )}

              {/* ─── Banner native Adsterra ─── */}
              <div className="mt-12 flex justify-center">
                <AdsterraBanner format="native" />
              </div>
            </>
          )}
        </main>

        {/* ─── FOOTER ─── */}
        <footer className="border-t border-white/[0.06] py-8">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <div className="flex items-center gap-2">
                <Logo size="sm" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  El hip hop no es moda, <span className="text-zinc-300">es cultura.</span>
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] uppercase tracking-wider text-zinc-700">
                  RAP · DJ · BREAK · GRAFFITI · KNOWLEDGE
                </span>
                <Link
                  href="/privacidad"
                  className="text-[10px] uppercase tracking-wider text-zinc-600 transition-colors hover:text-yellow-400"
                >
                  Política de Privacidad
                </Link>
              </div>
            </div>
            <div className="mt-6 border-t border-white/[0.04] pt-4 text-center text-[9px] uppercase tracking-wider text-zinc-800">
              © 2026 Juega Hip Hop — La cultura es tu mejor arma · Un proyecto de Infinity Force Company
              {debug && <span className="ml-2">[{debug}]</span>}
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

// ─── Card destacada horizontal: portada landscape + info ───

function FeaturedCard({
  game,
  progress,
  index,
  active,
}: {
  game: GameCatalogEntry
  progress: GameProgress | null
  index: number
  active?: boolean
}) {
  const accentColor = game.accent_color ?? game.color ?? '#7C3AED'
  const baseColor = game.color ?? '#7C3AED'
  const progressPct = progress && progress.total > 0
    ? Math.min((progress.current / progress.total) * 100, 100)
    : 0

  return (
    <a
      href={`/jugar/${game.slug}`}
      aria-label={`Jugar ${game.name}`}
      className="group relative block h-full overflow-hidden rounded-2xl border border-white/[0.08] transition-all duration-500 hover:-translate-y-1"
      style={{
        animationDelay: `${index * 100}ms`,
        boxShadow: active
          ? `0 0 0 1px ${accentColor}44, 0 12px 48px -8px ${accentColor}40`
          : '0 4px 24px -12px rgba(0,0,0,0.6)',
      }}
    >
      {/* ═══ Portada LANDSCAPE con info superpuesta (estilo streaming) ═══ */}
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        {game.image_url ? (
          <img
            src={`${game.image_url}?v=${new Date(game.updated_at).getTime()}`}
            alt={game.name}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              background: `radial-gradient(circle at 25% 25%, ${baseColor}40 0%, transparent 55%), linear-gradient(150deg, ${baseColor}2e 0%, #0a0a0a 75%)`,
            }}
          >
            <span className="text-6xl transition-transform duration-500 group-hover:scale-110">{game.emoji}</span>
          </div>
        )}

        {/* Gradiente cinematográfico inferior (legibilidad de la info) */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/25 to-transparent" />
        {/* Vignette sutil superior */}
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/50 to-transparent" />

        {/* Badge DESTACADO */}
        <div
          className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-black backdrop-blur-sm"
          style={{ backgroundColor: accentColor }}
        >
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-black/60" />
          DESTACADO
        </div>

        {/* Número de posición */}
        <span className="absolute right-3 top-3 font-archivo text-2xl leading-none text-white/25">
          {String(index + 1).padStart(2, '0')}
        </span>

        {/* Overlay hover con botón JUGAR */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 backdrop-blur-[2px] transition-opacity duration-300 group-hover:opacity-100">
          <div
            className="flex h-14 w-14 scale-75 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-100"
            style={{
              backgroundColor: `${accentColor}ee`,
              boxShadow: `0 0 0 6px ${accentColor}22, 0 0 36px ${accentColor}88`,
            }}
          >
            <svg className="ml-0.5 h-6 w-6 text-black" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* ═══ Info superpuesta en la portada ═══ */}
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <div className="mb-1.5 flex items-center gap-2">
            {game.status === 'beta' && (
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider backdrop-blur-sm"
                style={{ backgroundColor: `${accentColor}33`, color: accentColor }}
              >
                Beta
              </span>
            )}
            <span className="rounded-full border border-white/15 bg-black/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-300 backdrop-blur-sm">
              {game.category && game.category !== 'games' ? game.category : 'Jugar ahora'}
            </span>
          </div>

          <h3
            className="font-archivo text-2xl leading-none tracking-wide drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] sm:text-3xl"
            style={{ color: accentColor }}
          >
            {game.name}
          </h3>

          <p className="mt-1.5 line-clamp-2 max-w-[90%] text-[11px] uppercase leading-relaxed tracking-wide text-zinc-300/90">
            {game.short_description}
          </p>

          {progress && progress.total > 0 && (
            <div className="mt-3 max-w-[85%]">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-wider text-zinc-400">{progress.label}</span>
                <span className="text-[10px] font-bold" style={{ color: accentColor }}>
                  {progress.current}/{progress.total}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ backgroundColor: accentColor, width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </a>
  )
}
