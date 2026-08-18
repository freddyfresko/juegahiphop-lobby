/**
 * AdSense loader — red de anuncios de Google.
 *
 * Carga el script del publisher una sola vez y expone helpers para
 * mostrar unidades de anuncio (display) dentro del AdOverlay.
 *
 *   - Sin NEXT_PUBLIC_ADSENSE_CLIENT_ID configurado → no-op silencioso
 *     (el sistema cae al overlay manual de campañas).
 *   - Con el client ID (ca-pub-…) → carga adsbygoogle.js y el AdOverlay
 *     monta el ad de la red en su contenedor usando el ad slot que se
 *     define en la campaña (config.ad_slot).
 *
 * El ad slot (data-ad-slot) se crea en el panel de AdSense cuando la
 * cuenta esté aprobada: Ads → Crear unidad de anuncio → copiar el ID.
 */

let scriptPromise: Promise<boolean> | null = null

/** ¿Hay client ID de AdSense configurado? */
export function isAdSenseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID)
}

/**
 * Carga adsbygoogle.js una sola vez (idempotente).
 * Resuelve true si el SDK quedó disponible, false si no hay
 * configuración o el script falló (siempre silencioso).
 */
export function loadAdSense(): Promise<boolean> {
  if (!isAdSenseConfigured()) return Promise.resolve(false)
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false)

    const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID as string

    // Ya cargado en el DOM → listo
    if (document.querySelector('script[data-adsense-client]')) {
      return resolve(true)
    }

    const s = document.createElement('script')
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`
    s.async = true
    s.crossOrigin = 'anonymous'
    s.dataset.adsenseClient = clientId
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
 * Monta una unidad de anuncio de AdSense (display, responsive) dentro
 * de un contenedor. Requiere que el ad slot exista en el panel de
 * AdSense (data-ad-slot). Devuelve true si se montó y disparó el push.
 */
export async function showAdSenseAd(
  container: HTMLElement | null,
  adSlot: string,
): Promise<boolean> {
  const ok = await loadAdSense()
  if (!ok || !container || !adSlot) return false

  try {
    const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID as string

    // Limpiar contenedor (evita duplicados si se re-monta)
    container.innerHTML = ''

    const ins = document.createElement('ins')
    ins.className = 'adsbygoogle'
    ins.style.display = 'block'
    ins.dataset.adClient = clientId
    ins.dataset.adSlot = adSlot
    ins.dataset.format = 'auto'
    ins.dataset.fullWidthResponsive = 'true'

    container.appendChild(ins)

    // Disparar la carga del ad
    const w = window as unknown as { adsbygoogle?: unknown[] }
    ;(w.adsbygoogle = w.adsbygoogle || []).push({})

    return true
  } catch {
    return false
  }
}
