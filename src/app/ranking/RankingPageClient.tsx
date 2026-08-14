'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import Ranking from '@/components/Ranking'
import type { GameCatalogEntry } from '@/lib/types'
import type { User } from '@supabase/supabase-js'

export default function RankingPageClient({ games }: { games: GameCatalogEntry[] }) {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u)).catch(() => {})
  }, [])

  return (
    <div className="vignette brick-bg graffiti-spray min-h-dvh">
      <Sidebar user={user} />

      <div className="relative z-10 flex min-h-dvh flex-col content-with-rail">
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <div className="animate-fade-in-up">
            {/* Page header */}
            <div className="mb-8">
              <h1 className="font-archivo text-3xl tracking-wide text-white sm:text-4xl">
                RANKING <span className="text-yellow-400">🏆</span>
              </h1>
              <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500">
                La competencia está servida. ¿Dónde quedas tú?
              </p>
            </div>

            <Ranking user={user} games={games} />
          </div>
        </main>

        <footer className="border-t border-white/[0.06] py-6 text-center text-[10px] uppercase tracking-wider text-zinc-700">
          © 2026 Juega Hip Hop
        </footer>
      </div>
    </div>
  )
}
