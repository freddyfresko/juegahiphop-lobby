import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import GameForm from '@/app/admin/GameForm'
import type { GameCatalogEntry } from '@/lib/types'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function EditGamePage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) redirect('/login?reason=auth_required')

  try {
    const { data: isAdmin } = await supabase.rpc('is_admin')
    if (!isAdmin) redirect('/')
  } catch {
    redirect('/')
  }

  // Cargar el juego
  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!game) notFound()

  return <GameForm game={game as GameCatalogEntry} />
}
