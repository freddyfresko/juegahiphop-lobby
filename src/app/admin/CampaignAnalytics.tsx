'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Tipos de la respuesta del RPC get_campaign_analytics ───

interface AnalyticsTotals {
  impressions: number
  clicks: number
  dismissals: number
  conversions: number
  unique_sessions: number
  ctr: number | null
}

interface DailyPoint {
  day: string // YYYY-MM-DD
  impressions: number
  clicks: number
  ctr: number | null
}

interface GroupRow {
  impressions: number
  clicks: number
  ctr: number | null
}

interface CampaignAnalyticsData {
  totals: AnalyticsTotals
  daily: (DailyPoint & { game_id?: never; placement?: never })[]
  by_game: (GroupRow & { game_id: string })[]
  by_placement: (GroupRow & { placement: string })[]
}

const RANGES = [
  { days: 7, label: '7D' },
  { days: 14, label: '14D' },
  { days: 30, label: '30D' },
]

// ─── Helpers ───

function fmt(n: number | null | undefined): string {
  if (n == null) return '0'
  return n.toLocaleString('es-CL')
}

function fmtCtr(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '0%'
  return `${n.toLocaleString('es-CL', { maximumFractionDigits: 2 })}%`
}

/** Días [desde, hoy] en UTC (matchea el agrupado por día del RPC) */
function lastDaysUTC(days: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i))
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

function placementLabel(p: string): string {
  const map: Record<string, string> = {
    lobby_home: 'Lobby — Home',
    lobby_catalog: 'Lobby — Catálogo',
    lobby_profile: 'Lobby — Perfil',
    lobby_rankings: 'Lobby — Rankings',
    game_loading: 'Juego — Cargando',
    game_results: 'Juego — Resultados',
    game_level_complete: 'Juego — Nivel completo',
    game_category_complete: 'Juego — Categoría completa',
    game_session_end: 'Juego — Fin de sesión',
    game_exit: 'Juego — Salida',
    rewarded_hint: 'Rewarded — Pista',
    rewarded_continue: 'Rewarded — Continuar',
    rewarded_bonus: 'Rewarded — Bonus',
  }
  return map[p] ?? p
}

// ─── Componente ───

