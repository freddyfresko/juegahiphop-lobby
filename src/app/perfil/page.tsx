import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PerfilClient from './PerfilClient'
import { noIndexMetadata } from '@/lib/seo'

export const metadata: Metadata = {
  ...noIndexMetadata,
  title: 'Mi Perfil',
}

export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <PerfilClient userId={user.id} />
}
