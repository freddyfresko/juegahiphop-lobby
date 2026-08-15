-- ============================================================
-- JuegaHipHop — Player stats server-side (XP, nivel, racha)
-- Migration 00017: recalcula y persiste XP / nivel / racha en
-- player_profiles desde las partidas reales (game_sessions).
--
-- PROBLEMA: player_profiles.xp / level / current_streak eran
-- vestigios que nadie actualizaba (siempre 0). Solo el Perfil
-- calculaba en vivo; Sidebar / home / cards mostraban 0.
--
-- FIX:
--   1. recalc_player_stats(user_id) → recalcula XP (SUM de scores),
--      nivel (floor(xp/300)+1) y racha (días consecutivos con
--      partidas, ancla hoy/ayer, hora Chile) y persiste en
--      player_profiles.
--   2. Se llama al cerrar sesión (finish_game_session y
--      close_session).
--   3. Backfill: recalcula para TODOS los usuarios existentes.
-- ============================================================

-- ─── 1. Función de recálculo ───
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
  -- "Hoy" en hora de Chile (el usuario es de CL; evita desfase UTC)
  v_hoy := (NOW() AT TIME ZONE 'America/Santiago')::date;

  -- XP total = suma de scores de TODAS las partidas (abiertas suman 0)
  SELECT COALESCE(SUM(total_score), 0) INTO v_xp
  FROM game_sessions
  WHERE user_id = p_user_id;

  -- Nivel: cada ~300 XP sube un nivel (misma regla que el cliente)
  v_level := FLOOR(v_xp / 300) + 1;

  -- Racha: días distintos con partidas, consecutivos desde hoy/ayer.
  -- Si la última partida fue hace >1 día → 0 (se rompió).
  WITH dias AS (
    SELECT DISTINCT (started_at AT TIME ZONE 'America/Santiago')::date AS d
    FROM game_sessions
    WHERE user_id = p_user_id
  ),
  seq AS (
    SELECT d, d - (ROW_NUMBER() OVER (ORDER BY d DESC))::int AS grp
    FROM dias
  )
  SELECT COUNT(*) INTO v_streak
  FROM seq
  WHERE grp = (SELECT grp FROM seq ORDER BY d DESC LIMIT 1)
    AND (SELECT MAX(d) FROM seq) >= v_hoy - 1;

  -- Persistir (si el perfil no existe aún, el trigger 00010 lo crea)
  UPDATE player_profiles
  SET
    xp = v_xp,
    level = v_level,
    current_streak = v_streak,
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;

-- ─── 2. Llamar al cerrar sesión ───
-- finish_game_session: al final, recalculamos stats del jugador
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
  -- Solo el dueño de la sesión puede cerrarla con resultado
  SELECT user_id, game_id, duration_seconds, metadata
    INTO v_user_id, v_game_id, v_duration, v_existing_meta
  FROM game_sessions
  WHERE id = p_session_id
    AND ended_at IS NULL
    AND user_id = auth.uid();

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

  -- Agregar a los agregados por juego (best score, playtime, completions)
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

  -- ═══ NUEVO: recalcular XP / nivel / racha del jugador ═══
  PERFORM public.recalc_player_stats(v_user_id);
END;
$$;

-- close_session (sendBeacon / abandono): también recalcula
CREATE OR REPLACE FUNCTION public.close_session(
  p_session_id UUID,
  p_result TEXT DEFAULT 'abandoned',
  p_duration INTEGER DEFAULT 0
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_game_id TEXT;
BEGIN
  SELECT user_id, game_id INTO v_user_id, v_game_id
  FROM game_sessions
  WHERE id = p_session_id AND ended_at IS NULL;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE game_sessions
  SET
    ended_at = NOW(),
    duration_seconds = p_duration,
    session_result = p_result
  WHERE id = p_session_id AND ended_at IS NULL;

  -- Sumar playtime al aggregate aunque la sesión no haya terminado "bien"
  INSERT INTO game_state (
    user_id, game_id, total_playtime_seconds, total_plays, last_played_at, updated_at
  )
  VALUES (v_user_id, v_game_id, p_duration, 1, NOW(), NOW())
  ON CONFLICT (user_id, game_id)
  DO UPDATE SET
    total_playtime_seconds = game_state.total_playtime_seconds + EXCLUDED.total_playtime_seconds,
    last_played_at = NOW(),
    updated_at = NOW();

  -- ═══ NUEVO: recalcular XP / nivel / racha del jugador ═══
  PERFORM public.recalc_player_stats(v_user_id);
END;
$$;

-- ─── 3. Backfill: recalcular para todos los usuarios con partidas ───
DO $$
DECLARE
  u UUID;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM game_sessions LOOP
    PERFORM public.recalc_player_stats(u);
  END LOOP;
END $$;

-- También perfiles sin partidas: dejar stats en 0 consistente
UPDATE player_profiles
SET xp = 0, level = 1, current_streak = 0, updated_at = NOW()
WHERE user_id NOT IN (SELECT DISTINCT user_id FROM game_sessions);

NOTIFY pgrst, 'reload schema cache';
