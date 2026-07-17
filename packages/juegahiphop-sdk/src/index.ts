/**
 * @juegahiphop/sdk — Comunicación Lobby ↔ Juegos
 *
 * SDK exclusivo para el protocolo de comunicación postMessage
 * entre el Lobby JuegaHipHop y los juegos embedidos.
 *
 * NO contiene helpers de Supabase ni lógica de negocio.
 * Cada juego mantiene sus propias utilidades.
 */

export { createLobbyClient } from './lobby-client'
export type { LobbyClientInstance } from './lobby-client'

export { createGameClient } from './game-container'
export type { GameClientInstance } from './game-container'

export { MessageType, PROTOCOL_VERSION, isProtocolCompatible, createRequestId } from './types'

export {
  isValidMessage,
  createMessage,
  sendMessage,
  listenMessages,
  connectGameCallbacks,
  connectLobbyCallbacks,
} from './messages'
export type { MessageListener } from './messages'

export type {
  JuegaHipHopMessage,
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
  CampaignRewardStatus,
  EndSessionPayload,
  MessageCallback,
  GameEventHandlers,
  LobbyEventHandlers,
  GameClientOptions,
  LobbyClientOptions,
} from './types'
