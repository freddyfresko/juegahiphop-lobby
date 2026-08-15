-- ============================================================
-- JuegaHipHop — DIAGNÓSTICO de inconsistencia de números
-- (home vs perfil vs ranking)
--
-- Correr en Supabase → SQL Editor. Muestra las 3 fuentes de
-- verdad lado a lado para TODOS los usuarios con partidas.
--
-- Fuentes:
--   A) HOME/SIDEBAR  → player_profiles.xp / level (recalc 00017)
--   B) PERFIL        → cálculo en vivo: SUM(total_score) TODAS
--                      las sesiones + SUM(game_state.completions_count)
--   C) RANKING       → vista ranking_general: SUM(total_score)
--                      SOLO sesiones cerradas (ended_at IS NOT NULL)
-- ============================================================

-- ─── 1. Comparación general por usuario ───
SELECT
  u.email,
  pp.xp AS home_xp,
  pp.level AS home_level,
  pp.total_games_completed AS home_completados,
  pp.current_streak AS home_racha,
  -- Perfil: suma TODAS las sesiones (abiertas incluidas)
  (SELECT COALESCE(SUM(total_score),0) FROM game_sessions s WHERE s.user_id = u.id) AS perfil_xp_todas,
  -- Ranking: suma SOLO cerradas
  (SELECT COALESCE(SUM(total_score),0) FROM game_sessions s WHERE s.user_id = u.id AND s.ended_at IS NOT NULL) AS ranking_xp_cerradas,
  -- Detalle sesiones
  (SELECT COUNT(*) FROM game_sessions s WHERE s.user_id = u.id) AS sesiones_total,
  (SELECT COUNT(*) FROM game_sessions s WHERE s.user_id = u.id AND s.ended_at IS NULL) AS sesiones_abiertas,
  (SELECT COALESCE(SUM(total_score),0) FROM game_sessions s WHERE s.user_id = u.id AND s.ended_at IS NULL) AS xp_en_abiertas,
  (SELECT COUNT(*) FROM game_sessions s WHERE s.user_id = u.id AND s.session_result = 'completed') AS sesiones_completed,
  (SELECT COALESCE(SUM(completions_count),0) FROM game_state g WHERE g.user_id = u.id) AS game_state_completados
FROM auth.users u
JOIN player_profiles pp ON pp.user_id = u.id
WHERE EXISTS (SELECT 1 FROM game_sessions s WHERE s.user_id = u.id)
ORDER BY perfil_xp_todas DESC;

-- ─── 2. Sesiones abiertas (las sospechosas) ───
SELECT
  s.id,
  s.user_id,
  u.email,
  s.game_id,
  s.started_at,
  s.total_score,
  s.session_result,
  s.ended_at
FROM game_sessions s
JOIN auth.users u ON u.id = s.user_id
WHERE s.ended_at IS NULL
ORDER BY s.started_at DESC
LIMIT 50;
