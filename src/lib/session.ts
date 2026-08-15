/**
 * Session ID anónimo persistente — identidad del usuario sin login.
 *
 * Se genera un UUID la primera vez que el navegador visita el lobby
 * y se guarda en localStorage. Permite medir usuarios únicos,
 * frecuencia de impresiones por usuario y CTR real incluso para
 * guests (que hoy registran user_id = NULL).
 *
 * NOTA: no es un identificador personal — solo un ID aleatorio de
 * navegador. Sirve para analítica de campañas, no para trackear
 * identidad.
 */

const SESSION_KEY = 'jh_session_id'

let cached: string | null = null

export function getSessionId(): string | null {
  if (typeof window === 'undefined') return null
  if (cached) return cached

  try {
    let id = window.localStorage.getItem(SESSION_KEY)
    if (!id) {
      id = crypto.randomUUID()
      window.localStorage.setItem(SESSION_KEY, id)
    }
    cached = id
    return id
  } catch {
    // localStorage bloqueado (modo incógnito estricto, etc.) → sin sesión
    return null
  }
}

/** ID único por visualización de ad (conecta shown → clicked/dismissed y viaja como ?jh_click=) */
export function newViewId(): string {
  return crypto.randomUUID()
}
