'use client'

import type { GameCatalogEntry } from '@/lib/types'

import { useRouter } from 'next/navigation'

interface GameCardProps {
  game: GameCatalogEntry
  progress?: {
    current: number
    total: number
    label: string
  } | null
}

/**
 * Deriva clases Tailwind desde el color hex del juego.
 * Como Tailwind no permite clases dinámicas, usamos inline styles
 * para los colores y clases base para el layout.
 */
function useGameTheme(color: string, accentColor?: string | null) {
  const base = color ?? '#7C3AED'
  const accent = accentColor ?? base
  return {
    borderColor: `${base}33`,
    bgGradient: `linear-gradient(135deg, ${base}1a 0%, transparent 100%)`,
    iconBg: `${base}22`,
    btnBg: base,
    accentColor: accent,
    btnHover: `${base}dd`,
  }
}

/** Traducción de status a texto visible */
const STATUS_LABELS: Record<string, { label: string; icon: string }> = {
  coming_soon: { label: 'PRÓXIMAMENTE', icon: '🔥' },
  maintenance: { label: 'EN MANTENCIÓN', icon: '🔧' },
}

export default function GameCard({ game, progress }: GameCardProps) {
  const router = useRouter()
  const theme = useGameTheme(game.color, game.accent_color)
  const isPlayable = game.status === 'active' || game.status === 'beta'
  const statusInfo = !isPlayable ? STATUS_LABELS[game.status] : null

  const handlePlay = () => {
    if (!isPlayable) return
    router.push(`/jugar/${game.slug}`)
  }

  return (
    <div
      className={`game-card group relative flex flex-col overflow-hidden rounded-2xl border ${
        isPlayable ? 'hover:shadow-xl hover:shadow-black/60 cursor-pointer' : ''
      }`}
      style={{
        borderColor: theme.borderColor,
        background: theme.bgGradient,
      }}
    >
      {/* ─── Cover image ─── */}
      {game.image_url && (
        <div className="relative aspect-[16/9] w-full overflow-hidden">
          <img
            src={`${game.image_url}?v=${new Date(game.updated_at).getTime()}`}
            alt={game.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />

          {/* Status badge sobre la imagen */}
          {statusInfo && (
            <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 backdrop-blur-sm">
              <span className="text-xs">{statusInfo.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">
                {statusInfo.label}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ─── Top accent bar (solo si no hay imagen de portada) ─── */}
      {!game.image_url && (
        <div
          className="h-1 w-full shrink-0"
          style={{ backgroundColor: theme.iconBg }}
        />
      )}

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {/* Icon + Title row */}
        <div className="mb-3 flex items-center gap-3">
          {!game.image_url && (
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: theme.iconBg }}
            >
              <span className="text-lg">{game.emoji}</span>
            </div>
          )}
          <h3
            className="font-archivo text-lg tracking-wide"
            style={{ color: theme.accentColor }}
          >
            {game.name}
          </h3>
        </div>

        {/* Description */}
        <p className="mb-4 text-xs leading-relaxed text-zinc-400 flex-1 uppercase tracking-wide">
          {game.short_description}
        </p>

        {/* Progress bar (solo para juegos activos) */}
        {isPlayable && progress && progress.total > 0 && (
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">{progress.label}</span>
              <span className="text-xs font-bold" style={{ color: theme.accentColor }}>
                {progress.current}/{progress.total}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  backgroundColor: game.color,
                  width: `${Math.min((progress.current / progress.total) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Release date for coming_soon */}
        {game.status === 'coming_soon' && game.release_date && (
          <p className="mb-4 text-[10px] uppercase tracking-wider text-yellow-500/60">
            Disponible {new Date(game.release_date).toLocaleDateString('es-CL', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}

        {/* Action button */}
        {isPlayable ? (
          <button
            onClick={handlePlay}
            className="play-btn mt-auto flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-black transition-all active:scale-[0.97]"
            style={{ backgroundColor: theme.btnBg }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.btnHover }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.btnBg }}
          >
            <span>JUGAR</span>
            <svg className="h-3.5 w-3.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </button>
        ) : (
          <div className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {statusInfo?.label || 'NO DISPONIBLE'}
          </div>
        )}
      </div>
    </div>
  )
}
