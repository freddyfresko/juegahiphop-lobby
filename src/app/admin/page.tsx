import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AdminDashboard from './AdminDashboard'
import type { GameCatalogEntry, Banner } from '@/lib/types'

export default async function AdminPage() {
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4">
        <div className="max-w-md text-center">
          <div className="mb-4 text-6xl">🔒</div>
          <h1 className="font-archivo text-2xl tracking-wide text-white">
            ACCESO <span className="text-yellow-400">DENEGADO</span>
          </h1>
          <p className="mt-3 text-xs uppercase tracking-wider text-zinc-500">
            No tienes permisos de administrador.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-xl bg-yellow-400 px-6 py-3 text-sm font-bold text-black transition-colors hover:bg-yellow-300"
          >
            VOLVER AL LOBBY
          </Link>
        </div>
      </div>
    )
  }

  // Cargar juegos
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .order('sort_order', { ascending: true })

  // Cargar banners activos
  const { data: banners } = await supabase
    .from('banners')
    .select('*')
    .order('sort_order', { ascending: true })

  return (
    <AdminDashboard
      games={(games ?? []) as GameCatalogEntry[]}
      banners={(banners ?? []) as Banner[]}
      userEmail={user.email}
    />
  )
}
