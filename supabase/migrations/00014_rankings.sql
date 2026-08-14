-- ============================================================
-- JuegaHipHop — Rankings (leaderboard)
-- Migration 00014: ranking general + ranking por juego
--
-- Las vistas corren con permisos del owner (postgres), por lo que
-- bypassean el RLS de game_sessions (cada usuario solo ve sus
-- sesiones). SOLO se exponen campos agregados: display_name,
-- avatar_url, xp_total, partidas, completadas, best_score.
-- Nada de datos crudos.
--
-- Idempotente — seguro correrlo N veces.
-- ============================================================

-- ============================================================
-- 1. Ranking general — XP acumulado por usuario
--    (suma de total_score de todas las partidas cerradas)
-- ============================================================
CREATE OR REPLACE VIEW public.ranking_general AS
SELECT
  s.user_id,
  COALESCE(p.display_name, split_part(u.email, '@', 1), 'Jugador') AS display_name,
  COALESCE(p.avatar_url, '') AS avatar_url,
  COALESCE(SUM(s.total_score), 0)::bigint AS xp_total,
  COUNT(*)::bigint AS partidas,
  COUNT(*) FILTER (WHERE s.session_result = 'completed')::bigint AS completadas,
  MAX(s.started_at) AS ultima_partida
FROM game_sessions s
LEFT JOIN player_profiles p ON p.user_id = s.user_id
LEFT JOIN auth.users u ON u.id = s.user_id
WHERE s.ended_at IS NOT NULL
GROUP BY s.user_id, p.display_name, p.avatar_url, u.email;

-- ============================================================
-- 2. Ranking por juego — best score + XP por juego/usuario
-- ============================================================
CREATE OR REPLACE VIEW public.ranking_por_juego AS
SELECT
  s.game_id,
  s.user_id,
  COALESCE(p.display_name, split_part(u.email, '@', 1), 'Jugador') AS display_name,
  COALESCE(p.avatar_url, '') AS avatar_url,
  COALESCE(MAX(s.total_score), 0)::bigint AS best_score,
  COALESCE(SUM(s.total_score), 0)::bigint AS xp_total,
  COUNT(*)::bigint AS partidas,
  COUNT(*) FILTER (WHERE s.session_result = 'completed')::bigint AS completadas,
  MAX(s.started_at) AS ultima_partida
FROM game_sessions s
LEFT JOIN player_profiles p ON p.user_id = s.user_id
LEFT JOIN auth.users u ON u.id = s.user_id
WHERE s.ended_at IS NOT NULL
GROUP BY s.game_id, s.user_id, p.display_name, p.avatar_url, u.email;

-- ============================================================
-- 3. Permisos — todos pueden leer rankings (datos agregados)
-- ============================================================
GRANT SELECT ON public.ranking_general TO anon, authenticated;
GRANT SELECT ON public.ranking_por_juego TO anon, authenticated;

-- ============================================================
-- 4. Refrescar schema cache de PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema cache';

-- ============================================================
-- Verificación rápida (pegar en SQL Editor)
-- ============================================================
-- SELECT * FROM public.ranking_general ORDER BY xp_total DESC LIMIT 10;
-- SELECT * FROM public.ranking_por_juego WHERE game_id = 'sopa' ORDER BY best_score DESC LIMIT 10;
