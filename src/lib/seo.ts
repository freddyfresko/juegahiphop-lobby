import type { Metadata } from 'next'
import type { GameCatalogEntry } from '@/lib/types'

/**
 * ═══════════════════════════════════════════════════════════════
 * SEO central — Juega Hip Hop (juegahiphop.cl)
 *
 * Todo el SEO del lobby vive acá: constantes del sitio, metadata
 * base y helpers para generar metadata/JSON-LD por página y juego.
 * ═══════════════════════════════════════════════════════════════
 */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://juegahiphop.cl'
export const SITE_NAME = 'Juega Hip Hop'
export const SITE_TITLE = 'Juega Hip Hop — Juegos de Cultura Hip Hop Online'
export const SITE_DESCRIPTION =
  'Juega gratis a juegos de cultura hip hop: sopa de letras con palabras del rap, rompecabezas de leyendas y más. Aprende rap, breakdance, graffiti y DJ mientras juegas.'
export const SITE_KEYWORDS = [
  'juegos hip hop',
  'juega hip hop',
  'sopa de letras hip hop',
  'juegos de rap',
  'cultura hip hop',
  'juegos gratis',
  'juegos de breakdance',
  'juegos de graffiti',
  'rompecabezas hip hop',
  'aprender cultura hip hop',
]

/** Hero de la home — la keyword exacta del dominio */
export const HOME_H1 = 'Juega Hip Hop'

/** Metadata base — se aplica a todas las páginas del lobby */
export const baseMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: 'es_CL',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
}

/** Metadata para páginas privadas (login, perfil, admin) — fuera del index */
export const noIndexMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
}

/** JSON-LD WebSite global — inyectado en el layout */
export function webSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: 'es-CL',
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
  }
}

/** JSON-LD VideoGame para la página de un juego */
export function videoGameJsonLd(game: GameCatalogEntry) {
  const url = `${SITE_URL}/jugar/${game.slug}`
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: game.name,
    description: game.description ?? game.short_description,
    url,
    image: game.image_url ? new URL(game.image_url, SITE_URL).toString() : `${SITE_URL}/opengraph-image`,
    genre: 'Hip hop',
    gamePlatform: ['Web Browser', 'Móvil'],
    applicationCategory: 'GameApplication',
    operatingSystem: 'Any',
    inLanguage: 'es-CL',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'CLP',
      availability: 'https://schema.org/InStock',
    },
    ...(game.release_date
      ? { datePublished: new Date(game.release_date).toISOString().split('T')[0] }
      : {}),
  }
}
