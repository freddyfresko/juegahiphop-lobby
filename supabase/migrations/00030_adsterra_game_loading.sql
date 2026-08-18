-- ============================================================
-- JuegaHipHop — Adsterra: agregar placement game_loading
-- Migration 00030: la campaña Adsterra también cubre el ad de
-- carga (aparece UNA vez al abrir un juego, lo dispara el lobby).
-- ============================================================

UPDATE campaigns
SET placements = ARRAY['game_results', 'game_level_complete', 'game_loading']::campaign_placement[]
WHERE provider = 'adsterra'
  AND NOT ('game_loading' = ANY(placements));

-- Verificar
SELECT name, provider, priority, status, placements
FROM campaigns
ORDER BY priority DESC;
