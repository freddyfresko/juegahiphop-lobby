-- ============================================================
-- JuegaHipHop — Phase A: Platform Foundation
-- Migration 00004: Complete data model for the platform.
--
-- This migration adds:
-- 1. Missing columns to player_profiles (display_name, avatar_url)
-- 2. Extended game manifest columns (capabilities, events, placements, etc.)
-- 3. user_game_progress table (versioned progress per game)
-- 4. game_sessions table (session tracking)
-- 5. achievements definitions table
-- 6. user_global_stats table
-- 7. activity_feed table
-- 8. favorites table
-- ============================================================

-- ============================================================
-- 1. Extend player_profiles
-- ============================================================
ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ============================================================
-- 2. Extend games table — Full Game Manifest
-- ============================================================
ALTER TABLE games
  -- Version del juego
  ADD COLUMN IF NOT EXISTS version TEXT DEFAULT '1.0.0',
  -- Versión del protocolo de comunicación que soporta
  ADD COLUMN IF NOT EXISTS protocol_version TEXT DEFAULT '1.0.0',
  -- Versión del esquema de progreso (para migraciones)
  ADD COLUMN IF NOT EXISTS progress_schema_version TEXT DEFAULT '1.0.0',
  -- Capacidades declarativas del juego (array de strings)
  ADD COLUMN IF NOT EXISTS capabilities TEXT[] DEFAULT '{}',
  -- Eventos que el juego puede emitir (desde el SDK)
  ADD COLUMN IF NOT EXISTS supported_events TEXT[] DEFAULT '{}',
  -- Comandos que el juego acepta (desde el SDK)
  ADD COLUMN IF NOT EXISTS supported_commands TEXT[] DEFAULT '{}',
  -- Placements de campaña que soporta el juego
  ADD COLUMN IF NOT EXISTS campaign_placements TEXT[] DEFAULT '{}',
  -- Recompensas que soporta (para rewarded campaigns)
  ADD COLUMN IF NOT EXISTS supported_rewards TEXT[] DEFAULT '{}',
  -- Permisos adicionales para el CSP/iframe
  ADD COLUMN IF NOT EXISTS iframe_permissions TEXT[] DEFAULT '{}',
  -- Edad mínima recomendada
  ADD COLUMN IF NOT EXISTS min_age INTEGER,
  -- Tags / etiquetas para filtrado
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  -- URLs de screenshots / capturas
  ADD COLUMN IF NOT EXISTS screenshots TEXT[] DEFAULT '{}',
  -- Video de gameplay (URL)
  ADD COLUMN IF NOT EXISTS trailer_url TEXT,
  -- Desarrollador
  ADD COLUMN IF NOT EXISTS developer TEXT DEFAULT 'JuegaHipHop',
  -- Política de privacidad del juego
  ADD COLUMN IF NOT EXISTS privacy_url TEXT,
  -- Términos de servicio del juego
  ADD COLUMN IF NOT EXISTS terms_url TEXT;

-- ============================================================
-- 3. user_game_progress — Progreso versionado por juego
-- Reemplaza funcionalmente a game_state con schema versioning
-- ============================================================
CREATE TABLE IF NOT EXISTS user_game_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  schema_version TEXT NOT NULL DEFAULT '1.0.0',
  progress_data JSONB NOT NULL DEFAULT '{}',
  statistics_data JSONB NOT NULL DEFAULT '{}',
  achievements_data TEXT[] DEFAULT '{}',
  settings_data JSONB DEFAULT '{}',
  best_score INTEGER,
  total_plays INTEGER NOT NULL DEFAULT 0,
  total_playtime_seconds BIGINT NOT NULL DEFAULT 0,
  last_played_at TIMESTAMPTZ,
  sync_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Un usuario solo tiene un progreso por juego
  UNIQUE (user_id, game_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ugp_user ON user_game_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_ugp_game ON user_game_progress(game_id);
CREATE INDEX IF NOT EXISTS idx_ugp_last_played ON user_game_progress(last_played_at DESC);
CREATE INDEX IF NOT EXISTS idx_ugp_sync ON user_game_progress(sync_version) WHERE sync_version > 0;

-- Trigger para updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_game_progress_updated_at'
  ) THEN
    CREATE TRIGGER update_user_game_progress_updated_at
      BEFORE UPDATE ON user_game_progress
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- RLS
ALTER TABLE user_game_progress ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_game_progress' AND policyname = 'Users can read own progress'
  ) THEN
    CREATE POLICY "Users can read own progress"
      ON user_game_progress FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_game_progress' AND policyname = 'Users can insert own progress'
  ) THEN
    CREATE POLICY "Users can insert own progress"
      ON user_game_progress FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_game_progress' AND policyname = 'Users can update own progress'
  ) THEN
    CREATE POLICY "Users can update own progress"
      ON user_game_progress FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 4. game_sessions — Registro de sesiones de juego
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
CREATE INDEX IF NOT EXISTS idx_gs_active ON game_sessions(ended_at IS NULL);

