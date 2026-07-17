/**
 * Dev override para URLs de juegos en desarrollo local.
 *
 * Permite sobreescribir las external_url de la tabla `games` en Supabase
 * con URLs locales (localhost) para probar el flujo completo sin desplegar.
 *
 * Uso: definir en .env.local, una variable por juego:
 *
 *   NEXT_PUBLIC_DEV_GAME_URL_SOPA=http://localhost:5173
 *   NEXT_PUBLIC_DEV_GAME_URL_PUZZLE=http://localhost:3001
 *   NEXT_PUBLIC_DEV_GAME_URL_FIGHTERS=http://localhost:5174
 *
 * Los allowed_origins se derivan automáticamente del origin de cada URL.
 */

export interface DevGameOverride {
  url: string
  origins: string[]
}

const DEV_MODE = process.env.NODE_ENV === 'development'

/**
 * Retorna el override para un slug si existe una variable de entorno de desarrollo.
 */
export function getDevGameOverride(slug: string): DevGameOverride | null {
  if (!DEV_MODE) return null

  const envKey = `NEXT_PUBLIC_DEV_GAME_URL_${slug.toUpperCase()}`
  const url = process.env[envKey]

  if (!url) return null

  try {
    const parsed = new URL(url)
    return {
      url,
      origins: [parsed.origin],
    }
  } catch {
    return null
  }
}
