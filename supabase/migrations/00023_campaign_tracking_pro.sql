-- ============================================================
-- JuegaHipHop — Campaign tracking PRO (Fase 1 + 2)
-- Migration 00023: data de analítica real para campañas.
--
-- CAMBIOS:
--   campaign_impressions.session_id (TEXT) — identidad anónima
--     persistente del usuario (UUID en localStorage). Permite medir
--     usuarios únicos, frecuencia por usuario y CTR real con guests.
--     user_id sigue usándose para usuarios logueados.
--   RPC get_campaign_analytics(p_days) — dashboard de una sola
--     llamada: totales + serie diaria + top juegos + top placements.
--     Solo admins (is_admin check por dentro).
--
-- Los eventos de una misma visualización (shown → clicked/dismissed)
-- se conectan vía metadata.view_id (UUID generado en el cliente al
-- mostrar el ad). Ese mismo view_id viaja como ?jh_click= en la URL
-- del destino para atribución de conversión (postback futuro).
--
-- IDEMPOTENTE: puede correrse completa varias veces sin errores.
-- ============================================================

-- ─── 1. session_id en campaign_impressions ───

ALTER TABLE campaign_impressions
  ADD COLUMN IF NOT EXISTS session_id TEXT;

DROP INDEX IF EXISTS idx_impressions_session;
CREATE INDEX IF NOT EXISTS idx_impressions_session
  ON campaign_impressions (session_id)
  WHERE session_id IS NOT NULL;

-- Índice para series diarias (evento + día)
DROP INDEX IF EXISTS idx_impressions_event_day;
CREATE INDEX IF NOT EXISTS idx_impressions_event_day
  ON campaign_impressions (shown_at DESC, event)
  WHERE event IN ('shown', 'clicked');

-- ─── 2. RPC: dashboard analítico de campañas ───
-- Devuelve JSONB:
--   totals:        { impressions, clicks, dismissals, conversions,
--                    unique_sessions, ctr }
--   daily:         [{ day: 'YYYY-MM-DD', impressions, clicks, ctr }]
--   by_game:       [{ game_id, impressions, clicks, ctr }]
--   by_placement:  [{ placement, impressions, clicks, ctr }]

CREATE OR REPLACE FUNCTION public.get_campaign_analytics(
  p_days INTEGER DEFAULT 30
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_from TIMESTAMPTZ := NOW() - make_interval(days => p_days);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT jsonb_build_object(
    'totals', (
      SELECT jsonb_build_object(
        'impressions',  COUNT(*) FILTER (WHERE event = 'shown'),
        'clicks',       COUNT(*) FILTER (WHERE event = 'clicked'),
        'dismissals',   COUNT(*) FILTER (WHERE event = 'dismissed'),
        'conversions',  COUNT(*) FILTER (WHERE event = 'reward_granted'),
        'unique_sessions', COUNT(DISTINCT session_id) FILTER (WHERE event = 'shown'),
        'ctr', ROUND(
          100.0 * COUNT(*) FILTER (WHERE event = 'clicked')
            / NULLIF(COUNT(*) FILTER (WHERE event = 'shown'), 0),
          2
        )
      )
      FROM campaign_impressions
      WHERE shown_at >= v_from
    ),
    'daily', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'day',         to_char(day, 'YYYY-MM-DD'),
            'impressions', impressions,
            'clicks',      clicks,
            'ctr',         ROUND(100.0 * clicks / NULLIF(impressions, 0), 2)
          )
          ORDER BY day
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT
          date_trunc('day', shown_at) AS day,
          COUNT(*) FILTER (WHERE event = 'shown') AS impressions,
          COUNT(*) FILTER (WHERE event = 'clicked') AS clicks
        FROM campaign_impressions
        WHERE shown_at >= v_from
          AND event IN ('shown', 'clicked')
        GROUP BY 1
      ) t
    ),
    'by_game', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'game_id',     game_id,
            'impressions', impressions,
            'clicks',      clicks,
            'ctr',         ROUND(100.0 * clicks / NULLIF(impressions, 0), 2)
          )
          ORDER BY impressions DESC
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT
          game_id,
          COUNT(*) FILTER (WHERE event = 'shown') AS impressions,
          COUNT(*) FILTER (WHERE event = 'clicked') AS clicks
        FROM campaign_impressions
        WHERE shown_at >= v_from
          AND event IN ('shown', 'clicked')
          AND game_id IS NOT NULL
        GROUP BY 1
        ORDER BY impressions DESC
        LIMIT 8
      ) t
    ),
    'by_placement', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'placement',   placement,
            'impressions', impressions,
            'clicks',      clicks,
            'ctr',         ROUND(100.0 * clicks / NULLIF(impressions, 0), 2)
          )
          ORDER BY impressions DESC
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT
          placement,
          COUNT(*) FILTER (WHERE event = 'shown') AS impressions,
          COUNT(*) FILTER (WHERE event = 'clicked') AS clicks
        FROM campaign_impressions
        WHERE shown_at >= v_from
          AND event IN ('shown', 'clicked')
        GROUP BY 1
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

NOTIFY pgrst, 'reload schema cache';
