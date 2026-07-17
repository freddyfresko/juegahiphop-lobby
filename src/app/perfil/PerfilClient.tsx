'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/Header'
import type { PlayerProfile, AchievementUnlock } from '@/lib/types'
import type { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

interface PerfilClientProps {
  userId: string
}

export default function PerfilClient({ userId }: PerfilClientProps) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [achievements, setAchievements] = useState<AchievementUnlock[]>([])
  const [loading, setLoading] = useState(true)

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
        .single(),
      supabase
        .from('achievement_unlocks')
        .select('*')
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false }),
    ]).then(([profileRes, achievementsRes]) => {
      setProfile(profileRes.data as PlayerProfile | null)
      setAchievements(achievementsRes.data as AchievementUnlock[] ?? [])
      setLoading(false)
    })
  }, [userId])

  const handleSignOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }, [router])

  if (loading) {
    return (
      <div className="vignette brick-bg flex min-h-dvh flex-col">
        <div className="relative z-10 flex min-h-dvh flex-col">
          <Header user={null} />
          <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
            <div className="animate-pulse space-y-6">
              <div className="h-10 w-48 rounded bg-white/5" />
              <div className="h-32 rounded-2xl bg-white/[0.03]" />
              <div className="h-24 rounded-2xl bg-white/[0.03]" />
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="vignette brick-bg graffiti-spray flex min-h-dvh flex-col">
      <div className="relative z-10 flex min-h-dvh flex-col">
        <Header user={user} profile={profile} />

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
          <div className="animate-fade-in-up">
            {/* Page header */}
            <div className="mb-8 flex items-start justify-between">
              <div>
                <h1 className="font-archivo text-3xl tracking-wide text-white sm:text-4xl">
                  MI <span className="text-yellow-400">PERFIL</span>
                </h1>
                <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500">
                  {user?.email}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-red-400 transition-colors hover:bg-red-500/20"
              >
                Salir
              </button>
            </div>

            {/* Stats Grid */}
            <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'NIVEL', value: profile?.level ?? 1, color: 'text-yellow-400' },
                { label: 'XP TOTAL', value: profile?.xp?.toLocaleString() ?? '0', color: 'text-purple-400' },
                { label: 'RACHA', value: profile?.current_streak ?? 0, color: 'text-orange-400', suffix: profile?.current_streak ? ' 🔥' : '' },
                { label: 'JUEGOS', value: profile?.total_games_completed ?? 0, color: 'text-emerald-400' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center"
                >
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                    {stat.label}
                  </div>
                  <div className={`text-2xl font-bold ${stat.color}`}>
                    {stat.value}{stat.suffix || ''}
                  </div>
                </div>
              ))}
            </div>

            {/* Activity */}
            {profile?.last_played_date && (
              <div className="mb-8 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400">
                  <span className="text-yellow-400">🕐</span>
                  <span>
                    Última partida:{' '}
                    {new Date(profile.last_played_date).toLocaleDateString('es-CL', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            )}

            {/* Achievements */}
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
                  {achievements.map((ach) => (
                    <div
                      key={ach.id}
                      className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:border-yellow-500/20"
                    >
                      <span className="text-2xl">{ach.icon || '🏆'}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-white truncate">
                          {ach.achievement_name}
                        </div>
                        <div className="text-xs text-zinc-500 truncate">
                          {ach.achievement_description}
                        </div>
                        <div className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-700">
                          {new Date(ach.unlocked_at).toLocaleDateString('es-CL')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>

        <footer className="border-t border-white/[0.06] py-6 text-center text-[10px] uppercase tracking-wider text-zinc-700">
          © 2025 Juega Hip Hop
        </footer>
      </div>
    </div>
  )
}
