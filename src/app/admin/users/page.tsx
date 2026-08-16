import { createClient } from '@/lib/supabase/server'
import UsersManager from '../UsersManager'
import type { AdminUserRow, AdminUsersSummary, TrialStats } from '@/lib/types'

export default async function AdminUsersPage() {
  const supabase = await createClient()

  const [summaryRes, usersRes, trialsRes] = await Promise.all([
    supabase.rpc('admin_get_users_summary'),
    supabase.rpc('admin_get_users'),
    supabase.rpc('admin_get_trial_stats'),
  ])

  // Errores visibles (si una RPC falla, se muestran en la página en vez de vacío silencioso)
  const errors = [
    summaryRes.error ? `summary: ${summaryRes.error.message}` : null,
    usersRes.error ? `users: ${usersRes.error.message}` : null,
    trialsRes.error ? `trials: ${trialsRes.error.message}` : null,
  ].filter(Boolean) as string[]

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <UsersManager
        summary={(summaryRes.data ?? {}) as AdminUsersSummary}
        users={(usersRes.data ?? []) as AdminUserRow[]}
        trials={(trialsRes.data ?? {}) as TrialStats}
        errors={errors}
      />
    </div>
  )
}
