import { ImageResponse } from 'next/og'
import { SITE_NAME } from '@/lib/seo'

export const runtime = 'nodejs'
export const alt = SITE_NAME
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * OG image del lobby — 1200×630, branding stone+orange.
 * Se genera en build time (edge runtime) y sirve para compartir en
 * WhatsApp/Redes/Twitter. El texto usa la Bangers del brand.
 */
/**
 * Carga una fuente de Google Fonts: el CSS de Google devuelve @font-face
 * con la URL del .woff2 — hay que parsearlo y fetchear el binario real
 * (satori/ImageResponse rechaza el CSS crudo: "Unsupported OpenType signature").
 */
async function loadGoogleFont(family: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${family}&display=swap`
    ).then((res) => res.text())
    // Google sirve .ttf cuando el UA no es de navegador moderno — satori
    // soporta ttf/otf/woff/woff2, así que aceptamos cualquier formato.
    const match = css.match(/url\((https:\/\/[^)]+\.(?:ttf|otf|woff2?))\)/)
    if (!match) return null
    return fetch(match[1]).then((res) => res.arrayBuffer())
  } catch {
    return null
  }
}

export default async function Image() {
  const bangers = await loadGoogleFont('Bangers')
  const inter = await loadGoogleFont('Inter:wght@400;700')

  const fontData = (buf: ArrayBuffer | null, name: string) =>
    buf ? [{ name, data: buf, style: 'normal' as const }] : []

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(135deg, #0a0a0a 0%, #1c1917 55%, #292524 100%)',
          color: '#fafaf9',
          fontFamily: 'Inter',
          position: 'relative',
        }}
      >
        {/* Textura sutil de ladrillos */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.06,
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, #facc15 3px, transparent 4px)',
          }}
        />

        {/* Micrófono / emoji central */}
        <div style={{ display: 'flex', fontSize: 110, marginBottom: 18 }}>🎤</div>

        {/* Título en Bangers */}
        <div
          style={{
            display: 'flex',
            fontSize: 110,
            letterSpacing: '0.02em',
            lineHeight: 1,
            fontFamily: 'Bangers',
            color: '#facc15',
            textShadow: '0 4px 0 rgba(0,0,0,0.35)',
            marginBottom: 24,
          }}
        >
          {SITE_NAME.toUpperCase()}
        </div>

        {/* Tagline */}
        <div
          style={{
            display: 'flex',
            fontSize: 30,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#d6d3d1',
            fontWeight: 700,
            textAlign: 'center',
            padding: '0 80px',
            lineHeight: 1.5,
          }}
        >
          LA CULTURA ES TU MEJOR ARMA
        </div>

        {/* Firma de dominio */}
        <div
          style={{
            display: 'flex',
            marginTop: 36,
            fontSize: 22,
            letterSpacing: '0.12em',
            color: '#facc15',
            fontWeight: 700,
          }}
        >
          JUEGAHIPHOP.CL
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [...fontData(bangers, 'Bangers'), ...fontData(inter, 'Inter')],
    }
  )
}