-- RLS
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
-- 5. achievements — Definiciones de logros
-- ============================================================
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL DEFAULT 'game'
    CHECK (type IN ('game', 'global', 'hidden', 'seasonal')),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🏆',
  game_id TEXT,
  -- Condición de desbloqueo (descriptiva, la validación es en código)
  condition_description TEXT,
  -- Rareza estimada (se actualiza periódicamente)
  rarity TEXT DEFAULT 'common'
    CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  -- XP que otorga al desbloquear
  xp_reward INTEGER NOT NULL DEFAULT 0,
  -- Si es visible para el jugador antes de desbloquear
  is_visible BOOLEAN DEFAULT true,
  -- Orden de visualización
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ach_type ON achievements(type);
CREATE INDEX IF NOT EXISTS idx_ach_game ON achievements(game_id);

-- RLS — lectura pública
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'achievements' AND policyname = 'Anyone can read achievements'
  ) THEN
    CREATE POLICY "Anyone can read achievements"
      ON achievements FOR SELECT
      USING (true);
  END IF;
END $$;

-- ============================================================
-- 6. user_global_stats — Métricas globales del jugador
-- ============================================================
CREATE TABLE IF NOT EXISTS user_global_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  -- Tiempo total jugado en segundos
  total_playtime_seconds BIGINT NOT NULL DEFAULT 0,
  -- Sesiones totales
  total_sessions INTEGER NOT NULL DEFAULT 0,
  -- Sesiones completadas
  completed_sessions INTEGER NOT NULL DEFAULT 0,
  -- Días con actividad
  active_days INTEGER NOT NULL DEFAULT 0,
  -- Rachas
  longest_streak INTEGER NOT NULL DEFAULT 0,
  -- Logros desbloqueados
  total_achievements INTEGER NOT NULL DEFAULT 0,
  -- Juegos diferentes probados
  games_tried INTEGER NOT NULL DEFAULT 0,
  -- Juegos diferentes completados (al menos un ítem)
  games_completed INTEGER NOT NULL DEFAULT 0,
  -- Promedio de progreso entre todos los juegos
  average_progress_percent NUMERIC(5,2) DEFAULT 0,
  -- Última fecha de actividad
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE user_global_stats ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_global_stats' AND policyname = 'Users can read own stats'
  ) THEN
    CREATE POLICY "Users can read own stats"
      ON user_global_stats FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_global_stats' AND policyname = 'Users can insert own stats'
  ) THEN
    CREATE POLICY "Users can insert own stats"
      ON user_global_stats FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_global_stats' AND policyname = 'Users can update own stats'
  ) THEN
    CREATE POLICY "Users can update own stats"
      ON user_global_stats FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 7. activity_feed — Feed de actividad reciente
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL
    CHECK (activity_type IN (
      'game_started', 'game_completed', 'game_abandoned',
      'achievement_unlocked', 'level_up', 'milestone_reached',
      'campaign_viewed', 'reward_claimed', 'game_favorited',
      'session_ended', 'streak_milestone'
    )),
  game_id TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_af_user ON activity_feed(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_af_type ON activity_feed(activity_type);
CREATE INDEX IF NOT EXISTS idx_af_created ON activity_feed(created_at DESC);

-- RLS
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'activity_feed' AND policyname = 'Users can read own activity'
  ) THEN
    CREATE POLICY "Users can read own activity"
      ON activity_feed FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'activity_feed' AND policyname = 'Users can insert own activity'
  ) THEN
    CREATE POLICY "Users can insert own activity"
      ON activity_feed FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 8. favorites — Juegos favoritos
