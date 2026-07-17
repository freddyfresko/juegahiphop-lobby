-- ============================================================
-- JuegaHipHop — Games Catalog Table
-- Migration 00003: Add dynamic game catalog for the Lobby.
--
-- This table replaces the hardcoded GAMES array in LobbyClient.tsx.
-- Each row = one game available on the platform.
-- The Lobby reads this table to render GameCards dynamically.
-- ============================================================

-- ============================================================
-- 1. games — Catálogo dinámico de juegos
-- ============================================================
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🎮',
  short_description TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  color TEXT NOT NULL DEFAULT '#7C3AED',
  accent_color TEXT DEFAULT '#6D28D9',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'beta', 'coming_soon', 'maintenance', 'hidden')),
  featured BOOLEAN DEFAULT false,
  orientation TEXT NOT NULL DEFAULT 'landscape'
    CHECK (orientation IN ('landscape', 'portrait', 'any')),
  external_url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'games',
  sort_order INTEGER NOT NULL DEFAULT 0,
  total_items INTEGER,
  progress_label TEXT,
  allowed_origins TEXT[] DEFAULT '{}',
  release_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_sort ON games(sort_order);
CREATE INDEX IF NOT EXISTS idx_games_featured ON games(featured) WHERE featured = true;

-- ============================================================
-- 3. Trigger: auto-update updated_at
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_games_updated_at'
  ) THEN
    CREATE TRIGGER update_games_updated_at
      BEFORE UPDATE ON games
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================
-- 4. Row Level Security
-- ============================================================
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Anyone can read active/beta catalog entries; the lobby is public.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'games' AND policyname = 'Public users can read active games'
  ) THEN
    CREATE POLICY "Public users can read active games"
      ON games FOR SELECT
      USING (status IN ('active', 'beta'));
  END IF;
END $$;

-- ============================================================
-- 5. Seed data: existing games
-- ============================================================
INSERT INTO games (slug, name, emoji, short_description, description, color, accent_color, status, featured, orientation, external_url, category, sort_order, total_items, progress_label, allowed_origins)
VALUES
  (
    'sopa',
    'Sopa de Knowledge',
    '🔤',
    'Demuestra cuánto sabes de la cultura hip hop en cada ronda.',
    'Sopa de letras con 930 conceptos del hip hop. Encuentra palabras sobre rap, DJ, breakdance, graffiti y más.',
    '#10B981',
    '#059669',
    'active',
    true,
    'portrait',
    'https://sopa.juegahiphop.cl',
    'games',
    1,
    930,
    'Palabras',
    ARRAY['https://sopa.juegahiphop.cl']
  ),
  (
    'puzzle',
    'Puzzle H2',
    '🧩',
    'Arma el puzzle, descubre leyendas del hip hop.',
    'Rompecabezas con imágenes icónicas del hip hop. Arma las piezas y aprende historia mientras juegas.',
    '#7C3AED',
    '#6D28D9',
    'active',
    true,
    'landscape',
    'https://puzzle.juegahiphop.cl',
    'games',
    2,
    NULL,
    'Completados',
    ARRAY['https://puzzle.juegahiphop.cl']
  ),
  (
    'fighters',
    'Hip Hop Fighters',
    '🥊',
    'Enfrenta a los mejores en batallas épicas de hip hop.',
    'Beat ''em up 2D con personajes del hip hop. pelea a través de escenarios icónicos y derrota a los bosses.',
    '#EF4444',
    '#DC2626',
    'active',
    true,
    'landscape',
    'https://fighters.juegahiphop.cl',
    'games',
    3,
    NULL,
    'Niveles',
    ARRAY['https://fighters.juegahiphop.cl']
  )
ON CONFLICT (slug) DO NOTHING;
