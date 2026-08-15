-- ============================================================
-- JuegaHipHop — Reset de progreso por juego
-- Migration 00021: RPC reset_game_progress(p_game_id)
--
-- Permite que cada usuario reinicie un juego y empiece de 0.
-- Borra TODAS las tablas de progreso del usuario para ese
-- juego en UNA transacción (rápido, sin round-trips) y
-- recalcula las stats globales del jugador.
--
-- Tablas limpiadas (por user_id + game_id):
--   user_game_progress  → progreso versionado (canónico)
--   game_state          → agregados legacy + state JSONB
--   game_sessions       → historial (baja ranking/XP del juego)
--   game_completions    → items completados
--   achievement_unlocks → logros de ESE juego (via achievements.game_id)
--   game_events         → telemetría
--
-- El ranking y las stats globales se recalculan con
-- recalc_player_stats (misma definición que 00018).
--
-- Idempotente — seguro correrlo N veces.
-- ============================================================

CREATE OR REPLACE FUNCTION public.reset_game_progress(p_game_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  -- Solo usuarios autenticados pueden resetear su propio progreso
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para resetear tu progreso';
  END IF;

  -- 1. Progreso versionado (canónico)
  DELETE FROM user_game_progress
  WHERE user_id = v_user_id AND game_id = p_game_id;

  -- 2. Agregados legacy + state JSONB (la Sopa la usa en save/load)
  DELETE FROM game_state
  WHERE user_id = v_user_id AND game_id = p_game_id;

  -- 3. Historial de partidas (baja ranking + XP de ese juego)
  DELETE FROM game_sessions
  WHERE user_id = v_user_id AND game_id = p_game_id;

  -- 4. Items completados
  DELETE FROM game_completions
  WHERE user_id = v_user_id AND game_id = p_game_id;

  -- 5. Logros de ESE juego (los globales no se tocan)
  DELETE FROM achievement_unlocks u
  USING achievements a
  WHERE u.user_id = v_user_id
    AND u.achievement_id = a.achievement_id
    AND a.game_id = p_game_id;

  -- 6. Telemetría
  DELETE FROM game_events
  WHERE user_id = v_user_id AND game_id = p_game_id;

  -- 7. Recalcular XP/nivel/racha globales (las partidas de ese
  --    juego ya no cuentan)
  PERFORM public.recalc_player_stats(v_user_id);

  -- 8. Recalcular contador de juegos completados (baja si el juego
  --    resetado tenía completations)
  UPDATE player_profiles
  SET
    total_games_completed = (
      SELECT COUNT(*) FROM game_state g
      WHERE g.user_id = v_user_id AND g.completions_count > 0
    ),
    updated_at = NOW()
  WHERE user_id = v_user_id;
END;
$$;

-- Permisos: cualquier usuario autenticado puede llamar
GRANT EXECUTE ON FUNCTION public.reset_game_progress(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema cache';
