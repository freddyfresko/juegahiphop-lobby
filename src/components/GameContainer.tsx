'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createGameClient } from '@/lib/sdk/game-container'
import type { GameCatalogEntry } from '@/lib/types'
import type {
  SessionContextPayload,
  SaveProgressPayload,
  LoadProgressPayload,
  UnlockAchievementPayload,
  CampaignRequestPayload,
  ResetProgressPayload,
  SaveResultPayload,
  ProgressDataPayload,
  AchievementResultPayload,
  EndSessionPayload,
} from '@/lib/sdk/types'
import { createClient } from '@/lib/supabase/client'
import { selectCampaign, trackImpression } from '@/lib/campaign-manager'
import type { SelectedCampaign } from '@/lib/campaign-manager'
import type { CampaignPlacement } from '@/lib/types'
import AdOverlay, { type AdResult } from '@/components/AdOverlay'
import { getSessionId, newViewId } from '@/lib/session'

// ─── Estados del contenedor ───

type ContainerState =
  | 'loading'       // Mostrando pantalla de carga, esperando game_ready
  | 'handshake'     // Game listo, enviando contexto
  | 'playing'       // Juego activo, visible
  | 'saving'        // Guardando progreso (breve)
  | 'error'         // Error fatal
  | 'timeout'       // No recibió game_ready a tiempo

// ─── Props ───

interface GameContainerProps {
  slug: string
  game: GameCatalogEntry
  validatedUrl: string
  userId: string | null
}

// ─── Componente ───

