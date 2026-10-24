-- ============================================================
-- JuegaHipHop — Plataforma de cada juego (PC vs celular)
-- Migration 00032: agrega games.platform
--
-- El lobby separa el catálogo en dos secciones: juegos de PC
-- (teclado + mouse) y juegos de celular (touch). Default 'mobile'
-- porque casi todo el catálogo es touch.
--
-- Idempotente. El código del lobby (src/lib/game-platform.ts) ya
-- funciona SIN esta columna: mientras no exista, usa una lista de
-- slugs PC como fallback. Con la columna, la DB manda.
-- ============================================================

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'mobile';

-- CHECK aparte para que el ADD COLUMN siga siendo idempotente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'games_platform_check'
  ) THEN
    ALTER TABLE games
      ADD CONSTRAINT games_platform_check
      CHECK (platform IN ('mobile', 'pc', 'both'));
  END IF;
END $$;

-- Graffiti HH es 3D: requiere teclado y mouse
UPDATE games SET platform = 'pc' WHERE slug = 'graffiti-hh';
