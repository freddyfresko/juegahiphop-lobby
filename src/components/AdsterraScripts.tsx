'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Adsterra — scripts globales del sitio.
 *
 * Carga una sola vez (guard en window) los scripts de red de Adsterra:
 *   - SOCIAL BAR: barra flotante (In-Page Push + Interstitials)
 *
 * ⚠️ El POPUNDER está DESACTIVADO (ago-2026): se dispara con clics y
 * navegaciones → abría pestañas/popups justo al hacer clic para jugar,
 * "sale donde quiere" y entorpece la experiencia. Freddy lo reportó.
 * Para reactivarlo: descomentar el script 'adsterra-popunder' abajo.
 *
 * ⚠️ FORMATOS SITE-WIDE: SOLO cargan en las páginas del lobby
 * (home, ranking, perfil). NUNCA en /jugar/* (invade el iframe del juego
 * con popups/interstitials y entorpece la partida) ni en /admin/*.
 * Los ads dentro del juego salen SOLO por el AdOverlay programado
 * (campaña Adsterra 300x250 en game_results / game_level_complete).
 */
const SCRIPTS: { id: string; src: string; async?: boolean }[] = [
  // POPUNDER — desactivado: invasivo (abre pestañas con clics)
  // {
  //   id: 'adsterra-popunder',
  //   src: 'https://pl30914074.effectivecpmnetwork.com/af/f7/de/aff7de89b9a9f277140c061340e5f97e.js',
  // },
  {
    id: 'adsterra-socialbar',
    src: 'https://pl30914076.effectivecpmnetwork.com/00/ac/7a/00ac7a356a4d0edae585088385363a83.js',
  },
]

export default function AdsterraScripts() {
  const pathname = usePathname()

  // Excluir páginas donde los formatos site-wide NO deben aparecer
  const isGamePage = pathname?.startsWith('/jugar') ?? false
  const isAdminPage = pathname?.startsWith('/admin') ?? false
  const isLoginPage = pathname?.startsWith('/login') ?? false
  const skip = isGamePage || isAdminPage || isLoginPage

  useEffect(() => {
    if (skip) return

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
  }, [skip])

  return null
}
