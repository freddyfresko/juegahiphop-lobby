'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { SelectedCampaign } from '@/lib/campaign-manager'
import type { CampaignPlacement } from '@/lib/types'
import { loadAdinPlay, showAdinPlayAd, isAdinPlayConfigured } from '@/lib/adinplay-loader'
import { loadAdSense, showAdSenseAd, isAdSenseConfigured } from '@/lib/adsense-loader'
import AdsterraBanner, { type AdsterraFormat } from '@/components/AdsterraBanner'

// ─── Props ───

interface AdOverlayProps {
  campaign: SelectedCampaign
  placement: CampaignPlacement
  gameId: string | null
  userId: string | null
  /** UUID de esta visualización — viaja como ?jh_click= en la URL del destino */
  viewId: string
  onComplete: (result: AdResult) => void
}

export interface AdResult {
  /** 'clicked' el usuario clickeó el CTA; 'dismissed' cerró sin interacción; 'reward_granted' completó el ad recompensado; 'reward_expired' no completó */
  outcome: 'clicked' | 'dismissed' | 'reward_granted' | 'reward_expired'
  /** Si el ad era recompensado y se otorgó, los IDs de recompensa del juego */
  rewardIds?: string[]
}

// ─── Componente ───

/**
 * AdOverlay — overlay full-screen que el lobby pinta encima del iframe.
 *
 * Esto NO es un ad dentro del iframe (prohibido por AdSense policy).
 * Es un ad en el dominio del lobby, superpuesto al juego.
 *
 * Tipos de ad:
 *   - Interstitial (game_results, game_level_complete, etc.) → botón Cerrar o CTA
 *   - Rewarded (rewarded_hint, rewarded_continue, rewarded_bonus) → el usuario
 *     debe esperar N segundos y luego puede cerrar/reclamar recompensa
 */
