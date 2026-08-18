-- ============================================================
-- JuegaHipHop — Adsterra provider
-- Migration 00028: agregar 'adsterra' al enum campaign_provider
-- para que el Ad Manager pueda crear campañas con ads reales de
-- Adsterra (site ID 5992776, cuenta de Freddy).
-- ============================================================

DO $$ BEGIN
  ALTER TYPE campaign_provider ADD VALUE IF NOT EXISTS 'adsterra';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
