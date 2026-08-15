/**
 * @juegahiphop/sdk — LobbyClient
 *
 * Cliente que se usa DENTRO del juego (ejecutándose en un iframe)
 * para comunicarse con el Lobby que lo contiene.
 *
 * El lobby es el CEREBRO: maneja usuario, sesión, y persistencia.
 * Los juegos son stateless desde el punto de vista del backend.
 * Toda lectura/escritura va por postMessage al lobby.
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
 *   lobby.onSessionContext((ctx) => { /* recibir datos del usuario *​/ })
 *   lobby.onProgressData((data) => { /* cargar progreso guardado *​/ })
 *
 *   // Guardar/cargar progreso (vía el lobby)
 *   const result = await lobby.saveProgress({ gameState: { ... }, score: 100 })
 *   const data = await lobby.loadProgress()
 *
 *   // Registrar completion / logro
 *   lobby.sendGameCompleted({ score: 1000, itemId: 'nivel-3' })
 *   lobby.sendAchievementUnlocked({ achievementId: 'first_win' })
 *
 *   // Salir
 *   lobby.sendExitGame({ reason: 'user_quit' })
 */
import { listenMessages } from './messages';
import { MessageType } from './types';
import { PROTOCOL_VERSION, createRequestId } from './types';
const DEFAULT_TIMEOUT = 10000; // 10s para respuestas del lobby
export function createLobbyClient(options) {
    const { lobbyOrigin, capabilities, gameId } = options;
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
            ...(gameId ? { gameId } : {}),
            ...(requestId ? { requestId } : {}),
        }, lobbyOrigin);
    };
    // ─── Promesas pendientes (request/response) ───
    const pendingSaves = new Map();
    const pendingLoads = new Map();
    const pendingAchievements = new Map();
    const pendingCampaigns = new Map();
    const pendingResets = new Map();
    // ─── Callback arrays (eventos push) ───
    let pauseCb = [];
    let resumeCb = [];
    let sessionContextCb = [];
    let endSessionCb = [];
    // ─── Escuchar respuestas del lobby ───
    const responseListener = listenMessages((msg) => {
        if (msg.source !== 'lobby')
            return;
        switch (msg.type) {
            case MessageType.SESSION_CONTEXT:
                sessionContextCb.forEach((cb) => cb(msg.payload));
                break;
            case MessageType.PAUSE:
                pauseCb.forEach((cb) => cb(msg.payload));
                break;
            case MessageType.RESUME:
                resumeCb.forEach((cb) => cb(msg.payload));
                break;
            case MessageType.END_SESSION:
                endSessionCb.forEach((cb) => cb(msg.payload));
                break;
            case MessageType.SAVE_RESULT: {
                const resp = msg.payload;
                const pending = pendingSaves.get(resp.requestId);
                if (pending) {
                    clearTimeout(pending.timer);
                    pendingSaves.delete(resp.requestId);
                    pending.resolve(resp);
                }
                break;
            }
            case MessageType.PROGRESS_DATA: {
                const resp = msg.payload;
                const pending = pendingLoads.get(resp.requestId);
                if (pending) {
                    clearTimeout(pending.timer);
                    pendingLoads.delete(resp.requestId);
                    pending.resolve(resp);
                }
                break;
            }
            case MessageType.ACHIEVEMENT_RESULT: {
                const resp = msg.payload;
                const pending = pendingAchievements.get(resp.requestId);
                if (pending) {
                    clearTimeout(pending.timer);
                    pendingAchievements.delete(resp.requestId);
                    pending.resolve(resp);
                }
                break;
            }
            case MessageType.CAMPAIGN_RESPONSE: {
                const resp = msg.payload;
                const pending = pendingCampaigns.get(resp.requestId);
                if (pending) {
                    clearTimeout(pending.timer);
                    pendingCampaigns.delete(resp.requestId);
                    pending.resolve(resp);
                }
                break;
            }
            case MessageType.RESET_RESULT: {
                const resp = msg.payload;
                const pending = pendingResets.get(resp.requestId);
                if (pending) {
                    clearTimeout(pending.timer);
                    pendingResets.delete(resp.requestId);
                    pending.resolve(resp);
                }
                break;
            }
        }
    }, [lobbyOrigin]);
    // ─── Helper: crear promesa request/response con timeout ───
    const createPending = (map, type, payload, timeoutMs = DEFAULT_TIMEOUT) => {
        return new Promise((resolve, reject) => {
            if (destroyed) {
                reject(new Error('Cliente destruido'));
                return;
            }
            const requestId = createRequestId();
            const timer = setTimeout(() => {
                map.delete(requestId);
                reject(new Error(`Timeout: el lobby no respondió a ${type}`));
            }, timeoutMs);
            map.set(requestId, { resolve, reject, timer });
            send(type, payload, requestId);
        });
    };
    const instance = {
        // ═══ Ciclo de vida ═══
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
        // ═══ Persistencia (request/response) ═══
        saveProgress: (payload) => {
            return createPending(pendingSaves, MessageType.SAVE_PROGRESS, payload);
        },
        loadProgress: (payload) => {
            return createPending(pendingLoads, MessageType.LOAD_PROGRESS, payload ?? {});
        },
        unlockAchievement: (payload) => {
            return createPending(pendingAchievements, MessageType.UNLOCK_ACHIEVEMENT, payload);
        },
        requestCampaign: (payload) => {
            return createPending(pendingCampaigns, MessageType.CAMPAIGN_REQUEST, payload, 30000);
        },
        resetProgress: (payload) => {
            return createPending(pendingResets, MessageType.RESET_PROGRESS, payload ?? {});
        },
        // ═══ Listeners ═══
        onSessionContext: (cb) => { sessionContextCb.push(cb); },
        onPause: (cb) => { pauseCb.push(cb); },
        onResume: (cb) => { resumeCb.push(cb); },
        onEndSession: (cb) => { endSessionCb.push(cb); },
        // ═══ Cleanup ═══
        destroy: () => {
            destroyed = true;
            responseListener.unsubscribe();
            // Cancelar todas las promesas pendientes
            for (const [, pending] of pendingSaves) {
                clearTimeout(pending.timer);
                pending.reject(new Error('Cliente destruido'));
            }
            pendingSaves.clear();
            for (const [, pending] of pendingLoads) {
                clearTimeout(pending.timer);
                pending.reject(new Error('Cliente destruido'));
            }
            pendingLoads.clear();
            for (const [, pending] of pendingAchievements) {
                clearTimeout(pending.timer);
                pending.reject(new Error('Cliente destruido'));
            }
            pendingAchievements.clear();
            for (const [, pending] of pendingCampaigns) {
                clearTimeout(pending.timer);
                pending.reject(new Error('Cliente destruido'));
            }
            pendingCampaigns.clear();
            for (const [, pending] of pendingResets) {
                clearTimeout(pending.timer);
                pending.reject(new Error('Cliente destruido'));
            }
            pendingResets.clear();
            pauseCb = [];
            resumeCb = [];
            sessionContextCb = [];
            endSessionCb = [];
        },
    };
    return instance;
}
//# sourceMappingURL=lobby-client.js.map