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
  openGraph: {
    title: 'Juega Hip Hop',
    description: 'La cultura es tu mejor arma. Juega, aprende, representa.',
    siteName: 'Juega Hip Hop',
    type: 'website',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0a0a0a',
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
        {children}
      </body>
    </html>
  )
}
