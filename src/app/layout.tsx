import type { Metadata, Viewport } from 'next'
import { Bangers, Inter } from 'next/font/google'
import './globals.css'

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
  title: 'Juega Hip Hop — Lobby',
  description: 'Plataforma de juegos con temática de hip hop. Sopa de letras, rompecabezas y más.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Juega Hip Hop',
  appleWebApp: {
    capable: true,
    title: 'Juega Hip Hop',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    shortcut: ['/icons/favicon-32x32.png'],
    other: [
      { url: '/icons/ios-167x167.png', sizes: '167x167', type: 'image/png' },
      { url: '/icons/ios-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/ios-120x120.png', sizes: '120x120', type: 'image/png' },
      { url: '/icons/android-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/android-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'Juega Hip Hop',
    description: 'La cultura es tu mejor arma. Juega, aprende, representa.',
    siteName: 'Juega Hip Hop',
    type: 'website',
    images: [
      {
        url: '/icons/pwa-512x512.png',
        width: 512,
        height: 512,
        alt: 'Juega Hip Hop',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Juega Hip Hop',
    description: 'La cultura es tu mejor arma. Juega, aprende, representa.',
    images: ['/icons/pwa-512x512.png'],
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
  return (
    <html
      lang="es"
      className={`${bangers.variable} ${inter.variable} h-full`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-dvh overflow-x-hidden bg-[#0a0a0a] font-inter text-white antialiased">
        {/* Reglas críticas del rail lateral inline (inmunes a caché de CSS): el contenido
            siempre corre al lado de la barra fija, en cualquier viewport. */}
        <style>{`
          .content-with-rail { padding-left: 3.5rem; }
          @media (min-width: 64rem) { .content-with-rail { padding-left: 16rem; } }
        `}</style>
        {children}
      </body>
    </html>
  )
}
