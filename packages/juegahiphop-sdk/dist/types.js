/**
 * @juegahiphop/sdk — Tipos del protocolo de comunicación
 *
 * Copia local sincronizada con packages/juegahiphop-sdk/
 * Mantener actualizado cuando se modifique el paquete.
 *
 * Define el formato estándar de todos los mensajes intercambiados
 * entre el Lobby y los juegos mediante postMessage.
 *
 * Modelo: el Lobby es el CEREBRO — el único que toca Supabase.
 * Los juegos son stateless desde el punto de vista del backend.
 * Toda lectura/escritura de datos va por postMessage al lobby.
 *
 * Convención:
 * - Todos los tipos de mensaje usan prefijo "jh:" (JuegaHipHop)
 * - source identifica al emisor ('lobby' | 'game')
 * - timestamp en milisegundos (Date.now())
 * - requestId para operaciones que requieren respuesta (idempotencia)
 * - protocolVersion para compatibilidad entre versiones
 */
// ─── Versión del protocolo ───
export const PROTOCOL_VERSION = '2.0.0';
// ─── Tipos de mensaje ───
export const MessageType = {
    // ═══ Game → Lobby: Ciclo de vida ═══
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
    // ═══ Game → Lobby: Persistencia (lobby = cerebro) ═══
    /** El juego solicita guardar su estado completo */
    SAVE_PROGRESS: 'jh:save_progress',
    /** El juego solicita cargar su estado guardado */
    LOAD_PROGRESS: 'jh:load_progress',
    /** El juego solicita registrar un logro desbloqueado */
    UNLOCK_ACHIEVEMENT: 'jh:unlock_achievement',
    /** El juego solicita visualizar una campaña recompensada */
    CAMPAIGN_REQUEST: 'jh:campaign_request',
    /** El juego solicita RESETEAR su progreso (empezar de 0) */
    RESET_PROGRESS: 'jh:reset_progress',
    // ═══ Lobby → Game: Respuestas a solicitudes ═══
    /** Respuesta a save_progress (éxito/error) */
    SAVE_RESULT: 'jh:save_result',
    /** Respuesta a load_progress (datos guardados) */
    PROGRESS_DATA: 'jh:progress_data',
    /** Respuesta a unlock_achievement (éxito/error) */
    ACHIEVEMENT_RESULT: 'jh:achievement_result',
    /** Respuesta a campaign_request */
    CAMPAIGN_RESPONSE: 'jh:campaign_response',
    /** Respuesta a reset_progress (éxito/error) */
    RESET_RESULT: 'jh:reset_result',
    // ═══ Lobby → Game: Contexto y control ═══
    /** Contexto de sesión: perfil, progreso, configuración */
    SESSION_CONTEXT: 'jh:session_context',
    /** Confirmación de guardado exitoso (legacy — usar SAVE_RESULT) */
    SAVE_CONFIRMED: 'jh:save_confirmed',
    /** Pausar el juego */
    PAUSE: 'jh:pause',
    /** Reanudar el juego */
    RESUME: 'jh:resume',
    /** El lobby cierra la sesión de juego */
    END_SESSION: 'jh:end_session',
    /** El lobby notifica el tamaño real del viewport del iframe (resize, fullscreen, orientación) */
    VIEWPORT_CHANGED: 'jh:viewport_changed',
};
// ─── Versión del protocolo — funciones helpers ───
/** Verifica compatibilidad entre versiones del protocolo */
export function isProtocolCompatible(version, supportedVersion = PROTOCOL_VERSION) {
    if (!version)
        return false;
    const vParts = version.split('.').map(Number);
    const sParts = supportedVersion.split('.').map(Number);
    // Major version debe coincidir
    return vParts[0] === sParts[0];
}
/** Genera un requestId único */
export function createRequestId() {
    return `jh_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}
//# sourceMappingURL=types.js.map