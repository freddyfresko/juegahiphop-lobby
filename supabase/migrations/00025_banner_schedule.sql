-- ============================================================
-- JuegaHipHop — Programación de banners (vigencia + rotación)
-- Migration 00025: agrega ventana de vigencia (start_at/end_at)
-- para el intercambio automático del hero del home.
-- ============================================================

-- Vigencia: NULL = sin límite (siempre vigente mientras active=true)
ALTER TABLE banners
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;

-- Índice para consultas de vigencia sobre banners activos
CREATE INDEX IF NOT EXISTS idx_banners_schedule
  ON banners(start_at, end_at)
  WHERE active = true;

-- RLS: el público SOLO lee banners activos Y vigentes (start <= now <= end);
-- los admins siguen viendo todos (incluidos programados y vencidos).
DROP POLICY IF EXISTS "Anyone can read active banners" ON banners;
CREATE POLICY "Anyone can read active banners"
  ON banners FOR SELECT
  USING (
    (active = true
      AND (start_at IS NULL OR start_at <= NOW())
      AND (end_at IS NULL OR end_at >= NOW()))
    OR public.is_admin()
  );
