import { createClient } from '@/lib/supabase/server'
import CampaignManager from '../CampaignManager'
import type { CampaignEntry, GameCatalogEntry } from '@/lib/types'

export default async function AdminCampaignsPage() {
  const supabase = await createClient()

  const [{ data: campaigns }, { data: games }] = await Promise.all([
    supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('games')
      .select('*')
      .order('sort_order', { ascending: true }),
  ])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <CampaignManager
        campaigns={(campaigns ?? []) as CampaignEntry[]}
        games={(games ?? []) as GameCatalogEntry[]}
      />
    </div>
  )
}
