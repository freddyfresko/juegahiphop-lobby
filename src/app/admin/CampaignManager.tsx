'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ImageUpload from './ImageUpload'
import {
  createCampaign,
  updateCampaign,
  setCampaignStatus,
  deleteCampaign,
} from '@/lib/admin-actions'
import type {
  CampaignEntry,
  CampaignType,
  CampaignProvider,
  CampaignPlacement,
  GameCatalogEntry,
} from '@/lib/types'

interface CampaignManagerProps {
  campaigns: CampaignEntry[]
  games: GameCatalogEntry[]
}

// ─── Opciones para selects ───

const TYPE_OPTIONS: { value: CampaignType; label: string }[] = [
  { value: 'external_ad', label: 'Ad externo (Google/AdinPlay/NitroPay)' },
  { value: 'sponsor', label: 'Sponsor directo (marca que paga)' },
  { value: 'event', label: 'Evento propio' },
  { value: 'clubhh', label: 'ClubHH' },
  { value: 'tienda', label: 'Tienda' },
  { value: 'hhtickets', label: 'HHTickets' },
  { value: 'internal_game', label: 'Cross-promo entre juegos' },
  { value: 'educational', label: 'Educativo' },
]

const PROVIDER_OPTIONS: { value: CampaignProvider; label: string }[] = [
  { value: 'google_ads', label: 'Google AdSense' },
  { value: 'adsterra', label: 'Adsterra' },
  { value: 'adinplay', label: 'AdinPlay' },
  { value: 'nitropay', label: 'NitroPay' },
  { value: 'direct_sponsor', label: 'Sponsor directo' },
  { value: 'internal', label: 'Interno (casa)' },
]

const PLACEMENT_OPTIONS: { value: CampaignPlacement; label: string; group: string }[] = [
  // Lobby
  { value: 'lobby_home', label: 'Lobby — Home', group: 'Lobby' },
  { value: 'lobby_catalog', label: 'Lobby — Catálogo', group: 'Lobby' },
  { value: 'lobby_profile', label: 'Lobby — Perfil', group: 'Lobby' },
  { value: 'lobby_rankings', label: 'Lobby — Rankings', group: 'Lobby' },
  // Interstitial
  { value: 'game_loading', label: 'Juego — Cargando', group: 'Interstitial' },
  { value: 'game_results', label: 'Juego — Resultados', group: 'Interstitial' },
  { value: 'game_level_complete', label: 'Juego — Nivel completo', group: 'Interstitial' },
  { value: 'game_category_complete', label: 'Juego — Categoría completa', group: 'Interstitial' },
  { value: 'game_session_end', label: 'Juego — Fin de sesión', group: 'Interstitial' },
  { value: 'game_exit', label: 'Juego — Salida', group: 'Interstitial' },
  // Rewarded
  { value: 'rewarded_hint', label: 'Rewarded — Pista', group: 'Rewarded' },
  { value: 'rewarded_continue', label: 'Rewarded — Continuar', group: 'Rewarded' },
  { value: 'rewarded_bonus', label: 'Rewarded — Bonus', group: 'Rewarded' },
]

