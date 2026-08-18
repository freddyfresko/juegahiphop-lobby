-- ============================================================
-- JuegaHipHop — Campaña Adsterra (ads pagados de la red)
-- Prioridad 80 > latiendadelhiphop (50) → Adsterra gana SIEMPRE
-- en los placements compartidos (game_results, game_level_complete)
-- ============================================================

INSERT INTO campaigns (
  name,
  type,
  provider,
  title,
  description,
  image_url,
  destination_url,
  placements,
  priority,
  allowed_games,
  excluded_games,
  max_impressions,
  max_per_user,
  reward,
  status,
  config
) VALUES (
  'Adsterra — Ads red (pagados)',
  'external_ad',
  'adsterra',
  '',
  '',
  NULL,
  '',
  ARRAY['game_results', 'game_level_complete']::campaign_placement[],
  80,
  '{}'::text[],
  '{}'::text[],
  NULL,
  0,
  NULL,
  'active',
  '{"ad_format": "300x250"}'::jsonb
);

-- Verificar
SELECT name, provider, priority, status, placements, config
FROM campaigns
ORDER BY priority DESC;
