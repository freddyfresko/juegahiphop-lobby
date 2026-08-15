-- ============================================================
-- JuegaHipHop — Registro de la Trivia Hip Hop en la plataforma
-- Migration 00024: catálogo (tabla games) + logros (achievements)
--
-- REGISTRA el juego en el lobby y su catálogo de logros REAL
-- (fuente: E:\dev\JuegaHipHop\Trivia\src\game\achievements.ts).
--
-- IMPORTANTE: corre este archivo DESPUÉS de que exista el
-- subdominio https://trivia.juegahiphop.cl (CNAME + custom domain
-- en Firebase Hosting). Si el dominio no existe, el iframe del
-- lobby no carga el juego (timeout game_ready).
--
-- Idempotente — seguro correrlo N veces.
-- ============================================================

-- ─── 1. Registrar el juego en el catálogo ───
INSERT INTO games (
  slug, name, emoji, short_description, description,
  image_url, color, accent_color, status, featured, orientation,
  external_url, category, sort_order, total_items, progress_label,
  allowed_origins, version, protocol_version, progress_schema_version
)
VALUES (
  'trivia',
  'Trivia Hip Hop',
  '🎤',
  'Rondas de 10 preguntas de la Enciclopedia Hip Hop: historia, MCing, DJing, writing, breaking y más.',
  'Preguntas de opción múltiple generadas desde la Enciclopedia Hip Hop (1.470 preguntas, 12 áreas). Elige área y dificultad, responde contrarreloj, domina las 12 áreas y desbloquea logros.',
  '/covers/trivia.jpg',
  '#F97316', '#EA580C',
  'active', false, 'portrait',
  'https://trivia.juegahiphop.cl',
  'games', 4, 12, 'Áreas',
  ARRAY['https://trivia.juegahiphop.cl'],
  '1.0.0', '2.0.0', '1.0.0'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  emoji = EXCLUDED.emoji,
  short_description = EXCLUDED.short_description,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url,
  color = EXCLUDED.color,
  accent_color = EXCLUDED.accent_color,
  status = EXCLUDED.status,
  featured = EXCLUDED.featured,
  orientation = EXCLUDED.orientation,
  external_url = EXCLUDED.external_url,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  total_items = EXCLUDED.total_items,
  progress_label = EXCLUDED.progress_label,
  allowed_origins = EXCLUDED.allowed_origins,
  version = EXCLUDED.version,
  protocol_version = EXCLUDED.protocol_version,
  progress_schema_version = EXCLUDED.progress_schema_version,
  updated_at = NOW();

-- ─── 2. Catálogo de logros REAL de la Trivia ───
INSERT INTO achievements (achievement_id, type, name, description, icon, game_id, condition_description, rarity, xp_reward, sort_order)
VALUES
  ('trivia_first_win', 'game', 'Primer Acierto', 'Responde correctamente tu primera pregunta', '🎯', 'trivia', 'Responder correctamente la primera pregunta', 'common', 25, 1),
  ('trivia_round_5', 'game', 'En Racha', 'Acierta 5 seguidas en una ronda', '🔥', 'trivia', 'Acierta 5 seguidas en una ronda', 'uncommon', 50, 2),
  ('trivia_round_10', 'game', 'Imparable', 'Acierta las 10 preguntas de una ronda', '⚡', 'trivia', 'Acierta las 10 preguntas de una ronda', 'epic', 200, 3),
  ('trivia_first_area', 'game', 'Primer Territorio', 'Domina tu primer área (60%+ de acierto)', '🗺️', 'trivia', 'Dominar el primer área', 'uncommon', 75, 4),
  ('trivia_three_areas', 'game', 'Explorador', 'Domina 3 áreas de la enciclopedia', '🧭', 'trivia', 'Dominar 3 áreas', 'rare', 150, 5),
  ('trivia_six_areas', 'game', 'Conocedor', 'Domina 6 áreas de la enciclopedia', '📚', 'trivia', 'Dominar 6 áreas', 'epic', 300, 6),
  ('trivia_all_areas', 'game', 'Enciclopedista', 'Domina las 12 áreas de la enciclopedia', '🏛️', 'trivia', 'Dominar las 12 áreas', 'legendary', 1000, 7),
  ('trivia_games_5', 'game', 'Cinco Rondas', 'Completa 5 partidas', '🎮', 'trivia', 'Completar 5 partidas', 'uncommon', 50, 8),
  ('trivia_games_25', 'game', 'Vicio Saludable', 'Completa 25 partidas', '🎮', 'trivia', 'Completar 25 partidas', 'epic', 200, 9),
  ('trivia_correctas_50', 'game', 'Cincuenta Sabias', 'Acumula 50 respuestas correctas', '🧠', 'trivia', 'Acumular 50 respuestas correctas', 'rare', 150, 10),
  ('trivia_correctas_200', 'game', 'Doscientas Sabias', 'Acumula 200 respuestas correctas', '🧠', 'trivia', 'Acumular 200 respuestas correctas', 'epic', 400, 11),
  ('trivia_correctas_500', 'game', 'Biblioteca Viviente', 'Acumula 500 respuestas correctas', '📖', 'trivia', 'Acumular 500 respuestas correctas', 'legendary', 1000, 12),
  ('trivia_chile_domado', 'game', 'Orgullo Nacional', 'Domina el área de Hip Hop Chileno', '🇨🇱', 'trivia', 'Dominar el área 11-chile', 'epic', 250, 13),
  ('trivia_speed_5', 'game', 'Rápido como el Flash', 'Acierta en menos de 3 segundos', '⚡', 'trivia', 'Acierta en menos de 3 segundos', 'rare', 100, 14)
ON CONFLICT (achievement_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  rarity = EXCLUDED.rarity,
  xp_reward = EXCLUDED.xp_reward,
  condition_description = EXCLUDED.condition_description,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- ─── 3. Refrescar schema cache ───
NOTIFY pgrst, 'reload schema cache';

-- ─── Verificación rápida ───
-- SELECT slug, name, status, external_url, sort_order FROM games ORDER BY sort_order;
-- SELECT achievement_id, name, rarity, xp_reward FROM achievements WHERE game_id = 'trivia' ORDER BY sort_order;
