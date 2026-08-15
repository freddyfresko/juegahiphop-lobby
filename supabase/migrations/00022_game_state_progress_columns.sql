-- ============================================================
-- JuegaHipHop — Progreso real del juego en game_state
-- Migration 00022: agrega columnas de progreso estructurado
-- para que el lobby muestre el avance REAL de cada juego
-- (ej: 3/9 categorías, 120/930 palabras) en vez de partidas.
--
-- El juego manda `progress: { current, total, label }` en
-- save_progress (protocolo SDK v2) y el lobby lo persiste acá.
-- Las cards del home/perfil leen estas columnas.
--
-- Idempotente — seguro correrlo N veces.
-- ============================================================

ALTER TABLE game_state
  ADD COLUMN IF NOT EXISTS progress_current INTEGER,
  ADD COLUMN IF NOT EXISTS progress_total INTEGER,
  ADD COLUMN IF NOT EXISTS progress_label TEXT;

NOTIFY pgrst, 'reload schema cache';
