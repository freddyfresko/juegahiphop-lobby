import LobbyClient from './LobbyClient'
import { createClient } from '@/lib/supabase/server'
import type { GameCatalogEntry, Banner } from '@/lib/types'
import { PUBLIC_GAME_CATALOG } from '@/lib/public-game-catalog'

/**
 * Home page — COMPLETAMENTE PÚBLICA.
 * 
 * No requiere autenticación. El catálogo de juegos se muestra
 * a todos los visitantes, incluyendo los próximos lanzamientos.
 * Los banners del hero se cargan desde la DB.
 * El perfil y progreso solo se cargan si hay sesión activa.
 */
export default async function HomePage() {
  const supabase = await createClient()

  // Traer juegos activos, beta Y coming_soon para mostrar en el lobby
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .in('status', ['active', 'beta', 'coming_soon'])
    .order('sort_order', { ascending: true })

  const publicGames = (games ?? []) as GameCatalogEntry[]

  // Traer banners activos para el hero
  const { data: banners } = await supabase
    .from('banners')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  return (
    <LobbyClient
      initialGames={publicGames.length > 0 ? publicGames : PUBLIC_GAME_CATALOG}
      initialBanners={(banners ?? []) as Banner[]}
    />
  )
}
