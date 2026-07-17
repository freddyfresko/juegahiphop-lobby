'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createGameClient } from '@/lib/sdk/game-container'
import type { GameCatalogEntry } from '@/lib/types'
import type {
  SessionContextPayload,
  LoadProgressPayload,
  RequestSavePayload,
  CampaignRequestPayload,
  AchievementUnlockedPayload,
  EndSessionPayload,
} from '@/lib/sdk/types'
import { createClient } from '@/lib/supabase/client'

// ─── Estados del contenedor ───

type ContainerState =
  | 'loading'       // Mostrando pantalla de carga, esperando game_ready
  | 'handshake'     // Game listo, enviando contexto + progreso
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

  const [state, setState] = useState<ContainerState>('loading')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const supabase = createClient()
  const accentColor = game.accent_color ?? game.color

  // ─── Helpers ───

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
      return data.id
    } catch {
      return null
    }
  }, [userId, slug, supabase, game.version, game.protocol_version])

  /** Cerrar sesión de juego */
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

    await supabase
      .from('game_sessions')
      .update({
        ended_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        session_result: result,
      })
      .eq('id', sessionId)
  }, [supabase])

  /** Guardar progreso del juego en Supabase (solo si hay userId) */
  const saveProgress = useCallback(async (payload: RequestSavePayload) => {
    if (!userId) {
      // Modo invitado: confirmar al juego pero no persistir
      gameClientRef.current?.sendSaveConfirmed()
      return
    }
    try {
      await supabase.from('game_state').upsert(
        {
          user_id: userId,
          game_id: slug,
          state: payload.gameState,
          best_score: payload.score ?? 0,
          last_played_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id, game_id' },
      )

      // Incrementar contador de partidas
      await supabase.rpc('increment_game_plays', {
        p_user_id: userId,
        p_game_id: slug,
      })

      gameClientRef.current?.sendSaveConfirmed()
    } catch (err) {
      console.warn('[GameContainer] Error guardando progreso:', err)
    }
  }, [userId, slug, supabase])

  /** Cargar progreso del juego desde Supabase (solo si hay userId) */
  const loadProgress = useCallback(async (): Promise<LoadProgressPayload | null> => {
    if (!userId) return null
    try {
      const { data } = await supabase
        .from('game_state')
        .select('state, best_score')
        .eq('user_id', userId)
        .eq('game_id', slug)
        .single()

      if (!data) {
        return {
          schemaVersion: game.progress_schema_version ?? '1.0.0',
          gameState: null,
        }
      }

      return {
        schemaVersion: game.progress_schema_version ?? '1.0.0',
        gameState: (data.state as Record<string, unknown>) ?? null,
      }
    } catch {
      return {
        schemaVersion: game.progress_schema_version ?? '1.0.0',
        gameState: null,
      }
    }
  }, [userId, slug, supabase, game.progress_schema_version])

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
        const readyPayload = await gameClient.ready
        if (destroyed) return

        setState('handshake')

        // 2c. Cargar progreso guardado
        const progressPayload = await loadProgress()

        // 2d. Preparar contexto de sesión
        let displayName = 'Invitado'
        let avatarUrl: string | undefined
        let level = 1

        if (userId) {
          const { data: { user } } = await supabase.auth.getUser()
          const { data: profile } = await supabase
            .from('player_profiles')
            .select('display_name, avatar_url, level')
            .eq('user_id', userId)
            .single()
          displayName = (profile as { display_name?: string })?.display_name ?? user?.email?.split('@')[0] ?? 'Invitado'
          avatarUrl = (profile as { avatar_url?: string })?.avatar_url
          level = (profile as { level?: number })?.level ?? 1
        }

        const sessionContext: SessionContextPayload = {
          userId: userId ?? 'guest',
          displayName,
          avatarUrl,
          level,
          locale: 'es-CL',
          isGuest: !userId,
          sessionId: sessionId ?? '',
          capabilities: game.capabilities,
        }

        // 2e. Enviar contexto + progreso al juego
        gameClient.sendSessionContext(sessionContext)
        if (progressPayload) {
          gameClient.sendLoadProgress(progressPayload)
        }

        // 2f. ¡Juego activo!
        setState('playing')
      } catch (err) {
        if (destroyed) return
        setErrorMsg((err as Error).message)
        setState('timeout')
      }
    }

    init()

    // 3. Eventos del juego

    gameClient.onGameCompleted(async (payload) => {
      if (!userId) return // Invitado: no registrar progreso
      try {
        await supabase.from('game_completions').insert({
          user_id: userId,
          game_id: slug,
          item_id: payload.itemId ?? 'unknown',
          difficulty: payload.difficulty ?? 'normal',
          score: payload.score,
          metadata: payload.metadata ?? {},
          completed_at: new Date().toISOString(),
        })

        await supabase.rpc('increment_game_completions', { p_user_id: userId })
      } catch (err) {
        console.warn('[GameContainer] Error registrando completado:', err)
      }
    })

    gameClient.onScoreUpdated(() => {
      // Future: overlay de puntaje en vivo
    })

    gameClient.onRequestSave(async (payload) => {
      setState('saving')
      await saveProgress(payload)
      setState('playing')
    })

    gameClient.onCampaignRequest((payload: CampaignRequestPayload) => {
      console.log('[GameContainer] Campaign request:', payload.placement)
      gameClient.sendCampaignResponse({
        requestId: (payload as unknown as { requestId: string }).requestId ?? 'unknown',
        status: 'unavailable',
        message: 'Campaign Manager no implementado aún',
      })
    })

    gameClient.onAchievementUnlocked(async (payload: AchievementUnlockedPayload) => {
      if (!userId) return // Invitado: no registrar logros
      try {
        await supabase.from('achievement_unlocks').insert({
          user_id: userId,
          achievement_id: payload.achievementId,
          unlocked_at: new Date().toISOString(),
        })
      } catch (err) {
        console.warn('[GameContainer] Error registrando logro:', err)
      }
    })

    gameClient.onExitGame(async (payload) => {
      if (payload?.saveBeforeExit) {
        // El juego debería enviar request_save antes
      }
      await endSession(payload?.reason === 'completed' ? 'completed' : 'abandoned')
      handleBackToLobby()
    })

    gameClient.onError((payload) => {
      setErrorMsg(payload.message)
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

  // ─── Render ───

  const showIframe = state === 'playing' || state === 'handshake' || state === 'saving'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* ─── Top bar ─── */}
      <div
        className="flex h-12 shrink-0 items-center justify-between px-3 sm:px-4 safe-area-top"
        style={{ backgroundColor: `${game.color}22`, borderBottom: `1px solid ${game.color}33` }}
      >
        <button
          onClick={handleExitClick}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          <span className="hidden sm:inline">VOLVER</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-base">{game.emoji}</span>
          <span className="font-archivo text-sm tracking-wide text-white">
            {game.name}
          </span>
          {state === 'saving' && (
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
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-white"
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
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

      {/* ─── Exit confirmation dialog ─── */}
      {showExitConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-white/[0.08] bg-zinc-900 p-6 text-center shadow-2xl">
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
