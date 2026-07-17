/**
 * @juegahiphop/sdk — LobbyClient
 *
 * Cliente que se usa DENTRO del juego (ejecutándose en un iframe)
 * para comunicarse con el Lobby que lo contiene.
 *
 * Uso:
 *   import { createLobbyClient } from '@juegahiphop/sdk'
 *
 *   const lobby = createLobbyClient({ lobbyOrigin: 'https://juegahiphop.cl' })
 *
 *   // Anunciar que el juego está listo
 *   lobby.sendReady({ version: '1.0.0' })
 *
 *   // Escuchar eventos del lobby
 *   lobby.onPause(() => { /* pausar juego *​/ })
 *   lobby.onResume(() => { /* reanudar *​/ })
 *   lobby.onSessionContext((ctx) => { /* recibir datos del usuario *​/ })
 *   lobby.onLoadProgress((data) => { /* cargar progreso guardado *​/ })
 *
 *   // Enviar eventos
 *   lobby.sendGameCompleted({ score: 1000, itemId: 'nivel-3' })
 *   lobby.sendExitGame({ reason: 'user_quit' })
 *   lobby.requestSave({ gameState: { ... } })
 */

import type { LobbyClientOptions } from './types'
import { listenMessages } from './messages'
import { MessageType } from './types'
import type {
  GameReadyPayload,
  GameStartedPayload,
  GameCompletedPayload,
  ScoreUpdatedPayload,
  ExitGamePayload,
  ErrorPayload,
  RequestSavePayload,
  CampaignRequestPayload,
  AchievementUnlockedPayload,
  SessionContextPayload,
  LoadProgressPayload,
  CampaignResponsePayload,
  EndSessionPayload,
  MessageCallback,
} from './types'
import { PROTOCOL_VERSION, createRequestId } from './types'

export interface LobbyClientInstance {
  /** Anunciar que el juego terminó de cargar */
  sendReady: (payload: GameReadyPayload) => void

  /** Anunciar que empezó una partida */
  sendGameStarted: (payload?: GameStartedPayload) => void

  /** Anunciar que una partida terminó */
  sendGameCompleted: (payload: GameCompletedPayload) => void

  /** Actualizar puntaje en vivo */
  sendScoreUpdated: (payload: ScoreUpdatedPayload) => void

  /** Solicitar pantalla completa al lobby */
  requestFullscreen: () => void

  /** Solicitar volver al lobby */
  sendExitGame: (payload?: ExitGamePayload) => void

  /** Reportar un error */
  sendError: (payload: ErrorPayload) => void

  /** Solicitar guardar progreso */
  requestSave: (payload: RequestSavePayload) => void

  /** Solicitar campaña recompensada — devuelve promesa con la respuesta */
  requestCampaign: (payload: CampaignRequestPayload) => Promise<CampaignResponsePayload>

  /** Reportar logro desbloqueado */
  sendAchievementUnlocked: (payload: AchievementUnlockedPayload) => void

  /** Escuchar cuando el lobby pausa el juego */
  onPause: (cb: MessageCallback) => void

  /** Escuchar cuando el lobby reanuda el juego */
  onResume: (cb: MessageCallback) => void

  /** Escuchar contexto de sesión (perfil, userId, etc.) */
  onSessionContext: (cb: MessageCallback<SessionContextPayload>) => void

  /** Escuchar carga de progreso guardado */
  onLoadProgress: (cb: MessageCallback<LoadProgressPayload>) => void

  /** Escuchar confirmación de guardado */
  onSaveConfirmed: (cb: MessageCallback) => void

  /** Escuchar cierre de sesión */
  onEndSession: (cb: MessageCallback<EndSessionPayload>) => void

  /** Destruir la instancia y limpiar listeners */
  destroy: () => void
}

