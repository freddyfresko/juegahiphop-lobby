'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { GameCatalogEntry } from '@/lib/types'

interface RankingRow {
  user_id: string
  display_name: string
  avatar_url: string | null
  xp_total: number | string
  partidas: number | string
  completadas: number | string
  best_score?: number | string | null
  game_id?: string
  ultima_partida?: string | null
}

interface RankingProps {
  user: User | null
  games: GameCatalogEntry[]
}

const MEDALS = ['🥇', '🥈', '🥉']
const TOP_LIMIT = 25

function num(v: number | string | null | undefined): number {
  return Number(v ?? 0) || 0
}

export default function Ranking({ user, games }: RankingProps) {
  const [tab, setTab] = useState<'general' | 'juego'>('general')
  const [selectedGame, setSelectedGame] = useState<string>('')
  const [rows, setRows] = useState<RankingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Juegos disponibles para el selector (solo los que se pueden jugar)
  const playableGames = useMemo(
    () => games.filter((g) => g.status === 'active' || g.status === 'beta'),
    [games],
  )

  // Juego efectivo: el seleccionado, o el primero disponible por defecto
  const effectiveGame = selectedGame || playableGames[0]?.slug || ''

  useEffect(() => {
    if (tab === 'juego' && !effectiveGame) return
    let cancelled = false
    const supabase = createClient()

    ;(async () => {
      try {
        const query =
          tab === 'general'
            ? supabase
                .from('ranking_general')
                .select('*')
                .order('xp_total', { ascending: false })
                .limit(TOP_LIMIT)
            : supabase
                .from('ranking_por_juego')
                .select('*')
                .eq('game_id', effectiveGame)
                .order('best_score', { ascending: false })
                .limit(TOP_LIMIT)

        const { data, error: err } = await query
        if (cancelled) return
        if (err) {
          // La vista aún no existe (migración 00014 sin correr)
          console.warn('[Ranking] error:', err.message)
          setError('El ranking aún no está disponible. ¡Sé el primero en jugar!')
          setRows([])
        } else {
          setRows((data ?? []) as RankingRow[])
          setError(null)
        }
      } catch (e) {
        if (cancelled) return
        console.warn('[Ranking] excepción:', e)
        setError('No se pudo cargar el ranking.')
        setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [tab, effectiveGame])

  return (
    <section className="mb-10">
      {/* Header + tabs */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-archivo text-xl tracking-wide text-white sm:text-2xl">
          RANKING <span className="text-yellow-400">🏆</span>
        </h2>

        <div className="flex overflow-hidden rounded-xl border border-white/[0.08]">
          {([
            { key: 'general', label: 'GENERAL' },
            { key: 'juego', label: 'POR JUEGO' },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key)
                setLoading(true)
                setError(null)
              }}
              type="button"
              className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                tab === t.key
                  ? 'bg-yellow-400/15 text-yellow-400'
                  : 'bg-white/[0.02] text-zinc-500 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Selector de juego (tab por juego) */}
      {tab === 'juego' && playableGames.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {playableGames.map((g) => (
            <button
              key={g.slug}
              onClick={() => {
                setSelectedGame(g.slug)
                setLoading(true)
                setError(null)
              }}
              type="button"
              className={`rounded-full border px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                effectiveGame === g.slug
                  ? 'border-yellow-400/50 bg-yellow-400/15 text-yellow-400'
                  : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-white'
              }`}
            >
              {g.emoji} {g.name}
            </button>
          ))}
        </div>
      )}

      {/* Contenido */}
      {loading ? (
        <div className="flex items-center justify-center py-14">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-yellow-400/30 border-t-yellow-400" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-dashed border-white/[0.06] p-10 text-center">
          <div className="mb-2 text-3xl">🏆</div>
          <p className="text-xs uppercase tracking-wider text-zinc-500">{error}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.06] p-10 text-center">
          <div className="mb-2 text-3xl">🎮</div>
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            {tab === 'general'
              ? 'Aún no hay partidas registradas. ¡Sé el primero en jugar!'
              : 'Sin partidas en este juego todavía. ¡Dale!'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          {rows.map((row, i) => {
            const isMe = user != null && row.user_id === user.id
            return (
              <div
                key={`${tab === 'juego' ? row.game_id : 'g'}-${row.user_id}`}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  i > 0 ? 'border-t border-white/[0.04]' : ''
                } ${isMe ? 'bg-yellow-400/[0.07]' : 'hover:bg-white/[0.03]'}`}
              >
                {/* Posición */}
                <div className="w-8 shrink-0 text-center text-base font-black">
                  {i < 3 ? (
                    <span className="text-lg">{MEDALS[i]}</span>
                  ) : (
                    <span className="text-zinc-600">{i + 1}</span>
                  )}
                </div>

                {/* Avatar / inicial */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 text-xs font-black text-white">
                  {row.avatar_url ? (
                    <img src={row.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (row.display_name || '?').charAt(0).toUpperCase()
                  )}
                </div>

                {/* Nombre */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`truncate text-sm font-semibold ${isMe ? 'text-yellow-400' : 'text-white'}`}>
                      {row.display_name || 'Jugador'}
                    </span>
                    {isMe && (
                      <span className="shrink-0 rounded-full bg-yellow-400/20 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-yellow-400">
                        TÚ
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                    {num(row.partidas)} partidas · {num(row.completadas)} completadas
                  </div>
                </div>

                {/* Métrica principal */}
                <div className="shrink-0 text-right">
                  <div className={`text-base font-black ${isMe ? 'text-yellow-400' : 'text-white'}`}>
                    {tab === 'general'
                      ? num(row.xp_total).toLocaleString()
                      : num(row.best_score).toLocaleString()}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-zinc-600">
                    {tab === 'general' ? 'XP total' : 'Best score'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
