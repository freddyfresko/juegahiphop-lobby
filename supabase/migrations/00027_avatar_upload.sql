-- ============================================================
-- JuegaHipHop — Avatar de perfil (Google + subida propia)
-- Migration 00027:
--   1. Bucket 'avatars' (público, 5MB, imágenes) con RLS por carpeta
--   2. Trigger on_auth_user_oauth_sync: toma avatar_url/display_name
--      de las metadata del proveedor (Google) al login OAuth
--      (SOLO si el usuario no tiene foto propia)
--
-- Idempotente — seguro correrlo N veces.
-- ============================================================

-- ============================================================
-- 1. Bucket avatars
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO NOTHING;

-- Lectura pública (bucket público igual necesita policy de SELECT)
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- Cada usuario sube SOLO a su carpeta {userId}/
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- 2. Sincronizar foto de Google al login OAuth
--    auth.users.raw_user_meta_data se actualiza en CADA login
--    OAuth (avatar_url + full_name del proveedor).
--    Regla: se toma la foto de Google solo si el usuario NO tiene
--    foto propia (avatar_url NULL) o si la actual ES de Google
--    (lh3.googleusercontent.com) — así una foto subida por el
--    usuario nunca es pisada.
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_oauth_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avatar TEXT := NULLIF(NEW.raw_user_meta_data->>'avatar_url', '');
  v_name   TEXT := NULLIF(NEW.raw_user_meta_data->>'full_name', '');
BEGIN
  UPDATE player_profiles
  SET
    display_name = COALESCE(display_name, v_name),
    avatar_url = CASE
      WHEN avatar_url IS NULL THEN v_avatar
      WHEN avatar_url LIKE 'https://lh3.googleusercontent.com/%' AND v_avatar IS NOT NULL THEN v_avatar
      ELSE avatar_url
    END,
    updated_at = NOW()
  WHERE user_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_oauth_sync ON auth.users;
CREATE TRIGGER on_auth_user_oauth_sync
  AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_oauth_profile();

-- Refrescar schema cache de PostgREST
NOTIFY pgrst, 'reload schema cache';
