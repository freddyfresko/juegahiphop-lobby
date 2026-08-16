import { createClient } from '@/lib/supabase/server'
import AdminDashboard from './AdminDashboard'
import type { GameCatalogEntry } from '@/lib/types'

export default async function AdminPage() {
  const supabase = await createClient()

  // Cargar juegos (la auth/admin la valida el layout de /admin)
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .order('sort_order', { ascending: true })

  return <AdminDashboard games={(games ?? []) as GameCatalogEntry[]} />
}
