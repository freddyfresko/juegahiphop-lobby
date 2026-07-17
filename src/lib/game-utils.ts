/**
 * Utilidades para validación de URLs de juegos.
 */

/** Patrones de URL permitidos para juegos */
const ALLOWED_URL_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.juegahiphop\.cl$/,
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/,
  /^https:\/\/localhost:\d+$/,
  /^http:\/\/localhost:\d+$/,
]

/**
 * Valida que una URL de juego sea segura para cargar en el iframe.
 * - Debe ser HTTPS (excepto localhost)
 * - Debe coincidir con un patrón permitido
 * - No debe contener caracteres peligrosos
 */
export function validateGameUrl(url: string | null | undefined): {
  valid: boolean
  url: string
  error?: string
} {
  if (!url || typeof url !== 'string') {
    return { valid: false, url: '', error: 'URL no proporcionada' }
  }

  try {
    const parsed = new URL(url)

    if (parsed.protocol !== 'https:' && !parsed.hostname.startsWith('localhost')) {
      return { valid: false, url, error: 'Solo se permiten conexiones HTTPS' }
    }

    const isAllowed = ALLOWED_URL_PATTERNS.some((pattern) =>
      pattern.test(parsed.origin),
    )

    if (!isAllowed && !parsed.hostname.startsWith('localhost')) {
      return { valid: false, url, error: 'Dominio no permitido' }
    }

    return { valid: true, url }
  } catch {
    return { valid: false, url: url ?? '', error: 'URL mal formada' }
  }
}
