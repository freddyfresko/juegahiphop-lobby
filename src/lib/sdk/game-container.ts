/**
 * @juegahiphop/sdk — GameContainer
 *
 * Copia local sincronizada con packages/juegahiphop-sdk/
 * Mantener actualizado cuando se modifique el paquete.
 *
 * Cliente que se usa en el LOBBY para comunicarse con un juego
 * ejecutándose dentro de un iframe.
 *
 * El lobby es el CEREBRO: recibe solicitudes del juego (save, load,
 * unlock achievement, campaign) y responde con confirmaciones.
 */

import type { GameClientOptions } from './types'
import { MessageType, PROTOCOL_VERSION } from './types'
import { isProtocolCompatible } from './types'
import type {
  GameReadyPayload,
  GameStartedPayload,
  GameCompletedPayload,
  ScoreUpdatedPayload,
  ExitGamePayload,
  ErrorPayload,
  SaveProgressPayload,
  LoadProgressPayload,
  UnlockAchievementPayload,
  CampaignRequestPayload,
  SessionContextPayload,
  SaveResultPayload,
  ProgressDataPayload,
  AchievementResultPayload,
  CampaignResponsePayload,
  EndSessionPayload,
  MessageCallback,
} from './types'

export interface GameClientInstance {
  // ═══ Listeners: Game → Lobby ═══
  /** El juego está listo */
  onGameReady: (cb: MessageCallback<GameReadyPayload>) => void
  /** El juego empezó una partida */
  onGameStarted: (cb: MessageCallback<GameStartedPayload>) => void
  /** La partida terminó */
  onGameCompleted: (cb: MessageCallback<GameCompletedPayload>) => void
  /** Puntaje actualizado en vivo */
  onScoreUpdated: (cb: MessageCallback<ScoreUpdatedPayload>) => void
  /** El juego pide pantalla completa */
  onRequestFullscreen: (cb: MessageCallback) => void
  /** El juego pide volver al lobby */
  onExitGame: (cb: MessageCallback<ExitGamePayload>) => void
  /** Error desde el juego */
  onError: (cb: MessageCallback<ErrorPayload>) => void

  // ═══ Solicitudes de persistencia: Game → Lobby ═══
  /** El juego solicita guardar progreso */
  onSaveProgress: (cb: MessageCallback<SaveProgressPayload>) => void
  /** El juego solicita cargar progreso */
  onLoadProgress: (cb: MessageCallback<LoadProgressPayload>) => void
  /** El juego solicita registrar un logro */
  onUnlockAchievement: (cb: MessageCallback<UnlockAchievementPayload>) => void
  /** El juego solicita campaña recompensada */
  onCampaignRequest: (cb: MessageCallback<CampaignRequestPayload>) => void

  // ═══ Respuestas: Lobby → Game ═══
  /** Responder a save_progress */
  sendSaveResult: (payload: SaveResultPayload) => void
  /** Responder a load_progress */
  sendProgressData: (payload: ProgressDataPayload) => void
  /** Responder a unlock_achievement */
  sendAchievementResult: (payload: AchievementResultPayload) => void
  /** Responder a campaign_request */
  sendCampaignResponse: (payload: CampaignResponsePayload) => void

  // ═══ Contexto: Lobby → Game ═══
  /** Enviar contexto de sesión al juego (después de game_ready) */
  sendSessionContext: (payload: SessionContextPayload) => void
  /** Cerrar sesión de juego */
  sendEndSession: (payload?: EndSessionPayload) => void
  /** Pausar el juego */
  sendPause: () => void
  /** Reanudar el juego */
  sendResume: () => void

  /** Destruir la instancia */
  destroy: () => void

  /** Promesa que se resuelve cuando el juego envía game_ready, o rechaza en timeout */
  ready: Promise<GameReadyPayload>

  /** Versión del protocolo que el juego declaró (disponible después de ready) */
  gameProtocolVersion?: string
}