export default function CampaignAnalytics() {
  const supabase = createClient()
  const [days, setDays] = useState(14)
  const [data, setData] = useState<CampaignAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    supabase
      .rpc('get_campaign_analytics', { p_days: days })
      .then(({ data: result, error: rpcError }) => {
        if (cancelled) return
        if (rpcError || !result) {
          setError(rpcError?.message ?? 'Error al cargar analytics')
          setData(null)
        } else {
          setData(result as unknown as CampaignAnalyticsData)
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, days, refreshKey])

  // Cambio de rango / reintentar: event handlers (permiten setLoading síncrono)
  const handleRange = useCallback((d: number) => {
    setLoading(true)
    setDays(d)
  }, [])

  const handleRetry = useCallback(() => {
    setLoading(true)
    setError(null)
    setRefreshKey((k) => k + 1)
  }, [])

  // Serie diaria completa (rellenar días sin data con 0)
  const daysUTC = lastDaysUTC(days)
  const byDay = new Map((data?.daily ?? []).map((d) => [d.day, d]))
  const series = daysUTC.map((day) => byDay.get(day) ?? { day, impressions: 0, clicks: 0, ctr: null })

  const maxImpressions = Math.max(1, ...series.map((s) => s.impressions))
  const maxClicks = Math.max(1, ...series.map((s) => s.clicks))
  const maxGroup = Math.max(
    1,
    ...(data?.by_game ?? []).map((g) => g.impressions),
    ...(data?.by_placement ?? []).map((g) => g.impressions),
  )

  const totals = data?.totals

  return (
    <div className="mt-10">
      {/* ─── Header ─── */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-archivo text-lg tracking-wide text-white">
            ANALYTICS <span className="text-yellow-400">CAMPAÑAS</span>
          </h2>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-600">
            Impresiones, clicks y CTR — sesiones anónimas incluidas
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => handleRange(r.days)}
              className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                days === r.days
                  ? 'bg-yellow-400 text-black'
                  : 'text-zinc-500 hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="rounded-xl border border-white/[0.06] py-10 text-center text-[10px] uppercase tracking-wider text-zinc-600">
          Cargando analytics…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-400">
          {error}
          <button onClick={handleRetry} className="ml-3 underline hover:text-red-300">
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-4">
          {/* ─── KPI cards ─── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: 'Impresiones', value: fmt(totals?.impressions), icon: '👁' },
              { label: 'Clicks', value: fmt(totals?.clicks), icon: '👆' },
              { label: 'CTR', value: fmtCtr(totals?.ctr), icon: '📈' },
              { label: 'Sesiones únicas', value: fmt(totals?.unique_sessions), icon: '🧑‍🎤' },
              { label: 'Dismissals', value: fmt(totals?.dismissals), icon: '✕' },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3"
              >
                <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                  {kpi.icon} {kpi.label}
                </p>
                <p className="mt-1 font-archivo text-xl tracking-wide text-white">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* ─── Serie diaria ─── */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Serie diaria ({days} días)
            </p>
            <div className="flex h-32 items-end gap-[3px]">
              {series.map((s) => (
                <div
                  key={s.day}
                  className="group relative flex flex-1 flex-col justify-end gap-[2px]"
                  title={`${s.day} — ${fmt(s.impressions)} impr · ${fmt(s.clicks)} clicks · ${fmtCtr(s.ctr)}`}
                >
                  {/* Clicks bar */}
                  <div
                    className="w-full rounded-sm bg-yellow-400/80 transition-opacity group-hover:opacity-100"
                    style={{ height: `${Math.max(2, (s.clicks / maxClicks) * 100)}%`, opacity: 0.9 }}
                  />
                  {/* Impressions bar */}
                  <div
                    className="w-full rounded-sm bg-zinc-500/40 transition-opacity group-hover:bg-zinc-500/60"
                    style={{ height: `${Math.max(4, (s.impressions / maxImpressions) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[8px] uppercase tracking-wider text-zinc-700">
              <span>{series[0]?.day?.slice(5)}</span>
              <span>{series[series.length - 1]?.day?.slice(5)}</span>
            </div>
            <div className="mt-3 flex gap-4 border-t border-white/[0.04] pt-2 text-[9px] uppercase tracking-wider text-zinc-600">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-zinc-500/40" /> Impresiones
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-yellow-400/80" /> Clicks
              </span>
            </div>
          </div>

          {/* ─── Top juegos + top placements ─── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Top juegos
              </p>
              {data.by_game.length === 0 ? (
                <p className="py-4 text-center text-[10px] uppercase tracking-wider text-zinc-700">
                  Sin data todavía
                </p>
              ) : (
                <div className="space-y-2">
                  {data.by_game.map((g) => (
                    <div key={g.game_id}>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="truncate pr-2 font-mono text-zinc-400">{g.game_id}</span>
                        <span className="shrink-0 text-zinc-600">
                          {fmt(g.impressions)} · {fmtCtr(g.ctr)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                        <div
                          className="h-full rounded-full bg-yellow-400/70"
                          style={{ width: `${(g.impressions / maxGroup) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Top placements
              </p>
              {data.by_placement.length === 0 ? (
                <p className="py-4 text-center text-[10px] uppercase tracking-wider text-zinc-700">
                  Sin data todavía
                </p>
              ) : (
                <div className="space-y-2">
                  {data.by_placement.map((p) => (
                    <div key={p.placement}>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="truncate pr-2 text-zinc-400">
                          {placementLabel(p.placement)}
                        </span>
                        <span className="shrink-0 text-zinc-600">
                          {fmt(p.impressions)} · {fmtCtr(p.ctr)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                        <div
                          className="h-full rounded-full bg-yellow-400/70"
                          style={{ width: `${(p.impressions / maxGroup) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="text-center text-[9px] uppercase tracking-wider text-zinc-700">
            Últimos {days} días · sesiones únicas = navegadores distintos (guests incluidos)
          </p>
        </div>
      )}
    </div>
  )
}