-- ============================================================
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, game_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_fav_user ON favorites(user_id);

-- RLS
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'favorites' AND policyname = 'Users can read own favorites'
  ) THEN
    CREATE POLICY "Users can read own favorites"
      ON favorites FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'favorites' AND policyname = 'Users can manage own favorites'
  ) THEN
    CREATE POLICY "Users can manage own favorites"
      ON favorites FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'favorites' AND policyname = 'Users can delete own favorites'
  ) THEN
    CREATE POLICY "Users can delete own favorites"
      ON favorites FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 9. Update RLS on existing tables
-- ============================================================

-- player_profiles RLS
ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'player_profiles' AND policyname = 'Users can read own profile'
  ) THEN
    CREATE POLICY "Users can read own profile"
      ON player_profiles FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'player_profiles' AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile"
      ON player_profiles FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'player_profiles' AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON player_profiles FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- game_state RLS (existing table)
ALTER TABLE game_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'game_state' AND policyname = 'Users can read own game state'
  ) THEN
    CREATE POLICY "Users can read own game state"
      ON game_state FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'game_state' AND policyname = 'Users can upsert own game state'
  ) THEN
    CREATE POLICY "Users can upsert own game state"
      ON game_state FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'game_state' AND policyname = 'Users can update own game state'
  ) THEN
    CREATE POLICY "Users can update own game state"
      ON game_state FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- game_completions RLS
ALTER TABLE game_completions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'game_completions' AND policyname = 'Users can read own completions'
  ) THEN
    CREATE POLICY "Users can read own completions"
      ON game_completions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'game_completions' AND policyname = 'Users can insert own completions'
  ) THEN
    CREATE POLICY "Users can insert own completions"
      ON game_completions FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- achievement_unlocks RLS
ALTER TABLE achievement_unlocks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'achievement_unlocks' AND policyname = 'Users can read own unlocks'
  ) THEN
    CREATE POLICY "Users can read own unlocks"
      ON achievement_unlocks FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'achievement_unlocks' AND policyname = 'Users can insert own unlocks'
  ) THEN
    CREATE POLICY "Users can insert own unlocks"
      ON achievement_unlocks FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 10. Seed data: Global achievements