export function createGameClient(
  iframe: HTMLIFrameElement | null,
  options: GameClientOptions,
): GameClientInstance {
  const { allowedOrigins, readyTimeout = 15000, gameId } = options
  let destroyed = false
  let _gameProtocolVersion: string | undefined

  // Resolver/rechazar la promesa ready
  let resolveReady: (payload: GameReadyPayload) => void = () => {}
  let rejectReady: (reason: Error) => void = () => {}

  const readyPromise = new Promise<GameReadyPayload>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })

  // Timeout de ready
  const readyTimer = setTimeout(() => {
    if (!destroyed) {
      rejectReady(new Error(`Timeout: el juego no envió game_ready en ${readyTimeout}ms`))
    }
  }, readyTimeout)

  // Escuchar mensajes del iframe
  const onMessage = (event: MessageEvent) => {
    if (destroyed) return

    // Validar origen
    if (!allowedOrigins.includes(event.origin)) return

    // Validar formato
    const data = event.data
    if (!data || typeof data.type !== 'string' || !data.type.startsWith('jh:')) return
    if (data.source !== 'game') return

    const requestId: string | undefined = data.requestId

    switch (data.type) {
      case MessageType.GAME_READY: {
        clearTimeout(readyTimer)
        const payload = data.payload as GameReadyPayload
        // Validar compatibilidad de protocolo
        if (payload.protocolVersion && !isProtocolCompatible(payload.protocolVersion)) {
          rejectReady(
            new Error(
              `Protocolo incompatible: juego v${payload.protocolVersion}, lobby v${PROTOCOL_VERSION}`,
            ),
          )
          return
        }
        _gameProtocolVersion = payload.protocolVersion
        resolveReady(payload)
        gameReadyCb.forEach((cb) => cb(payload))
        break
      }
      case MessageType.GAME_STARTED:
        gameStartedCb.forEach((cb) => cb(data.payload as GameStartedPayload))
        break
      case MessageType.GAME_COMPLETED:
        gameCompletedCb.forEach((cb) => cb(data.payload as GameCompletedPayload))
        break
      case MessageType.SCORE_UPDATED:
        scoreUpdatedCb.forEach((cb) => cb(data.payload as ScoreUpdatedPayload))
        break
      case MessageType.REQUEST_FULLSCREEN:
        requestFullscreenCb.forEach((cb) => cb(data.payload))
        break
      case MessageType.EXIT_GAME:
        exitGameCb.forEach((cb) => cb(data.payload as ExitGamePayload))
        break
      case MessageType.ERROR:
        errorCb.forEach((cb) => cb(data.payload as ErrorPayload))
        break
      case MessageType.SAVE_PROGRESS:
        saveProgressCb.forEach((cb) => cb({ ...(data.payload as SaveProgressPayload), _requestId: requestId } as SaveProgressPayload & { _requestId?: string }))
        break
      case MessageType.LOAD_PROGRESS:
        loadProgressCb.forEach((cb) => cb({ ...(data.payload as LoadProgressPayload), _requestId: requestId } as LoadProgressPayload & { _requestId?: string }))
        break
      case MessageType.UNLOCK_ACHIEVEMENT:
        unlockAchievementCb.forEach((cb) => cb({ ...(data.payload as UnlockAchievementPayload), _requestId: requestId } as UnlockAchievementPayload & { _requestId?: string }))
        break
      case MessageType.CAMPAIGN_REQUEST:
        campaignRequestCb.forEach((cb) => cb({ ...(data.payload as CampaignRequestPayload), _requestId: requestId } as CampaignRequestPayload & { _requestId?: string }))
        break
    }
  }

  window.addEventListener('message', onMessage)

  // Helpers para enviar al iframe
  const sendToGame = (type: string, payload: unknown, requestId?: string) => {
    if (destroyed) return
    if (!iframe || !iframe.contentWindow) return

    // targetOrigin exacto
    const origin = allowedOrigins[0]
    if (!origin) return

    iframe.contentWindow.postMessage(
      {
        type,
        payload,
        timestamp: Date.now(),
        protocolVersion: PROTOCOL_VERSION,
        source: 'lobby',
        ...(gameId ? { gameId } : {}),
        ...(requestId ? { requestId } : {}),
      },
      origin,
    )
  }

  // Callback arrays
  let gameReadyCb: MessageCallback<GameReadyPayload>[] = []
  let gameStartedCb: MessageCallback<GameStartedPayload>[] = []
  let gameCompletedCb: MessageCallback<GameCompletedPayload>[] = []
  let scoreUpdatedCb: MessageCallback<ScoreUpdatedPayload>[] = []
  let requestFullscreenCb: MessageCallback[] = []
  let exitGameCb: MessageCallback<ExitGamePayload>[] = []
  let errorCb: MessageCallback<ErrorPayload>[] = []
  let saveProgressCb: MessageCallback<SaveProgressPayload>[] = []
  let loadProgressCb: MessageCallback<LoadProgressPayload>[] = []
  let unlockAchievementCb: MessageCallback<UnlockAchievementPayload>[] = []
  let campaignRequestCb: MessageCallback<CampaignRequestPayload>[] = []

  const instance: GameClientInstance = {
    // ═══ Listeners ═══
    onGameReady: (cb) => { gameReadyCb.push(cb) },
    onGameStarted: (cb) => { gameStartedCb.push(cb) },
    onGameCompleted: (cb) => { gameCompletedCb.push(cb) },
    onScoreUpdated: (cb) => { scoreUpdatedCb.push(cb) },
    onRequestFullscreen: (cb) => { requestFullscreenCb.push(cb) },
    onExitGame: (cb) => { exitGameCb.push(cb) },
    onError: (cb) => { errorCb.push(cb) },
    onSaveProgress: (cb) => { saveProgressCb.push(cb) },
    onLoadProgress: (cb) => { loadProgressCb.push(cb) },
    onUnlockAchievement: (cb) => { unlockAchievementCb.push(cb) },
    onCampaignRequest: (cb) => { campaignRequestCb.push(cb) },

    // ═══ Respuestas ═══
    sendSaveResult: (payload) => sendToGame(MessageType.SAVE_RESULT, payload, payload.requestId),
    sendProgressData: (payload) => sendToGame(MessageType.PROGRESS_DATA, payload, payload.requestId),
    sendAchievementResult: (payload) => sendToGame(MessageType.ACHIEVEMENT_RESULT, payload, payload.requestId),
    sendCampaignResponse: (payload) => sendToGame(MessageType.CAMPAIGN_RESPONSE, payload, payload.requestId),

    // ═══ Contexto ═══
    sendSessionContext: (payload) => sendToGame(MessageType.SESSION_CONTEXT, payload),
    sendEndSession: (payload) => sendToGame(MessageType.END_SESSION, payload ?? { reason: 'navigate_away' }),
    sendPause: () => sendToGame(MessageType.PAUSE, undefined),
    sendResume: () => sendToGame(MessageType.RESUME, undefined),

    get gameProtocolVersion() { return _gameProtocolVersion },

    ready: readyPromise,

    destroy: () => {
      destroyed = true
      clearTimeout(readyTimer)
      window.removeEventListener('message', onMessage)
      gameReadyCb = []
      gameStartedCb = []
      gameCompletedCb = []
      scoreUpdatedCb = []
      requestFullscreenCb = []
      exitGameCb = []
      errorCb = []
      saveProgressCb = []
      loadProgressCb = []
      unlockAchievementCb = []
      campaignRequestCb = []
    },
  }

  return instance
}