export function createLobbyClient(options: LobbyClientOptions): LobbyClientInstance {
  const { lobbyOrigin, capabilities } = options

  let destroyed = false

  // El origen del lobby es el que nos contiene (window.parent)
  const parentWindow = window.parent !== window ? window.parent : null

  // Helper para enviar mensajes al lobby
  const send = (type: string, payload: unknown, requestId?: string) => {
    if (destroyed || !parentWindow) return
    parentWindow.postMessage(
      {
        type,
        payload,
        timestamp: Date.now(),
        protocolVersion: PROTOCOL_VERSION,
        source: 'game',
        ...(requestId ? { requestId } : {}),
      },
      lobbyOrigin,
    )
  }

  // Escuchar mensajes del lobby
  const listener = listenMessages((msg) => {
    if (msg.source !== 'lobby') return
  }, [lobbyOrigin])

  // Promesas pendientes de campaign_request
  const pendingCampaigns = new Map<string, {
    resolve: (value: CampaignResponsePayload) => void
    reject: (reason: Error) => void
    timer: ReturnType<typeof setTimeout>
  }>()

  // Escuchar respuestas del lobby
  const responseListener = listenMessages((msg) => {
    if (msg.source !== 'lobby') return

    switch (msg.type) {
      case MessageType.SESSION_CONTEXT:
        sessionContextCb.forEach((cb) => cb(msg.payload as SessionContextPayload))
        break
      case MessageType.LOAD_PROGRESS:
        loadProgressCb.forEach((cb) => cb(msg.payload as LoadProgressPayload))
        break
      case MessageType.SAVE_CONFIRMED:
        saveConfirmedCb.forEach((cb) => cb(msg.payload))
        break
      case MessageType.CAMPAIGN_RESPONSE: {
        const resp = msg.payload as CampaignResponsePayload
        const pending = pendingCampaigns.get(resp.requestId)
        if (pending) {
          clearTimeout(pending.timer)
          pendingCampaigns.delete(resp.requestId)
          pending.resolve(resp)
        }
        campaignResponseCb.forEach((cb) => cb(resp))
        break
      }
      case MessageType.END_SESSION:
        endSessionCb.forEach((cb) => cb(msg.payload as EndSessionPayload))
        break
      case MessageType.PAUSE:
        pauseCb.forEach((cb) => cb(msg.payload))
        break
      case MessageType.RESUME:
        resumeCb.forEach((cb) => cb(msg.payload))
        break
    }
  }, [lobbyOrigin])

  // Callback arrays
  let pauseCb: MessageCallback[] = []
  let resumeCb: MessageCallback[] = []
  let sessionContextCb: MessageCallback<SessionContextPayload>[] = []
  let loadProgressCb: MessageCallback<LoadProgressPayload>[] = []
  let saveConfirmedCb: MessageCallback[] = []
  let campaignResponseCb: MessageCallback<CampaignResponsePayload>[] = []
  let endSessionCb: MessageCallback<EndSessionPayload>[] = []

  const instance: LobbyClientInstance = {
    sendReady: (payload: GameReadyPayload) => {
      if (destroyed) return
      send(MessageType.GAME_READY, {
        ...payload,
        protocolVersion: PROTOCOL_VERSION,
        capabilities,
      })
    },

    sendGameStarted: (payload?: GameStartedPayload) => {
      if (destroyed) return
      send(MessageType.GAME_STARTED, payload ?? {})
    },

    sendGameCompleted: (payload: GameCompletedPayload) => {
      if (destroyed) return
      send(MessageType.GAME_COMPLETED, payload)
    },

    sendScoreUpdated: (payload: ScoreUpdatedPayload) => {
      if (destroyed) return
      send(MessageType.SCORE_UPDATED, payload)
    },

    requestFullscreen: () => {
      if (destroyed) return
      send(MessageType.REQUEST_FULLSCREEN, undefined)
    },

    sendExitGame: (payload?: ExitGamePayload) => {
      if (destroyed) return
      send(MessageType.EXIT_GAME, payload ?? {})
    },

    sendError: (payload: ErrorPayload) => {
      if (destroyed) return
      send(MessageType.ERROR, payload)
    },

    requestSave: (payload: RequestSavePayload) => {
      if (destroyed) return
      send(MessageType.REQUEST_SAVE, payload)
    },

    requestCampaign: (payload: CampaignRequestPayload): Promise<CampaignResponsePayload> => {
      return new Promise((resolve, reject) => {
        if (destroyed) {
          reject(new Error('Cliente destruido'))
          return
        }
        const requestId = createRequestId()
        // Timeout de 30s para respuesta de campaña
        const timer = setTimeout(() => {
          pendingCampaigns.delete(requestId)
          reject(new Error('Timeout: el lobby no respondió a la solicitud de campaña'))
        }, 30000)
        pendingCampaigns.set(requestId, { resolve, reject, timer })
        send(MessageType.CAMPAIGN_REQUEST, payload, requestId)
      })
    },

    sendAchievementUnlocked: (payload: AchievementUnlockedPayload) => {
      if (destroyed) return
      send(MessageType.ACHIEVEMENT_UNLOCKED, payload)
    },

    onPause: (cb: MessageCallback) => { pauseCb.push(cb) },
    onResume: (cb: MessageCallback) => { resumeCb.push(cb) },
    onSessionContext: (cb: MessageCallback<SessionContextPayload>) => { sessionContextCb.push(cb) },
    onLoadProgress: (cb: MessageCallback<LoadProgressPayload>) => { loadProgressCb.push(cb) },
    onSaveConfirmed: (cb: MessageCallback) => { saveConfirmedCb.push(cb) },
    onEndSession: (cb: MessageCallback<EndSessionPayload>) => { endSessionCb.push(cb) },

    destroy: () => {
      destroyed = true
      listener.unsubscribe()
      responseListener.unsubscribe()
      // Cancelar todas las promesas pendientes
      for (const [, pending] of pendingCampaigns) {
        clearTimeout(pending.timer)
        pending.reject(new Error('Cliente destruido'))
      }
      pendingCampaigns.clear()
      pauseCb = []
      resumeCb = []
      sessionContextCb = []
      loadProgressCb = []
      saveConfirmedCb = []
      campaignResponseCb = []
      endSessionCb = []
    },
  }

  return instance
}