export default function GameContainer({
  slug,
  game,
  validatedUrl,
  userId,
}: GameContainerProps) {
  const router = useRouter()
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const gameClientRef = useRef<ReturnType<typeof createGameClient> | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const sessionStartedRef = useRef<number>(0)
  const endedRef = useRef(false)
  const lastScoreSentRef = useRef(0)

  const [state, setState] = useState<ContainerState>('loading')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // ─── Ad Overlay state ───
  const [activeAd, setActiveAd] = useState<{
    campaign: SelectedCampaign
    placement: CampaignPlacement
    requestId: string
    rewardIds: string[]
    /** UUID de esta visualización — conecta shown → clicked/dismissed y viaja como ?jh_click= */
    viewId: string
    /** Timestamp de cuando se mostró (para medir duración de vista) */
    shownAt: number
  } | null>(null)

  const supabase = createClient()
  const accentColor = game.accent_color ?? game.color

  // ─── Helpers de persistencia (el lobby es el CEREBRO) ───

  /** Crear sesión de juego en Supabase (solo si hay userId) */
  const startSession = useCallback(async (): Promise<string | null> => {
    if (!userId) return null // Modo invitado: sin sesión
    try {
      const deviceInfo = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        screenSize: `${window.screen.width}x${window.screen.height}`,
        platform: navigator.platform,
      }
      const { data, error } = await supabase
        .from('game_sessions')
        .insert({
          user_id: userId,
          game_id: slug,
          session_type: 'authenticated',
          device_info: deviceInfo,
          started_at: new Date().toISOString(),
          game_version: game.version ?? null,
          protocol_version: game.protocol_version ?? null,
        })
        .select('id')
        .single()

      if (error || !data) {
        console.warn('[GameContainer] Error creando sesión:', error?.message)
        return null
      }
      sessionIdRef.current = data.id
      sessionStartedRef.current = Date.now()

      // Incrementar contador de partidas del usuario en este juego
      void supabase
        .rpc('increment_game_plays', { p_user_id: userId, p_game_id: slug })
        .then(() => {}, () => { /* no crítico */ })

      return data.id
    } catch {
      return null
    }
  }, [userId, slug, supabase, game.version, game.protocol_version])

  /** Cerrar sesión de juego — SIEMPRE vía RPC para que game_state,
   *  player_profiles y recalc corran (UPDATE directo dejaba la sesión
   *  abierta y las stats desincronizadas — bug números home/perfil/ranking) */
  const endSession = useCallback(async (
    result: 'completed' | 'abandoned' | 'error' | 'timeout' = 'abandoned',
  ) => {
    if (endedRef.current) return
    const sessionId = sessionIdRef.current
    if (!sessionId) return

    endedRef.current = true
    const durationSeconds = sessionStartedRef.current
      ? Math.round((Date.now() - sessionStartedRef.current) / 1000)
      : 0

    try {
      if (result === 'completed') {
        // Cierre con resultado: actualiza game_state + player_profiles + recalc
        // p_score 0 → GREATEST conserva el score ya guardado por update_session_score
        await supabase.rpc('finish_game_session', {
          p_session_id: sessionId,
          p_score: 0,
          p_result: 'completed',
          p_playtime_seconds: durationSeconds,
        })
      } else {
        await supabase.rpc('close_session', {
          p_session_id: sessionId,
          p_result: result,
          p_duration: durationSeconds,
        })
      }
    } catch (err) {
      console.warn('[GameContainer] Error cerrando sesión:', err)
    }
  }, [supabase])

  /** Registrar evento de telemetría (solo con sesión activa) */
  const recordEvent = useCallback(async (
    eventType: string,
    eventData: Record<string, unknown> = {},
  ) => {
    if (!userId) return
    try {
      await supabase.rpc('record_game_event', {
        p_user_id: userId,
        p_game_id: slug,
        p_session_id: sessionIdRef.current,
        p_event_type: eventType,
        p_event_data: eventData,
      })
    } catch (err) {
      console.warn('[GameContainer] Error registrando evento:', err)
    }
  }, [userId, slug, supabase])

  /** Manejar solicitud de guardado del juego → persistir en Supabase */
  const handleSaveProgress = useCallback(async (
    payload: SaveProgressPayload & { _requestId?: string },
  ): Promise<void> => {
    const requestId = payload._requestId ?? ''
    if (!userId) {
      // Modo invitado: confirmar pero no persistir
      gameClientRef.current?.sendSaveResult({ requestId, success: true })
      return
    }
    try {
      setIsSaving(true)
      await supabase.from('game_state').upsert(
        {
          user_id: userId,
          game_id: slug,
          state: payload.gameState,
          best_score: payload.score ?? 0,
          // Progreso REAL del juego para las cards del lobby (ej: 3/9 categorías).
          // Si el juego no lo manda, conservar los valores previos (undefined → no toca).
          ...(payload.progress
            ? {
                progress_current: Math.max(0, Math.round(payload.progress.current)),
                progress_total: Math.max(0, Math.round(payload.progress.total)),
                progress_label: payload.progress.label,
              }
            : {}),
          last_played_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id, game_id' },
      )
      gameClientRef.current?.sendSaveResult({ requestId, success: true })
    } catch (err) {
      gameClientRef.current?.sendSaveResult({
        requestId,
        success: false,
        error: err instanceof Error ? err.message : 'Error desconocido',
      })
    } finally {
      setIsSaving(false)
    }
  }, [userId, slug, supabase])

  /** Manejar solicitud de carga del juego → leer de Supabase */
  const handleLoadProgress = useCallback(async (
    payload: LoadProgressPayload & { _requestId?: string },
  ): Promise<void> => {
    const requestId = payload._requestId ?? ''
    if (!userId) {
      gameClientRef.current?.sendProgressData({
        requestId,
        success: true,
        gameState: null,
      })
      return
    }
    try {
      const { data } = await supabase
        .from('game_state')
        .select('state, best_score')
        .eq('user_id', userId)
        .eq('game_id', slug)
        .single()

      const gameState = (data?.state as Record<string, unknown> | null) ?? null
      const bestScore = data?.best_score ?? undefined

      gameClientRef.current?.sendProgressData({
        requestId,
        success: true,
        gameState,
        bestScore,
        schemaVersion: game.progress_schema_version ?? '1.0.0',
      })
    } catch {
      gameClientRef.current?.sendProgressData({
        requestId,
        success: true,
        gameState: null,
        schemaVersion: game.progress_schema_version ?? '1.0.0',
      })
    }
  }, [userId, slug, supabase, game.progress_schema_version])

  /** Manejar solicitud de logro desbloqueado → persistir en Supabase */
  const handleUnlockAchievement = useCallback(async (
    payload: UnlockAchievementPayload & { _requestId?: string },
  ): Promise<void> => {
    const requestId = payload._requestId ?? ''
    if (!userId) {
      gameClientRef.current?.sendAchievementResult({ requestId, success: true })
      return
    }
    try {
      const { error } = await supabase
        .from('achievement_unlocks')
        .insert({
          user_id: userId,
          achievement_id: payload.achievementId,
          unlocked_at: new Date().toISOString(),
        })

      // Si ya existía (violación de unique constraint), ya estaba desbloqueado
      const alreadyUnlocked = error?.code === '23505'
      gameClientRef.current?.sendAchievementResult({
        requestId,
        success: !error || alreadyUnlocked,
        alreadyUnlocked,
        error: error && !alreadyUnlocked ? error.message : undefined,
      })

      // Telemetría del logro (aunque ya estuviera desbloqueado)
      await recordEvent('achievement_unlocked', {
        achievementId: payload.achievementId,
        alreadyUnlocked,
        ...(payload.metadata ?? {}),
      })
    } catch (err) {
      gameClientRef.current?.sendAchievementResult({
        requestId,
        success: false,
        error: err instanceof Error ? err.message : 'Error desconocido',
      })
    }
  }, [userId, supabase, recordEvent])

  /** Manejar RESET de progreso → el juego pide empezar de 0.
   *  El lobby borra todo el progreso del usuario para este juego
   *  (RPC server-side, 1 transacción) y responde al juego. */
  const handleResetProgress = useCallback(async (
    payload: ResetProgressPayload & { _requestId?: string },
  ): Promise<void> => {
    const requestId = payload._requestId ?? ''
    if (!userId) {
      gameClientRef.current?.sendResetResult({ requestId, success: false, error: 'Debes iniciar sesión' })
      return
    }
    if (payload.confirm !== true) {
      gameClientRef.current?.sendResetResult({ requestId, success: false, error: 'confirm no fue true' })
      return
    }
    try {
      const { error } = await supabase.rpc('reset_game_progress', { p_game_id: slug })
      if (error) throw error
      gameClientRef.current?.sendResetResult({ requestId, success: true })
    } catch (err) {
      console.warn('[GameContainer] Error reseteando progreso:', err)
      gameClientRef.current?.sendResetResult({
        requestId,
        success: false,
        error: err instanceof Error ? err.message : 'Error desconocido',
      })
    }
  }, [userId, slug, supabase])

  /** Volver al lobby */
  const handleBackToLobby = useCallback(() => {
    router.push('/')
  }, [router])

  // ─── Inicializar todo ───

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    let destroyed = false

    // 1. Crear game client SDK
    const gameClient = createGameClient(iframe, {
      allowedOrigins: game.allowed_origins,
      readyTimeout: 15000,
      gameId: slug,
    })
    gameClientRef.current = gameClient

    // 2. Iniciar flujo completo
    async function init() {
      if (destroyed) return

      // 2a. Crear sesión (solo si hay userId)
      const sessionId = await startSession()

      // 2b. Esperar game_ready (con validación de protocolo)
      try {
        await gameClient.ready
        if (destroyed) return

        setState('handshake')

        // 2c. Preparar contexto de sesión
        let displayName = 'Invitado'
        let avatarUrl: string | undefined
        let level = 1
        let xp = 0

        if (userId) {
          const { data: { user } } = await supabase.auth.getUser()
          const { data: profile, error: profileErr } = await supabase
            .from('player_profiles')
            .select('display_name, avatar_url, level, xp')
            .eq('user_id', userId)
            .maybeSingle()

          // Si no existe el perfil (406 PGRST116 o profile === null),
          // crearlo automaticamente para que futuras lecturas funcionen.
          if (!profile && userId && !profileErr) {
            const fallbackName = user?.email?.split('@')[0] ?? 'Jugador'
            await supabase
              .from('player_profiles')
              .upsert({
                user_id: userId,
                display_name: fallbackName,
                xp: 0,
                level: 1,
                total_games_completed: 0,
                current_streak: 0,
              }, { onConflict: 'user_id' })
              .select('display_name, avatar_url, level, xp')
              .maybeSingle()
              .then(({ data: created }) => {
                if (created) {
                  displayName = (created as { display_name?: string }).display_name ?? fallbackName
                  level = (created as { level?: number }).level ?? 1
                  xp = (created as { xp?: number }).xp ?? 0
                }
              })
          } else {
            displayName = (profile as { display_name?: string })?.display_name ?? user?.email?.split('@')[0] ?? 'Invitado'
            avatarUrl = (profile as { avatar_url?: string })?.avatar_url
            level = (profile as { level?: number })?.level ?? 1
            xp = (profile as { xp?: number })?.xp ?? 0
          }
        }

        const sessionContext: SessionContextPayload = {
          userId: userId ?? 'guest',
          displayName,
          avatarUrl,
          level,
          xp,
          locale: 'es-CL',
          isGuest: !userId,
          sessionId: sessionId ?? '',
          capabilities: game.capabilities,
        }

        // 2d. Enviar contexto al juego
        gameClient.sendSessionContext(sessionContext)

        // 2e. Notificar viewport inicial al juego (tamaño real del iframe)
        sendViewport()

        // 2f. ¡Juego activo!
        setState('playing')
      } catch (err) {
        if (destroyed) return
        setErrorMsg((err as Error).message)
        setState('timeout')
      }
    }

    // Envía el tamaño real del iframe al juego (dvh del contenedor).
    const sendViewport = () => {
      const rect = iframe.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return
      gameClient.sendViewportChanged({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        isFullscreen: document.fullscreenElement !== null,
        orientation:
          window.innerHeight > window.innerWidth ? 'portrait' : 'landscape',
        devicePixelRatio: window.devicePixelRatio || 1,
      })
    }

    // Observar cambios de tamaño del iframe (resize de ventana, fullscreen,
    // teclado móvil, rotación) y notificar al juego para que re-layoutee.
    const resizeObserver = new ResizeObserver(() => {
      if (gameClientRef.current) sendViewport()
    })
    resizeObserver.observe(iframe)

    init()

    // 3. Eventos del juego

    // ── Inicio de partida: guardar contexto (nivel/dificultad) + telemetría ──
    gameClient.onGameStarted(async (payload) => {
      if (!userId) return
      if (sessionIdRef.current) {
        await supabase
          .from('game_sessions')
          .update({
            level_id: payload.levelId ?? null,
            difficulty: payload.difficulty ?? null,
          })
          .eq('id', sessionIdRef.current)
      }
      await recordEvent('game_started', {
        levelId: payload.levelId ?? null,
        difficulty: payload.difficulty ?? null,
      })
    })

    // ── Partida completada: historial + cierre de sesión con stats + telemetría ──
    gameClient.onGameCompleted(async (payload) => {
      if (!userId) return
      const sessionId = sessionIdRef.current

      // ═══ Normalización del payload — RANKING-PROTOCOL v1.0.0 ═══
      // Regla 2: score es un entero ≥ 0. Cualquier cosa rara → 0.
      const rawScore = typeof payload.score === 'number' ? payload.score : Number(payload.score)
      const score = Number.isFinite(rawScore) && rawScore > 0 ? Math.round(rawScore) : 0
      // Regla 3: completed SOLO es true explícito. Si el juego no lo manda,
      // la partida NO cuenta como completada (default conservador).
      const completed = payload.completed === true

      const itemsCompleted =
        typeof payload.metadata?.itemsCompleted === 'number'
          ? (payload.metadata.itemsCompleted as number)
          : payload.itemId
            ? 1
            : 0
      const timeSpent = payload.timeSpent ?? (sessionStartedRef.current
        ? Math.round((Date.now() - sessionStartedRef.current) / 1000)
        : null)

      // 1. Historial de completados (idempotente — no duplica si el item ya estaba)
      try {
        await supabase
          .from('game_completions')
          .upsert(
            {
              user_id: userId,
              game_id: slug,
              item_id: payload.itemId ?? 'unknown',
              difficulty: payload.difficulty ?? 'normal',
              score,
              metadata: payload.metadata ?? {},
              completed_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,game_id,item_id,difficulty', ignoreDuplicates: true },
          )
      } catch (err) {
        console.warn('[GameContainer] Error registrando completado:', err)
      }

      // 2. Cerrar la sesión con resultado → actualiza game_state
      //    (best_score, playtime, completions) y player_profiles
      if (sessionId) {
        try {
          await supabase.rpc('finish_game_session', {
            p_session_id: sessionId,
            p_score: score,
            p_items_completed: itemsCompleted,
            p_result: completed ? 'completed' : 'abandoned',
            p_playtime_seconds: timeSpent,
            p_metadata: {
              ...(payload.metadata ?? {}),
              itemId: payload.itemId,
              difficulty: payload.difficulty,
            },
          })
        } catch (err) {
          console.warn('[GameContainer] Error cerrando sesión:', err)
        }
      }

      // 3. Telemetría
      await recordEvent('game_completed', {
        score,
        itemId: payload.itemId ?? null,
        difficulty: payload.difficulty ?? null,
        timeSpent,
        completed: payload.completed !== false,
      })
    })

    // ── Score en vivo: actualizar la sesión con throttle (cada 5s) ──
    gameClient.onScoreUpdated((payload) => {
      const now = Date.now()
      if (now - lastScoreSentRef.current < 5000) return
      lastScoreSentRef.current = now
      const sessionId = sessionIdRef.current
      if (!sessionId || !userId) return
      const playtime = sessionStartedRef.current
        ? Math.round((now - sessionStartedRef.current) / 1000)
        : null
      void supabase
        .rpc('update_session_score', {
          p_session_id: sessionId,
          p_score: payload.score,
          p_playtime_seconds: playtime,
        })
        .then(() => {}, () => { /* no crítico */ })
      recordEvent('score_updated', {
        score: payload.score,
        progress: payload.progress ?? null,
      }).catch(() => { /* no crítico */ })
    })

    // ── Persistencia: el juego le pide al lobby que guarde ──
    gameClient.onSaveProgress((payload) => handleSaveProgress(payload))

    // ── Persistencia: el juego le pide al lobby que cargue ──
    gameClient.onLoadProgress((payload) => handleLoadProgress(payload))

    // ── Logros: el juego le pide al lobby que registre ──
    gameClient.onUnlockAchievement((payload) => handleUnlockAchievement(payload))

    // ── Reset: el juego le pide al lobby que borre su progreso ──
    gameClient.onResetProgress((payload) => handleResetProgress(payload))

    gameClient.onCampaignRequest(async (payload: CampaignRequestPayload) => {
      const requestId = (payload as unknown as { _requestId?: string })._requestId ?? ''
      const placement = (payload.placement as CampaignPlacement) ?? 'game_results'
      const rewardIds = payload.rewardIds ?? []

      // Buscar campaña activa para este placement + juego + usuario
      const campaign = await selectCampaign(supabase, placement, slug, userId)

      if (!campaign) {
        // Sin campaña elegible → le decimos al juego que no hay ad
        gameClient.sendCampaignResponse({
          requestId,
          status: 'unavailable',
          message: 'No hay campañas activas para este placement',
        })
        return
      }

      // Registrar impresión (shown) — con sesión anónima y viewId
      const viewId = newViewId()
      await trackImpression(supabase, campaign.id, 'shown', {
        userId,
        gameId: slug,
        placement,
        sessionId: getSessionId(),
        viewId,
      })

      // Mostrar el overlay (el juego se pausa implícitamente porque
      // el overlay cubre toda la pantalla)
      setActiveAd({ campaign, placement, requestId, rewardIds, viewId, shownAt: Date.now() })
    })

    gameClient.onExitGame(async (payload) => {
      await endSession(payload?.reason === 'completed' ? 'completed' : 'abandoned')
      handleBackToLobby()
    })

    gameClient.onError((payload) => {
      setErrorMsg(payload.message)
      recordEvent('game_error', {
        code: payload.code,
        message: payload.message,
        fatal: payload.fatal,
      }).catch(() => { /* no crítico */ })
      if (payload.fatal) {
        setState('error')
        endSession('error')
      }
    })

    // 4. beforeunload: cerrar sesión si cierran la pestaña
    const handleBeforeUnload = () => {
      if (!endedRef.current && sessionIdRef.current) {
        navigator.sendBeacon(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/close_session`,
          JSON.stringify({
            p_session_id: sessionIdRef.current,
            p_result: 'abandoned',
            p_duration: Math.round((Date.now() - sessionStartedRef.current) / 1000),
          }),
        )
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    // 5. Cleanup
    return () => {
      destroyed = true
      resizeObserver.disconnect()
      window.removeEventListener('beforeunload', handleBeforeUnload)
      gameClient.destroy()
      if (!endedRef.current) {
        endSession('abandoned')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  // ─── Fullscreen ───

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch {
      setIsFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const onFSChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFSChange)
    return () => document.removeEventListener('fullscreenchange', onFSChange)
  }, [])

  // ─── Salida ───

  const handleExitClick = useCallback(() => {
    if (state === 'playing' || state === 'handshake') {
      setShowExitConfirm(true)
    } else {
      handleBackToLobby()
    }
  }, [state, handleBackToLobby])

  const confirmExit = useCallback(async () => {
    setShowExitConfirm(false)
    if (gameClientRef.current) {
      gameClientRef.current.sendEndSession({ reason: 'navigate_away' })
    }
    await endSession('abandoned')
    handleBackToLobby()
  }, [handleBackToLobby, endSession])

  const cancelExit = useCallback(() => {
    setShowExitConfirm(false)
  }, [])

  // ─── Iframe error ───

  const handleIframeError = useCallback(() => {
    setErrorMsg('El juego no pudo cargarse. Verifica tu conexión e intenta de nuevo.')
    setState('error')
    endSession('error')
  }, [endSession])

  // ─── Retry ───

  const handleRetry = useCallback(() => {
    endedRef.current = false
    sessionIdRef.current = null
    sessionStartedRef.current = 0
    setState('loading')
    setErrorMsg('')
    if (iframeRef.current) {
      iframeRef.current.src = validatedUrl
    }
  }, [validatedUrl])

  // ─── Ad Overlay completion ───

  const handleAdComplete = useCallback(
    async (result: AdResult) => {
      const ad = activeAd
      if (!ad) return
      setActiveAd(null)

      // Registrar el evento (clicked/dismissed/reward_granted/reward_expired)
      const eventName =
        result.outcome === 'clicked'
          ? 'clicked'
          : result.outcome === 'dismissed'
            ? 'dismissed'
            : result.outcome === 'reward_granted'
              ? 'reward_granted'
              : 'reward_expired'
      await trackImpression(supabase, ad.campaign.id, eventName, {
        userId,
        gameId: slug,
        placement: ad.placement,
        sessionId: getSessionId(),
        viewId: ad.viewId,
        viewDurationSeconds: Math.max(0, Math.round((Date.now() - ad.shownAt) / 1000)),
      })

      // Responder al juego según el resultado
      const gameClient = gameClientRef.current
      if (!gameClient) return

      if (result.outcome === 'reward_granted') {
        gameClient.sendCampaignResponse({
          requestId: ad.requestId,
          status: 'approved',
          campaignId: ad.campaign.id,
          rewardedIds: ad.rewardIds,
          message: 'Recompensa concedida',
        })
      } else if (result.outcome === 'clicked') {
        gameClient.sendCampaignResponse({
          requestId: ad.requestId,
          status: 'approved',
          campaignId: ad.campaign.id,
          message: 'Click registrado',
        })
      } else if (result.outcome === 'reward_expired') {
        gameClient.sendCampaignResponse({
          requestId: ad.requestId,
          status: 'cancelled',
          message: 'El usuario no completó el ad recompensado',
        })
      } else {
        // dismissed
        gameClient.sendCampaignResponse({
          requestId: ad.requestId,
          status: 'rejected',
          message: 'El usuario cerró el ad',
        })
      }
    },
    [activeAd, supabase, userId, slug],
  )

  // ─── Render ───

  const showIframe = state !== 'timeout' && state !== 'error'

  return (
    <div className="fixed inset-0 z-50 flex min-h-dvh flex-col bg-black">
      {/* ─── Top bar ─── */}
      <div
        className="safe-area-top flex h-12 shrink-0 items-center justify-between gap-2 px-3 sm:px-4"
        style={{ backgroundColor: `${game.color}22`, borderBottom: `1px solid ${game.color}33` }}
      >
        <button
          onClick={handleExitClick}
          className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-white active:bg-white/[0.10]"
          type="button"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          <span className="hidden sm:inline">VOLVER</span>
        </button>

        <div className="flex min-w-0 items-center gap-2">
          <span className="text-base">{game.emoji}</span>
          <span className="truncate font-archivo text-sm tracking-wide text-white">
            {game.name}
          </span>
          {isSaving && (
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 animate-pulse">
              GUARDANDO…
            </span>
          )}
          {game.status === 'beta' && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: `${accentColor}33`, color: accentColor }}
            >
              Beta
            </span>
          )}
        </div>

        <button
          onClick={toggleFullscreen}
          className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-white active:bg-white/[0.10]"
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          type="button"
        >
          {isFullscreen ? (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          )}
          <span className="hidden sm:inline">{isFullscreen ? 'SALIR' : 'FULL'}</span>
        </button>
      </div>

      {/* ─── Game area ─── */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
        {/* Loading / Handshake state */}
        {(state === 'loading' || state === 'handshake') && (
          <LoadingScreen
            game={game}
            accentColor={accentColor}
            isHandshake={state === 'handshake'}
          />
        )}

        {/* Timeout state */}
        {state === 'timeout' && (
          <div className="relative z-10 flex flex-col items-center px-4 text-center">
            <div className="mb-4 text-5xl">⏱️</div>
            <h2 className="font-archivo text-xl tracking-wide text-white">
              EL JUEGO NO RESPONDE
            </h2>
            <p className="mt-2 max-w-sm text-xs uppercase tracking-wider text-zinc-500">
              {errorMsg}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleRetry}
                className="rounded-xl px-6 py-2.5 text-sm font-bold text-black transition-colors"
                style={{ backgroundColor: accentColor }}
              >
                REINTENTAR
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {state === 'error' && (
          <ErrorScreen
            message={errorMsg}
            onRetry={handleRetry}
            onBack={handleBackToLobby}
            accentColor={accentColor}
          />
        )}

        {/* Iframe */}
        {showIframe && (
          <iframe
            ref={iframeRef}
            src={validatedUrl}
            title={game.name}
            className={`absolute inset-0 h-full w-full border-0 transition-opacity duration-500 ${
              state === 'playing' ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            allow={[
              'fullscreen',
              'autoplay',
              'clipboard-write',
              'gamepad',
              'gyroscope',
              'accelerometer',
              ...(game.iframe_permissions ?? []),
            ].join('; ')}
            sandbox={[
              'allow-scripts',
              'allow-same-origin',
              'allow-forms',
              'allow-popups',
              'allow-modals',
              'allow-orientation-lock',
              'allow-pointer-lock',
              'allow-presentation',
            ].join(' ')}
            onError={handleIframeError}
            loading="lazy"
          />
        )}
      </div>

      {/* ─── Ad Overlay (interstitial / rewarded) ─── */}
      {activeAd && (
        <AdOverlay
          campaign={activeAd.campaign}
          placement={activeAd.placement}
          gameId={slug}
          userId={userId}
          viewId={activeAd.viewId}
          onComplete={handleAdComplete}
        />
      )}

      {/* ─── Exit confirmation dialog ─── */}
      {showExitConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-zinc-900 p-6 text-center shadow-2xl">
            <div className="mb-3 text-3xl">🚪</div>
            <h3 className="font-archivo text-lg tracking-wide text-white">
              ¿SALIR DEL JUEGO?
            </h3>
            <p className="mt-2 text-xs uppercase tracking-wider text-zinc-500">
              Tu progreso se guarda automáticamente.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={cancelExit}
                className="flex-1 rounded-xl border border-white/[0.08] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.06]"
              >
                SEGUIR JUGANDO
              </button>
              <button
                onClick={confirmExit}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-black transition-colors"
                style={{ backgroundColor: accentColor }}
              >
                SALIR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Loading Screen ───

function LoadingScreen({
  game,
  accentColor,
  isHandshake,
}: {
  game: GameCatalogEntry
  accentColor: string
  isHandshake: boolean
}) {
  return (
    <div className="relative z-10 flex flex-col items-center px-4 text-center">
      <div
        className="mb-6 h-12 w-12 animate-spin rounded-full border-2 border-t-transparent"
        style={{
          borderColor: `${accentColor}44`,
          borderTopColor: accentColor,
        }}
      />
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
        style={{ backgroundColor: `${accentColor}18` }}
      >
        {game.emoji}
      </div>
      <h2 className="font-archivo text-xl tracking-wide text-white">
        {isHandshake
          ? `PREPARANDO ${game.name.toUpperCase()}`
          : `CARGANDO ${game.name.toUpperCase()}`
        }
      </h2>
      <p className="mt-2 text-xs uppercase tracking-wider text-zinc-500">
        {isHandshake ? 'Configurando tu sesión' : 'Preparando tu experiencia'}
      </p>
    </div>
  )
}

// ─── Error Screen ───

function ErrorScreen({
  message,
  onRetry,
  onBack,
  accentColor,
}: {
  message: string
  onRetry: () => void
  onBack: () => void
  accentColor: string
}) {
  return (
    <div className="relative z-10 flex flex-col items-center px-4 text-center">
      <div className="mb-4 text-5xl">⚠️</div>
      <h2 className="font-archivo text-xl tracking-wide text-white">
        ERROR AL CARGAR
      </h2>
      <p className="mt-2 max-w-sm text-xs uppercase tracking-wider text-zinc-500">
        {message}
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={onBack}
          className="rounded-xl border border-white/[0.08] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.06]"
        >
          VOLVER AL LOBBY
        </button>
        <button
          onClick={onRetry}
          className="rounded-xl px-6 py-2.5 text-sm font-bold text-black transition-colors"
          style={{ backgroundColor: accentColor }}
        >
          REINTENTAR
        </button>
      </div>
    </div>
  )
}
