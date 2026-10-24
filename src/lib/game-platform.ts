import type { GameCatalogEntry } from '@/lib/types'

/**
 * Plataforma de un juego.
 *
 * - `mobile` → se juega desde el teléfono (touch, vertical)
 * - `pc`     → requiere teclado y mouse (pantalla grande)
 * - `both`   → anda bien en las dos
 */
export type GamePlatform = 'mobile' | 'pc' | 'both'

/**
 * Juegos que son de PC aunque la DB todavía no tenga la columna `platform`.
 *
 * La fuente canónica sigue siendo la tabla `games`: si la fila trae
 * `platform` ('pc' | 'mobile' | 'both') ese valor MANDA. Esta lista es
 * solo el fallback para cuando la columna no existe o viene en null.
 */
const PC_SLUGS: ReadonlySet<string> = new Set(['graffiti-hh'])

export function getGamePlatform(game: Pick<GameCatalogEntry, 'slug'> & { platform?: string | null }): GamePlatform {
  const declared = game.platform
  if (declared === 'pc' || declared === 'mobile' || declared === 'both') return declared
  return PC_SLUGS.has(game.slug) ? 'pc' : 'mobile'
}

/** Se juega (también) en el teléfono. */
export function isMobileGame(game: GameCatalogEntry): boolean {
  const platform = getGamePlatform(game)
  return platform === 'mobile' || platform === 'both'
}

/** Se juega (también) en PC. */
export function isPcGame(game: GameCatalogEntry): boolean {
  const platform = getGamePlatform(game)
  return platform === 'pc' || platform === 'both'
}