export default function AdOverlay({
  campaign,
  placement,
  gameId,
  viewId,
  onComplete,
}: AdOverlayProps) {
  const isRewarded =
    placement === 'rewarded_hint' ||
    placement === 'rewarded_continue' ||
    placement === 'rewarded_bonus'

  // Para rewarded: 5s antes de poder reclamar/cerrar (simula ad de video)
  const REWARDED_SECONDS = 5
  const trackRef = useRef(false)

  // ─── Ad de red real (AdinPlay / AdSense) ───
  // Si la campaña es de una red real y el SDK está configurado, intentamos
  // mostrar el ad real de la red en el contenedor dedicado. Sin SDK
  // configurado (o si falla), el overlay cae al contenido manual.
  const isAdinPlayAd = campaign.provider === 'adinplay' && isAdinPlayConfigured()
  const isAdSenseAd =
    campaign.provider === 'google_ads' &&
    isAdSenseConfigured() &&
    Boolean(campaign.config?.ad_slot)
  const isAdsterraAd = campaign.provider === 'adsterra'
  const isNetworkAd = isAdinPlayAd || isAdSenseAd
  const [networkAdMounted, setNetworkAdMounted] = useState(false)
  const adContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isNetworkAd) return
    let cancelled = false

    const run = async () => {
      let shown = false
      if (isAdSenseAd) {
        const adSlot = campaign.config?.ad_slot as string
        // El SDK de AdSense monta la unidad display en el contenedor.
        shown = await showAdSenseAd(adContainerRef.current, adSlot)
      } else {
        // Mostrar el ad real AdinPlay (interstitial o rewarded según placement)
        const kind: 'interstitial' | 'rewarded' = isRewarded ? 'rewarded' : 'interstitial'
        shown = await showAdinPlayAd(kind)
      }
      if (cancelled) return
      if (shown) {
        setNetworkAdMounted(true)
        // AdinPlay: el SDK de la red gestiona su propio cierre/recompensa.
        // TODO(adinplay): conectar onClose/onReward del SDK real para
        // llamar handleComplete('reward_granted' | 'dismissed') aquí.
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [isNetworkAd, isAdSenseAd, isRewarded, campaign.config?.ad_slot])

  // Inicialización directa: interstitial permite cerrar de inmediato,
  // rewarded arranca con countdown y canClose=false
  const [countdown, setCountdown] = useState(isRewarded ? REWARDED_SECONDS : 0)
  const [canClose, setCanClose] = useState(!isRewarded)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (!isRewarded) return
    // Rewarded: correr countdown hasta llegar a 0, habilitar close
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          setCanClose(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [isRewarded])

  // ─── Handlers ───

  const handleComplete = useCallback(
    (outcome: AdResult['outcome'], rewardIds?: string[]) => {
      if (trackRef.current) return
      trackRef.current = true
      setClosing(true)
      // Pequeño delay para animación de salida
      setTimeout(() => {
        onComplete({ outcome, rewardIds })
      }, 250)
    },
    [onComplete],
  )

  const handleCtaClick = useCallback(() => {
    if (campaign.destination_url) {
      // Atribución: UTMs para que la tienda/sponsor vea el tráfico del lobby
      // en su analytics + jh_click (viewId) para cerrar el loop de conversión.
      try {
        const url = new URL(campaign.destination_url, window.location.origin)
        url.searchParams.set('utm_source', 'juegahiphop')
        url.searchParams.set('utm_medium', 'campaign')
        url.searchParams.set('utm_campaign', campaign.id)
        url.searchParams.set('utm_content', placement)
        if (gameId) url.searchParams.set('utm_term', gameId)
        url.searchParams.set('jh_click', viewId)
        window.open(url.toString(), '_blank', 'noopener,noreferrer')
      } catch {
        // URL inválida → abrir tal cual
        window.open(campaign.destination_url, '_blank', 'noopener,noreferrer')
      }
    }
    handleComplete('clicked')
  }, [campaign.destination_url, campaign.id, placement, gameId, viewId, handleComplete])

  const handleDismiss = useCallback(() => {
    if (!canClose) return
    handleComplete('dismissed')
  }, [canClose, handleComplete])

  const handleClaimReward = useCallback(() => {
    if (!canClose) return
    // El juego debe indicar qué rewardIds esperaba — los propagamos.
    // El lobby ya los tiene del campaign_request original.
    handleComplete('reward_granted')
  }, [canClose, handleComplete])

  // Si no hay imagen, usar gradient con color inicial de la campaña
  const accentColor = (campaign.config?.accent_color as string) ?? '#facc15'

  // ─── Render ───

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md transition-opacity duration-250 ${
        closing ? 'opacity-0' : 'opacity-100'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Publicidad"
    >
      <div className="relative mx-4 w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0f0f0f] shadow-2xl">
        {/* ─── Ad de red real (AdinPlay / AdSense / Adsterra) — el SDK inyecta aquí ─── */}
        {networkAdMounted || isAdsterraAd ? (
          <div
            ref={adContainerRef}
            className="flex min-h-[300px] w-full items-center justify-center"
            aria-label="Publicidad"
          >
            {isAdsterraAd ? (
              <AdsterraBanner
                format={(campaign.config?.ad_format as AdsterraFormat) ?? '300x250'}
              />
            ) : (
              /* El SDK de AdinPlay/AdSense monta su ad en este contenedor */
              <></>
            )}
          </div>
        ) : (
          <>
        {/* ─── Ad badge ─── */}
        <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
          <span className="rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400 backdrop-blur-sm">
            Ad
          </span>
          {canClose && (
            <button
              onClick={handleDismiss}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-zinc-400 backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-white"
              aria-label="Cerrar publicidad"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {!canClose && isRewarded && (
            <span className="flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4" />
              </svg>
              {countdown}s
            </span>
          )}
        </div>

        {/* ─── Media (imagen o placeholder) ─── */}
        <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-800">
          {campaign.image_url ? (
            <img
              src={campaign.image_url}
              alt={campaign.title || campaign.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${accentColor}22 0%, transparent 100%)` }}
            >
              <span className="text-6xl opacity-30">🎯</span>
            </div>
          )}
          {isRewarded && (
            <div className="absolute left-3 top-3 rounded-full bg-yellow-400/90 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black">
              ⭐ Rewarded
            </div>
          )}
        </div>

        {/* ─── Content ─── */}
        <div className="p-5">
          {campaign.title && (
            <h3 className="font-archivo text-lg tracking-wide text-white">
              {campaign.title}
            </h3>
          )}
          {campaign.description && (
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              {campaign.description}
            </p>
          )}

          {/* ─── Reward info ─── */}
          {isRewarded && campaign.reward && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-3 py-2">
              <span className="text-lg">🎁</span>
              <div>
                <p className="text-xs font-semibold text-yellow-400">
                  Recompensa: +{campaign.reward.value} {campaign.reward.type}
                </p>
                {campaign.reward.description && (
                  <p className="text-[10px] text-zinc-500">{campaign.reward.description}</p>
                )}
              </div>
            </div>
          )}

          {/* ─── Actions ─── */}
          <div className="mt-4 flex gap-2">
            {isRewarded ? (
              <button
                onClick={handleClaimReward}
                disabled={!canClose}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-black transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]"
                style={{ backgroundColor: canClose ? accentColor : '#525252' }}
              >
                {canClose ? '🎁 RECLAMAR RECOMPENSA' : `ESPERA ${countdown}s…`}
              </button>
            ) : (
              <>
                <button
                  onClick={handleDismiss}
                  disabled={!canClose}
                  className="flex-1 rounded-xl border border-white/[0.08] px-4 py-2.5 text-sm font-semibold text-zinc-400 transition-colors hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  CERRAR
                </button>
                {campaign.destination_url && (
                  <button
                    onClick={handleCtaClick}
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-black transition-all active:scale-[0.97]"
                    style={{ backgroundColor: accentColor }}
                  >
                    {campaign.config?.cta_label as string || 'VER MÁS'}
                  </button>
                )}
              </>
            )}
          </div>

          {/* ─── Provider label ─── */}
          <p className="mt-3 text-center text-[9px] uppercase tracking-wider text-zinc-700">
            {campaign.provider === 'google_ads' && 'Anuncio Google'}
            {campaign.provider === 'direct_sponsor' && 'Patrocinador'}
            {campaign.provider === 'adinplay' && 'AdinPlay'}
            {campaign.provider === 'nitropay' && 'NitroPay'}
            {campaign.provider === 'adsterra' && 'Adsterra'}
            {campaign.provider === 'internal' && 'JuegaHipHop'}
            {!['google_ads','direct_sponsor','adinplay','nitropay','adsterra','internal'].includes(campaign.provider) && campaign.provider}
          </p>
        </div>
          </>
        )}
      </div>
    </div>
  )
}
