-- ============================================================
-- JuegaHipHop — CONSISTENCIA DE NÚMEROS (home = perfil = ranking)
-- Migration 00018: cierra sesiones huérfanas + unifica la
-- definición de XP/nivel/racha en SOLO sesiones cerradas.
--
-- PROBLEMA (ago-2026, reportado por Freddy):
--   home, perfil y ranking mostraban cifras distintas.
--   Causa raíz: sesiones NUNCA cerradas (ended_at IS NULL) con
--   score (el update_session_score sí guarda, pero el cierre
--   fallaba: finish_game_session exige auth.uid() y el JWT puede
--   expirar durante el juego; endSession del lobby hacía UPDATE
--   directo sin pasar por las RPCs).
--   → Perfil sumaba TODAS las sesiones (abiertas incluidas),
--     Ranking solo cerradas, Home el último recalc. 3 números.
--
-- FIX:
--   1. Cerrar sesiones abiertas huérfanas (>30 min) como
--      'abandoned', CONSERVANDO su total_score (el XP se ganó).
--   2. recalc_player_stats: XP/nivel/racha = SOLO sesiones
--      cerradas (misma definición que ranking_general).
--   3. finish_game_session: aceptar auth.uid() NULL (JWT
--      expirado) validando por session_id (UUID aleatorio,
--      mismo riesgo aceptado que close_session).
--   4. Backfill: recalc para todos los usuarios.
--
-- Idempotente — seguro correrlo N veces.
-- ============================================================

-- ─── 1. Cerrar sesiones huérfanas (abiertas hace > 30 min) ───
-- Conserva total_score: el XP de esa partida SÍ se ganó y debe
-- contar en ranking/perfil/home. Se marca 'abandoned' porque no
-- hay game_completed confirmado (no sabemos si terminó).
UPDATE game_sessions
SET
  ended_at = COALESCE(ended_at, NOW()),
  duration_seconds = COALESCE(duration_seconds, GREATEST(EXTRACT(EPOCH FROM (NOW() - started_at))::int, 0)),
  session_result = COALESCE(session_result, 'abandoned')
WHERE ended_at IS NULL
  AND started_at < NOW() - interval '30 minutes';

