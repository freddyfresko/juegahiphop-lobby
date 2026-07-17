/**
 * @juegahiphop/sdk — Tipos del protocolo de comunicación
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
export const PROTOCOL_VERSION = '1.0.0';
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