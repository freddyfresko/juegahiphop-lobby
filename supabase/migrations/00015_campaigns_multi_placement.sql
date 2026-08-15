-- ============================================================
-- JuegaHipHop — Campaigns multi-placement
-- Migration 00015: una campaña puede cubrir VARIOS placements
-- (antes: 1 campaña = 1 placement; ahora: array de placements)
--
-- CAMBIOS:
--   campaigns.placement (campaign_placement) → campaigns.placements (campaign_placement[])
--   RPC select_campaign_for_placement: filtra con p_placement = ANY(c.placements)
--   Índices: GIN sobre placements (búsqueda por elemento)
--
-- IDEMPOTENTE: puede correrse completa varias veces sin importar en
-- qué punto quedó un intento anterior (la migración puede fallar a
-- medio camino y al correrla de nuevo retoma sin errores).
-- ============================================================

-- ─── 1. Convertir columna a array + renombrar (solo si falta) ───
-- OJO: hay que DROP DEFAULT antes del TYPE change — el default
-- 'game_results'::campaign_placement no se castea solo al array.
-- El DO block verifica que la columna vieja 'placement' exista, así
-- que si la migración ya avanzó (columna ya renombrada a 'placements')
-- este bloque no hace nada.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'placement'
  ) THEN
    ALTER TABLE campaigns ALTER COLUMN placement DROP DEFAULT;
    ALTER TABLE campaigns
      ALTER COLUMN placement TYPE campaign_placement[] USING ARRAY[placement]::campaign_placement[];
    ALTER TABLE campaigns
      ALTER COLUMN placement SET DEFAULT '{game_results}'::campaign_placement[];
    ALTER TABLE campaigns RENAME COLUMN placement TO placements;
  END IF;
END $$;

-- Asegurar el default correcto también si la columna ya es 'placements'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'placements'
  ) THEN
    ALTER TABLE campaigns ALTER COLUMN placements SET DEFAULT '{game_results}'::campaign_placement[];
  END IF;
END $$;

-- ─── 2. Índices: GIN para búsqueda por elemento del array ───
DROP INDEX IF EXISTS idx_campaigns_placement;
DROP INDEX IF EXISTS idx_campaigns_placements;
CREATE INDEX IF NOT EXISTS idx_campaigns_placements
  ON campaigns USING GIN (placements);

DROP INDEX IF EXISTS idx_campaigns_active;
CREATE INDEX IF NOT EXISTS idx_campaigns_active
  ON campaigns (priority DESC)
  WHERE status = 'active';

-- ─── 3. RPC: seleccionar campaña que cubra el placement pedido ───
-- OJO: CREATE OR REPLACE no puede cambiar el tipo de retorno — el row
-- type cambió de placement a placements[], hay que DROP primero.
-- (IF EXISTS: si el intento anterior ya la recreó, no falla.)

DROP FUNCTION IF EXISTS select_campaign_for_placement(campaign_placement, text, uuid);

CREATE FUNCTION public.select_campaign_for_placement(
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
  placements campaign_placement[],
  priority INTEGER,
  reward JSONB,
  config JSONB
) LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    c.id, c.name, c.type, c.provider, c.title, c.description,
    c.image_url, c.video_url, c.destination_url, c.placements,
    c.priority, c.reward, c.config
  FROM campaigns c
  WHERE c.status = 'active'
    AND p_placement = ANY(c.placements)
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

NOTIFY pgrst, 'reload schema cache';
