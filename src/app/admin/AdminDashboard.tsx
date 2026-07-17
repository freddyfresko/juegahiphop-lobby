'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useCallback } from 'react'
import { setGameStatus, deleteGame, reorderGames } from '@/lib/admin-actions'
import BannerManager from './BannerManager'
import type { GameCatalogEntry, Banner } from '@/lib/types'

interface AdminDashboardProps {
  games: GameCatalogEntry[]
  banners: Banner[]
  userEmail: string
}

const STATUS_CONFIG: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  active:      { label: 'Activo',        icon: '▶', bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  beta:        { label: 'Beta',          icon: '🧪', bg: 'bg-sky-500/15',    text: 'text-sky-400' },
  coming_soon: { label: 'Próximamente',  icon: '🔥', bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  maintenance: { label: 'Mantención',    icon: '🔧', bg: 'bg-orange-500/15', text: 'text-orange-400' },
  hidden:      { label: 'Oculto',        icon: '👁', bg: 'bg-zinc-500/15',   text: 'text-zinc-400' },
}

const STATUS_ORDER = ['coming_soon', 'beta', 'active', 'maintenance', 'hidden']

export default function AdminDashboard({ games, banners, userEmail }: AdminDashboardProps) {
  const router = useRouter()
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const showMsg = useCallback((type: 'ok' | 'err', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }, [])

  const handleStatusToggle = async (slug: string, currentStatus: string) => {
    const nextStatus = STATUS_ORDER[(STATUS_ORDER.indexOf(currentStatus) + 1) % STATUS_ORDER.length]
    try {
      await setGameStatus(slug, nextStatus as GameCatalogEntry['status'])
      showMsg('ok', `${STATUS_CONFIG[nextStatus]?.icon} Estado → ${STATUS_CONFIG[nextStatus]?.label}`)
      router.refresh()
    } catch (e) {
      showMsg('err', (e as Error).message)
    }
  }

  const handleDelete = async (slug: string) => {
    try {
      await deleteGame(slug)
      showMsg('ok', '🗑 Juego eliminado')
      router.refresh()
    } catch (e) {
      showMsg('err', (e as Error).message)
    }
    setConfirmDelete(null)
  }

  const handleMove = async (index: number, direction: -1 | 1) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= games.length) return

    const reordered = [...games]
    ;[reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]]

    try {
      await reorderGames(reordered.map((g) => g.slug))
      showMsg('ok', '📦 Orden actualizado')
      router.refresh()
    } catch (e) {
      showMsg('err', (e as Error).message)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* ─── Top bar ─── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 group">
            <svg className="h-4 w-4 text-yellow-400 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 19l2-12 4 3 4-5 4 5 4-3 2 12H2zM12 5l-3 4 3-1 3 1-3-4z"/>
            </svg>
            <span className="font-archivo text-base tracking-wide text-white">
              ADMIN
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-[10px] tracking-wider text-zinc-600">{userEmail}</span>
            <Link
              href="/"
              className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 transition-colors hover:border-yellow-500/30 hover:text-yellow-400"
            >
              LOBBY
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* ─── Toast ─── */}
        {message && (
          <div
            className={`mb-5 animate-fade-in rounded-xl border px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-all ${
              message.type === 'ok'
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                : 'border-red-500/20 bg-red-500/10 text-red-400'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* ─── Header ─── */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-archivo text-xl tracking-wide text-white sm:text-2xl">
              CATÁLOGO DE <span className="text-yellow-400">JUEGOS</span>
            </h1>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-600">
              {games.length} juego{games.length !== 1 ? 's' : ''} · Click en estado para cambiar
            </p>
          </div>
          <Link
            href="/admin/games/new"
            className="flex items-center gap-1.5 rounded-xl bg-yellow-400 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-yellow-300 active:scale-[0.97]"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            NUEVO
          </Link>
        </div>

        {/* ─── Game Cards Grid ─── */}
        {games.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.06] py-20">
            <div className="mb-3 text-4xl">🎮</div>
            <p className="text-xs uppercase tracking-wider text-zinc-500">No hay juegos en el catálogo</p>
            <Link
              href="/admin/games/new"
              className="mt-4 rounded-xl bg-yellow-400 px-5 py-2.5 text-xs font-bold text-black transition-colors hover:bg-yellow-300"
            >
              CREAR PRIMER JUEGO
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {games.map((game, index) => {
              const statusStyle = STATUS_CONFIG[game.status] || STATUS_CONFIG.hidden
              const isHovered = hoveredCard === game.slug

              return (
                <div
                  key={game.id}
                  className={`group relative overflow-hidden rounded-2xl border transition-all duration-200 ${
                    isHovered ? 'border-white/[0.12] shadow-lg shadow-black/40' : 'border-white/[0.06]'
                  }`}
                  style={{
                    background: `linear-gradient(180deg, ${game.color}12 0%, transparent 100%)`,
                  }}
                  onMouseEnter={() => setHoveredCard(game.slug)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  {/* ─── Cover / Placeholder ─── */}
                  <Link href={`/admin/games/${game.slug}`} className="block">
                    <div className="relative aspect-[16/9] w-full overflow-hidden">
                      {game.image_url ? (
                        <img
                          src={game.image_url}
                          alt={game.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-white/[0.03]">
                          <span className="text-3xl opacity-40">{game.emoji}</span>
                        </div>
                      )}
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />

                      {/* Status badge */}
                      <div className={`absolute right-2 top-2 flex items-center gap-1 rounded-full px-2.5 py-1 ${statusStyle.bg}`}>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${statusStyle.text}`}>
                          {statusStyle.icon} {statusStyle.label}
                        </span>
                      </div>

                      {/* Sort order badge */}
                      <div className="absolute bottom-2 left-2 rounded-md bg-black/50 px-2 py-0.5 text-[10px] text-zinc-500 backdrop-blur-sm">
                        #{game.sort_order}
                      </div>
                    </div>
                  </Link>

                  {/* ─── Info ─── */}
                  <div className="p-3.5">
                    <Link href={`/admin/games/${game.slug}`} className="block">
                      <h3 className="font-archivo text-base tracking-wide text-white transition-colors hover:text-yellow-400">
                        {game.name}
                      </h3>
                      <p className="mt-1 line-clamp-1 text-[10px] uppercase tracking-wider text-zinc-500">
                        {game.short_description || 'Sin descripción'}
                      </p>
                      <p className="mt-0.5 font-mono text-[9px] text-zinc-700">{game.slug}</p>
                    </Link>

                    {/* ─── Actions ─── */}
                    <div className="mt-3 flex items-center gap-1.5 border-t border-white/[0.04] pt-3">
                      {/* Status toggle */}
                      <button
                        onClick={() => handleStatusToggle(game.slug, game.status)}
                        className={`flex-1 rounded-lg py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-all ${statusStyle.bg} ${statusStyle.text} hover:opacity-80 active:scale-[0.97]`}
                        title="Click para cambiar estado"
                      >
                        {statusStyle.icon} {statusStyle.label}
                      </button>

                      {/* Reorder buttons */}
                      <button
                        onClick={() => handleMove(index, -1)}
                        disabled={index === 0}
                        className="rounded-lg border border-white/[0.06] px-2 py-1.5 text-zinc-500 transition-colors hover:border-white/[0.12] hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                        title="Mover arriba"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.5l7.5-7.5 7.5 7.5" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleMove(index, 1)}
                        disabled={index === games.length - 1}
                        className="rounded-lg border border-white/[0.06] px-2 py-1.5 text-zinc-500 transition-colors hover:border-white/[0.12] hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                        title="Mover abajo"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.5l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>

                      {/* Delete */}
                      {confirmDelete === game.slug ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDelete(game.slug)}
                            className="rounded-lg bg-red-500/20 px-2 py-1.5 text-[10px] font-bold text-red-400 transition-colors hover:bg-red-500/30"
                          >
                            SÍ
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="rounded-lg border border-white/[0.06] px-2 py-1.5 text-[10px] text-zinc-500"
                          >
                            NO
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(game.slug)}
                          className="rounded-lg border border-transparent px-2 py-1.5 text-zinc-600 transition-colors hover:border-red-500/30 hover:text-red-400"
                          title="Eliminar"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ─── Banners Section ─── */}
        <BannerManager banners={banners} />

        {/* ─── Stats footer ─── */}
        <div className="mt-8 border-t border-white/[0.04] pt-4 text-center">
          <div className="flex items-center justify-center gap-6 text-[10px] text-zinc-600">
            <span>🟢 {games.filter((g) => g.status === 'active').length} activos</span>
            <span>🧪 {games.filter((g) => g.status === 'beta').length} beta</span>
            <span>🔥 {games.filter((g) => g.status === 'coming_soon').length} próximos</span>
            <span>🔧 {games.filter((g) => g.status === 'maintenance').length} en mantención</span>
            <span>👁 {games.filter((g) => g.status === 'hidden').length} ocultos</span>
          </div>
        </div>
      </main>
    </div>
  )
}
