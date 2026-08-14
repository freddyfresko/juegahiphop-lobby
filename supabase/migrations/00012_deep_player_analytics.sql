-- ============================================================
-- JuegaHipHop — Deep Player Analytics
-- Migration 00012: telemetría completa por usuario y por juego
--
-- El lobby es el CEREBRO. Esta migración le da las herramientas
-- para guardar TODO lo que pasa en cada partida:
--
--   1. game_events        → tabla de telemetría (eventos por usuario/juego/sesión)
--   2. game_sessions      → + difficulty, level_id (contexto de la partida)
--   3. game_state         → + total_playtime_seconds, completions_count
--   4. RPC record_game_event        → registrar cualquier evento (started, completed, score, logro…)
--   5. RPC update_session_score     → score en vivo (throttle) sin cerrar la sesión
--   6. RPC finish_game_session      → cierra sesión + agrega playtime/best/completions a game_state
--   7. RPC close_session (mejorada)→ cierre por sendBeacon + suma playtime al aggregate
--
-- Idempotente — seguro correrlo N veces.
-- ============================================================

-- ============================================================
-- 1. game_sessions — contexto extra de la partida
-- ============================================================
ALTER TABLE game_sessions
  ADD COLUMN IF NOT EXISTS difficulty TEXT,
  ADD COLUMN IF NOT EXISTS level_id TEXT;

-- ============================================================
-- 2. game_state — agregados de larga duración
-- ============================================================
ALTER TABLE game_state
  ADD COLUMN IF NOT EXISTS total_playtime_seconds BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completions_count INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- 3. game_events — telemetría cruda
--    Una fila por evento: game_started, score_updated,
--    game_completed, achievement_unlocked, error, etc.
-- ============================================================
CREATE TABLE IF NOT EXISTS game_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas típicas:
--   - historial por usuario+juego (perfil)
--   - eventos por sesión (sesión completa reconstruible)
--   - filtro por tipo (analytics global)
CREATE INDEX IF NOT EXISTS idx_ge_user_game ON game_events(user_id, game_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ge_session ON game_events(session_id);
CREATE INDEX IF NOT EXISTS idx_ge_type ON game_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ge_created ON game_events(created_at DESC);

-- RLS: los usuarios ven sus propios eventos; admin ve todo
ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own events" ON game_events;
CREATE POLICY "Users can insert own events"
  ON game_events FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own events" ON game_events;
CREATE POLICY "Users can read own events"
  ON game_events FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================
-- 4. RPC record_game_event — registra un evento de telemetría
--    Validación: no se pueden registrar eventos de otro usuario.
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_game_event(
  p_user_id UUID,
  p_game_id TEXT,
  p_session_id UUID DEFAULT NULL,
  p_event_type TEXT DEFAULT 'event',
  p_event_data JSONB DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NOT NULL AND p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden: cannot record events for another user';
  END IF;

  INSERT INTO game_events (user_id, session_id, game_id, event_type, event_data)
  VALUES (p_user_id, p_session_id, p_game_id, p_event_type, p_event_data);
END;
$$;

-- ============================================================
-- 5. RPC update_session_score — score en vivo (throttle)
--    Actualiza el score máximo de la sesión sin cerrarla.
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_session_score(
  p_session_id UUID,
  p_score INTEGER DEFAULT 0,
  p_playtime_seconds INTEGER DEFAULT NULL
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE game_sessions
  SET
    total_score = GREATEST(total_score, p_score),
    duration_seconds = COALESCE(p_playtime_seconds, duration_seconds)
  WHERE id = p_session_id
    AND ended_at IS NULL
    AND user_id = auth.uid();
$$;

-- ============================================================
-- 6. RPC finish_game_session — cierre de sesión con resultado
--    - cierra la sesión (ended_at, resultado, score, items, metadata)
--    - agrega playtime / best_score / completions a game_state
--    - incrementa total_games_completed en player_profiles
-- ============================================================
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
END;
$$;

-- ============================================================
-- 7. RPC close_session — MEJORADA (sendBeacon / abandono)
--    La versión anterior solo cerraba la sesión. Ahora además
--    suma el playtime al agregado de game_state.
--    (Sin validación auth.uid(): se llama vía sendBeacon sin JWT)
-- ============================================================
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
END;
$$;

-- ============================================================
-- 8. Refrescar schema cache de PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema cache';

-- ============================================================
-- 9. Verificación rápida (pegar en SQL Editor)
-- ============================================================
-- SELECT to_regclass('public.game_events') AS game_events_exists;
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name IN ('game_sessions','game_state')
--     AND column_name IN ('difficulty','level_id','total_playtime_seconds','completions_count');
-- SELECT proname FROM pg_proc
--   WHERE proname IN ('record_game_event','update_session_score','finish_game_session','close_session');
