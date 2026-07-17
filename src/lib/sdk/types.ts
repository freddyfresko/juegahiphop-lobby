/**
 * @juegahiphop/sdk — Tipos del protocolo de comunicación
 *
 * Copia local sincronizada con packages/juegahiphop-sdk/
 * Mantener actualizado cuando se modifique el paquete.
 *
 * Define el formato estándar de todos los mensajes intercambiados
 * entre el Lobby y los juegos mediante postMessage.
 *
 * Convención:
 * - Todos los tipos de mensaje usan prefijo "jh:" (JuegaHipHop)
 * - source identifica al emisor ('lobby' | 'game')
 * - timestamp en milisegundos (Date.now())
 * - requestId para operaciones que requieren respuesta (idempotencia)
 * - protocolVersion para compatibilidad entre versiones
 */

// ─── Versión del protocolo ───

export const PROTOCOL_VERSION = '1.0.0'

// ─── Formato base de cualquier mensaje ───

export interface JuegaHipHopMessage<T = unknown> {
  type: string
  payload?: T
  timestamp: number
  source: 'lobby' | 'game'
  gameId?: string
  /** ID único de solicitud para operaciones request/response */
  requestId?: string
  /** Versión del protocolo (para validación de compatibilidad) */
  protocolVersion?: string
}

// ─── Tipos de mensaje ───

export const MessageType = {
  // ═══ Game → Lobby ═══
  /** El juego terminó de cargar y está listo */
  GAME_READY: 'jh:game_ready',
  /** El usuario empezó una partida */
  GAME_STARTED: 'jh:game_started',
  /** Una partida terminó (con resultado) */
  GAME_COMPLETED: 'jh:game_completed',
  /** Actualización de puntaje en vivo */
  SCORE_UPDATED: 'jh:score_updated',
  /** El juego solicita pantalla completa */
  REQUEST_FULLSCREEN: 'jh:request_fullscreen',
  /** El juego solicita volver al lobby */
  EXIT_GAME: 'jh:exit_game',
  /** Error desde el juego */
  ERROR: 'jh:error',
  /** El juego solicita que se guarde el progreso actual */
  REQUEST_SAVE: 'jh:request_save',
  /** El juego solicita visualizar una campaña recompensada */
  CAMPAIGN_REQUEST: 'jh:campaign_request',
  /** El juego notifica un logro desbloqueado */
  ACHIEVEMENT_UNLOCKED: 'jh:achievement_unlocked',

  // ═══ Lobby → Game ═══
  /** Pausar el juego */
  PAUSE: 'jh:pause',
  /** Reanudar el juego */
  RESUME: 'jh:resume',
  /** Contexto de sesión: perfil, progreso, configuración */
  SESSION_CONTEXT: 'jh:session_context',
  /** Cargar progreso guardado en el juego */
  LOAD_PROGRESS: 'jh:load_progress',
  /** Confirmación de guardado exitoso */
  SAVE_CONFIRMED: 'jh:save_confirmed',
  /** Respuesta a una solicitud de campaña recompensada */
  CAMPAIGN_RESPONSE: 'jh:campaign_response',
  /** El lobby cierra la sesión de juego */
  END_SESSION: 'jh:end_session',
} as const

export type MessageType = (typeof MessageType)[keyof typeof MessageType]

// ─── Payloads específicos ───

/** El juego anuncia que está listo */
export interface GameReadyPayload {
  version: string
  protocolVersion?: string
  /** Capacidades declaradas por el juego (para validación lobby-side) */
  capabilities?: string[]
}

/** El juego notifica inicio de partida */
export interface GameStartedPayload {
  sessionId?: string
  /** Identificador del nivel / categoría / modo */
  levelId?: string
  /** Dificultad seleccionada */
  difficulty?: string
}

/** El juego notifica finalización de partida */
export interface GameCompletedPayload {
  score: number
  itemId?: string
  difficulty?: string
  /** Tiempo en segundos que duró la partida */
  timeSpent?: number
  /** Si la partida fue completada exitosamente */
  completed?: boolean
  metadata?: Record<string, unknown>
}

/** Actualización de puntaje en vivo */
export interface ScoreUpdatedPayload {
  score: number
  progress?: number
}

/** Solicitud para volver al lobby */
export interface ExitGamePayload {
  reason?: 'user_quit' | 'game_over' | 'completed' | 'error'
  /** Si debe guardar antes de salir */
  saveBeforeExit?: boolean
}

/** Error desde el juego */
export interface ErrorPayload {
  code: string
  message: string
  fatal: boolean
}

/** El juego solicita guardar progreso */
export interface RequestSavePayload {
  /** Estado completo del juego (opaco para el lobby) */
  gameState: Record<string, unknown>
  /** Puntaje a registrar */
  score?: number
  /** Metadatos adicionales */
  metadata?: Record<string, unknown>
}

/** Solicitud de campaña recompensada */
export interface CampaignRequestPayload {
  /** Placement donde se solicita la campaña */
  placement: string
  /** IDs de recompensas solicitadas (el juego las conoce) */
  rewardIds: string[]
  /** Metadatos adicionales del juego */
  metadata?: Record<string, unknown>
}

/** Notificación de logro desbloqueado */
export interface AchievementUnlockedPayload {
  achievementId: string
  /** Metadatos adicionales (puntaje, nivel, etc.) */
  metadata?: Record<string, unknown>
}

// ═══ Lobby → Game ───────────────────────

