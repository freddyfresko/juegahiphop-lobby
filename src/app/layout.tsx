import type { Metadata, Viewport } from 'next'
import { Bangers, Inter } from 'next/font/google'
import './globals.css'
import { baseMetadata, webSiteJsonLd, SITE_NAME, SITE_URL } from '@/lib/seo'

const bangers = Bangers({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  ...baseMetadata,
  // Verificación de Google AdSense (meta google-adsense-account)
  other: {
    'google-adsense-account': 'ca-pub-9249421160144086',
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/favicon-16x16.png?v=2', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32x32.png?v=2', sizes: '32x32', type: 'image/png' },
      { url: '/icons/juegahiphop_512.png?v=2', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: ['/icons/juegahiphop_512.png?v=2'],
    other: [
      { url: '/icons/ios-167x167.png', sizes: '167x167', type: 'image/png' },
      { url: '/icons/ios-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/ios-120x120.png', sizes: '120x120', type: 'image/png' },
      { url: '/icons/android-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/android-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const jsonLd = webSiteJsonLd()
  return (
    <html
      lang="es"
      className={`${bangers.variable} ${inter.variable} h-full`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-dvh overflow-x-hidden bg-[#0a0a0a] font-inter text-white antialiased">
        {/* Structured data: WebSite (schema.org) — el head lo genera la metadata API */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Reglas críticas del layout inline (inmunes a caché de CSS): en desktop el
            contenido corre bajo la top nav fija (h-16); en móvil deja espacio abajo
            para la bottom nav bar fija (h-16 + safe-area). */}
        <style>{`
          .content-with-rail { padding-bottom: calc(4.5rem + env(safe-area-inset-bottom)); }
          @media (min-width: 64rem) {
            .content-with-rail { padding-top: 4rem; padding-bottom: 0; }
          }
        `}</style>
        {/* Ads: SOLO formatos fijos controlados por componente (AdsterraBanner en
            home/ranking/perfil + AdOverlay programado dentro del juego). Nada de
            scripts site-wide flotantes: la social bar (popup-like) y el popunder
            de Adsterra están RETIRADOS (ago-2026, decisión de Freddy). */}
        {children}
      </body>
    </html>
  )
}
