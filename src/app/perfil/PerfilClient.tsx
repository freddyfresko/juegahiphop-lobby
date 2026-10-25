'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import AvatarUpload from '@/components/AvatarUpload'
import { useIsAdmin } from '@/lib/use-is-admin'
import type { PlayerProfile, AchievementUnlock, AchievementDefinition, GameCatalogEntry } from '@/lib/types'
import type { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

interface PerfilClientProps {
  userId: string
}

interface GameStatRow {
  game_id: string
  total_plays: number
  best_score: number | null
  total_playtime_seconds: number | null
  completions_count: number | null
  last_played_at: string | null
}

interface SessionRow {
  id: string
  game_id: string
  started_at: string
  duration_seconds: number | null
  session_result: string | null
  total_score: number
  items_completed: number
  difficulty: string | null
}

interface HistoryRow {
  started_at: string
  total_score: number
}

const RESULT_LABELS: Record<string, { label: string; cls: string }> = {
  completed: { label: 'COMPLETADA', cls: 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10' },
  abandoned: { label: 'ABANDONADA', cls: 'text-zinc-400 border-zinc-400/20 bg-zinc-400/10' },
  error: { label: 'ERROR', cls: 'text-red-400 border-red-400/20 bg-red-400/10' },
  timeout: { label: 'TIMEOUT', cls: 'text-orange-400 border-orange-400/20 bg-orange-400/10' },
}

/** Badge de rareza de logros */
const RARITY_STYLES: Record<string, string> = {
  common: 'text-zinc-400 border-zinc-500/20 bg-zinc-500/10',
  uncommon: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
  rare: 'text-sky-400 border-sky-500/20 bg-sky-500/10',
  epic: 'text-purple-400 border-purple-500/20 bg-purple-500/10',
  legendary: 'text-yellow-400 border-yellow-500/20 bg-yellow-500/10',
}

/** Logro desbloqueado + datos de su definición (JOIN en cliente) */
interface AchievementWithDef extends AchievementUnlock {
  rarity?: string
  xp_reward?: number
}

function formatPlaytime(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${seconds % 60}s`
  return `${seconds}s`
}

// Nivel derivado del XP acumulado: cada ~300 XP sube un nivel.
function levelFromXp(xp: number): number {
  if (xp <= 0) return 1
  return Math.floor(xp / 300) + 1
}

// Racha: días consecutivos con al menos una partida, contando desde
// la última (hoy o ayer). Si la última fue hace >1 día → 0.
function calcStreak(startedDates: Date[]): number {
  if (startedDates.length === 0) return 0
  const days = [...new Set(startedDates.map((d) => d.toDateString()))].sort((a, b) => b.localeCompare(a))
  // Diferencia en DÍAS DE CALENDARIO (medianoche a medianoche local).
  // NO usar Math.round sobre horas: una partida de ayer 9am con "hoy 11pm"
  // da ~1.6 días → round=2 → rompía la racha (la última parecía de hace 2 días).
  const dayDiff = (a: Date, b: Date) => {
    const da = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
    const db = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
    return Math.round((da - db) / 86400000)
  }

  const today = new Date()
  const last = new Date(days[0])
  if (dayDiff(today, last) > 1) return 0

  let streak = 1
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1])
    const cur = new Date(days[i])
    if (dayDiff(prev, cur) === 1) streak++
    else break
  }
  return streak
}

export default function PerfilClient({ userId }: PerfilClientProps) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [achievements, setAchievements] = useState<AchievementUnlock[]>([])
  const [gameStats, setGameStats] = useState<GameStatRow[]>([])
  const [games, setGames] = useState<GameCatalogEntry[]>([])
  const [recentSessions, setRecentSessions] = useState<SessionRow[]>([])
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const isAdmin = useIsAdmin()

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u)
    })

    Promise.all([
      supabase
        .from('player_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('achievement_unlocks')
        .select('*')
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false }),
      supabase
        .from('achievements')
        .select('achievement_id, name, description, icon, rarity, xp_reward, game_id, sort_order'),
      supabase
        .from('game_state')
        .select('game_id, total_plays, best_score, total_playtime_seconds, completions_count, last_played_at')
        .eq('user_id', userId)
        .order('total_plays', { ascending: false }),
      supabase
        .from('games')
        .select('slug, name, emoji, color, accent_color, image_url, updated_at, status')
        .in('status', ['active', 'beta', 'coming_soon']),
      supabase
        .from('game_sessions')
        .select('id, game_id, started_at, duration_seconds, session_result, total_score, items_completed, difficulty')
        .eq('user_id', userId)
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(3),
      supabase
        .from('game_sessions')
        .select('started_at, total_score')
        .eq('user_id', userId)
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false }),
    ]).then(([profileRes, achievementsRes, achDefsRes, statsRes, gamesRes, sessionsRes, historyRes]) => {
      setProfile(profileRes.data as PlayerProfile | null)

      // Mapear unlocks con sus definiciones (JOIN en cliente — achievement_unlocks
      // solo guarda achievement_id; el nombre/descripción/icono viven en achievements)
      const defs = (achDefsRes.data ?? []) as AchievementDefinition[]
      const defByKey = new Map(defs.map((d) => [d.achievement_id, d]))
      const unlocks = ((achievementsRes.data ?? []) as AchievementUnlock[]).map((u) => {
        const def = defByKey.get(u.achievement_id)
        // Fallback legible: 'sopa_ten_words' → 'Sopa Ten Words'
        const prettyId = u.achievement_id
          .split('_')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
        return {
          ...u,
          achievement_name: def?.name ?? prettyId,
          achievement_description: def?.description ?? 'Logro desbloqueado',
          icon: def?.icon ?? '🏆',
          rarity: def?.rarity,
          xp_reward: def?.xp_reward,
        } as AchievementWithDef
      })
      setAchievements(unlocks)

      setGameStats(statsRes.data as GameStatRow[] ?? [])
      setGames(gamesRes.data as GameCatalogEntry[] ?? [])
      setRecentSessions(sessionsRes.data as SessionRow[] ?? [])
      setHistory(historyRes.data as HistoryRow[] ?? [])
      setLoading(false)
    })
  }, [userId])

  const handleSignOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }, [router])

  const gameName = (slug: string) => games.find((g) => g.slug === slug)?.name ?? slug
  const gameEmoji = (slug: string) => games.find((g) => g.slug === slug)?.emoji ?? '🎮'
  const gameColor = (slug: string) => games.find((g) => g.slug === slug)?.accent_color
    ?? games.find((g) => g.slug === slug)?.color
    ?? '#7C3AED'

  // ─── Stats unificadas — MISMA definición que ranking y home ───
  // XP/nivel/racha = SOLO sesiones cerradas (ended_at IS NOT NULL).
  // Completados = game_state.completions_count (agregado por juego).
  // Sin fallbacks a player_profiles: tras la migración 00018 el
  // persistido se recalcula con la misma definición, y mezclar
  // fuentes era justo lo que producía los 3 números distintos.

  const totalPlaytime = gameStats.reduce((acc, s) => acc + (s.total_playtime_seconds ?? 0), 0)

  const { xpTotal, juegosCompletados, streak } = useMemo(() => {
    const xp = history.reduce((acc, h) => acc + (h.total_score || 0), 0)
    const completions = gameStats.reduce((acc, s) => acc + (s.completions_count ?? 0), 0)
    const racha = calcStreak(history.map((h) => new Date(h.started_at)))
    return { xpTotal: xp, juegosCompletados: completions, streak: racha }
  }, [history, gameStats])

  const xpFinal = xpTotal
  const nivelFinal = levelFromXp(xpFinal)
  const streakFinal = streak
  const completadosFinal = juegosCompletados

  if (loading) {
    return (
      <div className="vignette brick-bg min-h-dvh">
        <Sidebar user={null} />
        <div className="relative z-10 min-h-dvh content-with-rail">
          <main className="mx-auto w-full max-w-4xl px-4 py-8">
            <div className="animate-pulse space-y-6">
              <div className="h-10 w-48 rounded bg-white/5" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-white/[0.03]" />)}
              </div>
              <div className="h-32 rounded-2xl bg-white/[0.03]" />
              <div className="h-40 rounded-2xl bg-white/[0.03]" />
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="vignette brick-bg graffiti-spray min-h-dvh">
      <Sidebar user={user} profile={profile} isAdmin={isAdmin} />

      <div className="relative z-10 flex min-h-dvh flex-col content-with-rail">
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <div className="animate-fade-in-up">
            {/* Page header */}
            <div className="mb-8 flex items-start justify-between gap-4">
              <div className="flex items-center gap-4 sm:gap-5">
                <AvatarUpload
                  userId={userId}
                  currentUrl={profile?.avatar_url ?? null}
                  onChanged={(url) =>
                    setProfile((p) =>
                      p ? { ...p, avatar_url: url } as PlayerProfile : p,
                    )
                  }
                />
                <div>
                  <h1 className="font-archivo text-3xl tracking-wide text-white sm:text-4xl">
                    MI <span className="text-yellow-400">PERFIL</span>
                  </h1>
                  <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500">
                    {user?.email}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-600">
                    NIVEL {nivelFinal} · {xpFinal.toLocaleString()} XP
                  </p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-red-400 transition-colors hover:bg-red-500/20"
              >
                Salir
              </button>
            </div>

            {/* Stats Grid — conectadas a partidas reales */}
            <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'NIVEL', value: nivelFinal, color: 'text-yellow-400', icon: '⭐' },
                { label: 'XP TOTAL', value: xpFinal.toLocaleString(), color: 'text-purple-400', icon: '⚡' },
                { label: 'RACHA', value: streakFinal, color: 'text-orange-400', icon: '🔥', suffix: streakFinal > 0 ? ' 🔥' : '' },
                { label: 'JUEGOS', value: completadosFinal, color: 'text-emerald-400', icon: '🏆' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center"
                >
                  <div className="mb-1 flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                    <span>{stat.icon}</span>
                    {stat.label}
                  </div>
                  <div className={`text-2xl font-bold ${stat.color}`}>
                    {stat.value}{stat.suffix || ''}
                  </div>
                </div>
              ))}
            </div>

            {/* ─── Últimas partidas (solo 3, compactas) ─── */}
            {recentSessions.length > 0 && (
              <section className="mb-10">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-archivo text-xl tracking-wide text-white">
                    ÚLTIMAS <span className="text-yellow-400">PARTIDAS</span>
                  </h2>
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                    ⏱ {formatPlaytime(totalPlaytime)} en total
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {recentSessions.map((session) => {
                    const resultInfo = RESULT_LABELS[session.session_result ?? ''] ?? {
                      label: session.session_result ?? '—',
                      cls: 'text-zinc-500 border-zinc-500/20 bg-zinc-500/10',
                    }
                    const color = gameColor(session.game_id)
                    return (
                      <div
                        key={session.id}
                        className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:border-white/[0.12]"
                      >
                        <div className="mb-3 flex items-center gap-3">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"
                            style={{ backgroundColor: `${color}22` }}
                          >
                            {gameEmoji(session.game_id)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-white">
                              {gameName(session.game_id)}
                            </div>
                            <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                              {new Date(session.started_at).toLocaleDateString('es-CL', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-white/[0.04] pt-3">
                          <div>
                            <div className="text-base font-bold text-white">
                              {session.total_score > 0 ? session.total_score.toLocaleString() : '—'}
                            </div>
                            <div className="text-[9px] uppercase tracking-wider text-zinc-600">
                              Puntos · {formatPlaytime(session.duration_seconds)}
                            </div>
                          </div>
                          <span
                            className={`inline-block rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider ${resultInfo.cls}`}
                          >
                            {resultInfo.label}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ─── Estadísticas por juego ─── */}
            {gameStats.length > 0 && (
              <section className="mb-10">
                <h2 className="font-archivo mb-4 text-xl tracking-wide text-white">
                  ESTADÍSTICAS <span className="text-yellow-400">POR JUEGO</span>
                </h2>

                <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                  {gameStats.map((stat, i) => {
                    const color = gameColor(stat.game_id)
                    return (
                      <div
                        key={stat.game_id}
                        className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03] ${
                          i > 0 ? 'border-t border-white/[0.04]' : ''
                        }`}
                      >
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl"
                          style={{ backgroundColor: `${color}22` }}
                        >
                          <span className="text-lg">{gameEmoji(stat.game_id)}</span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-white">
                            {gameName(stat.game_id)}
                          </div>
                          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                            {stat.total_plays} partidas · {stat.completions_count ?? 0} completadas
                          </div>
                        </div>

                        <div className="grid shrink-0 grid-cols-3 gap-4 text-right sm:gap-6">
                          <div>
                            <div className="text-sm font-bold" style={{ color }}>
                              {stat.best_score?.toLocaleString() ?? '—'}
                            </div>
                            <div className="text-[9px] uppercase tracking-wider text-zinc-600">Best score</div>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">{formatPlaytime(stat.total_playtime_seconds)}</div>
                            <div className="text-[9px] uppercase tracking-wider text-zinc-600">Tiempo</div>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-zinc-300">
                              {stat.last_played_at
                                ? new Date(stat.last_played_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
                                : '—'}
                            </div>
                            <div className="text-[9px] uppercase tracking-wider text-zinc-600">Última vez</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Logros */}
            <section>
              <h2 className="font-archivo mb-5 text-xl tracking-wide text-white">
                LOGROS{' '}
                {achievements.length > 0 && (
                  <span className="text-yellow-400">({achievements.length})</span>
                )}
              </h2>

              {achievements.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/[0.06] p-10 text-center">
                  <div className="mb-2 text-3xl">🏆</div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500">
                    Aún no tienes logros. ¡Juega para desbloquearlos!
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {achievements.map((ach) => {
                    const withDef = ach as AchievementWithDef
                    return (
                      <div
                        key={ach.id}
                        className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:border-yellow-500/20"
                      >
                        <span className="text-2xl leading-none">{ach.icon || '🏆'}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate text-sm font-semibold text-white">
                              {ach.achievement_name}
                            </div>
                            {withDef.rarity && (
                              <span
                                className={`shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider ${
                                  RARITY_STYLES[withDef.rarity] ?? RARITY_STYLES.common
                                }`}
                              >
                                {withDef.rarity}
                              </span>
                            )}
                          </div>
                          <div className="truncate text-xs text-zinc-500">
                            {ach.achievement_description}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-700">
                            <span>
                              {new Date(ach.unlocked_at).toLocaleDateString('es-CL', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            {withDef.xp_reward ? (
                              <span className="text-yellow-500/70">· +{withDef.xp_reward} XP</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        </main>

        <footer className="border-t border-white/[0.06] py-6 text-center text-[10px] uppercase tracking-wider text-zinc-700">
          © 2026 Juega Hip Hop · Un proyecto de Infinity Force Company
        </footer>
      </div>
    </div>
  )
}