/** Contexto de sesión enviado al juego después del handshake */
export interface SessionContextPayload {
  /** ID público del usuario (no el auth UUID completo) */
  userId: string
  /** Nombre visible del jugador */
  displayName?: string
  /** URL del avatar */
  avatarUrl?: string
  /** Nivel global del jugador */
  level?: number
  /** Idioma preferido */
  locale?: string
  /** Indica si el usuario es invitado */
  isGuest: boolean
  /** Sesión activa del juego (UUID) */
  sessionId: string
  /** Capacidades disponibles (suscripción, etc.) */
  capabilities?: string[]
}

/** Datos de progreso enviados al juego al cargar */
export interface LoadProgressPayload {
  /** Versión del esquema de progreso */
  schemaVersion: string
  /** Datos opacos del progreso (game_state) */
  gameState: Record<string, unknown> | null
  /** Configuración guardada del juego */
  settings?: Record<string, unknown>
}

/** Respuesta del lobby a una solicitud de campaña */
export interface CampaignResponsePayload {
  /** Mismo requestId de la solicitud */
  requestId: string
  /** Estado de la respuesta */
  status: CampaignRewardStatus
  /** ID de la campaña mostrada (si aplica) */
  campaignId?: string
  /** IDs de recompensas concedidas */
  rewardedIds?: string[]
  /** Mensaje para el usuario */
  message?: string
}

export type CampaignRewardStatus =
  | 'approved'
  | 'rejected'
  | 'unavailable'
  | 'cancelled'
  | 'expired'
  | 'error'

/** El lobby cierra la sesión */
export interface EndSessionPayload {
  reason?: 'navigate_away' | 'timeout' | 'error' | 'user_logout'
}

// ─── Mapa de tipo → payload ───

export interface MessagePayloadMap {
  [MessageType.GAME_READY]: GameReadyPayload
  [MessageType.GAME_STARTED]: GameStartedPayload
  [MessageType.GAME_COMPLETED]: GameCompletedPayload
  [MessageType.SCORE_UPDATED]: ScoreUpdatedPayload
  [MessageType.REQUEST_FULLSCREEN]: undefined
  [MessageType.EXIT_GAME]: ExitGamePayload
  [MessageType.ERROR]: ErrorPayload
  [MessageType.REQUEST_SAVE]: RequestSavePayload
  [MessageType.CAMPAIGN_REQUEST]: CampaignRequestPayload
  [MessageType.ACHIEVEMENT_UNLOCKED]: AchievementUnlockedPayload
  [MessageType.PAUSE]: undefined
  [MessageType.RESUME]: undefined
  [MessageType.SESSION_CONTEXT]: SessionContextPayload
  [MessageType.LOAD_PROGRESS]: LoadProgressPayload
  [MessageType.SAVE_CONFIRMED]: undefined
  [MessageType.CAMPAIGN_RESPONSE]: CampaignResponsePayload
  [MessageType.END_SESSION]: EndSessionPayload
}

// ─── Callbacks para eventos ───

export type MessageCallback<T = unknown> = (payload: T) => void

/** Handlers que el juego (iframe) puede registrar */
export interface GameEventHandlers {
  onPause?: MessageCallback
  onResume?: MessageCallback
  onSessionContext?: MessageCallback<SessionContextPayload>
  onLoadProgress?: MessageCallback<LoadProgressPayload>
  onSaveConfirmed?: MessageCallback
  onCampaignResponse?: MessageCallback<CampaignResponsePayload>
  onEndSession?: MessageCallback<EndSessionPayload>
}

/** Handlers que el lobby puede registrar */
export interface LobbyEventHandlers {
  onGameReady?: MessageCallback<GameReadyPayload>
  onGameStarted?: MessageCallback<GameStartedPayload>
  onGameCompleted?: MessageCallback<GameCompletedPayload>
  onScoreUpdated?: MessageCallback<ScoreUpdatedPayload>
  onRequestFullscreen?: MessageCallback
  onExitGame?: MessageCallback<ExitGamePayload>
  onError?: MessageCallback<ErrorPayload>
  onRequestSave?: MessageCallback<RequestSavePayload>
  onCampaignRequest?: MessageCallback<CampaignRequestPayload>
  onAchievementUnlocked?: MessageCallback<AchievementUnlockedPayload>
}

// ─── Opciones de configuración ───

export interface LobbyClientOptions {
  /** Origen del lobby (para targetOrigin en postMessage) */
  lobbyOrigin: string
  /** Timeout en ms para game_ready (default: 15000) */
  readyTimeout?: number
  /** Capacidades del juego que se reportarán en game_ready */
  capabilities?: string[]
}

export interface GameClientOptions {
  /** Lista de orígenes permitidos para recibir mensajes */
  allowedOrigins: string[]
  /** Tiempo máximo de espera para game_ready en ms (default: 15000) */
  readyTimeout?: number
  /** ID del juego (slug) */
  gameId?: string
}

// ─── Versión del protocolo — funciones helpers ───

/** Verifica compatibilidad entre versiones del protocolo */
export function isProtocolCompatible(
  version: string | undefined,
  supportedVersion: string = PROTOCOL_VERSION,
): boolean {
  if (!version) return false
  const vParts = version.split('.').map(Number)
  const sParts = supportedVersion.split('.').map(Number)
  // Major version debe coincidir
  return vParts[0] === sParts[0]
}

/** Genera un requestId único */
export function createRequestId(): string {
  return `jh_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
}
