import { createClient } from '@/lib/supabase/server'
import BannerManager from '../BannerManager'
import type { Banner } from '@/lib/types'

export default async function AdminBannersPage() {
  const supabase = await createClient()

  const { data: banners } = await supabase
    .from('banners')
    .select('*')
    .order('sort_order', { ascending: true })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <BannerManager banners={(banners ?? []) as Banner[]} />
    </div>
  )
}
