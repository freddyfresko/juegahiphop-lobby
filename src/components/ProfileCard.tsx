'use client'

import type { PlayerProfile } from '@/lib/types'

interface ProfileCardProps {
  profile: PlayerProfile | null
  loading?: boolean
}

function getLevelLabel(level: number): string {
  if (level >= 50) return '🎤 Leyenda'
  if (level >= 30) return '💎 Diamante'
  if (level >= 20) return '🥇 Oro'
  if (level >= 10) return '🥈 Plata'
  if (level >= 5) return '🥉 Bronce'
  if (level >= 2) return '🟢 Novato'
  return '⚫ Principiante'
}

function xpForNextLevel(level: number): number {
  return level * 500
}

export default function ProfileCard({ profile, loading }: ProfileCardProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 sm:p-6 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-white/5" />
          <div className="space-y-2 flex-1">
            <div className="h-5 w-32 rounded bg-white/5" />
            <div className="h-3 w-24 rounded bg-white/5" />
          </div>
        </div>
      </div>
    )
  }

  if (!profile) return null

  const levelXp = profile.xp % xpForNextLevel(profile.level)
  const neededXp = xpForNextLevel(profile.level)

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent p-5 sm:p-6">
      {/* Top row: avatar + level badge */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-lg font-black text-black shadow-lg shadow-yellow-500/20">
            {profile.level}
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-500">Nivel {profile.level}</div>
            <div className="text-lg font-bold text-white">
              {getLevelLabel(profile.level)}
            </div>
          </div>
        </div>

        {/* Streak */}
        {profile.current_streak > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 px-3 py-1.5">
            <span className="text-sm">🔥</span>
            <span className="text-sm font-bold text-orange-400">{profile.current_streak}</span>
          </div>
        )}
      </div>

      {/* XP Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-zinc-500">XP</span>
          <span className="text-xs font-medium text-zinc-400">
            {profile.xp.toLocaleString()} XP
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-purple-500 transition-all duration-500"
            style={{ width: `${(levelXp / neededXp) * 100}%` }}
          />
        </div>
        <div className="mt-1 text-[11px] text-zinc-600">
          {levelXp.toLocaleString()} / {neededXp.toLocaleString()} XP para nivel {profile.level + 1}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
          <div className="text-xs text-zinc-500 mb-0.5">Juegos</div>
          <div className="text-lg font-bold text-white">{profile.total_games_completed}</div>
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
          <div className="text-xs text-zinc-500 mb-0.5">Racha</div>
          <div className="text-lg font-bold text-white">
            {profile.current_streak > 0 ? (
              <span className="text-orange-400">{profile.current_streak} 🔥</span>
            ) : (
              <span className="text-zinc-500">—</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
