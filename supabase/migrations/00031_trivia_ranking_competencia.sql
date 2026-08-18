-- ============================================================
-- JuegaHipHop — Ranking de Trivia: solo modo COMPETICIÓN
-- Migration 00031: el ranking POR JUEGO de la trivia se arma
-- exclusivamente con sesiones del modo competición
-- (metadata.modo = 'competencia').
--
-- Motivo: en la Trivia hay 3 modos — Por Área, Mixto y
-- Competición. Los dos primeros son práctica (rondas de 10 con
-- puntaje en puntos); el modo competición es llegar lo más
-- lejos posible sin equivocarse y SU score (la distancia) es el
-- que define el ranking de trivia.
--
-- El juego manda metadata.modo en jh:game_completed → el lobby
-- lo guarda en game_sessions.metadata (finish_game_session hace
-- v_existing_meta || p_metadata). Las sesiones de los otros
-- modos (sin metadata.modo = 'competencia') quedan fuera del
-- ranking por juego, pero SIGUEN contando para el ranking
-- general (XP).
--
-- Idempotente — seguro correrlo N veces.
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
  -- Trivia: solo compiten las sesiones del modo competición.
  -- Los demás juegos (sopa, etc.) no filtran nada.
  AND (s.game_id <> 'trivia' OR s.metadata->>'modo' = 'competencia')
GROUP BY s.game_id, s.user_id, p.display_name, p.avatar_url, u.email;

-- Permisos — todos pueden leer rankings (datos agregados)
GRANT SELECT ON public.ranking_por_juego TO anon, authenticated;

-- Refrescar schema cache de PostgREST
NOTIFY pgrst, 'reload schema cache';

-- ============================================================
-- Verificación rápida (pegar en SQL Editor)
-- ============================================================
-- SELECT * FROM public.ranking_por_juego WHERE game_id = 'trivia' ORDER BY best_score DESC LIMIT 10;
-- SELECT * FROM public.ranking_por_juego WHERE game_id = 'sopa' ORDER BY best_score DESC LIMIT 5;
