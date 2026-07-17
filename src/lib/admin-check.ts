import { createClient } from '@/lib/supabase/server'

/**
 * Verifica si el usuario autenticado es admin.
 * Revisa contra la tabla `admin_users` por email.
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return false

  const { data } = await supabase
    .from('admin_users')
    .select('id')
    .eq('email', user.email)
    .maybeSingle()

  return !!data
}

/**
 * Obtiene el usuario actual (útil para server components que necesitan
 * verificar admin). Lanza error si no hay sesión.
 */
export async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autorizado')
  return user
}

/**
 * Obtiene el usuario actual (útil para server components que necesitan
 * verificar admin). Lanza error si no hay sesión o no es admin.
 */
export async function requireAdmin() {
  const user = await requireAuth()
  const admin = await isAdmin()
  if (!admin) throw new Error('No tienes permisos de administrador')
  return user
}
