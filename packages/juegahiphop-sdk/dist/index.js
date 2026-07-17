/**
 * @juegahiphop/sdk — Comunicación Lobby ↔ Juegos
 *
 * SDK exclusivo para el protocolo de comunicación postMessage
 * entre el Lobby JuegaHipHop y los juegos embedidos.
 *
 * NO contiene helpers de Supabase ni lógica de negocio.
 * Cada juego mantiene sus propias utilidades.
 */
export { createLobbyClient } from './lobby-client';
export { createGameClient } from './game-container';
export { MessageType, PROTOCOL_VERSION, isProtocolCompatible, createRequestId } from './types';
export { isValidMessage, createMessage, sendMessage, listenMessages, connectGameCallbacks, connectLobbyCallbacks, } from './messages';
//# sourceMappingURL=index.js.map