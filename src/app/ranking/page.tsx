import { createClient } from '@/lib/supabase/server'
import RankingPageClient from './RankingPageClient'
import type { GameCatalogEntry } from '@/lib/types'

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
