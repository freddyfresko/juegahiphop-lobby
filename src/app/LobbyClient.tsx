'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/Header'
import GameCard from '@/components/GameCard'
import type { PlayerProfile, GameCatalogEntry, GameProgress, Banner } from '@/lib/types'
import type { User } from '@supabase/supabase-js'

/**
 * Calcula el progreso actual de un juego de forma genérica.
 */
function computeProgress(
  game: GameCatalogEntry,
  _state: Record<string, unknown> | null,
  totalPlays: number,
): GameProgress | null {
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
          setBanners((bannersRes.data ?? []) as Banner[])
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
            .single(),
          supabase
            .from('game_state')
            .select('game_id, state, total_plays')
            .eq('user_id', u.id),
          supabase
            .from('admin_users')
            .select('id')
            .eq('email', u.email)
            .maybeSingle(),
        ]).then(([profileRes, gameStatesRes, adminRes]) => {
          setProfile(profileRes.data as PlayerProfile | null)
          setIsAdmin(!!adminRes.data)

          const map: Record<string, GameProgress | null> = {}
          for (const game of games) {
            const row = (gameStatesRes.data ?? []).find(
              (r: { game_id: string }) => r.game_id === game.slug,
            )
            map[game.slug] = computeProgress(
              game,
              (row?.state as Record<string, unknown>) ?? null,
              row?.total_plays ?? 0,
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

  // Banner activo (primero de la lista)
  const heroBanner = banners.length > 0 ? banners[0] : null

  return (
    <div className="vignette brick-bg graffiti-spray flex min-h-screen flex-col">
      <div className="relative z-10 flex min-h-screen flex-col">
        <Header user={user} profile={profile} isAdmin={isAdmin} />

        {/* ─── HERO SECTION ─── */}
        <section className="relative flex min-h-[50vh] items-center justify-center overflow-hidden border-b border-white/[0.04] sm:min-h-[70vh]">
          {heroBanner?.image_url && (
            <>
              {/* Background image */}
              <div className="absolute inset-0">
                <img
                  src={`${heroBanner.image_url}?v=${new Date(heroBanner.updated_at).getTime()}`}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              {/* Overlay */}
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(180deg, rgba(0,0,0,${heroBanner.overlay_opacity}) 0%, rgba(0,0,0,${Number(heroBanner.overlay_opacity) + 0.2}) 100%)`,
                }}
              />
            </>
          )}

          {/* SVG decorations (only when no banner) */}
          {!heroBanner?.image_url && (
            <>
              <div className="pointer-events-none absolute bottom-0 left-0 hidden w-[280px] opacity-30 lg:block xl:w-[350px]">
                <svg viewBox="0 0 280 500" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-auto w-full">
                  <path d="M140 180 C120 180 100 190 90 210 C80 230 75 250 80 270 L70 320 C65 340 60 350 55 370 L50 410 C48 420 45 430 50 440 L55 455 L60 470 L65 480 L75 490 L90 500 L100 490 L95 475 L90 460 L85 440 L90 420 L100 380 L105 360 L110 340 L115 320 L118 300 C118 300 120 310 130 320 C140 330 150 335 155 340 L160 350 L158 370 L155 390 L150 420 L145 440 L140 460 L135 480 L140 500 L155 500 L160 480 L162 460 L165 440 L170 420 L175 390 L180 360 L185 340 L195 320 L210 300 L220 290 L225 280 L220 270 L210 265 L200 260 L195 250 L190 240 L185 230 L180 220 L175 210 L170 200 L165 190 L155 185 L150 180 Z" fill="currentColor" className="text-white/80"/>
                  <circle cx="140" cy="140" r="55" fill="currentColor" className="text-white/80"/>
                </svg>
              </div>
              <div className="pointer-events-none absolute bottom-0 right-0 hidden w-[250px] opacity-25 lg:block xl:w-[300px]">
                <svg viewBox="0 0 250 500" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-auto w-full">
                  <path d="M125 180 C110 180 95 185 85 200 C75 215 70 235 75 255 L65 300 C60 320 55 340 50 360 L45 390 C42 400 40 415 45 430 L50 445 L55 460 L65 475 L75 485 L90 495 L100 500 L105 490 L100 475 L95 455 L90 435 L95 410 L105 380 L110 355 L115 335 L120 315 L122 300 C122 300 125 310 135 320 C145 330 155 338 160 345 L165 355 L162 375 L158 395 L152 420 L148 440 L143 460 L140 480 L142 500 L158 500 L162 480 L165 460 L168 440 L172 420 L178 390 L182 365 L188 345 L198 325 L215 305 L225 295 L230 285 L225 275 L215 268 L205 262 L200 252 L195 240 L190 228 L185 218 L180 208 L175 198 L168 190 L158 186 L150 182 Z" fill="currentColor" className="text-white/80"/>
                  <ellipse cx="125" cy="135" rx="50" ry="55" fill="currentColor" className="text-white/80"/>
                </svg>
              </div>
            </>
          )}

          <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
            <div className="animate-fade-in">
              {/* Crown icon */}
              <svg className="mx-auto mb-3 h-10 w-10 text-yellow-400 sm:h-12 sm:w-12 animate-float" viewBox="0 0 24 24" fill={heroBanner?.accent_color || '#facc15'}>
                <path d="M2 19l2-12 4 3 4-5 4 5 4-3 2 12H2zM12 5l-3 4 3-1 3 1-3-4z"/>
              </svg>

              <h1
                className="font-archivo text-5xl font-normal leading-none tracking-wide sm:text-6xl md:text-7xl lg:text-8xl"
                style={{ color: heroBanner?.text_color || '#ffffff' }}
              >
                {heroBanner?.title?.split(' ').map((word, i) =>
                  i === heroBanner.title.split(' ').length - 1 && heroBanner.title.split(' ').length > 1 ? (
                    <span key={i} style={{ color: heroBanner?.accent_color || '#facc15' }}>{word}</span>
                  ) : (
                    <span key={i}>{word}{i < heroBanner.title.split(' ').length - 1 ? ' ' : ''}</span>
                  )
                ) || (
                  <>
                    JUEGA<br className="sm:hidden" />
                    <span className="text-yellow-400">HIP HOP</span>
                  </>
                )}
              </h1>

              {heroBanner?.subtitle && (
                <p
                  className="mt-4 text-sm font-semibold tracking-[0.25em] sm:text-base"
                  style={{ color: heroBanner.accent_color || '#facc15' }}
                >
                  {heroBanner.subtitle}
                </p>
              )}

              {heroBanner?.description && (
                <p className="mt-2 text-xs tracking-wider text-zinc-500 sm:text-sm">
                  {heroBanner.description}
                </p>
              )}

              {/* CTA Button */}
              {heroBanner?.link_url && (
                <a
                  href={heroBanner.link_url}
                  className="mt-8 inline-block rounded-xl bg-yellow-400 px-8 py-3 text-sm font-bold text-black transition-all hover:bg-yellow-300 active:scale-[0.97]"
                  style={{ backgroundColor: heroBanner.accent_color || '#facc15' }}
                >
                  {heroBanner.link_label || 'JUGAR AHORA'}
                </a>
              )}

              {/* Scroll indicator */}
              <div className="mt-10 animate-float">
                <svg className="mx-auto h-6 w-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* ─── GAMES SECTION ─── */}
        <section id="juegos" className="py-12 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-yellow-400/30 border-t-yellow-400" />
                <p className="text-[10px] uppercase tracking-wider text-zinc-600">Cargando juegos…</p>
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center justify-center py-16">
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
                {availableGames.length > 0 && (
                  <>
                    <div className="mb-10 text-center">
                      <h2 className="font-archivo text-2xl tracking-wide text-white sm:text-3xl lg:text-4xl">
                        JUEGOS <span className="text-yellow-400">DISPONIBLES</span>
                      </h2>
                      <div className="mx-auto mt-3 h-0.5 w-16 rounded-full bg-yellow-500/50" />
                      {!user && (
                        <p className="mt-3 text-[10px] uppercase tracking-wider text-zinc-600">
                          Juega sin registro — tu progreso se guarda al crear una cuenta
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {availableGames.map((game, i) => (
                        <div key={game.slug} style={{ animationDelay: `${(i + 1) * 100}ms` }}>
                          <GameCard game={game} progress={progressMap[game.slug] ?? null} />
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {comingSoonGames.length > 0 && (
                  <div className={availableGames.length > 0 ? 'mt-16 sm:mt-20' : ''}>
                    <div className="mb-10 text-center">
                      <h2 className="font-archivo text-2xl tracking-wide text-white sm:text-3xl lg:text-4xl">
                        PRÓXIMOS <span className="text-yellow-400">LANZAMIENTOS</span>
                      </h2>
                      <div className="mx-auto mt-3 h-0.5 w-16 rounded-full bg-yellow-500/50" />
                      <p className="mt-3 text-[10px] uppercase tracking-wider text-zinc-600">
                        Prepárate para lo que se viene 🔥
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {comingSoonGames.map((game, i) => (
                        <div key={game.slug} style={{ animationDelay: `${(i + 1) * 100}ms` }}>
                          <GameCard game={game} progress={null} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {availableGames.length === 0 && comingSoonGames.length === 0 && (
                  <div className="rounded-xl border border-dashed border-white/[0.06] p-10 text-center">
                    <div className="mb-2 text-3xl">🎮</div>
                    <p className="text-xs uppercase tracking-wider text-zinc-500">
                      No hay juegos disponibles en este momento
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* ─── FOOTER ─── */}
        <footer className="mt-auto border-t border-white/[0.06] py-10 sm:py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 sm:grid-cols-3">
              <div className="text-center sm:text-left">
                <div className="mb-3 flex justify-center sm:justify-start">
                  <svg className="h-6 w-6 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2 19l2-12 4 3 4-5 4 5 4-3 2 12H2zM12 5l-3 4 3-1 3 1-3-4z"/>
                  </svg>
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  El hip hop no es moda,<br />
                  <span className="text-zinc-300">es cultura.</span>
                </p>
              </div>
              <div className="text-center sm:text-left">
                <div className="mb-3 flex justify-center sm:justify-start">
                  <svg className="h-6 w-6 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="2" y="8" width="20" height="12" rx="2" ry="2"/>
                    <circle cx="8" cy="14" r="3" fill="#0a0a0a" stroke="currentColor" strokeWidth="1.5"/>
                    <circle cx="16" cy="14" r="3" fill="#0a0a0a" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="5" y="3" width="14" height="5" rx="1"/>
                    <circle cx="8" cy="14" r="1.5" fill="currentColor"/>
                    <circle cx="16" cy="14" r="1.5" fill="currentColor"/>
                  </svg>
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  RAP, DJ, BREAK,<br />
                  GRAFFITI, KNOWLEDGE.
                </p>
              </div>
              <div className="text-center sm:text-left">
                <div className="mb-3 flex justify-center sm:justify-start">
                  <svg className="h-6 w-6 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10"/>
                    <ellipse cx="12" cy="12" rx="4" ry="10"/>
                    <path d="M2 12h20"/>
                  </svg>
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  CONECTA. COMPITE.<br />
                  REPRESENTA.
                </p>
              </div>
            </div>
            <div className="mt-10 pt-6 text-center text-[10px] uppercase tracking-wider text-zinc-700">
              © 2025 Juega Hip Hop — La cultura es tu mejor arma
            </div>
            {debug && (
              <div className="mt-2 text-center text-[8px] text-zinc-800">
                [{debug}]
              </div>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}
