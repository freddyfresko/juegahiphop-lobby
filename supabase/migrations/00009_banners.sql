-- ============================================================
-- JuegaHipHop — Home Banners
-- Migration 00009: banners table for the dynamic hero section
-- ============================================================

CREATE TABLE IF NOT EXISTS banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'JUEGA HIP HOP',
  subtitle TEXT DEFAULT '',
  description TEXT DEFAULT '',
  image_url TEXT,
  link_url TEXT,
  link_label TEXT DEFAULT 'JUGAR AHORA',
  overlay_opacity NUMERIC(3,2) DEFAULT 0.40,
  text_color TEXT DEFAULT '#ffffff',
  accent_color TEXT DEFAULT '#facc15',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_banners_sort ON banners(sort_order);
CREATE INDEX IF NOT EXISTS idx_banners_active ON banners(active) WHERE active = true;

-- Trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_banners_updated_at'
  ) THEN
    CREATE TRIGGER update_banners_updated_at
      BEFORE UPDATE ON banners
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- RLS
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

-- Anyone can read active banners
CREATE POLICY "Anyone can read active banners"
  ON banners FOR SELECT
  USING (active = true OR public.is_admin());

-- Admins can insert
CREATE POLICY "Admins can insert banners"
  ON banners FOR INSERT
  WITH CHECK (public.is_admin());

-- Admins can update
CREATE POLICY "Admins can update banners"
  ON banners FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can delete
CREATE POLICY "Admins can delete banners"
  ON banners FOR DELETE
  USING (public.is_admin());

-- Seed a default banner with the current hero content
INSERT INTO banners (title, subtitle, description, sort_order, active)
VALUES (
  'JUEGA HIP HOP',
  'JUEGA. APRENDE. REPRESENTA.',
  'LA CULTURA ES TU MEJOR ARMA',
  0,
  true
)
ON CONFLICT DO NOTHING;
