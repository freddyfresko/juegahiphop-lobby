/**
 * AdinPlay loader — red de ads para juegos HTML5 (Venatus).
 *
 * Carga el script del publisher una sola vez y expone helpers para
 * interstitial / rewarded. Diseñado como esqueleto:
 *
 *   - Sin NEXT_PUBLIC_ADINPLAY_SITE_ID / SCRIPT_URL configurados → no-op
 *     silencioso (el sistema cae al overlay manual de campañas).
 *   - Con el ID real → carga el script y el AdOverlay monta el ad de
 *     la red en su contenedor.
 *
 * ⚠️ COMPLETAR cuando AdinPlay entregue el site ID + snippet real:
 *   rellenar showAdinPlayAd() con la API exacta del SDK (la inyección
 *   del ad en el contenedor del overlay la hace el script de la red).
 */

let scriptPromise: Promise<boolean> | null = null

/** ¿Hay credenciales de AdinPlay configuradas? */
export function isAdinPlayConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_ADINPLAY_SITE_ID &&
      process.env.NEXT_PUBLIC_ADINPLAY_SCRIPT_URL,
  )
}

/**
 * Carga el script de AdinPlay una sola vez (idempotente).
 * Resuelve true si el SDK quedó disponible, false si no hay
 * configuración o el script falló (siempre silencioso).
 */
export function loadAdinPlay(): Promise<boolean> {
  if (!isAdinPlayConfigured()) return Promise.resolve(false)
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false)

    const siteId = process.env.NEXT_PUBLIC_ADINPLAY_SITE_ID as string
    const scriptUrl = process.env.NEXT_PUBLIC_ADINPLAY_SCRIPT_URL as string

    // Ya cargado en el DOM → listo
    if (document.querySelector(`script[data-adinplay-site-id="${siteId}"]`)) {
      return resolve(true)
    }

    const s = document.createElement('script')
    s.src = scriptUrl
    s.async = true
    s.dataset.adinplaySiteId = siteId
    s.onload = () => resolve(true)
    s.onerror = () => {
      // Fallo silencioso: el overlay cae al contenido manual de la campaña
      scriptPromise = null
      resolve(false)
    }
    document.head.appendChild(s)
  })

  return scriptPromise
}

/**
 * Muestra un ad real de AdinPlay (interstitial o rewarded).
 *
 * TODO(adinplay): cuando llegue el site ID, reemplazar el cuerpo con la
 * API real del SDK — ej:
 *   window.adinplay.showInterstitial({ onClose: () => ... })
 *   window.adinplay.showRewarded({ onReward: () => ... })
 *
 * Hoy devuelve false (sin SDK real) → el lobby usa la campaña manual.
 */
export async function showAdinPlayAd(
  kind: 'interstitial' | 'rewarded',
): Promise<boolean> {
  const ok = await loadAdinPlay()
  if (!ok) return false
  try {
    // TODO(adinplay): reemplazar con la API real del SDK cuando llegue
    // el site ID — ej:
    //   kind === 'rewarded'
    //     ? window.adinplay.showRewarded({ onReward: ... })
    //     : window.adinplay.showInterstitial({ onClose: ... })
    console.debug(`[AdinPlay] ${kind} solicitado — SDK aún no integrado`)
    return false
  } catch {
    return false
  }
}
