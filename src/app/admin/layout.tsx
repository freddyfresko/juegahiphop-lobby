import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminShell from './AdminShell'
import { noIndexMetadata } from '@/lib/seo'
import type { PlayerProfile } from '@/lib/types'

export const metadata: Metadata = {
  ...noIndexMetadata,
  title: 'Admin',
}

/**
 * Layout del panel admin: autentica y valida permisos UNA vez para todas las
 * rutas /admin (incluye games/new y games/[slug]), y envuelve todo en el shell
 * con la top nav del lobby + sidebar de secciones.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    redirect('/login?reason=auth_required')
  }

  // Verificar admin vía RPC
  let isAdmin = false
  try {
    const { data } = await supabase.rpc('is_admin')
    isAdmin = !!data
  } catch {
    // Función no existe
  }

  if (!isAdmin) {
    redirect('/')
  }

  // Perfil para el avatar de la top nav
  const { data: profile } = await supabase
    .from('player_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  return (
    <AdminShell user={user} profile={(profile ?? null) as PlayerProfile | null}>
      {children}
    </AdminShell>
  )
}
