// ═══════════════════════════════════════════════════════════════
// JuegaHipHop — Tipos de la plataforma
//
// NOTA: Los tipos del protocolo de comunicación (SDK) están en
// src/lib/sdk/types.ts — sincronizados con packages/juegahiphop-sdk/
// ═══════════════════════════════════════════════════════════════

// ─── Game Catalog (desde Supabase games table — Manifiesto completo) ───

export interface GameCatalogEntry {
  id: string
  slug: string
  name: string
  emoji: string
  short_description: string
  description: string | null
  image_url: string | null
  color: string
  accent_color: string | null
  status: 'active' | 'beta' | 'coming_soon' | 'maintenance' | 'hidden'
  featured: boolean
  orientation: 'landscape' | 'portrait' | 'any'
  external_url: string
  category: string
  sort_order: number
  total_items: number | null
  progress_label: string | null
  allowed_origins: string[]
  release_date: string | null
  updated_at: string

  // ═══ Manifiesto extendido ═══
  version?: string
  protocol_version?: string
  progress_schema_version?: string
  /** Capacidades declarativas: 'fullscreen', 'save_progress', 'campaigns', 'achievements', etc. */
  capabilities?: string[]
  /** Eventos que el juego puede emitir: 'game_ready', 'game_started', etc. */
  supported_events?: string[]
  /** Comandos que el juego acepta: 'pause', 'resume', 'session_context', etc. */
  supported_commands?: string[]
  /** Placements de campaña: 'game_results', 'game_level_complete', etc. */
  campaign_placements?: string[]
  /** IDs de recompensas soportadas */
  supported_rewards?: string[]
  /** Permisos extra para el iframe */
  iframe_permissions?: string[]
  min_age?: number | null
  tags?: string[]
  screenshots?: string[]
  trailer_url?: string | null
  developer?: string
  privacy_url?: string | null
  terms_url?: string | null
}

// ─── Player Profile (progreso global) ───

export interface PlayerProfile {
  user_id: string
  xp: number
  level: number
  total_games_completed: number
  current_streak: number
  last_played_date: string | null
  display_name?: string
  avatar_url?: string
}

// ─── Game State (progreso por juego — tabla legacy) ───

export interface GameStateRow {
  user_id: string
  game_id: string
  state: Record<string, unknown>
  best_score: number
  total_plays: number
  last_played_at: string
  updated_at: string
}

// ─── User Game Progress (nueva tabla versionada) ───

export interface UserGameProgress {
  id: string
  user_id: string
  game_id: string
  schema_version: string
  progress_data: Record<string, unknown>
  statistics_data: Record<string, unknown>
  achievements_data: string[]
  settings_data: Record<string, unknown> | null
  best_score: number | null
  total_plays: number
  total_playtime_seconds: number
  last_played_at: string | null
  sync_version: number
  created_at: string
  updated_at: string
}

// ─── Game Completion (partida completada) ───

export interface GameCompletion {
  user_id: string
  game_id: string
  item_id: string
  difficulty: string
  score: number
  metadata: Record<string, unknown>
  completed_at: string
}

// ─── Game Session ───

export interface GameSession {
  id: string
  user_id: string
  game_id: string
  session_type: 'authenticated' | 'guest' | 'anonymous'
  device_info: Record<string, unknown>
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  session_result: 'completed' | 'abandoned' | 'error' | 'timeout' | 'unknown' | null
  game_version: string | null
  protocol_version: string | null
  total_score: number
  items_completed: number
}

// ─── Achievement (logro desbloqueado) ───

export interface AchievementUnlock {
  id: string
  user_id: string
  achievement_id: string
  achievement_name: string
  achievement_description: string
  icon: string
  unlocked_at: string
}

// ─── Achievement Definition ───

export interface AchievementDefinition {
  id: string
  achievement_id: string
  type: 'game' | 'global' | 'hidden' | 'seasonal'
  name: string
  description: string
  icon: string
  game_id: string | null
  condition_description: string | null
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  xp_reward: number
  is_visible: boolean
  sort_order: number
}

// ─── Game Progress (para la UI de GameCard) ───

export interface GameProgress {
  current: number
  total: number
  label: string
}

// ─── Activity Feed ───

export interface ActivityEntry {
  id: string
  user_id: string
  activity_type: string
  game_id: string | null
  description: string | null
  metadata: Record<string, unknown>
  created_at: string
}

// ─── Auth ───

export type AuthView = 'login' | 'register'

// ─── Banner Types ───

export interface Banner {
  id: string
  title: string
  subtitle: string | null
  description: string | null
  image_url: string | null
  link_url: string | null
  link_label: string
  overlay_opacity: number
  text_color: string
  accent_color: string
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

// ─── Campaign Types ───

export interface CampaignEntry {
  id: string
  name: string
  type: CampaignType
  provider: CampaignProvider
  title: string
  description: string
  image_url: string | null
  video_url: string | null
  destination_url: string
  placement: CampaignPlacement
  priority: number
  allowed_games: string[]
  excluded_games: string[]
  start_date: string
  end_date: string
  max_impressions: number | null
  max_per_user: number
  reward: CampaignReward | null
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'
  config: Record<string, unknown>
  impressions: number
  clicks: number
  dismissals: number
  conversions: number
}

export type CampaignType =
  | 'internal_game'
  | 'event'
  | 'clubhh'
  | 'tienda'
  | 'hhtickets'
  | 'educational'
  | 'sponsor'
  | 'external_ad'

export type CampaignProvider =
  | 'internal'
  | 'direct_sponsor'
  | 'google_ads'
  | 'mobile_ads'
  | 'future'

export type CampaignPlacement =
  | 'lobby_home'
  | 'lobby_catalog'
  | 'lobby_profile'
  | 'lobby_rankings'
  | 'game_loading'
  | 'game_results'
  | 'game_level_complete'
  | 'game_category_complete'
  | 'game_session_end'
  | 'game_exit'
  | 'rewarded_hint'
  | 'rewarded_continue'
  | 'rewarded_bonus'

export interface CampaignReward {
  type: string
  value: number
  description: string
  expires_in_hours?: number
}
