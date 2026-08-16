-- ============================================================
-- JuegaHipHop — Prueba única de invitados + vista admin de jugadores
-- Migration 00026 (v2, ago-2026): RPCs reescritas con RETURNS SETOF
-- jsonb / jsonb_build_object — el patrón jsonb_agg(row_to_jsonb)
-- fallaba en producción (tabla de usuarios vacía).
--
--   1. trial_plays — partidas de prueba de invitados (gate de cuenta)
--   2. RPC admin_get_users_summary — KPIs globales de jugadores
--   3. RPC admin_get_users — lista de usuarios registrados con stats
--   4. RPC admin_get_trial_stats — pruebas de invitados por día/juego
--
-- Idempotente — seguro correrlo N veces.
-- ============================================================

-- ============================================================
-- 1. trial_plays — 1 partida de prueba por navegador (invitados)
--    session_id = jh_session_id anónimo del navegador (lib/session.ts)
-- ============================================================
CREATE TABLE IF NOT EXISTS trial_plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  game_id TEXT NOT NULL,
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trial_played ON trial_plays(played_at DESC);
CREATE INDEX IF NOT EXISTS idx_trial_session ON trial_plays(session_id);

ALTER TABLE trial_plays ENABLE ROW LEVEL SECURITY;

-- Anónimo puede insertar (el juego la registra sin login); solo admins leen
DROP POLICY IF EXISTS "Anyone can insert trial plays" ON trial_plays;
CREATE POLICY "Anyone can insert trial plays"
  ON trial_plays FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read trial plays" ON trial_plays;
CREATE POLICY "Admins can read trial plays"
  ON trial_plays FOR SELECT
  USING (public.is_admin());

-- ============================================================
-- 2. RPCs admin — DROP previo obligatorio: la v1 de admin_get_users
--    retornaba jsonb y la v2 retorna SETOF jsonb (42P13 si solo
--    se usa CREATE OR REPLACE).
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_get_users();
DROP FUNCTION IF EXISTS public.admin_get_users_summary();
DROP FUNCTION IF EXISTS public.admin_get_trial_stats();

-- ============================================================
-- 3. admin_get_users_summary — KPIs globales (jsonb único)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_get_users_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  SELECT jsonb_build_object(
    'total_users',       (SELECT COUNT(*) FROM auth.users),
    'new_users_7d',      (SELECT COUNT(*) FROM auth.users WHERE created_at >= NOW() - interval '7 days'),
    'new_users_30d',     (SELECT COUNT(*) FROM auth.users WHERE created_at >= NOW() - interval '30 days'),
    'users_with_plays',  (SELECT COUNT(DISTINCT user_id) FROM game_sessions WHERE user_id IS NOT NULL),
    'users_no_plays',    (SELECT COUNT(*) FROM auth.users u
                            WHERE NOT EXISTS (SELECT 1 FROM game_sessions s WHERE s.user_id = u.id)),
    'total_plays',       (SELECT COUNT(*) FROM game_sessions),
    'completed_plays',   (SELECT COUNT(*) FROM game_sessions WHERE session_result = 'completed'),
    'active_today',      (SELECT COUNT(DISTINCT user_id) FROM game_sessions
                            WHERE user_id IS NOT NULL
                              AND started_at >= (NOW() AT TIME ZONE 'America/Santiago')::date
                                                 AT TIME ZONE 'America/Santiago'),
    'active_7d',         (SELECT COUNT(DISTINCT user_id) FROM game_sessions
                            WHERE user_id IS NOT NULL AND started_at >= NOW() - interval '7 days'),
    'active_30d',        (SELECT COUNT(DISTINCT user_id) FROM game_sessions
                            WHERE user_id IS NOT NULL AND started_at >= NOW() - interval '30 days'),
    'trial_plays',       (SELECT COUNT(*) FROM trial_plays),
    'trial_plays_today', (SELECT COUNT(*) FROM trial_plays
                            WHERE played_at >= (NOW() AT TIME ZONE 'America/Santiago')::date
                                               AT TIME ZONE 'America/Santiago'),
    'trial_plays_7d',    (SELECT COUNT(*) FROM trial_plays WHERE played_at >= NOW() - interval '7 days')
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 3. admin_get_users — usuarios registrados con stats
--    SETOF jsonb: una fila jsonb por usuario (patrón robusto,
--    evita jsonb_agg + row_to_jsonb que fallaba en producción).
--    Ordenados por XP desc. Emails visibles solo vía SECURITY DEFINER.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'registered_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'display_name', pp.display_name,
    'avatar_url', pp.avatar_url,
    'xp', COALESCE(pp.xp, 0),
    'level', COALESCE(pp.level, 1),
    'total_games_completed', COALESCE(pp.total_games_completed, 0),
    'current_streak', COALESCE(pp.current_streak, 0),
    'last_played_date', pp.last_played_date,
    'plays_count', (SELECT COUNT(*) FROM game_sessions s WHERE s.user_id = u.id),
    'completions', (SELECT COUNT(*) FROM game_sessions s WHERE s.user_id = u.id AND s.session_result = 'completed'),
    'playtime_seconds', (SELECT COALESCE(SUM(s.duration_seconds), 0) FROM game_sessions s WHERE s.user_id = u.id),
    'last_session_at', (SELECT MAX(s.started_at) FROM game_sessions s WHERE s.user_id = u.id)
  )
  FROM auth.users u
  LEFT JOIN player_profiles pp ON pp.user_id = u.id
  ORDER BY COALESCE(pp.xp, 0) DESC;
END;
$$;

-- ============================================================
-- 4. admin_get_trial_stats — pruebas de invitados
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_get_trial_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  SELECT jsonb_build_object(
    'totals', jsonb_build_object(
      'plays', (SELECT COUNT(*) FROM trial_plays),
      'unique_sessions', (SELECT COUNT(DISTINCT session_id) FROM trial_plays WHERE session_id IS NOT NULL)
    ),
    'by_day', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', d, 'plays', n) ORDER BY d)
      FROM (
        SELECT (played_at AT TIME ZONE 'America/Santiago')::date AS d, COUNT(*) AS n
        FROM trial_plays
        WHERE played_at >= NOW() - interval '30 days'
        GROUP BY 1
      ) day_rows
    ), '[]'::jsonb),
    'by_game', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('game_id', g, 'plays', n) ORDER BY n DESC)
      FROM (
        SELECT game_id AS g, COUNT(*) AS n
        FROM trial_plays
        GROUP BY 1
      ) game_rows
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Refrescar schema cache de PostgREST
NOTIFY pgrst, 'reload schema cache';
