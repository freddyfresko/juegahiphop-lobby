/**
 * @juegahiphop/sdk — Helpers de mensajes postMessage
 *
 * Funciones para crear, enviar, validar y recibir mensajes
 * del protocolo JuegaHipHop.
 */
import { PROTOCOL_VERSION } from './types';
// ─── Crear mensaje ───
export function createMessage(type, payload, source, options) {
    return {
        type,
        payload,
        timestamp: Date.now(),
        protocolVersion: PROTOCOL_VERSION,
        source,
        ...(options?.gameId ? { gameId: options.gameId } : {}),
        ...(options?.requestId ? { requestId: options.requestId } : {}),
    };
}
// ─── Validar mensaje ───
export function isValidMessage(data) {
    if (!data || typeof data !== 'object')
        return false;
    const msg = data;
    return (typeof msg.type === 'string' &&
        msg.type.startsWith('jh:') &&
        typeof msg.timestamp === 'number' &&
        (msg.source === 'lobby' || msg.source === 'game'));
}
// ─── Enviar mensaje a un target específico ───
export function sendMessage(target, type, payload, targetOrigin, source, options) {
    if (!target)
        return;
    const win = target instanceof HTMLIFrameElement ? target.contentWindow : target;
    if (!win)
        return;
    const message = createMessage(type, payload, source, options);
    win.postMessage(message, targetOrigin);
}
export function listenMessages(handler, allowedOrigins) {
    const onMessage = (event) => {
        // Validar origen si hay lista blanca
        if (allowedOrigins && allowedOrigins.length > 0) {
            if (!allowedOrigins.includes(event.origin))
                return;
        }
        // Validar formato del mensaje
        if (!isValidMessage(event.data))
            return;
        handler(event.data);
    };
    window.addEventListener('message', onMessage);
    return {
        unsubscribe: () => window.removeEventListener('message', onMessage),
    };
}
// ─── Conectar callbacks del juego (iframe) ───
export function connectGameCallbacks(listener, handlers, allowedOrigins) {
    const { unsubscribe: unsubParent } = listenMessages((msg) => {
        switch (msg.type) {
            case 'jh:pause':
                handlers.onPause?.(msg.payload);
                break;
            case 'jh:resume':
                handlers.onResume?.(msg.payload);
                break;
            case 'jh:session_context':
                handlers.onSessionContext?.(msg.payload);
                break;
            case 'jh:load_progress':
                handlers.onLoadProgress?.(msg.payload);
                break;
            case 'jh:save_confirmed':
                handlers.onSaveConfirmed?.(msg.payload);
                break;
            case 'jh:campaign_response':
                handlers.onCampaignResponse?.(msg.payload);
                break;
            case 'jh:end_session':
                handlers.onEndSession?.(msg.payload);
                break;
        }
    }, allowedOrigins);
    return {
        unsubscribe: () => {
            unsubParent();
            listener.unsubscribe();
        },
    };
}
// ─── Conectar callbacks del lobby ───
export function connectLobbyCallbacks(handlers, allowedOrigins) {
    return listenMessages((msg) => {
        switch (msg.type) {
            case 'jh:game_ready':
                handlers.onGameReady?.(msg.payload);
                break;
            case 'jh:game_started':
                handlers.onGameStarted?.(msg.payload);
                break;
            case 'jh:game_completed':
                handlers.onGameCompleted?.(msg.payload);
                break;
            case 'jh:score_updated':
                handlers.onScoreUpdated?.(msg.payload);
                break;
            case 'jh:request_fullscreen':
                handlers.onRequestFullscreen?.(msg.payload);
                break;
            case 'jh:exit_game':
                handlers.onExitGame?.(msg.payload);
                break;
            case 'jh:error':
                handlers.onError?.(msg.payload);
                break;
            case 'jh:request_save':
                handlers.onRequestSave?.(msg.payload);
                break;
            case 'jh:campaign_request':
                handlers.onCampaignRequest?.(msg.payload);
                break;
            case 'jh:achievement_unlocked':
                handlers.onAchievementUnlocked?.(msg.payload);
                break;
        }
    }, allowedOrigins);
}
//# sourceMappingURL=messages.js.map