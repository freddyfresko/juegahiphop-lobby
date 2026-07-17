'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBanner, updateBanner, toggleBanner, deleteBanner, reorderBanners } from '@/lib/admin-actions'
import ImageUpload from './ImageUpload'
import type { Banner } from '@/lib/types'

interface BannerManagerProps {
  banners: Banner[]
}

// ─── Banner Form (extracted to avoid creating components during render) ───

function BannerForm({ banner, onDone, showMsg }: {
  banner?: Banner
  onDone: () => void
  showMsg: (msg: string) => void
}) {
  const router = useRouter()
  const [title, setTitle] = useState(banner?.title || '')
  const [subtitle, setSubtitle] = useState(banner?.subtitle || '')
  const [description, setDescription] = useState(banner?.description || '')
  const [linkUrl, setLinkUrl] = useState(banner?.link_url || '')
  const [linkLabel, setLinkLabel] = useState(banner?.link_label || 'JUGAR AHORA')
  const [imageUrl, setImageUrl] = useState(banner?.image_url || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const data = {
        title,
        subtitle: subtitle || null,
        description: description || null,
        image_url: imageUrl || null,
        link_url: linkUrl || null,
        link_label: linkLabel,
      }
      if (banner) {
        await updateBanner(banner.id, data)
      } else {
        await createBanner(data)
      }
      onDone()
      router.refresh()
    } catch (e) { showMsg(`Error: ${(e as Error).message}`) }
    setSaving(false)
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Título</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-yellow-500/40" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Subtítulo</label>
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-yellow-500/40" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Descripción</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-yellow-500/40" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Link URL (opcional)</label>
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..."
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-yellow-500/40" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Texto del botón</label>
          <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-yellow-500/40" />
        </div>
      </div>
      <ImageUpload
        currentUrl={banner?.image_url || null}
        gameSlug={`banner-${banner?.id || 'new'}`}
        onUploadComplete={(url) => setImageUrl(url)}
      />
      <p className="text-[10px] text-zinc-600">
        📐 Banner hero — medidas recomendadas: <strong className="text-zinc-400">1920×640px</strong> (3:1) · WebP o JPG · Máx 2MB
      </p>
      <input type="hidden" value={imageUrl} />
      <div className="flex gap-2 pt-1">
        <button onClick={handleSave} disabled={saving}
          className="rounded-lg bg-yellow-400 px-4 py-2 text-xs font-bold text-black transition-colors hover:bg-yellow-300 disabled:opacity-50">
          {saving ? 'GUARDANDO...' : banner ? 'GUARDAR' : 'CREAR'}
        </button>
        <button onClick={onDone}
          className="rounded-lg border border-white/[0.08] px-4 py-2 text-xs text-zinc-400 transition-colors hover:text-white">
          CANCELAR
        </button>
      </div>
    </div>
  )
}

// ─── Banner Manager ───

