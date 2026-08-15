'use client'

import { useRef, useState, useCallback } from 'react'
import type { GameCatalogEntry } from '@/lib/types'

interface GameCardProps {
  game: GameCatalogEntry
  progress?: {
    current: number
    total: number
    label: string
  } | null
}

const STATUS_LABELS: Record<string, { label: string; icon: string }> = {
  coming_soon: { label: 'PRÓXIMAMENTE', icon: '🔥' },
  maintenance: { label: 'EN MANTENCIÓN', icon: '🔧' },
}

/**
 * Tarjeta CUADRADA: la portada es la protagonista (aspect-square,
 * sin texto encima). Título + descripción viven en el pie, fuera
 * del cuadrado. Hover → zoom + glow del color del juego + botón JUGAR.
 */
export default function GameCard({ game, progress }: GameCardProps) {
  const cardRef = useRef<HTMLElement | null>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 })

  const isPlayable = game.status === 'active' || game.status === 'beta'
  const statusInfo = !isPlayable ? STATUS_LABELS[game.status] : null
  const accentColor = game.accent_color ?? game.color ?? '#7C3AED'
  const baseColor = game.color ?? '#7C3AED'
  const href = `/jugar/${game.slug}`
  const hasCover = !!game.image_url

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setGlowPos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
    })
  }, [])

  const handleMouseEnter = useCallback(() => setIsHovered(true), [])
  const handleMouseLeave = useCallback(() => setIsHovered(false), [])

  const progressPct = progress && progress.total > 0
    ? Math.min((progress.current / progress.total) * 100, 100)
    : 0

  const cardContent = (
    <>
      {/* ─── Glow que sigue al mouse ─── */}
      <div
        className="pointer-events-none absolute -inset-[2px] rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(420px circle at ${glowPos.x}% ${glowPos.y}%, ${accentColor}44 0%, transparent 70%)`,
          zIndex: 0,
        }}
      />

      {/* ─── Cuerpo de la tarjeta ─── */}
      <div
        className="relative overflow-hidden rounded-2xl border transition-all duration-300 ease-out group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-yellow-400"
        style={{
          borderColor: isHovered ? `${accentColor}77` : 'rgba(255,255,255,0.06)',
          boxShadow: isHovered
            ? `0 24px 70px rgba(0,0,0,0.6), 0 0 40px ${accentColor}2e, inset 0 1px 0 ${accentColor}2e`
            : '0 6px 24px rgba(0,0,0,0.35)',
          zIndex: 1,
        }}
      >
        {/* ═══ Portada (CUADRADA — la imagen es la protagonista, sin texto encima) ═══ */}
        <div className="relative aspect-square w-full overflow-hidden">
          {hasCover ? (
            <img
              src={`${game.image_url}?v=${new Date(game.updated_at).getTime()}`}
              alt={game.name}
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.08]"
              loading="lazy"
            />
          ) : (
            /* Fallback artístico cuando no hay portada: gradiente + emoji gigante */
            <div
              className="flex h-full w-full items-center justify-center"
              style={{
                background: `radial-gradient(circle at 30% 20%, ${baseColor}33 0%, transparent 60%), linear-gradient(160deg, ${baseColor}26 0%, #0a0a0a 70%)`,
              }}
            >
              <span
                className="text-7xl drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)] transition-transform duration-500 group-hover:scale-125"
                style={{ filter: `drop-shadow(0 0 30px ${accentColor}44)` }}
              >
                {game.emoji}
              </span>
            </div>
          )}

          {/* Gradiente sutil inferior para legibilidad del badge (sin tapar la imagen) */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0a0a0a]/50 to-transparent" />

          {/* Overlay hover con botón JUGAR */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-[2px] transition-opacity duration-300 group-hover:opacity-100">
            <div
              className="flex h-16 w-16 scale-75 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-100"
              style={{
                backgroundColor: `${accentColor}ee`,
                boxShadow: `0 0 0 8px ${accentColor}22, 0 0 40px ${accentColor}88`,
              }}
            >
              <svg className="ml-1 h-7 w-7 text-black" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>

          {/* Badge de estado */}
          {statusInfo && (
            <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 backdrop-blur-md">
              <span className="text-xs">{statusInfo.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">
                {statusInfo.label}
              </span>
            </div>
          )}
        </div>

        {/* ═══ Pie: título + descripción FUERA del cuadrado ═══ */}
        <div className="bg-[#0d0d0d] p-4">
          <div className="flex items-start justify-between gap-2">
            <h3
              className="font-archivo text-lg leading-tight tracking-wide"
              style={{ color: accentColor }}
            >
              {game.name}
            </h3>

            {/* Categoría / beta */}
            <div className="flex shrink-0 items-center gap-1.5">
              {game.category && game.category !== 'games' && (
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-300">
                  {game.category}
                </span>
              )}
              {game.status === 'beta' && (
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: `${accentColor}33`, color: accentColor }}
                >
                  Beta
                </span>
              )}
            </div>
          </div>

          <p className="mt-1 line-clamp-2 text-[11px] uppercase leading-relaxed tracking-wide text-zinc-500">
            {game.short_description}
          </p>

          {isPlayable && progress && progress.total > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-wider text-zinc-600">{progress.label}</span>
                <span className="text-[10px] font-bold" style={{ color: accentColor }}>
                  {progress.current}/{progress.total}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    backgroundColor: accentColor,
                    width: `${progressPct}%`,
                    boxShadow: isHovered ? `0 0 10px ${accentColor}77` : 'none',
                  }}
                />
              </div>
            </div>
          )}

          {game.status === 'coming_soon' && game.release_date && (
            <p className="mt-3 text-[10px] uppercase tracking-wider text-yellow-500/60">
              Disponible{' '}
              {new Date(game.release_date).toLocaleDateString('es-CL', {
                day: 'numeric',
                month: 'long',
              })}
            </p>
          )}
        </div>
      </div>
    </>
  )

  if (!isPlayable) {
    return (
      <div
        ref={(node) => { cardRef.current = node }}
        aria-label={`${game.name} no disponible`}
        aria-disabled="true"
        className="group relative w-full cursor-not-allowed text-left opacity-80 outline-none"
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {cardContent}
      </div>
    )
  }

  return (
    <a
      ref={(node) => { cardRef.current = node }}
      aria-label={`Jugar ${game.name}`}
      className="group relative block w-full cursor-pointer touch-manipulation text-left outline-none transition-transform active:scale-[0.985]"
      href={href}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {cardContent}
    </a>
  )
}
