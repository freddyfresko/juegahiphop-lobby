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

export default function GameCard({ game, progress }: GameCardProps) {
  const cardRef = useRef<HTMLElement | null>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 })

  const isPlayable = game.status === 'active' || game.status === 'beta'
  const statusInfo = !isPlayable ? STATUS_LABELS[game.status] : null
  const accentColor = game.accent_color ?? game.color ?? '#7C3AED'
  const baseColor = game.color ?? '#7C3AED'
  const href = `/jugar/${game.slug}`

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const card = cardRef.current
    if (!card) return

    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const tiltX = ((y - centerY) / centerY) * -6
    const tiltY = ((x - centerX) / centerX) * 6
    setTilt({ x: tiltX, y: tiltY })

    setGlowPos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 })
    setIsHovered(false)
  }, [])

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true)
  }, [])

  const progressPct = progress && progress.total > 0
    ? Math.min((progress.current / progress.total) * 100, 100)
    : 0

  const cardContent = (
    <>
      {/* ─── Glow background (sigue al mouse) ─── */}
      <div
        className="pointer-events-none absolute -inset-[2px] rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(400px circle at ${glowPos.x}% ${glowPos.y}%, ${accentColor}55 0%, transparent 70%)`,
          zIndex: 0,
        }}
      />

      {/* ─── Card body ─── */}
      <div
        className="relative rounded-2xl border transition-all duration-200 ease-out group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-yellow-400"
        style={{
          transform: isHovered
            ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(-4px)`
            : 'rotateX(0deg) rotateY(0deg) translateY(0px)',
          borderColor: isHovered ? `${accentColor}66` : `${baseColor}22`,
          background: isHovered
            ? `linear-gradient(135deg, ${baseColor}22 0%, transparent 100%)`
            : `linear-gradient(135deg, ${baseColor}12 0%, transparent 100%)`,
          boxShadow: isHovered
            ? `0 20px 60px rgba(0,0,0,0.5), 0 0 30px ${accentColor}22, inset 0 1px 0 ${accentColor}22`
            : '0 4px 20px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          zIndex: 1,
        }}
      >
        {/* ─── Cover image ─── */}
        {game.image_url && (
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-2xl">
            <img
              src={`${game.image_url}?v=${new Date(game.updated_at).getTime()}`}
              alt={game.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/30 to-transparent" />

            {/* Status badge */}
            {statusInfo && (
              <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 backdrop-blur-md">
                <span className="text-xs">{statusInfo.icon}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">
                  {statusInfo.label}
                </span>
              </div>
            )}

            {/* Play overlay en hover */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: `${accentColor}dd` }}
              >
                <svg className="ml-0.5 h-6 w-6 text-black" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>

            {/* Bottom gradient para texto */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent p-4 pt-12">
              <h3
                className="font-archivo text-lg tracking-wide"
                style={{ color: accentColor }}
              >
                {game.name}
              </h3>
            </div>
          </div>
        )}

        {/* ─── Sin imagen ─── */}
        {!game.image_url && (
          <div className="p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${accentColor}22` }}
              >
                <span className="text-xl">{game.emoji}</span>
              </div>
              <h3
                className="font-archivo text-lg tracking-wide"
                style={{ color: accentColor }}
              >
                {game.name}
              </h3>
            </div>
          </div>
        )}

        {/* ─── Contenido inferior ─── */}
        <div className="p-5 pt-3 sm:p-6">
          {/* Description */}
          <p className="line-clamp-2 text-xs uppercase leading-relaxed tracking-wide text-zinc-400">
            {game.short_description}
          </p>

          {/* Progress bar */}
          {isPlayable && progress && progress.total > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">{progress.label}</span>
                <span className="text-xs font-bold" style={{ color: accentColor }}>
                  {progress.current}/{progress.total}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    backgroundColor: accentColor,
                    width: `${progressPct}%`,
                    boxShadow: isHovered ? `0 0 8px ${accentColor}66` : 'none',
                  }}
                />
              </div>
            </div>
          )}

          {/* Release date */}
          {game.status === 'coming_soon' && game.release_date && (
            <p className="mt-3 text-[10px] uppercase tracking-wider text-yellow-500/60">
              Disponible {new Date(game.release_date).toLocaleDateString('es-CL', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}

          {/* Action button visual */}
          <div className="mt-4">
            {isPlayable ? (
              <div
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all duration-300"
                style={{
                  borderColor: accentColor,
                  color: isHovered ? '#000' : accentColor,
                  backgroundColor: isHovered ? accentColor : `${accentColor}18`,
                  boxShadow: isHovered
                    ? `0 0 20px ${accentColor}66, 0 0 60px ${accentColor}22, inset 0 0 20px ${accentColor}22`
                    : `0 0 0px transparent`,
                }}
              >
                <span>JUGAR</span>
                <svg className="h-3.5 w-3.5 transition-transform group-hover:scale-110" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            ) : (
              <div className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {statusInfo?.label || 'NO DISPONIBLE'}
              </div>
            )}
          </div>
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
        style={{ perspective: '1000px' }}
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
      style={{ perspective: '1000px' }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {cardContent}
    </a>
  )
}
