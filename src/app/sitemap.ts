import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PUBLIC_GAME_CATALOG } from '@/lib/public-game-catalog'
import { SITE_URL } from '@/lib/seo'
import type { GameCatalogEntry } from '@/lib/types'

/**
 * sitemap.xml dinámico — juegahiphop.cl
 *
 * URLs públicas indexables: home, ranking, privacidad y una URL por
 * juego jugable (active/beta/coming_soon). La DB es la fuente canónica;
 * si no responde, cae al catálogo público de respaldo.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/ranking`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/privacidad`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
  ]

  let games: GameCatalogEntry[] = PUBLIC_GAME_CATALOG
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('games')
      .select('slug, updated_at, status')
      .in('status', ['active', 'beta', 'coming_soon'])
      .order('sort_order', { ascending: true })
    if (data && data.length > 0) {
      games = data as GameCatalogEntry[]
    }
  } catch {
    // Sin DB (build sin env) → catálogo de respaldo
  }

  const gameRoutes: MetadataRoute.Sitemap = games
    .filter((g) => g.slug && g.status !== 'hidden')
    .map((game) => ({
      url: `${SITE_URL}/jugar/${game.slug}`,
      lastModified: game.updated_at ? new Date(game.updated_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    }))

  return [...staticRoutes, ...gameRoutes]
}
