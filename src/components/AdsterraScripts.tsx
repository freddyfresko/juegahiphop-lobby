'use client'

import { useEffect } from 'react'

/**
 * Adsterra — scripts globales del sitio.
 *
 * Carga una sola vez (guard en window) los scripts de red de Adsterra:
 *   - POPUNDER: se dispara en navegaciones/clics del usuario
 *   - SOCIAL BAR: barra flotante (In-Page Push + Interstitials)
 *
 * Ambos son formatos "site-wide": se inyectan en el body y la red hace
 * el resto. Van montados en el RootLayout.
 */
const SCRIPTS: { id: string; src: string; async?: boolean }[] = [
  {
    id: 'adsterra-popunder',
    src: 'https://pl30914074.effectivecpmnetwork.com/af/f7/de/aff7de89b9a9f277140c061340e5f97e.js',
  },
  {
    id: 'adsterra-socialbar',
    src: 'https://pl30914076.effectivecpmnetwork.com/00/ac/7a/00ac7a356a4d0edae585088385363a83.js',
  },
]

export default function AdsterraScripts() {
  useEffect(() => {
    // Guard: evitar duplicados (HMR / re-mount)
    if ((window as unknown as { __adsterraGlobalLoaded?: boolean }).__adsterraGlobalLoaded) {
      return
    }
    ;(window as unknown as { __adsterraGlobalLoaded: boolean }).__adsterraGlobalLoaded = true

    for (const s of SCRIPTS) {
      if (document.getElementById(s.id)) continue
      const script = document.createElement('script')
      script.id = s.id
      script.src = s.src
      if (s.async) script.async = true
      script.onerror = () => console.warn(`[Adsterra] fallo al cargar ${s.id}`)
      document.body.appendChild(script)
    }
  }, [])

  return null
}
