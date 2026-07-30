-- ============================================================
-- Migración mínima para que GameContainer funcione con la sopa
-- (subset de 00004 + 00005, idempotente — seguro correrlo N veces)
--
-- Crea:
--   1. Extend player_profiles con display_name, avatar_url
--   2. Extend games con version, protocol_version, progress_schema_version, capabilities
--   3. game_sessions table
--   4. RPCs: increment_game_completions, close_session, increment_game_plays, add_player_xp
--
-- No crea: user_game_progress, achievements, user_global_stats,
--   activity_feed, favorites, ni las policies de RLS adicionales.
--   Esas tablas existen en 00004 pero el GameContainer no las toca.
-- ============================================================

-- ============================================================
-- 1. Extender player_profiles con display_name y avatar_url
-- ============================================================
ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ============================================================
-- 2. Extender games con campos de protocolo y capabilities
--    (GameContainer.tsx lee game.version, game.protocol_version,
--     game.progress_schema_version, game.capabilities)
-- ============================================================
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS version TEXT DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS protocol_version TEXT DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS progress_schema_version TEXT DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS capabilities TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS supported_events TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS supported_commands TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS campaign_placements TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS supported_rewards TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS iframe_permissions TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS min_age INTEGER,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS screenshots TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trailer_url TEXT,
  ADD COLUMN IF NOT EXISTS developer TEXT DEFAULT 'JuegaHipHop',
  ADD COLUMN IF NOT EXISTS privacy_url TEXT,
  ADD COLUMN IF NOT EXISTS terms_url TEXT;

-- ============================================================
-- 3. game_sessions — tracking de sesiones por usuario
--    (GameContainer startSession inserta acá al iniciar el iframe)
-- ============================================================
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  session_type TEXT NOT NULL DEFAULT 'authenticated'
    CHECK (session_type IN ('authenticated', 'guest', 'anonymous')),
  device_info JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  session_result TEXT
    CHECK (session_result IN ('completed', 'abandoned', 'error', 'timeout', 'unknown')),
  game_version TEXT,
  protocol_version TEXT,
  total_score INTEGER DEFAULT 0,
  items_completed INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_gs_user ON game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_gs_game ON game_sessions(game_id);
CREATE INDEX IF NOT EXISTS idx_gs_started ON game_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_gs_active ON game_sessions((ended_at IS NULL));

-- RLS en game_sessions
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'game_sessions' AND policyname = 'Users can read own sessions'
  ) THEN
    CREATE POLICY "Users can read own sessions"
      ON game_sessions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'game_sessions' AND policyname = 'Users can insert own sessions'
  ) THEN
    CREATE POLICY "Users can insert own sessions"
      ON game_sessions FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'game_sessions' AND policyname = 'Users can update own sessions'
  ) THEN
    CREATE POLICY "Users can update own sessions"
      ON game_sessions FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 4. RPCs — funciones que GameContainer invoca
-- ============================================================

-- 4.1 increment_game_plays — GameContainer la llama al iniciar sesion
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

-- 4.2 increment_game_completions — GameContainer la llama tras game_completed
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

-- 4.3 close_session — GameContainer la llama al cerrar el iframe (sendBeacon)
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

-- 4.4 add_player_xp — Suma XP al player_profiles y recalcula level
--                      (curva: cada nivel requiere level * 500 XP)
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

-- ============================================================
-- 5. Refrescar schema cache de PostgREST
--    (Supabase puede demorar en reconocer nuevas tablas/RPCs)
-- ============================================================
NOTIFY pgrst, 'reload schema cache';

-- ============================================================
-- 6. Verificación rápida — pegar al final de la consola para confirmar
-- ============================================================
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'player_profiles' AND column_name IN ('display_name','avatar_url');
-- SELECT to_regclass('public.game_sessions') as game_sessions_exists;
-- SELECT proname FROM pg_proc WHERE proname IN ('increment_game_completions','close_session','increment_game_plays','add_player_xp');
