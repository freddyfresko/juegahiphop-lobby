'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * useIsAdmin — verifica si el usuario autenticado tiene permisos de admin.
 *
 * Usa el RPC is_admin() (SECURITY DEFINER) — el mismo mecanismo que la
 * página /admin usa con éxito. NO consultar la tabla admin_users directo:
 * su RLS no expone la lectura por PostgREST (la política SELECT no aplica
 * a anon/authenticated de forma fiable) → siempre devolvería false.
 *
 * Devuelve boolean; mientras carga devuelve false (el link del Sidebar
 * simplemente no aparece hasta confirmar).
 */
export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase
      .rpc('is_admin')
      .then(
        ({ data }) => {
          if (!cancelled) setIsAdmin(!!data)
        },
        () => { /* no crítico: sin admin no se muestra el link */ },
      )
    return () => {
      cancelled = true
    }
  }, [])

  return isAdmin
}
