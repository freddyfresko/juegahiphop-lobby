'use client'

import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ImageUploadProps {
  currentUrl: string | null
  gameSlug: string
  onUploadComplete: (url: string) => void
}

export default function ImageUpload({ currentUrl, gameSlug, onUploadComplete }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentUrl)
  const [progress, setProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const uploadFile = useCallback(async (file: File) => {
    // Validar tipo
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
    if (!allowed.includes(file.type)) {
      alert('Formato no soportado. Usa JPG, PNG, WebP o AVIF.')
      return
    }

    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen es muy grande. Máximo 5MB.')
      return
    }

    setUploading(true)
    setProgress(10)

    try {
      const supabase = createClient()

      // Generar nombre único
      const ext = file.name.split('.').pop() || 'webp'
      const fileName = `${gameSlug}-${Date.now()}.${ext}`
      const filePath = `${gameSlug}/${fileName}`

      setProgress(30)

      // Subir a Supabase Storage
      const { data, error } = await supabase.storage
        .from('game-covers')
        .upload(filePath, file, {
          cacheControl: '31536000',
          upsert: true,
        })

      setProgress(70)

      if (error) {
        console.error('[Upload] Error:', error)
        alert(`Error al subir: ${error.message}`)
        return
      }

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('game-covers')
        .getPublicUrl(filePath)

      setProgress(100)
      setPreview(publicUrl)
      onUploadComplete(publicUrl)
    } catch (e) {
      console.error('[Upload] Exception:', e)
      alert('Error inesperado al subir la imagen')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }, [gameSlug, onUploadComplete])

  const handleFile = useCallback((file: File | undefined) => {
    if (!file) return
    // Preview local inmediata
    const localUrl = URL.createObjectURL(file)
    setPreview(localUrl)
    uploadFile(file)
  }, [uploadFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  return (
    <div className="space-y-2">
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Portada (1200×675px recomendado)
      </label>

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative cursor-pointer overflow-hidden rounded-xl border-2 border-dashed transition-all ${
          dragOver
            ? 'border-yellow-400 bg-yellow-400/5'
            : preview
              ? 'border-white/[0.08] hover:border-yellow-500/30'
              : 'border-white/[0.08] hover:border-yellow-500/30 hover:bg-white/[0.02]'
        }`}
      >
        {/* Preview */}
        {preview ? (
          <div className="relative aspect-[16/9] w-full">
            <img
              src={preview}
              alt="Preview portada"
              className="h-full w-full object-cover"
            />
            {/* Overlay en hover */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all hover:bg-black/60 hover:opacity-100">
              <div className="flex items-center gap-2 text-sm text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Cambiar imagen
              </div>
            </div>
            {/* Uploading overlay */}
            {uploading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
                <div className="mb-2 h-8 w-8 animate-spin rounded-full border-2 border-yellow-400/30 border-t-yellow-400" />
                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/[0.1]">
                  <div
                    className="h-full rounded-full bg-yellow-400 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-2 text-[10px] text-zinc-400">Subiendo…</p>
              </div>
            )}
          </div>
        ) : (
          /* Empty state */
          <div className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 p-8">
            {uploading ? (
              <>
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-yellow-400/30 border-t-yellow-400" />
                <p className="text-[10px] text-zinc-500">Subiendo…</p>
              </>
            ) : (
              <>
                <svg className="h-8 w-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-xs text-zinc-500">
                  Arrastra una imagen o haz click para subir
                </p>
                <p className="text-[10px] text-zinc-600">
                  JPG, PNG, WebP o AVIF · Máx 5MB · 1200×675px
                </p>
              </>
            )}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
    </div>
  )
}
