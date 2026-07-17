-- ============================================================
-- JuegaHipHop — Game Covers Storage
-- Migration 00008: Storage bucket for game cover images
--
-- Crea el bucket game-covers y sus políticas RLS para que
-- admins puedan subir portadas desde el panel de admin.
-- ============================================================

-- ============================================================
-- 1. Create storage bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'game-covers',
  'game-covers',
  true,                    -- Público: las imágenes se sirven sin auth
  5242880,                 -- 5MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[];

-- ============================================================
-- 2. RLS Policies for storage.objects
-- ============================================================

-- Anyone can read public images (the covers are shown publicly)
CREATE POLICY "Public can read game covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'game-covers');

-- Only authenticated users (admins validated server-side) can upload
CREATE POLICY "Authenticated users can upload game covers"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'game-covers'
    AND auth.role() = 'authenticated'
    -- Server-side validation en el server action confirma que es admin
  );

-- Uploader can update their own files
CREATE POLICY "Users can update own game covers"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'game-covers' AND auth.uid() = owner)
  WITH CHECK (bucket_id = 'game-covers' AND auth.uid() = owner);

-- Uploader can delete their own files
CREATE POLICY "Users can delete own game covers"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'game-covers' AND auth.uid() = owner);
