import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import RankingPageClient from './RankingPageClient'
import type { GameCatalogEntry } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Ranking',
  description:
    'Ranking de Juega Hip Hop: los mejores jugadores, puntajes y XP de la comunidad. ¿Estás en el top?',
  alternates: {
    canonical: '/ranking',
  },
}

export default async function RankingPage() {
  const supabase = await createClient()

  // Juegos jugables para el selector del ranking por juego
  const { data: games } = await supabase
    .from('games')
    .select('slug, name, emoji, color, accent_color, image_url, updated_at, status')
    .in('status', ['active', 'beta'])
    .order('sort_order', { ascending: true })

  return <RankingPageClient games={(games ?? []) as GameCatalogEntry[]} />
}
