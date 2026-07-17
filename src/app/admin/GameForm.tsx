'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createGame, updateGame } from '@/lib/admin-actions'
import ImageUpload from './ImageUpload'
import type { GameCatalogEntry } from '@/lib/types'

interface GameFormProps {
  game?: GameCatalogEntry | null
}

const STATUS_OPTIONS: { value: GameCatalogEntry['status']; label: string; desc: string }[] = [
  { value: 'coming_soon', label: 'Próximamente', desc: 'Se muestra como "PRÓXIMAMENTE"' },
  { value: 'beta', label: 'Beta', desc: 'Visible y jugable (beta)' },
  { value: 'active', label: 'Activo', desc: 'Visible y jugable' },
  { value: 'maintenance', label: 'Mantención', desc: 'No jugable, se muestra como "EN MANTENCIÓN"' },
  { value: 'hidden', label: 'Oculto', desc: 'Completamente oculto' },
]

const ORIENTATION_OPTIONS = [
  { value: 'landscape', label: 'Horizontal (16:9)' },
  { value: 'portrait', label: 'Vertical (9:16)' },
  { value: 'any', label: 'Cualquiera' },
]

export default function GameForm({ game }: GameFormProps) {
  const isEditing = !!game
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [imageUrl, setImageUrl] = useState(game?.image_url || '')

  const handleSubmit = async (formData: FormData) => {
    setError(null)
    setPending(true)
    try {
      if (isEditing && game) {
        await updateGame(game.slug, formData)
      } else {
        await createGame(formData)
      }
    } catch (e) {
      setError((e as Error).message)
      setPending(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 19l2-12 4 3 4-5 4 5 4-3 2 12H2zM12 5l-3 4 3-1 3 1-3-4z"/>
            </svg>
            <span className="font-archivo text-lg tracking-wide text-white">
              {isEditing ? 'EDITAR' : 'NUEVO'} <span className="text-yellow-400">JUEGO</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <form action={handleSubmit} className="space-y-6">
          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-400">
              {error}
            </div>
          )}

          {/* Slug + Name */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Slug (URL)" required>
              <input
                name="slug"
                defaultValue={game?.slug || ''}
                required
                placeholder="mi-juego"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-yellow-500/40"
              />
            </Field>
            <Field label="Nombre" required>
              <input
                name="name"
                defaultValue={game?.name || ''}
                required
                placeholder="Mi Juego"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-yellow-500/40"
              />
            </Field>
          </div>

          {/* Emoji + Color */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Emoji">
              <input
                name="emoji"
                defaultValue={game?.emoji || '🎮'}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-yellow-500/40"
              />
            </Field>
            <Field label="Color (hex)">
              <div className="flex items-center gap-2">
                <input
                  name="color"
                  type="color"
                  defaultValue={game?.color || '#7C3AED'}
                  className="h-10 w-10 cursor-pointer rounded-lg border border-white/[0.08] bg-transparent"
                />
                <input
                  name="color"
                  defaultValue={game?.color || '#7C3AED'}
                  className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-yellow-500/40 font-mono"
                  onChange={(e) => {
                    const colorInput = document.querySelector('input[name="color"][type="color"]') as HTMLInputElement
                    if (colorInput) colorInput.value = e.target.value
                  }}
                />
              </div>
            </Field>
            <Field label="Acento (hex)">
              <div className="flex items-center gap-2">
                <input
                  name="accent_color"
                  type="color"
                  defaultValue={game?.accent_color || '#6D28D9'}
                  className="h-10 w-10 cursor-pointer rounded-lg border border-white/[0.08] bg-transparent"
                />
                <input
                  name="accent_color"
                  defaultValue={game?.accent_color || '#6D28D9'}
                  className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-yellow-500/40 font-mono"
                />
              </div>
            </Field>
          </div>

          {/* Status + Orientation */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Estado">
              <select
                name="status"
                defaultValue={game?.status || 'coming_soon'}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-yellow-500/40"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#0a0a0a]">
                    {opt.label} — {opt.desc}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Orientación">
              <select
                name="orientation"
                defaultValue={game?.orientation || 'landscape'}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-yellow-500/40"
              >
                {ORIENTATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#0a0a0a]">
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Descriptions */}
          <Field label="Descripción corta">
            <textarea
              name="short_description"
              defaultValue={game?.short_description || ''}
              rows={2}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-yellow-500/40 resize-none"
              placeholder="Breve descripción para la tarjeta..."
            />
          </Field>
          <Field label="Descripción larga">
            <textarea
              name="description"
              defaultValue={game?.description || ''}
              rows={3}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-yellow-500/40 resize-none"
              placeholder="Descripción completa del juego..."
            />
          </Field>

          {/* Image upload */}
          <ImageUpload
            currentUrl={game?.image_url || null}
            gameSlug={game?.slug || 'new'}
            onUploadComplete={(url) => setImageUrl(url)}
          />
          <input type="hidden" name="image_url" value={imageUrl} />

          {/* External URL + Allowed Origins */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="URL del juego" required>
              <input
                name="external_url"
                defaultValue={game?.external_url || ''}
                required
                placeholder="https://juego.ejemplo.com"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-yellow-500/40"
              />
            </Field>
            <Field label="Orígenes permitidos">
              <input
                name="allowed_origins"
                defaultValue={game?.allowed_origins?.join(', ') || ''}
                placeholder="https://juego.ejemplo.com, https://dev.local"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-yellow-500/40"
              />
              <p className="mt-1 text-[10px] text-zinc-600">Separados por coma</p>
            </Field>
          </div>

          {/* Category + Sort Order + Featured */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Categoría">
              <input
                name="category"
                defaultValue={game?.category || 'games'}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-yellow-500/40"
              />
            </Field>
            <Field label="Orden">
              <input
                name="sort_order"
                type="number"
                defaultValue={game?.sort_order || 0}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-yellow-500/40"
              />
            </Field>
            <Field label="Destacado">
              <label className="flex h-full cursor-pointer items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white transition-colors hover:border-yellow-500/30">
                <input
                  name="featured"
                  type="checkbox"
                  defaultChecked={game?.featured || false}
                  className="h-4 w-4 accent-yellow-400"
                />
                Mostrar como destacado
              </label>
            </Field>
          </div>

          {/* Total items + Progress label + Release date */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Total ítems">
              <input
                name="total_items"
                type="number"
                defaultValue={game?.total_items ?? ''}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-yellow-500/40"
              />
            </Field>
            <Field label="Etiqueta de progreso">
              <input
                name="progress_label"
                defaultValue={game?.progress_label || ''}
                placeholder="Niveles"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-yellow-500/40"
              />
            </Field>
            <Field label="Fecha de lanzamiento">
              <input
                name="release_date"
                type="date"
                defaultValue={
                  game?.release_date
                    ? new Date(game.release_date).toISOString().split('T')[0]
                    : ''
                }
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-yellow-500/40 [color-scheme:dark]"
              />
            </Field>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-yellow-400 px-6 py-3 text-sm font-bold text-black transition-colors hover:bg-yellow-300 disabled:opacity-50"
            >
              {pending ? 'GUARDANDO...' : isEditing ? 'GUARDAR CAMBIOS' : 'CREAR JUEGO'}
            </button>
            <Link
              href="/admin"
              className="rounded-xl border border-white/[0.08] px-6 py-3 text-sm font-semibold text-zinc-400 transition-colors hover:text-white"
            >
              CANCELAR
            </Link>
          </div>
        </form>
      </main>
    </div>
  )
}

/** Wrapper para campo de formulario */
function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        {label}
        {required && <span className="ml-1 text-yellow-400">*</span>}
      </span>
      {children}
    </label>
  )
}
