/**
 * Campaign Manager — lógica de selección y tracking de ads.
 *
 * El lobby es el CEREBRO de publicidad. Cuando un juego (iframe)
 * envía campaign_request, el lobby:
 *   1. Llama a RPC select_campaign_for_placement (Supabase)
 *   2. Si hay campaña → registra impresión (shown) + la pinta
 *   3. El overlay puede terminar en clicked / dismissed / reward_granted
 *   4. Cada acción actualiza métricas via RPC
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CampaignPlacement } from './types'

export interface SelectedCampaign {
  id: string
  name: string
  type: string
  provider: string
  title: string
  description: string
  image_url: string | null
  video_url: string | null
  destination_url: string
  placement: CampaignPlacement
  priority: number
  reward: {
    type: string
    value: number
    description: string
    expires_in_hours?: number
  } | null
  config: Record<string, unknown>
}

/**
 * Busca la mejor campaña activa para un placement + juego + usuario.
 * Devuelve null si no hay ninguna campaña elegible.
 */
export async function selectCampaign(
  supabase: SupabaseClient,
  placement: CampaignPlacement,
  gameId: string | null,
  userId: string | null,
): Promise<SelectedCampaign | null> {
  const { data, error } = await supabase
    .rpc('select_campaign_for_placement', {
      p_placement: placement,
      p_game_id: gameId ?? null,
      p_user_id: userId ?? null,
    })
    .maybeSingle()

  if (error || !data) return null
  return data as unknown as SelectedCampaign
}

/**
 * Registra una impresión (event='shown', 'clicked', etc.) en campaign_impressions.
 * También incrementa el contador correspondiente en la tabla campaigns vía RPC.
 */
export async function trackImpression(
  supabase: SupabaseClient,
  campaignId: string,
  event: 'shown' | 'clicked' | 'dismissed' | 'reward_granted' | 'reward_expired',
  options: {
    userId?: string | null
    gameId?: string | null
    placement?: CampaignPlacement
    metadata?: Record<string, unknown>
  } = {},
): Promise<void> {
  // Insert en campaign_impressions
  await supabase.from('campaign_impressions').insert({
    campaign_id: campaignId,
    user_id: options.userId ?? null,
    game_id: options.gameId ?? null,
    placement: options.placement ?? 'game_results',
    event,
    metadata: options.metadata ?? {},
  })

  // Incrementar contador en campaigns
  const field = event === 'shown'
    ? 'impressions'
    : event === 'clicked'
      ? 'clicks'
      : event === 'dismissed'
        ? 'dismissals'
        : event === 'reward_granted'
          ? 'conversions'
          : 'impressions' // reward_expired no tiene contador propio

  await supabase.rpc('increment_campaign_counter', {
    p_campaign_id: campaignId,
    p_field: field,
  })
}

/**
 * Determina si un placement es rewarded (opt-in del usuario con recompensa).
 */
export function isRewardedPlacement(placement: CampaignPlacement): boolean {
  return (
    placement === 'rewarded_hint' ||
    placement === 'rewarded_continue' ||
    placement === 'rewarded_bonus'
  )
}
