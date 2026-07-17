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
 *   lobby.onReady({ version: '1.0.0' })
 *
 *   // Escuchar eventos del lobby
 *   lobby.onPause(() => { /* pausar juego *​/ })
 *   lobby.onResume(() => { /* reanudar *​/ })
 *
 *   // Enviar eventos
 *   lobby.sendGameCompleted({ score: 1000, itemId: 'nivel-3' })
 *   lobby.sendExitGame({ reason: 'user_quit' })
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
  MessageCallback,
} from './types'

export interface LobbyClientInstance {
  /** Anunciar que el juego terminó de cargar */
  onReady: (payload: GameReadyPayload) => void

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

  /** Escuchar cuando el lobby pausa el juego */
  onPause: (cb: MessageCallback) => void

  /** Escuchar cuando el lobby reanuda el juego */
  onResume: (cb: MessageCallback) => void

  /** Destruir la instancia y limpiar listeners */
  destroy: () => void
}

export function createLobbyClient(options: LobbyClientOptions): LobbyClientInstance {
  const { lobbyOrigin } = options

  let destroyed = false
  let readyTimer: ReturnType<typeof setTimeout> | null = null

  // El origen del lobby es el que nos contiene (window.parent)
  const parentWindow = window.parent !== window ? window.parent : null

  // Helper para enviar mensajes al lobby
  const send = (type: string, payload: unknown) => {
    if (destroyed || !parentWindow) return
    parentWindow.postMessage(
      {
        type,
        payload,
        timestamp: Date.now(),
        source: 'game',
      },
      lobbyOrigin,
    )
  }

  // Escuchar mensajes del lobby (pause, resume)
  const listener = listenMessages((msg) => {
    // Solo aceptar mensajes del lobby
    if (msg.source !== 'lobby') return
  }, [lobbyOrigin])

  // Timeout de ready: si el juego no envía onReady a tiempo, error
  const clearReadyTimer = () => {
    if (readyTimer) {
      clearTimeout(readyTimer)
      readyTimer = null
    }
  }

  const instance: LobbyClientInstance = {
    onReady: (payload: GameReadyPayload) => {
      if (destroyed) return
      clearReadyTimer()
      send(MessageType.GAME_READY, payload)
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

    onPause: (cb: MessageCallback) => {
      const l = listenMessages((msg) => {
        if (msg.type === MessageType.PAUSE) cb(msg.payload)
      }, [lobbyOrigin])
      // Store for cleanup — simplistic: just keep reference
      return l
    },

    onResume: (cb: MessageCallback) => {
      const l = listenMessages((msg) => {
        if (msg.type === MessageType.RESUME) cb(msg.payload)
      }, [lobbyOrigin])
      return l
    },

    destroy: () => {
      destroyed = true
      clearReadyTimer()
      listener.unsubscribe()
    },
  }

  return instance
}