-- ─── 2. recalc_player_stats — SOLO sesiones cerradas ───
CREATE OR REPLACE FUNCTION public.recalc_player_stats(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_xp INTEGER;
  v_level INTEGER;
  v_streak INTEGER;
  v_hoy DATE;
BEGIN
  -- "Hoy" en hora de Chile
  v_hoy := (NOW() AT TIME ZONE 'America/Santiago')::date;

  -- XP = suma de scores de partidas CERRADAS (misma definición que
  -- ranking_general: ended_at IS NOT NULL)
  SELECT COALESCE(SUM(total_score), 0) INTO v_xp
  FROM game_sessions
  WHERE user_id = p_user_id
    AND ended_at IS NOT NULL;

  v_level := FLOOR(v_xp / 300) + 1;

  -- Racha: días distintos con partidas CERRADAS, consecutivos
  WITH dias AS (
    SELECT DISTINCT (started_at AT TIME ZONE 'America/Santiago')::date AS d
    FROM game_sessions
    WHERE user_id = p_user_id AND ended_at IS NOT NULL
  ),
  seq AS (
    SELECT d, d - (ROW_NUMBER() OVER (ORDER BY d DESC))::int AS grp
    FROM dias
  )
  SELECT COUNT(*) INTO v_streak
  FROM seq
  WHERE grp = (SELECT grp FROM seq ORDER BY d DESC LIMIT 1)
    AND (SELECT MAX(d) FROM seq) >= v_hoy - 1;

  UPDATE player_profiles
  SET
    xp = v_xp,
    level = v_level,
    current_streak = v_streak,
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;

-- ─── 3. finish_game_session — tolerar JWT expirado ───
-- Antes exigía user_id = auth.uid(); si el JWT expiraba durante
-- una partida larga, auth.uid() era NULL → RETURN silencioso →
-- sesión abierta para siempre. Ahora: si hay auth, exige dueño;
-- si no hay auth (expirado/beacon), valida por session_id
-- (UUID aleatorio inencontrable — mismo riesgo que close_session).
CREATE OR REPLACE FUNCTION public.finish_game_session(
  p_session_id UUID,
  p_score INTEGER DEFAULT 0,
  p_items_completed INTEGER DEFAULT 0,
  p_result TEXT DEFAULT 'completed',
  p_playtime_seconds INTEGER DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_game_id TEXT;
  v_duration INTEGER;
  v_existing_meta JSONB;
BEGIN
  -- Dueño de la sesión: con auth exige user_id; sin auth (JWT
  -- expirado) acepta por session_id aleatorio.
  SELECT user_id, game_id, duration_seconds, metadata
    INTO v_user_id, v_game_id, v_duration, v_existing_meta
  FROM game_sessions
  WHERE id = p_session_id
    AND ended_at IS NULL
    AND (user_id = auth.uid() OR auth.uid() IS NULL);

  IF v_user_id IS NULL THEN
    RETURN; -- no existe, ya cerrada o no es del usuario
  END IF;

  v_duration := COALESCE(p_playtime_seconds, v_duration, 0);

  UPDATE game_sessions
  SET
    ended_at = NOW(),
    duration_seconds = v_duration,
    total_score = GREATEST(total_score, p_score),
    items_completed = GREATEST(items_completed, p_items_completed),
    session_result = p_result,
    metadata = v_existing_meta || p_metadata
  WHERE id = p_session_id;

  -- Agregados por juego (best score, playtime, completions)
  INSERT INTO game_state (
    user_id, game_id, best_score, total_plays,
    total_playtime_seconds, completions_count, last_played_at, updated_at
  )
  VALUES (
    v_user_id, v_game_id, p_score, 1,
    v_duration, CASE WHEN p_result = 'completed' THEN 1 ELSE 0 END,
    NOW(), NOW()
  )
  ON CONFLICT (user_id, game_id)
  DO UPDATE SET
    best_score = GREATEST(game_state.best_score, EXCLUDED.best_score),
    total_playtime_seconds = game_state.total_playtime_seconds + EXCLUDED.total_playtime_seconds,
    completions_count = game_state.completions_count + EXCLUDED.completions_count,
    last_played_at = NOW(),
    updated_at = NOW();

  -- Perfil global: contador de completados + última fecha
  IF p_result = 'completed' THEN
    UPDATE player_profiles
    SET
      total_games_completed = total_games_completed + 1,
      last_played_date = CURRENT_DATE,
      updated_at = NOW()
    WHERE user_id = v_user_id;
  END IF;

  PERFORM public.recalc_player_stats(v_user_id);
END;
$$;

-- ─── 4. Backfill: recalc para todos ───
DO $$
DECLARE
  u UUID;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM game_sessions LOOP
    PERFORM public.recalc_player_stats(u);
  END LOOP;
END $$;

UPDATE player_profiles
SET xp = 0, level = 1, current_streak = 0, updated_at = NOW()
WHERE user_id NOT IN (SELECT DISTINCT user_id FROM game_sessions);

NOTIFY pgrst, 'reload schema cache';

-- ============================================================
-- Verificación (pegar después):
-- SELECT u.email, pp.xp AS home_xp, pp.level AS home_level,
--        (SELECT COALESCE(SUM(total_score),0) FROM game_sessions s
--         WHERE s.user_id = u.id AND s.ended_at IS NOT NULL) AS ranking_xp,
--        (SELECT COUNT(*) FROM game_sessions s
--         WHERE s.user_id = u.id AND s.ended_at IS NULL) AS abiertas
-- FROM auth.users u JOIN player_profiles pp ON pp.user_id = u.id
-- WHERE EXISTS (SELECT 1 FROM game_sessions s WHERE s.user_id = u.id);
-- ============================================================
