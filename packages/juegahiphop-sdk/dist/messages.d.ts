/**
 * @juegahiphop/sdk — Helpers de mensajes postMessage
 *
 * Funciones para crear, enviar, validar y recibir mensajes
 * del protocolo JuegaHipHop.
 */
import type { JuegaHipHopMessage, MessagePayloadMap, MessageType, GameEventHandlers, LobbyEventHandlers } from './types';
export declare function createMessage<T extends MessageType>(type: T, payload: MessagePayloadMap[T], source: 'lobby' | 'game', options?: {
    gameId?: string;
    requestId?: string;
}): JuegaHipHopMessage<MessagePayloadMap[T]>;
export declare function isValidMessage(data: unknown): data is JuegaHipHopMessage;
export declare function sendMessage<T extends MessageType>(target: Window | HTMLIFrameElement | null, type: T, payload: MessagePayloadMap[T], targetOrigin: string, source: 'lobby' | 'game', options?: {
    gameId?: string;
    requestId?: string;
}): void;
export interface MessageListener {
    unsubscribe: () => void;
}
export declare function listenMessages(handler: (message: JuegaHipHopMessage) => void, allowedOrigins?: string[]): MessageListener;
export declare function connectGameCallbacks(listener: MessageListener, handlers: GameEventHandlers, allowedOrigins?: string[]): MessageListener;
export declare function connectLobbyCallbacks(handlers: LobbyEventHandlers, allowedOrigins?: string[]): MessageListener;
//# sourceMappingURL=messages.d.ts.map