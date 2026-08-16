import imageCompression from 'browser-image-compression'
import { createClient } from '@/lib/supabase/client'

const AVATAR_BUCKET = 'avatars'

/**
 * Comprime la imagen del avatar ANTES de subirla al storage:
 * WebP, máx 512px, calidad 0.8 (≈10-50KB en vez de MB).
 */
export async function compressAvatar(file: File): Promise<File> {
  return imageCompression(file, {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 512,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.8,
  })
}

/**
 * Comprime y sube el avatar a avatars/{userId}/avatar-{ts}.webp.
 * Devuelve la URL pública y el path (para borrar el viejo al reemplazar).
 */
export async function uploadAvatar(
  file: File,
  userId: string,
): Promise<{ url: string; path: string }> {
  const supabase = createClient()
  const compressed = await compressAvatar(file)

  const path = `${userId}/avatar-${Date.now()}.webp`
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, compressed, {
    cacheControl: '31536000',
    upsert: true,
    contentType: 'image/webp',
  })

  if (error) throw new Error(`Error al subir la foto: ${error.message}`)

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, path }
}

/** Borra una imagen de nuestro storage (no borra avatares de Google). */
export async function deleteStoredAvatar(path: string | null): Promise<void> {
  if (!path) return
  const supabase = createClient()
  await supabase.storage.from(AVATAR_BUCKET).remove([path])
}

/** True si la URL es una foto de Google (no vive en nuestro storage). */
export function isGoogleAvatar(url: string | null | undefined): boolean {
  return !!url && url.startsWith('https://lh3.googleusercontent.com/')
}

/** Extrae el path del storage desde la URL pública (si es nuestra). */
export function avatarPathFromUrl(url: string | null | undefined): string | null {
  if (!url || isGoogleAvatar(url)) return null
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/')
    // .../object/public/avatars/{userId}/avatar-xxx.webp
    const idx = parts.indexOf('avatars')
    if (idx === -1) return null
    return parts.slice(idx + 1).join('/')
  } catch {
    return null
  }
}
