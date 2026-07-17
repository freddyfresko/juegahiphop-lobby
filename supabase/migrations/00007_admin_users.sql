-- ============================================================
-- JuegaHipHop — Admin Users & Game Management RLS
-- Migration 00007: admin_users table + admin policies for games
-- ============================================================

-- ============================================================
-- 1. admin_users table
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS para admin_users: solo admins pueden leer/escribir, pero
-- la función is_admin() usa SECURITY DEFINER para bypassearlo.
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Permitir lectura autenticada (para la web app)
CREATE POLICY "Authenticated users can read admin_users"
  ON admin_users FOR SELECT
  USING (true);

-- Solo admins pueden insertar nuevos admins (vía is_admin)
CREATE POLICY "Admins can insert admin_users"
  ON admin_users FOR INSERT
  WITH CHECK (public.is_admin() OR auth.jwt() ->> 'email' = 'freddyfresko@gmail.com');

-- ============================================================
-- 2. is_admin() helper for RLS policies
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE email = (auth.jwt() ->> 'email')
  );
$$;

-- ============================================================
-- 3. Update RLS on games table
-- ============================================================
DROP POLICY IF EXISTS "Public users can read active games" ON games;
DROP POLICY IF EXISTS "Authenticated users can read games" ON games;

-- Anyone can read active/beta games (public lobby)
CREATE POLICY "Public can read active and beta games"
  ON games FOR SELECT
  USING (status IN ('active', 'beta'));

-- Admins can read ALL games
CREATE POLICY "Admins can read all games"
  ON games FOR SELECT
  USING (public.is_admin());

-- Admins can INSERT games
CREATE POLICY "Admins can insert games"
  ON games FOR INSERT
  WITH CHECK (public.is_admin());

-- Admins can UPDATE games
CREATE POLICY "Admins can update games"
  ON games FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can DELETE games
CREATE POLICY "Admins can delete games"
  ON games FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- 4. Seed first admin user
-- ============================================================
INSERT INTO admin_users (email)
VALUES ('freddyfresko@gmail.com')
ON CONFLICT (email) DO NOTHING;
