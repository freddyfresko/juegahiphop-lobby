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
import { listenMessages } from './messages';
import { MessageType } from './types';
import { PROTOCOL_VERSION, createRequestId } from './types';
export function createLobbyClient(options) {
    const { lobbyOrigin, capabilities } = options;
    let destroyed = false;
    // El origen del lobby es el que nos contiene (window.parent)
    const parentWindow = window.parent !== window ? window.parent : null;
    // Helper para enviar mensajes al lobby
    const send = (type, payload, requestId) => {
        if (destroyed || !parentWindow)
            return;
        parentWindow.postMessage({
            type,
            payload,
            timestamp: Date.now(),
            protocolVersion: PROTOCOL_VERSION,
            source: 'game',
            ...(requestId ? { requestId } : {}),
        }, lobbyOrigin);
    };
    // Escuchar mensajes del lobby
    const listener = listenMessages((msg) => {
        if (msg.source !== 'lobby')
            return;
    }, [lobbyOrigin]);
    // Promesas pendientes de campaign_request
    const pendingCampaigns = new Map();
    // Escuchar respuestas del lobby
    const responseListener = listenMessages((msg) => {
        if (msg.source !== 'lobby')
            return;
        switch (msg.type) {
            case MessageType.SESSION_CONTEXT:
                sessionContextCb.forEach((cb) => cb(msg.payload));
                break;
            case MessageType.LOAD_PROGRESS:
                loadProgressCb.forEach((cb) => cb(msg.payload));
                break;
            case MessageType.SAVE_CONFIRMED:
                saveConfirmedCb.forEach((cb) => cb(msg.payload));
                break;
            case MessageType.CAMPAIGN_RESPONSE: {
                const resp = msg.payload;
                const pending = pendingCampaigns.get(resp.requestId);
                if (pending) {
                    clearTimeout(pending.timer);
                    pendingCampaigns.delete(resp.requestId);
                    pending.resolve(resp);
                }
                campaignResponseCb.forEach((cb) => cb(resp));
                break;
            }
            case MessageType.END_SESSION:
                endSessionCb.forEach((cb) => cb(msg.payload));
                break;
            case MessageType.PAUSE:
                pauseCb.forEach((cb) => cb(msg.payload));
                break;
            case MessageType.RESUME:
                resumeCb.forEach((cb) => cb(msg.payload));
                break;
        }
    }, [lobbyOrigin]);
    // Callback arrays
    let pauseCb = [];
    let resumeCb = [];
    let sessionContextCb = [];
    let loadProgressCb = [];
    let saveConfirmedCb = [];
    let campaignResponseCb = [];
    let endSessionCb = [];
    const instance = {
        sendReady: (payload) => {
            if (destroyed)
                return;
            send(MessageType.GAME_READY, {
                ...payload,
                protocolVersion: PROTOCOL_VERSION,
                capabilities,
            });
        },
        sendGameStarted: (payload) => {
            if (destroyed)
                return;
            send(MessageType.GAME_STARTED, payload ?? {});
        },
        sendGameCompleted: (payload) => {
            if (destroyed)
                return;
            send(MessageType.GAME_COMPLETED, payload);
        },
        sendScoreUpdated: (payload) => {
            if (destroyed)
                return;
            send(MessageType.SCORE_UPDATED, payload);
        },
        requestFullscreen: () => {
            if (destroyed)
                return;
            send(MessageType.REQUEST_FULLSCREEN, undefined);
        },
        sendExitGame: (payload) => {
            if (destroyed)
                return;
            send(MessageType.EXIT_GAME, payload ?? {});
        },
        sendError: (payload) => {
            if (destroyed)
                return;
            send(MessageType.ERROR, payload);
        },
        requestSave: (payload) => {
            if (destroyed)
                return;
            send(MessageType.REQUEST_SAVE, payload);
        },
        requestCampaign: (payload) => {
            return new Promise((resolve, reject) => {
                if (destroyed) {
                    reject(new Error('Cliente destruido'));
                    return;
                }
                const requestId = createRequestId();
                // Timeout de 30s para respuesta de campaña
                const timer = setTimeout(() => {
                    pendingCampaigns.delete(requestId);
                    reject(new Error('Timeout: el lobby no respondió a la solicitud de campaña'));
                }, 30000);
                pendingCampaigns.set(requestId, { resolve, reject, timer });
                send(MessageType.CAMPAIGN_REQUEST, payload, requestId);
            });
        },
        sendAchievementUnlocked: (payload) => {
            if (destroyed)
                return;
            send(MessageType.ACHIEVEMENT_UNLOCKED, payload);
        },
        onPause: (cb) => { pauseCb.push(cb); },
        onResume: (cb) => { resumeCb.push(cb); },
        onSessionContext: (cb) => { sessionContextCb.push(cb); },
        onLoadProgress: (cb) => { loadProgressCb.push(cb); },
        onSaveConfirmed: (cb) => { saveConfirmedCb.push(cb); },
        onEndSession: (cb) => { endSessionCb.push(cb); },
        destroy: () => {
            destroyed = true;
            listener.unsubscribe();
            responseListener.unsubscribe();
            // Cancelar todas las promesas pendientes
            for (const [, pending] of pendingCampaigns) {
                clearTimeout(pending.timer);
                pending.reject(new Error('Cliente destruido'));
            }
            pendingCampaigns.clear();
            pauseCb = [];
            resumeCb = [];
            sessionContextCb = [];
            loadProgressCb = [];
            saveConfirmedCb = [];
            campaignResponseCb = [];
            endSessionCb = [];
        },
    };
    return instance;
}
//# sourceMappingURL=lobby-client.js.map