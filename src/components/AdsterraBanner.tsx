'use client'

import { useEffect, useRef } from 'react'

/**
 * Adsterra — banner display (native / 300x250 / 728x90).
 *
 * Inyecta el script del formato en un contenedor. Cada formato tiene su
 * propio key de Adsterra (cuenta juegahiphop.cl, site ID 5992776).
 *
 * OJO: los formatos con `atOptions` usan una variable GLOBAL — por eso
 * este componente se monta UNO a la vez por página (si necesitas varios,
 * monta distintos formatos separados o secuenciales).
 *
 * Los <script> se crean con createElement (NO innerHTML) porque los
 * scripts inyectados por innerHTML no se ejecutan en navegadores modernos.
 */

export type AdsterraFormat = 'native' | '300x250' | '728x90'

const FORMATS: Record<AdsterraFormat, { html: string }> = {
  native: {
    html: `
      <div id="container-84180ecee3199a07b6d0079d86d3904a"></div>
      <script async="async" data-cfasync="false" src="https://pl30914077.effectivecpmnetwork.com/84180ecee3199a07b6d0079d86d3904a/invoke.js"></script>
    `,
  },
  '300x250': {
    html: `
      <script>
        atOptions = {
          'key' : '74ae25d966a2dd932c3be561a7dfe384',
          'format' : 'iframe',
          'height' : 50,
          'width' : 320,
          'params' : {}
        };
      </script>
      <script src="https://www.highperformanceformat.com/74ae25d966a2dd932c3be561a7dfe384/invoke.js"></script>
    `,
  },
  '728x90': {
    html: `
      <script>
        atOptions = {
          'key' : 'db17084fef78afa78e26160cab8000db',
          'format' : 'iframe',
          'height' : 90,
          'width' : 728,
          'params' : {}
        };
      </script>
      <script src="https://www.highperformanceformat.com/db17084fef78afa78e26160cab8000db/invoke.js"></script>
    `,
  },
}

/** Monta HTML + scripts en el contenedor. Los <script> se recrean como nodos reales. */
function mountAd(container: HTMLElement, html: string) {
  container.innerHTML = ''

  const template = document.createElement('template')
  template.innerHTML = html.trim()

  for (const node of Array.from(template.content.childNodes)) {
    if (node.nodeName === 'SCRIPT') {
      const old = node as HTMLScriptElement
      const script = document.createElement('script')
      // Copiar atributos (src, async, data-cfasync…)
      for (const attr of Array.from(old.attributes)) {
        script.setAttribute(attr.name, attr.value)
      }
      // Código inline (atOptions) — textContent NO ejecuta; usar eval vía append
      if (old.textContent) {
        const inline = document.createElement('script')
        inline.textContent = old.textContent
        container.appendChild(inline)
      }
      container.appendChild(script)
    } else {
      container.appendChild(node)
    }
  }
}

export default function AdsterraBanner({
  format,
  className = '',
}: {
  format: AdsterraFormat
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const formatRef = useRef(format)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const info = FORMATS[formatRef.current]
    mountAd(container, info.html)

    return () => {
      container.innerHTML = ''
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden ${className}`}
      aria-label="Publicidad"
    />
  )
}
