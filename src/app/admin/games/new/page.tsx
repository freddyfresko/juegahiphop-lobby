import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GameForm from '@/app/admin/GameForm'

export default async function NewGamePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) redirect('/login?reason=auth_required')

  try {
    const { data: isAdmin } = await supabase.rpc('is_admin')
    if (!isAdmin) redirect('/')
  } catch {
    redirect('/')
  }

  return <GameForm />
}
