import type { GameCatalogEntry } from '@/lib/types'

/**
 * Catálogo público de respaldo.
 *
 * Mantiene el lobby y rutas /jugar funcionando para invitados aunque la policy
 * remota de Supabase todavía no exponga `games` a `anon`.
 * La fuente canónica sigue siendo la tabla `games`; esto replica el seed público.
 */
export const PUBLIC_GAME_CATALOG: GameCatalogEntry[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    slug: 'sopa',
    name: 'Sopa de Knowledge',
    emoji: '🔤',
    short_description: 'Demuestra cuánto sabes de la cultura hip hop en cada ronda.',
    description: 'Sopa de letras con 930 conceptos del hip hop. Encuentra palabras sobre rap, DJ, breakdance, graffiti y más.',
    image_url: null,
    color: '#10B981',
    accent_color: '#059669',
    status: 'active',
    featured: true,
    orientation: 'portrait',
    external_url: 'https://sopa.juegahiphop.cl',
    category: 'games',
    sort_order: 1,
    total_items: 930,
    progress_label: 'Palabras',
    allowed_origins: ['https://sopa.juegahiphop.cl'],
    release_date: null,
    updated_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    slug: 'puzzle',
    name: 'Puzzle H2',
    emoji: '🧩',
    short_description: 'Arma el puzzle, descubre leyendas del hip hop.',
    description: 'Rompecabezas con imágenes icónicas del hip hop. Arma las piezas y aprende historia mientras juegas.',
    image_url: null,
    color: '#7C3AED',
    accent_color: '#6D28D9',
    status: 'active',
    featured: true,
    orientation: 'landscape',
    external_url: 'https://puzzle.juegahiphop.cl',
    category: 'games',
    sort_order: 2,
    total_items: null,
    progress_label: 'Completados',
    allowed_origins: ['https://puzzle.juegahiphop.cl'],
    release_date: null,
    updated_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    slug: 'fighters',
    name: 'Hip Hop Fighters',
    emoji: '🥊',
    short_description: 'Enfrenta a los mejores en batallas épicas de hip hop.',
    description: "Beat 'em up 2D con personajes del hip hop. pelea a través de escenarios icónicos y derrota a los bosses.",
    image_url: null,
    color: '#EF4444',
    accent_color: '#DC2626',
    status: 'active',
    featured: true,
    orientation: 'landscape',
    external_url: 'https://fighters.juegahiphop.cl',
    category: 'games',
    sort_order: 3,
    total_items: null,
    progress_label: 'Niveles',
    allowed_origins: ['https://fighters.juegahiphop.cl'],
    release_date: null,
    updated_at: '2025-01-01T00:00:00.000Z',
  },
]

export function getPublicGameBySlug(slug: string): GameCatalogEntry | null {
  return PUBLIC_GAME_CATALOG.find((game) => game.slug === slug) ?? null
}
