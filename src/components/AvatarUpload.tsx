'use client'

import { useCallback, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  uploadAvatar,
  deleteStoredAvatar,
  avatarPathFromUrl,
} from '@/lib/upload-image'

interface AvatarUploadProps {
  userId: string
  /** URL actual del avatar (Google o nuestro storage) */
  currentUrl: string | null
  /** Se llama con la nueva URL al guardar (o null si se quitó) */
  onChanged: (url: string | null) => void
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

/**
 * Avatar editable del perfil: muestra la foto actual y al hacer click
 * permite subir una propia con COMPRESIÓN client-side (WebP 512px)
 * antes de guardarla en el bucket `avatars`.
 */
export default function AvatarUpload({ userId, currentUrl, onChanged }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return
      setError(null)

      if (!ACCEPTED.includes(file.type)) {
        setError('Formato no soportado. Usa JPG, PNG, WebP o AVIF.')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('La imagen es muy grande. Máximo 5MB.')
        return
      }

      setBusy(true)
      try {
        // Borrar la foto anterior SOLO si era nuestra (no la de Google)
        const oldPath = avatarPathFromUrl(currentUrl)
        const { url } = await uploadAvatar(file, userId)
        await deleteStoredAvatar(oldPath)

        // Guardar la URL en el perfil (RLS: el usuario actualiza su propio perfil)
        const supabase = createClient()
        const { error: dbErr } = await supabase
          .from('player_profiles')
          .update({ avatar_url: url })
          .eq('user_id', userId)

        if (dbErr) throw new Error(dbErr.message)

        onChanged(url)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setBusy(false)
        if (inputRef.current) inputRef.current.value = ''
      }
    },
    [userId, currentUrl, onChanged],
  )

  const handleRemove = useCallback(async () => {
    setError(null)
    setBusy(true)
    try {
      const oldPath = avatarPathFromUrl(currentUrl)
      await deleteStoredAvatar(oldPath)
      const supabase = createClient()
      const { error: dbErr } = await supabase
        .from('player_profiles')
        .update({ avatar_url: null })
        .eq('user_id', userId)
      if (dbErr) throw new Error(dbErr.message)
      onChanged(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }, [userId, currentUrl, onChanged])

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label="Cambiar foto de perfil"
        title="Cambiar foto de perfil"
        className="group relative block overflow-hidden rounded-full transition-all active:scale-[0.97] disabled:opacity-60"
      >
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-2xl font-black text-black ring-2 ring-yellow-400/40">
          {currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
          ) : (
            '?'
          )}
        </div>
        {/* Overlay al hover */}
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-[9px] font-bold uppercase tracking-wider text-white opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100">
          {busy ? 'GUARDANDO…' : '📷'}
        </div>
      </button>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 transition-colors hover:border-yellow-500/30 hover:text-yellow-400 disabled:opacity-50"
        >
          {busy ? 'Comprimiendo…' : 'Cambiar foto'}
        </button>
        {currentUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="rounded-lg border border-red-400/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-red-400/70 transition-colors hover:bg-red-400/10 hover:text-red-400 disabled:opacity-50"
          >
            Quitar
          </button>
        )}
      </div>

      {error && <p className="text-[10px] font-semibold text-red-400">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  )
}
