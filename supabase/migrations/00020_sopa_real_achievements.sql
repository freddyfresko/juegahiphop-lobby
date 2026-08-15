-- ============================================================
-- JuegaHipHop — Catálogo de logros REAL (fuente: la Sopa)
-- Migration 00020: corrige el catálogo de logros de la Sopa.
--
-- PROBLEMA: la migración 00019 copió el catálogo hipotético del
-- DDL 00004 (sopa_50_words, sopa_100_words, sopa_first_category)
-- pero la Sopa REAL manda IDs distintos (sopa_fifty_words,
-- sopa_hundred_words, sopa_games_5, sopa_level_2...). Resultado:
-- el perfil mostraba el ID crudo en vez del nombre (solo
-- sopa_first_word coincidía).
--
-- FIX:
--   1. UPSERT de los 32 logros REALES de la Sopa (extraídos de
--      sopadeletras/src/data/achievements.ts) — nombre,
--      descripción, icono, rareza (heurística por XP) y xp_reward.
--   2. DELETE de los IDs fantasma del catálogo viejo que la Sopa
--      nunca manda (quedaban como ruido).
--
-- Idempotente — seguro correrlo N veces.
-- ============================================================

-- ─── 1. UPSERT logros reales de la Sopa ───
INSERT INTO achievements (achievement_id, type, name, description, icon, game_id, condition_description, rarity, xp_reward, sort_order)
VALUES
  ('sopa_first_word', 'game', 'Primer Descubrimiento', 'Encuentra tu primera palabra', '🔍', 'sopa', 'Encontrar la primera palabra', 'common', 25, 1),
  ('sopa_ten_words', 'game', 'Aprendiz', 'Encuentra 10 palabras', '📖', 'sopa', 'Encontrar 10 palabras', 'uncommon', 50, 2),
  ('sopa_fifty_words', 'game', 'Conocedor', 'Encuentra 50 palabras', '📚', 'sopa', 'Encontrar 50 palabras', 'rare', 150, 3),
  ('sopa_hundred_words', 'game', 'Erudito', 'Encuentra 100 palabras', '🎓', 'sopa', 'Encontrar 100 palabras', 'epic', 300, 4),
  ('sopa_two_fifty_words', 'game', 'Enciclopedista', 'Encuentra 250 palabras', '📕', 'sopa', 'Encontrar 250 palabras', 'legendary', 500, 5),
  ('sopa_all_words', 'game', 'Biblioteca Completa', 'Encuentra TODAS las palabras', '🏛️', 'sopa', 'Encontrar todas las palabras', 'legendary', 2000, 6),
  ('sopa_breaking_master', 'game', 'Maestro del Breaking', 'Encuentra todas las palabras de Breaking', '💃', 'sopa', 'Completar la categoría Breaking', 'epic', 200, 7),
  ('sopa_mcing_master', 'game', 'Maestro del Micrófono', 'Encuentra todas las palabras de MC', '🎤', 'sopa', 'Completar la categoría MC', 'epic', 200, 8),
  ('sopa_djing_master', 'game', 'Maestro de los Platos', 'Encuentra todas las palabras de DJ', '🎧', 'sopa', 'Completar la categoría DJ', 'epic', 200, 9),
  ('sopa_graffiti_master', 'game', 'Maestro del Graffiti', 'Encuentra todas las palabras de Graffiti', '🎨', 'sopa', 'Completar la categoría Graffiti', 'epic', 200, 10),
  ('sopa_historia_master', 'game', 'Historiador', 'Completa la categoría Historia del Hip Hop', '📜', 'sopa', 'Completar la categoría Historia', 'epic', 250, 11),
  ('sopa_cultura_master', 'game', 'Filósofo del Hip Hop', 'Completa la categoría Cultura Hip Hop', '🧠', 'sopa', 'Completar la categoría Cultura', 'epic', 250, 12),
  ('sopa_all_categories', 'game', 'Todas las Disciplinas', 'Completa todas las categorías disponibles', '🌟', 'sopa', 'Completar todas las categorías', 'legendary', 1000, 13),
  ('sopa_level_2', 'game', 'Subiendo de Nivel', 'Alcanza el nivel 2', '⭐', 'sopa', 'Alcanzar nivel 2', 'uncommon', 50, 14),
  ('sopa_level_5', 'game', 'Jugador', 'Alcanza el nivel 5', '🌟', 'sopa', 'Alcanzar nivel 5', 'rare', 100, 15),
  ('sopa_level_10', 'game', 'Veterano', 'Alcanza el nivel 10', '💫', 'sopa', 'Alcanzar nivel 10', 'epic', 250, 16),
  ('sopa_level_20', 'game', 'Legendario', 'Alcanza el nivel 20', '👑', 'sopa', 'Alcanzar nivel 20', 'legendary', 500, 17),
  ('sopa_level_30', 'game', 'Inmortal', 'Alcanza el nivel 30', '🏆', 'sopa', 'Alcanzar nivel 30', 'legendary', 1000, 18),
  ('sopa_level_50', 'game', 'Dios del Hip Hop', 'Alcanza el nivel 50', '🔱', 'sopa', 'Alcanzar nivel 50', 'legendary', 2500, 19),
  ('sopa_streak_3', 'game', 'Racha de 3', 'Juega 3 días consecutivos', '🔥', 'sopa', 'Racha de 3 días', 'uncommon', 75, 20),
  ('sopa_streak_7', 'game', 'Racha Semanal', 'Juega 7 días consecutivos', '🔥', 'sopa', 'Racha de 7 días', 'epic', 200, 21),
  ('sopa_streak_14', 'game', 'Racha Quincenal', 'Juega 14 días consecutivos', '🔥', 'sopa', 'Racha de 14 días', 'legendary', 500, 22),
  ('sopa_streak_30', 'game', 'Racha Mensual', 'Juega 30 días consecutivos', '🔥', 'sopa', 'Racha de 30 días', 'legendary', 1000, 23),
  ('sopa_streak_100', 'game', 'Leyenda de la Constancia', 'Juega 100 días consecutivos', '🔥', 'sopa', 'Racha de 100 días', 'legendary', 5000, 24),
  ('sopa_games_5', 'game', 'Cinco Partidas', 'Completa 5 partidas', '🎮', 'sopa', 'Completar 5 partidas', 'uncommon', 50, 25),
  ('sopa_games_25', 'game', 'Dedicación', 'Completa 25 partidas', '🎮', 'sopa', 'Completar 25 partidas', 'epic', 200, 26),
  ('sopa_games_100', 'game', 'Vicio Saludable', 'Completa 100 partidas', '🎮', 'sopa', 'Completar 100 partidas', 'legendary', 500, 27),
  ('sopa_no_hints_3', 'game', 'Mente Pura', 'Completa 3 partidas sin usar pistas', '🧠', 'sopa', 'Completar 3 partidas sin pistas', 'rare', 150, 28),
  ('sopa_speed_demon', 'game', 'Velocista', 'Encuentra una palabra en menos de 3 segundos', '⚡', 'sopa', 'Palabra en menos de 3 segundos', 'rare', 100, 29),
  ('sopa_daily_7', 'game', 'Fiel Seguidor', 'Reclama 7 recompensas diarias', '📅', 'sopa', 'Reclamar 7 recompensas diarias', 'rare', 100, 30),
  ('sopa_first_xp_1000', 'game', 'Mil Experiencias', 'Acumula 1000 XP', '✦', 'sopa', 'Acumular 1000 XP', 'rare', 100, 31),
  ('sopa_first_xp_10000', 'game', 'Diez Mil Horas', 'Acumula 10000 XP', '✦', 'sopa', 'Acumular 10000 XP', 'legendary', 500, 32)
ON CONFLICT (achievement_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  rarity = EXCLUDED.rarity,
  xp_reward = EXCLUDED.xp_reward,
  condition_description = EXCLUDED.condition_description,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- ─── 2. DELETE de los IDs fantasma del catálogo viejo (la Sopa
--       nunca los manda — solo quedaban como ruido) ───
DELETE FROM achievements
WHERE game_id = 'sopa'
  AND achievement_id IN ('sopa_50_words', 'sopa_100_words', 'sopa_first_category');

-- ─── 3. Refrescar schema cache ───
NOTIFY pgrst, 'reload schema cache';