-- ============================================================
INSERT INTO achievements (achievement_id, type, name, description, icon, game_id, condition_description, rarity, xp_reward, sort_order)
VALUES
  -- Logros globales
  ('first_game', 'global', 'Primer Juego', 'Juega tu primer juego en JuegaHipHop', '🎮', NULL, 'Jugar al menos un juego', 'common', 100, 1),
  ('three_games', 'global', 'Explorador', 'Prueba tres juegos diferentes', '🎯', NULL, 'Jugar al menos 3 juegos distintos', 'uncommon', 250, 2),
  ('all_games', 'global', 'JuegaHipHop Completo', 'Juega todos los juegos disponibles', '🏆', NULL, 'Jugar todos los juegos de la plataforma', 'epic', 1000, 3),
  ('ten_sessions', 'global', 'Dedicación', 'Completa 10 sesiones de juego', '⏱️', NULL, 'Acumular 10 sesiones', 'common', 150, 4),
  ('fifty_sessions', 'global', 'Vicio Saludable', 'Completa 50 sesiones de juego', '🔥', NULL, 'Acumular 50 sesiones', 'rare', 500, 5),
  ('streak_3', 'global', 'Racha', 'Mantén una racha de 3 días', '📅', NULL, 'Alcanzar 3 días de racha', 'common', 100, 6),
  ('streak_7', 'global', 'Semana Hip Hop', 'Mantén una racha de 7 días', '📅', NULL, 'Alcanzar 7 días de racha', 'uncommon', 300, 7),
  ('streak_30', 'global', 'Mes Cultural', 'Mantén una racha de 30 días', '💪', NULL, 'Alcanzar 30 días de racha', 'legendary', 2000, 8),
  ('first_achievement', 'global', 'Coleccionista', 'Consigue tu primer logro', '⭐', NULL, 'Desbloquear al menos 1 logro', 'common', 50, 9),
  ('ten_achievements', 'global', 'Logrador', 'Consigue 10 logros', '🏅', NULL, 'Desbloquear 10 logros', 'rare', 500, 10),
  ('level_5', 'global', 'Aprendiz', 'Alcanza el nivel 5', '📈', NULL, 'Subir al nivel 5', 'common', 200, 11),
  ('level_10', 'global', 'Conocedor', 'Alcanza el nivel 10', '🌟', NULL, 'Subir al nivel 10', 'uncommon', 500, 12),
  ('level_25', 'global', 'Experto', 'Alcanza el nivel 25', '👑', NULL, 'Subir al nivel 25', 'rare', 1500, 13),
  ('level_50', 'global', 'Leyenda', 'Alcanza el nivel 50', '🎤', NULL, 'Subir al nivel 50', 'legendary', 5000, 14),

  -- Logros de Sopa de Knowledge
  ('sopa_first_word', 'game', 'Primera Palabra', 'Encuentra tu primera palabra en Sopa de Knowledge', '🔤', 'sopa', 'Encontrar al menos 1 palabra', 'common', 50, 15),
  ('sopa_50_words', 'game', 'Palabrero', 'Encuentra 50 palabras en Sopa de Knowledge', '📝', 'sopa', 'Encontrar 50 palabras', 'uncommon', 200, 16),
  ('sopa_100_words', 'game', 'Sabiondo', 'Encuentra 100 palabras en Sopa de Knowledge', '📚', 'sopa', 'Encontrar 100 palabras', 'rare', 500, 17),
  ('sopa_all_words', 'game', 'Knowledge Master', 'Encuentra todas las palabras de Sopa de Knowledge', '👑', 'sopa', 'Completar las 930 palabras', 'legendary', 3000, 18),
  ('sopa_first_category', 'game', 'Categoría Desbloqueada', 'Completa tu primera categoría', '🎯', 'sopa', 'Completar 1 categoría completa', 'common', 100, 19),
  ('sopa_all_categories', 'game', 'Enciclopedia', 'Completa todas las categorías de Sopa', '📖', 'sopa', 'Completar las 9 categorías', 'epic', 1500, 20),

  -- Logros de Puzzle HH
  ('puzzle_first', 'game', 'Primer Puzzle', 'Completa tu primer puzzle', '🧩', 'puzzle', 'Completar 1 puzzle', 'common', 50, 21),
  ('puzzle_10', 'game', 'Armador', 'Completa 10 puzzles', '🧩', 'puzzle', 'Completar 10 puzzles', 'uncommon', 200, 22),
  ('puzzle_50', 'game', 'Maestro del Puzzle', 'Completa 50 puzzles', '🏆', 'puzzle', 'Completar 50 puzzles', 'rare', 800, 23),

  -- Logros de Hip Hop Fighters
  ('fighters_first', 'game', 'Primera Pelea', 'Gana tu primera batalla', '🥊', 'fighters', 'Ganar 1 batalla', 'common', 50, 24),
  ('fighters_10', 'game', 'Peleador', 'Gana 10 batallas', '💪', 'fighters', 'Ganar 10 batallas', 'uncommon', 200, 25),
  ('fighters_first_boss', 'game', 'Cazador de Jefes', 'Derrota a tu primer jefe', '👹', 'fighters', 'Derrotar 1 jefe', 'rare', 500, 26),
  ('fighters_all_bosses', 'game', 'Legendario', 'Derrota a todos los jefes', '👑', 'fighters', 'Derrotar todos los jefes', 'epic', 2000, 27)
ON CONFLICT (achievement_id) DO NOTHING;
