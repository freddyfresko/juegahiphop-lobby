-- ============================================================
-- JuegaHipHop — Definiciones de logros (tabla faltante)
-- Migration 00019: crea la tabla `achievements` que el DDL de
-- 00004 definía pero NUNCA llegó a la DB (solo existía
-- achievement_unlocks con id/user_id/achievement_id/unlocked_at,
-- sin nombre/descripción/icono → el perfil mostraba solo la
-- fecha). Con esta tabla, el perfil hace JOIN y muestra
-- nombre + descripción + icono de cada logro.
--
-- Idempotente — seguro correrlo N veces.
-- ============================================================

-- ─── 1. Tabla de definiciones ───
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL DEFAULT 'game'
    CHECK (type IN ('game', 'global', 'hidden', 'seasonal')),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🏆',
  game_id TEXT,
  condition_description TEXT,
  rarity TEXT DEFAULT 'common'
    CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  xp_reward INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ach_type ON achievements(type);
CREATE INDEX IF NOT EXISTS idx_ach_game ON achievements(game_id);

-- ─── 2. RLS — lectura pública (el perfil la lee para el JOIN) ───
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

-- ─── 3. Seed: logros globales + por juego (mismo catálogo de 00004) ───
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

-- ─── 4. Refrescar schema cache ───
NOTIFY pgrst, 'reload schema cache';
