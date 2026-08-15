-- ============================================================
-- JuegaHipHop — Campaign Images Storage
-- Migration 00016: Storage bucket para imágenes de campañas (ads)
--
-- Mismo patrón que game-covers (00008): bucket público de solo
-- lectura, admins suben desde el panel (validación server-side).
-- ============================================================

-- ─── 1. Create storage bucket ───
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaign-images',
  'campaign-images',
  true,                    -- Público: las imágenes se sirven sin auth
  5242880,                 -- 5MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[];

-- ─── 2. RLS Policies for storage.objects ───

-- Anyone can read public images (the ads are shown to all players)
CREATE POLICY "Public can read campaign images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'campaign-images');

-- Only authenticated users (admins validated server-side) can upload
CREATE POLICY "Authenticated users can upload campaign images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'campaign-images'
    AND auth.role() = 'authenticated'
    -- Server-side validation en el server action confirma que es admin
  );

-- Uploader can update their own files
CREATE POLICY "Users can update own campaign images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'campaign-images' AND auth.uid() = owner)
  WITH CHECK (bucket_id = 'campaign-images' AND auth.uid() = owner);

-- Uploader can delete their own files
CREATE POLICY "Users can delete own campaign images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'campaign-images' AND auth.uid() = owner);