export default function BannerManager({ banners }: BannerManagerProps) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const showMsg = useCallback((text: string) => {
    setMsg(text)
    setTimeout(() => setMsg(null), 3000)
  }, [])

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await toggleBanner(id, !active)
      showMsg(active ? '🔴 Banner desactivado' : '🟢 Banner activado')
      router.refresh()
    } catch (e) { showMsg(`Error: ${(e as Error).message}`) }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteBanner(id)
      showMsg('🗑 Banner eliminado')
      router.refresh()
    } catch (e) { showMsg(`Error: ${(e as Error).message}`) }
  }

  const handleMove = async (index: number, dir: -1 | 1) => {
    const newIdx = index + dir
    if (newIdx < 0 || newIdx >= banners.length) return
    const reordered = [...banners]
    ;[reordered[index], reordered[newIdx]] = [reordered[newIdx], reordered[index]]
    try {
      await reorderBanners(reordered.map((b) => b.id))
      showMsg('📦 Orden actualizado')
      router.refresh()
    } catch (e) { showMsg(`Error: ${(e as Error).message}`) }
  }

  return (
    <div className="mt-10">
      {msg && (
        <div className="mb-4 animate-fade-in rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
          {msg}
        </div>
      )}

      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-archivo text-lg tracking-wide text-white">
            BANNERS DEL <span className="text-yellow-400">HOME</span>
          </h2>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-600">
            {banners.length} banner{banners.length !== 1 ? 's' : ''}
          </p>
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-xl bg-yellow-400/20 px-3.5 py-2 text-xs font-bold text-yellow-400 transition-colors hover:bg-yellow-400/30">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            NUEVO BANNER
          </button>
        )}
      </div>

      {creating && (
        <div className="mb-4">
          <BannerForm onDone={() => setCreating(false)} showMsg={showMsg} />
        </div>
      )}

      <div className="space-y-3">
        {banners.length === 0 && !creating && (
          <div className="rounded-xl border border-dashed border-white/[0.06] py-8 text-center">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Sin banners todavía</p>
            <p className="mt-1 text-[10px] text-zinc-600">Crea el primero para personalizar el hero del home</p>
          </div>
        )}

        {banners.map((banner, index) => (
          <div key={banner.id}>
            <div className="relative overflow-hidden rounded-xl border border-white/[0.06] transition-all hover:border-white/[0.10]">
              <div className="relative aspect-[21/9] sm:aspect-[3/1]">
                {banner.image_url ? (
                  <img src={banner.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-800">
                    <span className="text-4xl opacity-20">🎨</span>
                  </div>
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 p-4 text-center">
                  <h3 className="font-archivo text-xl tracking-wide text-white sm:text-2xl">{banner.title}</h3>
                  {banner.subtitle && (
                    <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-yellow-400">{banner.subtitle}</p>
                  )}
                  {banner.description && (
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-300">{banner.description}</p>
                  )}
                </div>
                <div className="absolute left-2 top-2 flex gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    banner.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-500/20 text-zinc-400'
                  }`}>
                    {banner.active ? 'Activo' : 'Inactivo'}
                  </span>
                  <span className="rounded-full bg-black/40 px-2.5 py-0.5 text-[9px] text-zinc-400 backdrop-blur-sm">
                    #{banner.sort_order}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 border-t border-white/[0.04] bg-white/[0.02] px-3 py-2">
                <button onClick={() => handleToggle(banner.id, banner.active)}
                  className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-all ${
                    banner.active
                      ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                      : 'bg-zinc-500/15 text-zinc-400 hover:bg-zinc-500/25'
                  }`}>
                  {banner.active ? '🟢 Activo' : '🔴 Inactivo'}
                </button>
                <button onClick={() => handleMove(index, -1)} disabled={index === 0}
                  className="rounded-lg border border-white/[0.06] px-2 py-1.5 text-zinc-500 transition-colors hover:text-white disabled:opacity-20">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.5l7.5-7.5 7.5 7.5" />
                  </svg>
                </button>
                <button onClick={() => handleMove(index, 1)} disabled={index === banners.length - 1}
                  className="rounded-lg border border-white/[0.06] px-2 py-1.5 text-zinc-500 transition-colors hover:text-white disabled:opacity-20">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.5l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                <div className="flex-1" />
                {editingId === banner.id ? (
                  <button onClick={() => setEditingId(null)}
                    className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[10px] text-zinc-500 transition-colors hover:text-white">
                    CERRAR
                  </button>
                ) : (
                  <button onClick={() => setEditingId(banner.id)}
                    className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[10px] text-zinc-500 transition-colors hover:border-yellow-500/30 hover:text-yellow-400">
                    EDITAR
                  </button>
                )}
                <button onClick={() => { if (confirm('¿Eliminar este banner?')) handleDelete(banner.id) }}
                  className="rounded-lg border border-transparent px-2 py-1.5 text-zinc-600 transition-colors hover:border-red-500/30 hover:text-red-400">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
            {editingId === banner.id && (
              <div className="mt-2">
                <BannerForm banner={banner} onDone={() => setEditingId(null)} showMsg={showMsg} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
