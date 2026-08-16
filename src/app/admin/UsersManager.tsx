'use client'

import { useMemo, useState } from 'react'
import type { AdminUserRow, AdminUsersSummary, TrialStats } from '@/lib/types'

interface UsersManagerProps {
  summary: AdminUsersSummary
  users: AdminUserRow[]
  trials: TrialStats
  errors?: string[]
}

function formatPlaytime(seconds: number): string {
  if (!seconds || seconds <= 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${seconds}s`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

export default function UsersManager({ summary, users, trials, errors = [] }: UsersManagerProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        (u.display_name ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q),
    )
  }, [users, query])

  const kpis: { label: string; value: number; icon: string; color: string; sub?: string }[] = [
    { label: 'USUARIOS', value: summary.total_users ?? 0, icon: '👥', color: 'text-yellow-400', sub: `${summary.new_users_7d ?? 0} nuevos en 7d` },
    { label: 'HAN JUGADO', value: summary.users_with_plays ?? 0, icon: '🎮', color: 'text-emerald-400', sub: `${summary.users_no_plays ?? 0} aún sin jugar` },
    { label: 'PARTIDAS', value: summary.total_plays ?? 0, icon: '🕹', color: 'text-sky-400', sub: `${summary.completed_plays ?? 0} completadas` },
    { label: 'ACTIVOS HOY', value: summary.active_today ?? 0, icon: '⚡', color: 'text-orange-400', sub: `${summary.active_7d ?? 0} en 7d · ${summary.active_30d ?? 0} en 30d` },
    { label: 'PRUEBAS INVITADO', value: summary.trial_plays ?? 0, icon: '🎟', color: 'text-purple-400', sub: `${summary.trial_plays_today ?? 0} hoy · ${summary.trial_plays_7d ?? 0} en 7d` },
  ]

  const maxTrialDay = Math.max(1, ...trials.by_day.map((d) => d.plays))
  const maxTrialGame = Math.max(1, ...trials.by_game.map((g) => g.plays))

  return (
    <div>
      {/* ─── Header ─── */}
      <div className="mb-6">
        <h1 className="font-archivo text-xl tracking-wide text-white sm:text-2xl">
          JUGADORES <span className="text-yellow-400">👥</span>
        </h1>
        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-600">
          Usuarios con cuenta, actividad y pruebas de invitados
        </p>
      </div>

      {/* ─── Errores de RPC (diagnóstico visible) ─── */}
      {errors.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          {errors.map((e) => (
            <p key={e} className="text-[11px] font-semibold text-red-400">
              ⚠️ {e}
            </p>
          ))}
        </div>
      )}

      {/* ─── KPIs ─── */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <span className="text-lg">{k.icon}</span>
            </div>
            <div className={`mt-2 text-2xl font-black leading-none ${k.color}`}>
              {k.value.toLocaleString()}
            </div>
            <div className="mt-1.5 text-[9px] font-bold uppercase tracking-widest text-zinc-500">
              {k.label}
            </div>
            {k.sub && <div className="mt-0.5 text-[9px] text-zinc-600">{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* ─── Usuarios con cuenta ─── */}
      <section className="mb-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-archivo text-lg tracking-wide text-white">
              USUARIOS CON <span className="text-yellow-400">CUENTA</span>
            </h2>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-600">
              {filtered.length} de {users.length} usuarios
            </p>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o email…"
            className="w-full max-w-xs rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-yellow-500/40"
          />
        </div>

        {users.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.06] py-12 text-center">
            <div className="mb-2 text-3xl">👥</div>
            <p className="text-xs uppercase tracking-wider text-zinc-500">Sin usuarios todavía</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[9px] uppercase tracking-widest text-zinc-500">
                  <th className="px-3 py-2.5 font-semibold">Usuario</th>
                  <th className="px-3 py-2.5 font-semibold">Registro</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Nivel</th>
                  <th className="px-3 py-2.5 font-semibold text-right">XP</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Partidas</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Complet.</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Tiempo</th>
                  <th className="px-3 py-2.5 font-semibold">Última partida</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.03]"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-[10px] font-black text-black">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            (u.display_name || u.email || '?').charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-white">
                            {u.display_name || u.email?.split('@')[0] || '—'}
                          </div>
                          <div className="truncate text-[9px] text-zinc-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-zinc-400">{formatDate(u.registered_at)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-yellow-400">{u.level ?? 1}</td>
                    <td className="px-3 py-2.5 text-right text-zinc-300">
                      {(u.xp ?? 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right text-zinc-300">{u.plays_count ?? 0}</td>
                    <td className="px-3 py-2.5 text-right text-emerald-400">{u.completions ?? 0}</td>
                    <td className="px-3 py-2.5 text-right text-zinc-400">
                      {formatPlaytime(u.playtime_seconds ?? 0)}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-400">
                      {formatDateTime(u.last_session_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─── Invitados (pruebas) ─── */}
      <section>
        <h2 className="font-archivo text-lg tracking-wide text-white">
          INVITADOS <span className="text-yellow-400">(SIN CUENTA)</span>
        </h2>
        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-600">
          Partidas de prueba: 1 por navegador antes de pedir cuenta
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* Por juego */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Por juego
              </h3>
              <span className="text-[10px] text-zinc-500">
                {trials.totals.plays ?? 0} pruebas · {(trials.totals.unique_sessions ?? 0).toLocaleString()} navegadores únicos
              </span>
            </div>
            {trials.by_game.length === 0 ? (
              <p className="py-6 text-center text-[10px] uppercase tracking-wider text-zinc-600">
                Sin pruebas todavía — aparecen acá cuando un invitado juega su primera partida
              </p>
            ) : (
              <div className="space-y-2">
                {trials.by_game.map((g) => (
                  <div key={g.game_id} className="flex items-center gap-2">
                    <span className="w-32 truncate text-[10px] uppercase tracking-wider text-zinc-400">
                      {g.game_id}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                      <div
                        className="h-full rounded-full bg-yellow-400/70"
                        style={{ width: `${(g.plays / maxTrialGame) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-[10px] font-bold text-zinc-300">
                      {g.plays}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Por día (30d) */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Pruebas por día (últimos 30 días)
            </h3>
            {trials.by_day.length === 0 ? (
              <p className="py-6 text-center text-[10px] uppercase tracking-wider text-zinc-600">
                Sin actividad de invitados en los últimos 30 días
              </p>
            ) : (
              <div className="space-y-1.5">
                {trials.by_day.slice(-15).reverse().map((d) => (
                  <div key={d.day} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-[9px] text-zinc-500">
                      {formatDate(d.day)}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                      <div
                        className="h-full rounded-full bg-purple-400/70"
                        style={{ width: `${(d.plays / maxTrialDay) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-[10px] font-bold text-zinc-300">
                      {d.plays}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
