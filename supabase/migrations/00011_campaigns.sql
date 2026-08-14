-- ============================================================
-- JuegaHipHop — Ad Campaigns & Impressions
-- Migration 00011: ad management system (modelo Nerbyte)
--
-- El lobby es el CEREBRO de publicidad:
--   - campaigns: definiciones de ads (tipo, provider, placement, targeting)
--   - campaign_impressions: tracking por impresión (usuario, click, dismiss, reward)
--
-- Los juegos son stateless — mandan campaign_request via postMessage
-- y el lobby decide qué ad mostrar encima del iframe.
-- ============================================================

-- ─── Enums ───

DO $$ BEGIN
  CREATE TYPE campaign_type AS ENUM (
    'internal_game','event','clubhh','tienda','hhtickets',
    'educational','sponsor','external_ad'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE campaign_provider AS ENUM (
    'internal','direct_sponsor','google_ads','adinplay','nitropay','mobile_ads','future'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE campaign_placement AS ENUM (
    'lobby_home','lobby_catalog','lobby_profile','lobby_rankings',
    'game_loading','game_results','game_level_complete',
    'game_category_complete','game_session_end','game_exit',
    'rewarded_hint','rewarded_continue','rewarded_bonus'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE campaign_status AS ENUM (
    'draft','active','paused','completed','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE impression_event AS ENUM (
    'shown','clicked','dismissed','reward_granted','reward_expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── campaigns ───

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type campaign_type NOT NULL DEFAULT 'external_ad',
  provider campaign_provider NOT NULL DEFAULT 'google_ads',
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  video_url TEXT,
  destination_url TEXT NOT NULL DEFAULT '',
  placement campaign_placement NOT NULL DEFAULT 'game_results',
  priority INTEGER NOT NULL DEFAULT 50,  -- 1 (low) — 100 (high)
  allowed_games TEXT[] NOT NULL DEFAULT '{}',  -- slugs; vacío = todos
  excluded_games TEXT[] NOT NULL DEFAULT '{}',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  max_impressions INTEGER,  -- NULL = ilimitado
  max_per_user INTEGER NOT NULL DEFAULT 0,  -- 0 = ilimitado
  reward JSONB,  -- { type, value, description, expires_in_hours }
  status campaign_status NOT NULL DEFAULT 'draft',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,  -- provider-specific snippet/zone/etc
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  dismissals INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_placement ON campaigns(placement);
CREATE INDEX IF NOT EXISTS idx_campaigns_active
  ON campaigns(placement, priority DESC)
  WHERE status = 'active';

-- Trigger updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_campaigns_updated_at') THEN
    CREATE TRIGGER update_campaigns_updated_at
      BEFORE UPDATE ON campaigns
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ─── campaign_impressions ───

CREATE TABLE IF NOT EXISTS campaign_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id UUID,  -- NULL = guest
  game_id TEXT,  -- slug del juego donde se mostró
  placement campaign_placement NOT NULL,
  event impression_event NOT NULL DEFAULT 'shown',
  shown_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_impressions_campaign ON campaign_impressions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_impressions_user ON campaign_impressions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_impressions_shown ON campaign_impressions(shown_at DESC);

-- ─── RLS ───

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_impressions ENABLE ROW LEVEL SECURITY;

-- Campañas activas: cualquiera puede leerlas (lobby necesita verlas)
DROP POLICY IF EXISTS "Public can read active campaigns" ON campaigns;
CREATE POLICY "Public can read active campaigns"
  ON campaigns FOR SELECT
  USING (status = 'active' OR public.is_admin());

-- Admin CRUD en campaigns
DROP POLICY IF EXISTS "Admins can insert campaigns" ON campaigns;
CREATE POLICY "Admins can insert campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update campaigns" ON campaigns;
CREATE POLICY "Admins can update campaigns"
  ON campaigns FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete campaigns" ON campaigns;
CREATE POLICY "Admins can delete campaigns"
  ON campaigns FOR DELETE
  USING (public.is_admin());

-- Impressions: anónimo puede insertar (lobby registra impresión sin login necesario)
DROP POLICY IF EXISTS "Anyone can insert impressions" ON campaign_impressions;
CREATE POLICY "Anyone can insert impressions"
  ON campaign_impressions FOR INSERT
  WITH CHECK (true);

-- Impressions: solo admins leen (analytics)
DROP POLICY IF EXISTS "Admins can read impressions" ON campaign_impressions;
CREATE POLICY "Admins can read impressions"
  ON campaign_impressions FOR SELECT
  USING (public.is_admin());

-- ─── RPC: incrementar contador de campaign ───

CREATE OR REPLACE FUNCTION public.increment_campaign_counter(
  p_campaign_id UUID,
  p_field TEXT
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE campaigns
  SET
    impressions = CASE WHEN p_field = 'impressions' THEN impressions + 1 ELSE impressions END,
    clicks = CASE WHEN p_field = 'clicks' THEN clicks + 1 ELSE clicks END,
    dismissals = CASE WHEN p_field = 'dismissals' THEN dismissals + 1 ELSE dismissals END,
    conversions = CASE WHEN p_field = 'conversions' THEN conversions + 1 ELSE conversions END
  WHERE id = p_campaign_id;
$$;

-- ─── RPC: contar impresiones por usuario para una campaña ───

CREATE OR REPLACE FUNCTION public.count_user_campaign_impressions(
  p_campaign_id UUID,
  p_user_id UUID
) RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INTEGER
  FROM campaign_impressions
  WHERE campaign_id = p_campaign_id
    AND user_id = p_user_id
    AND event = 'shown';
$$;

-- ─── RPC: seleccionar mejor campaña activa para un placement + juego ───
-- Devuelve una sola campaña (o ninguna) respetando:
--   - status = 'active'
--   - vigencia por fechas
--   - max_impressions no superado
--   - allowed_games/excluded_games
--   - max_per_user no superado (si p_user_id no es NULL)
--   - ordenadas por priority DESC, random como tiebreaker

CREATE OR REPLACE FUNCTION public.select_campaign_for_placement(
  p_placement campaign_placement,
  p_game_id TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  name TEXT,
  type campaign_type,
  provider campaign_provider,
  title TEXT,
  description TEXT,
  image_url TEXT,
  video_url TEXT,
  destination_url TEXT,
  placement campaign_placement,
  priority INTEGER,
  reward JSONB,
  config JSONB
) LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    c.id, c.name, c.type, c.provider, c.title, c.description,
    c.image_url, c.video_url, c.destination_url, c.placement,
    c.priority, c.reward, c.config
  FROM campaigns c
  WHERE c.status = 'active'
    AND c.placement = p_placement
    AND (c.start_date IS NULL OR c.start_date <= NOW())
    AND (c.end_date IS NULL OR c.end_date >= NOW())
    AND (c.max_impressions IS NULL OR c.impressions < c.max_impressions)
    AND (
      p_game_id IS NULL
      OR c.allowed_games = '{}'::text[]
      OR p_game_id = ANY(c.allowed_games)
    )
    AND (p_game_id IS NULL OR NOT (p_game_id = ANY(c.excluded_games)))
    AND (
      p_user_id IS NULL
      OR c.max_per_user = 0
      OR public.count_user_campaign_impressions(c.id, p_user_id) < c.max_per_user
    )
  ORDER BY c.priority DESC, RANDOM()
  LIMIT 1;
$$;
