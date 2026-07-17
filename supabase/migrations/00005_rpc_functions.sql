-- ============================================================
-- JuegaHipHop — Helper functions for the Game Container
-- Migration 00005: RPC functions
-- ============================================================

-- ============================================================
-- 1. Incrementar total_plays en game_state
-- ============================================================
CREATE OR REPLACE FUNCTION increment_game_plays(
  p_user_id UUID,
  p_game_id TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO game_state (user_id, game_id, total_plays, last_played_at, updated_at)
  VALUES (p_user_id, p_game_id, 1, NOW(), NOW())
  ON CONFLICT (user_id, game_id)
  DO UPDATE SET
    total_plays = game_state.total_plays + 1,
    last_played_at = NOW(),
    updated_at = NOW();
END;
$$;

-- ============================================================
-- 2. Incrementar total_games_completed en player_profiles
-- ============================================================
CREATE OR REPLACE FUNCTION increment_game_completions(
  p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE player_profiles
  SET
    total_games_completed = total_games_completed + 1,
    last_played_date = CURRENT_DATE,
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;

-- ============================================================
-- 3. Cerrar sesión de juego (usado por sendBeacon en beforeunload)
-- ============================================================
CREATE OR REPLACE FUNCTION close_session(
  p_session_id UUID,
  p_result TEXT DEFAULT 'abandoned',
  p_duration INTEGER DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE game_sessions
  SET
    ended_at = NOW(),
    duration_seconds = p_duration,
    session_result = p_result
  WHERE id = p_session_id AND ended_at IS NULL;
END;
$$;

-- ============================================================
-- 4. Incrementar XP del jugador (para logros y recompensas)
-- ============================================================
CREATE OR REPLACE FUNCTION add_player_xp(
  p_user_id UUID,
  p_xp INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_xp INTEGER;
  v_new_level INTEGER;
BEGIN
  UPDATE player_profiles
  SET
    xp = xp + p_xp,
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING xp INTO v_new_xp;

  -- Calcular nivel basado en XP (cada nivel requiere level * 500 XP)
  v_new_level := 1;
  WHILE v_new_xp >= (v_new_level * 500) LOOP
    v_new_xp := v_new_xp - (v_new_level * 500);
    v_new_level := v_new_level + 1;
  END LOOP;

  UPDATE player_profiles
  SET level = v_new_level
  WHERE user_id = p_user_id AND level < v_new_level;
END;
$$;
