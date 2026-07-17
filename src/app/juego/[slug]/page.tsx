import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ slug: string }>
}

/**
 * Página legacy /juego/[slug]
 * Redirige a la nueva ruta /jugar/[slug]
 */
export default async function JuegoRedirectPage({ params }: PageProps) {
  const { slug } = await params
  redirect(`/jugar/${slug}`)
}