const STATUS_OPTIONS: { value: CampaignEntry['status']; label: string; bg: string; text: string }[] = [
  { value: 'draft', label: 'Borrador', bg: 'bg-zinc-500/15', text: 'text-zinc-400' },
  { value: 'active', label: 'Activa', bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  { value: 'paused', label: 'Pausada', bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  { value: 'completed', label: 'Completada', bg: 'bg-sky-500/15', text: 'text-sky-400' },
  { value: 'cancelled', label: 'Cancelada', bg: 'bg-red-500/15', text: 'text-red-400' },
]

function getStatusStyle(status: string) {
  return STATUS_OPTIONS.find((s) => s.value === status) ?? STATUS_OPTIONS[0]
}

// ─── Form ───

function CampaignForm({
  campaign,
  games,
  onDone,
  showMsg,
}: {
  campaign?: CampaignEntry
  games: GameCatalogEntry[]
  onDone: () => void
  showMsg: (msg: string) => void
}) {
  const router = useRouter()
  const [name, setName] = useState(campaign?.name ?? '')
  const [type, setType] = useState<CampaignType>(campaign?.type ?? 'external_ad')
  const [provider, setProvider] = useState<CampaignProvider>(campaign?.provider ?? 'google_ads')
  const [title, setTitle] = useState(campaign?.title ?? '')
  const [description, setDescription] = useState(campaign?.description ?? '')
  const [imageUrl, setImageUrl] = useState(campaign?.image_url ?? '')
  const [destinationUrl, setDestinationUrl] = useState(campaign?.destination_url ?? '')
  const [placements, setPlacements] = useState<CampaignPlacement[]>(campaign?.placements ?? ['game_results'])
  const [priority, setPriority] = useState(campaign?.priority ?? 50)
  const [allowedGames, setAllowedGames] = useState<string[]>(campaign?.allowed_games ?? [])
  const [excludedGames, setExcludedGames] = useState<string[]>(campaign?.excluded_games ?? [])
  const [maxImpressions, setMaxImpressions] = useState<string>(
    campaign?.max_impressions?.toString() ?? '',
  )
  const [maxPerUser, setMaxPerUser] = useState<string>(
    campaign?.max_per_user?.toString() ?? '0',
  )
  const [status, setStatus] = useState<CampaignEntry['status']>(campaign?.status ?? 'draft')
  const [adSlot, setAdSlot] = useState<string>(
    (campaign?.config?.ad_slot as string) ?? '',
  )
  const [adFormat, setAdFormat] = useState<'300x250' | '728x90' | 'native'>(
    (campaign?.config?.ad_format as '300x250' | '728x90' | 'native') ?? '300x250',
  )
  const [rewardValue, setRewardValue] = useState<string>(
    campaign?.reward?.value?.toString() ?? '',
  )
  const [rewardType, setRewardType] = useState<string>(campaign?.reward?.type ?? 'xp')
  const [rewardDesc, setRewardDesc] = useState<string>(campaign?.reward?.description ?? '')
  const [saving, setSaving] = useState(false)

  // Determinar si algún placement es rewarded (requiere configuración de recompensa)
  const isRewarded = placements.some(
    (p) => p === 'rewarded_hint' || p === 'rewarded_continue' || p === 'rewarded_bonus',
  )

  const togglePlacement = (value: CampaignPlacement) => {
    setPlacements((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value],
    )
  }

  const toggleGame = (slug: string, list: string[], setList: (v: string[]) => void) => {
    if (list.includes(slug)) {
      setList(list.filter((s) => s !== slug))
    } else {
      setList([...list, slug])
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const data = {
        name,
        type,
        provider,
        title,
        description,
        image_url: imageUrl || null,
        destination_url: destinationUrl,
        placements: placements.length > 0 ? placements : (['game_results'] as CampaignPlacement[]),
        priority: Number(priority) || 50,
        allowed_games: allowedGames,
        excluded_games: excludedGames,
        max_impressions: maxImpressions ? Number(maxImpressions) : null,
        max_per_user: Number(maxPerUser) || 0,
        status,
        reward: isRewarded && rewardValue
          ? {
              type: rewardType,
              value: Number(rewardValue),
              description: rewardDesc,
            }
          : null,
        config: {
          ...(campaign?.config ?? {}),
          ...(provider === 'google_ads' && adSlot ? { ad_slot: adSlot } : {}),
          ...(provider === 'adsterra' ? { ad_format: adFormat } : {}),
        },
      }
      if (campaign) {
        await updateCampaign(campaign.id, data)
      } else {
        await createCampaign(data)
      }
      onDone()
      router.refresh()
    } catch (e) {
      showMsg(`Error: ${(e as Error).message}`)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      {/* ─── Nombre y tipo ─── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Nombre (interno)
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: AdSense game_results"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-yellow-500/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Estado
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as CampaignEntry['status'])}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-yellow-500/40"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value} className="bg-zinc-900">
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Tipo de campaña
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as CampaignType)}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-yellow-500/40"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value} className="bg-zinc-900">
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Provider (red publicitaria)
          </label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as CampaignProvider)}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-yellow-500/40"
          >
            {PROVIDER_OPTIONS.map((p) => (
              <option key={p.value} value={p.value} className="bg-zinc-900">
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ─── Ad slot (AdSense) ─── */}
      {provider === 'google_ads' && (
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Ad slot de AdSense (data-ad-slot)
          </label>
          <input
            value={adSlot}
            onChange={(e) => setAdSlot(e.target.value)}
            placeholder="Ej: 1234567890 — se crea en tu panel de AdSense → Ads → Unidad de anuncio"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-yellow-500/40"
          />
          <p className="mt-1 text-[10px] text-zinc-600">
            Cuando la cuenta esté aprobada: crea una unidad «Display» en AdSense y pega su ID acá.
            El ad real se mostrará en el overlay en vez del contenido manual.
          </p>
        </div>
      )}

      {/* ─── Formato (Adsterra) ─── */}
      {provider === 'adsterra' && (
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Formato de Adsterra
          </label>
          <select
            value={adFormat}
            onChange={(e) => setAdFormat(e.target.value as '300x250' | '728x90' | 'native')}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-yellow-500/40"
          >
            <option value="300x250" className="bg-zinc-900">300×250 (rectángulo — ideal overlay)</option>
            <option value="728x90" className="bg-zinc-900">728×90 (leaderboard desktop)</option>
            <option value="native" className="bg-zinc-900">Native banner</option>
          </select>
          <p className="mt-1 text-[10px] text-zinc-600">
            El ad real de Adsterra se muestra en el overlay (o en el slot elegido) con la cuenta
            juegahiphop.cl ya activa.
          </p>
        </div>
      )}

      {/* ─── Placements (multi) ─── */}
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Placements (dónde aparece — puedes marcar varios)
        </label>
        {['Lobby', 'Interstitial', 'Rewarded'].map((group) => (
          <div key={group} className="mb-2">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-700">
              {group}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PLACEMENT_OPTIONS.filter((p) => p.group === group).map((p) => {
                const active = placements.includes(p.value)
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => togglePlacement(p.value)}
                    className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all ${
                      active
                        ? 'border-yellow-500/40 bg-yellow-400/15 text-yellow-400'
                        : 'border-white/[0.06] text-zinc-500 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ─── Contenido del ad ─── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Título (cabezal del ad)
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-yellow-500/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Link destino (URL)
          </label>
          <input
            value={destinationUrl}
            onChange={(e) => setDestinationUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-yellow-500/40"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Descripción
        </label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-yellow-500/40"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Imagen del anuncio (16:9 ideal)
        </label>
        <ImageUpload
          currentUrl={campaign?.image_url ?? null}
          gameSlug="campaign"
          bucket="campaign-images"
          folder="campaigns"
          label="Imagen (16:9 ideal)"
          hint="JPG, PNG, WebP o AVIF · Máx 5MB · 16:9"
          onUploadComplete={(url) => setImageUrl(url)}
        />
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="…o pega una URL externa (opcional)"
          className="mt-2 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-yellow-500/40"
        />
      </div>

      {/* ─── Targeting ─── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Prioridad (1-100)
          </label>
          <input
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            type="number"
            min={1}
            max={100}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-yellow-500/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Max impresiones (∞)
          </label>
          <input
            value={maxImpressions}
            onChange={(e) => setMaxImpressions(e.target.value)}
            type="number"
            placeholder="∞"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-yellow-500/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Max por usuario (0=∞)
          </label>
          <input
            value={maxPerUser}
            onChange={(e) => setMaxPerUser(e.target.value)}
            type="number"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-yellow-500/40"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Juegos permitidos (vacío = todos)
        </label>
        {games.length === 0 ? (
          <p className="text-[10px] text-zinc-600">No hay juegos cargados</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {games.map((g) => (
              <button
                key={g.slug}
                onClick={() => toggleGame(g.slug, allowedGames, setAllowedGames)}
                className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all ${
                  allowedGames.includes(g.slug)
                    ? 'border-yellow-500/40 bg-yellow-400/15 text-yellow-400'
                    : 'border-white/[0.06] text-zinc-500 hover:text-white'
                }`}
              >
                {g.emoji} {g.slug}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Juegos excluidos (no mostrar aquí)
        </label>
        {games.length === 0 ? (
          <p className="text-[10px] text-zinc-600">No hay juegos cargados</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {games.map((g) => (
              <button
                key={g.slug}
                onClick={() => toggleGame(g.slug, excludedGames, setExcludedGames)}
                className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all ${
                  excludedGames.includes(g.slug)
                    ? 'border-red-500/40 bg-red-500/15 text-red-400'
                    : 'border-white/[0.06] text-zinc-500 hover:text-white'
                }`}
              >
                {g.emoji} {g.slug}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── Reward (solo si placement es rewarded) ─── */}
      {isRewarded && (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-yellow-400">
            🎁 Configuración de recompensa
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={rewardType}
              onChange={(e) => setRewardType(e.target.value)}
              placeholder="tipo (xp, hint, coins)"
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-xs text-white outline-none focus:border-yellow-500/40"
            />
            <input
              value={rewardValue}
              onChange={(e) => setRewardValue(e.target.value)}
              type="number"
              placeholder="cantidad"
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-xs text-white outline-none focus:border-yellow-500/40"
            />
            <input
              value={rewardDesc}
              onChange={(e) => setRewardDesc(e.target.value)}
              placeholder="descripción"
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-xs text-white outline-none focus:border-yellow-500/40"
            />
          </div>
        </div>
      )}

      {/* ─── Actions ─── */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving || !name}
          className="rounded-lg bg-yellow-400 px-4 py-2 text-xs font-bold text-black transition-colors hover:bg-yellow-300 disabled:opacity-50"
        >
          {saving ? 'GUARDANDO…' : campaign ? 'GUARDAR' : 'CREAR'}
        </button>
        <button
          onClick={onDone}
          className="rounded-lg border border-white/[0.08] px-4 py-2 text-xs text-zinc-400 transition-colors hover:text-white"
        >
          CANCELAR
        </button>
      </div>
    </div>
  )
}

// ─── CampaignManager ───

export default function CampaignManager({ campaigns, games }: CampaignManagerProps) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const showMsg = useCallback((text: string) => {
    setMsg(text)
    setTimeout(() => setMsg(null), 3000)
  }, [])

  const handleToggleStatus = async (c: CampaignEntry) => {
    const nextStatus = c.status === 'active' ? 'paused' : 'active'
    try {
      await setCampaignStatus(c.id, nextStatus)
      showMsg(nextStatus === 'active' ? '🟢 Campaña activada' : '⏸ Campaña pausada')
      router.refresh()
    } catch (e) {
      showMsg(`Error: ${(e as Error).message}`)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteCampaign(id)
      showMsg('🗑 Campaña eliminada')
      router.refresh()
    } catch (e) {
      showMsg(`Error: ${(e as Error).message}`)
    }
  }

  const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions ?? 0), 0)
  const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks ?? 0), 0)
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0'

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
            AD <span className="text-yellow-400">MANAGER</span>
          </h2>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-600">
            {campaigns.length} campaña{campaigns.length !== 1 ? 's' : ''} · {totalImpressions} impresiones · {totalClicks} clicks · CTR {ctr}%
          </p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-xl bg-yellow-400/20 px-3.5 py-2 text-xs font-bold text-yellow-400 transition-colors hover:bg-yellow-400/30"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            NUEVA CAMPAÑA
          </button>
        )}
      </div>

      {creating && (
        <div className="mb-4">
          <CampaignForm games={games} onDone={() => setCreating(false)} showMsg={showMsg} />
        </div>
      )}

      <div className="space-y-3">
        {campaigns.length === 0 && !creating && (
          <div className="rounded-xl border border-dashed border-white/[0.06] py-8 text-center">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Sin campañas todavía</p>
            <p className="mt-1 text-[10px] text-zinc-600">
              Crea la primera para empezar a monetizar entre niveles
            </p>
          </div>
        )}

        {campaigns.map((c) => {
          const statusStyle = getStatusStyle(c.status)
          return (
            <div key={c.id}>
              <div className="relative overflow-hidden rounded-xl border border-white/[0.06] transition-all hover:border-white/[0.10]">
                {/* ─── Card ─── */}
                <div className="flex items-stretch gap-3 p-3">
                  {/* ─── Thumbnail ─── */}
                  <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-zinc-900">
                    {c.image_url ? (
                      <img src={c.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-800">
                        <span className="text-2xl opacity-30">🎯</span>
                      </div>
                    )}
                    {/* Rewarded badge */}
                    {(c.placements ?? []).some((p) => p.startsWith('rewarded_')) && (
                      <span className="absolute left-1 top-1 rounded-full bg-yellow-400/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-black">
                        ⭐ Rewarded
                      </span>
                    )}
                  </div>

                  {/* ─── Info ─── */}
                  <div className="flex flex-1 flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-archivo text-sm tracking-wide text-white">{c.name}</h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${statusStyle.bg} ${statusStyle.text}`}
                        >
                          {statusStyle.label}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
                        <span className="rounded bg-white/[0.04] px-1.5 py-0.5">{c.provider}</span>
                        {(c.placements ?? []).map((p) => (
                          <span key={p} className="rounded bg-white/[0.04] px-1.5 py-0.5">{p}</span>
                        ))}
                        <span className="rounded bg-white/[0.04] px-1.5 py-0.5">Pri {c.priority}</span>
                        {c.allowed_games.length > 0 && (
                          <span className="rounded bg-white/[0.04] px-1.5 py-0.5">
                            {c.allowed_games.length} juegos
                          </span>
                        )}
                      </div>
                    </div>
                    {/* ─── Metrics ─── */}
                    <div className="mt-1.5 flex items-center gap-3 text-[10px] text-zinc-600">
                      <span>👁 {c.impressions ?? 0}</span>
                      <span>👆 {c.clicks ?? 0}</span>
                      <span>✕ {c.dismissals ?? 0}</span>
                      <span>🎁 {c.conversions ?? 0}</span>
                      {c.max_impressions && (
                        <span className="text-zinc-700">
                          / {c.max_impressions}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ─── Actions ─── */}
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <button
                      onClick={() => handleToggleStatus(c)}
                      className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-all ${
                        c.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                          : 'bg-zinc-500/15 text-zinc-400 hover:bg-zinc-500/25'
                      }`}
                    >
                      {c.status === 'active' ? '⏸ PAUSAR' : '▶ ACTIVAR'}
                    </button>
                    {editingId === c.id ? (
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[10px] text-zinc-500 transition-colors hover:text-white"
                      >
                        CERRAR
                      </button>
                    ) : (
                      <button
                        onClick={() => setEditingId(c.id)}
                        className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[10px] text-zinc-500 transition-colors hover:border-yellow-500/30 hover:text-yellow-400"
                      >
                        EDITAR
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm('¿Eliminar esta campaña?')) handleDelete(c.id)
                      }}
                      className="rounded-lg border border-transparent px-2.5 py-1.5 text-[10px] text-zinc-600 transition-colors hover:border-red-500/30 hover:text-red-400"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>

              {editingId === c.id && (
                <div className="mt-2">
                  <CampaignForm
                    campaign={c}
                    games={games}
                    onDone={() => setEditingId(null)}
                    showMsg={showMsg}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
