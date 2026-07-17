/**
 * @juegahiphop/sdk — GameContainer
 *
 * Cliente que se usa en el LOBBY para comunicarse con un juego
 * ejecutándose dentro de un iframe.
 *
 * Uso:
 *   import { createGameClient } from '@juegahiphop/sdk'
 *
 *   const game = createGameClient(iframeRef.current, {
 *     allowedOrigins: ['https://fighters.juegahiphop.cl'],
 *   })
 *
 *   game.onGameReady(() => { /* ocultar loading *​/ })
 *   game.onGameCompleted((data) => { /* guardar puntaje *​/ })
 *   game.onExitGame(() => { /* volver al lobby *​/ })
 *   game.onRequestSave((data) => { /* persistir gameState *​/ })
 *
 *   // Limpiar al destruir el contenedor
 *   game.destroy()
 */
import { MessageType, PROTOCOL_VERSION } from './types';
import { isProtocolCompatible } from './types';
export function createGameClient(iframe, options) {
    const { allowedOrigins, readyTimeout = 15000, gameId } = options;
    let destroyed = false;
    let _gameProtocolVersion;
    // Resolver/rechazar la promesa ready
    let resolveReady = () => { };
    let rejectReady = () => { };
    const readyPromise = new Promise((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
    });
    // Timeout de ready
    const readyTimer = setTimeout(() => {
        if (!destroyed) {
            rejectReady(new Error(`Timeout: el juego no envió game_ready en ${readyTimeout}ms`));
        }
    }, readyTimeout);
    // Escuchar mensajes del iframe
    const onMessage = (event) => {
        if (destroyed)
            return;
        // Validar origen
        if (!allowedOrigins.includes(event.origin))
            return;
        // Validar formato
        const data = event.data;
        if (!data || typeof data.type !== 'string' || !data.type.startsWith('jh:'))
            return;
        if (data.source !== 'game')
            return;
        switch (data.type) {
            case MessageType.GAME_READY: {
                clearTimeout(readyTimer);
                const payload = data.payload;
                // Validar compatibilidad de protocolo
                if (payload.protocolVersion && !isProtocolCompatible(payload.protocolVersion)) {
                    rejectReady(new Error(`Protocolo incompatible: juego v${payload.protocolVersion}, lobby v${PROTOCOL_VERSION}`));
                    return;
                }
                _gameProtocolVersion = payload.protocolVersion;
                resolveReady(payload);
                gameReadyCb.forEach((cb) => cb(payload));
                break;
            }
            case MessageType.GAME_STARTED:
                gameStartedCb.forEach((cb) => cb(data.payload));
                break;
            case MessageType.GAME_COMPLETED:
                gameCompletedCb.forEach((cb) => cb(data.payload));
                break;
            case MessageType.SCORE_UPDATED:
                scoreUpdatedCb.forEach((cb) => cb(data.payload));
                break;
            case MessageType.REQUEST_FULLSCREEN:
                requestFullscreenCb.forEach((cb) => cb(data.payload));
                break;
            case MessageType.EXIT_GAME:
                exitGameCb.forEach((cb) => cb(data.payload));
                break;
            case MessageType.ERROR:
                errorCb.forEach((cb) => cb(data.payload));
                break;
            case MessageType.REQUEST_SAVE:
                requestSaveCb.forEach((cb) => cb(data.payload));
                break;
            case MessageType.CAMPAIGN_REQUEST:
                campaignRequestCb.forEach((cb) => cb(data.payload));
                break;
            case MessageType.ACHIEVEMENT_UNLOCKED:
                achievementUnlockedCb.forEach((cb) => cb(data.payload));
                break;
        }
    };
    window.addEventListener('message', onMessage);
    // Helpers para enviar al iframe
    const sendToGame = (type, payload, requestId) => {
        if (destroyed)
            return;
        if (!iframe || !iframe.contentWindow)
            return;
        // targetOrigin exacto
        const origin = allowedOrigins[0];
        if (!origin)
            return;
        iframe.contentWindow.postMessage({
            type,
            payload,
            timestamp: Date.now(),
            protocolVersion: PROTOCOL_VERSION,
            source: 'lobby',
            ...(gameId ? { gameId } : {}),
            ...(requestId ? { requestId } : {}),
        }, origin);
    };
    // Callback arrays
    let gameReadyCb = [];
    let gameStartedCb = [];
    let gameCompletedCb = [];
    let scoreUpdatedCb = [];
    let requestFullscreenCb = [];
    let exitGameCb = [];
    let errorCb = [];
    let requestSaveCb = [];
    let campaignRequestCb = [];
    let achievementUnlockedCb = [];
    const instance = {
        onGameReady: (cb) => { gameReadyCb.push(cb); },
        onGameStarted: (cb) => { gameStartedCb.push(cb); },
        onGameCompleted: (cb) => { gameCompletedCb.push(cb); },
        onScoreUpdated: (cb) => { scoreUpdatedCb.push(cb); },
        onRequestFullscreen: (cb) => { requestFullscreenCb.push(cb); },
        onExitGame: (cb) => { exitGameCb.push(cb); },
        onError: (cb) => { errorCb.push(cb); },
        onRequestSave: (cb) => { requestSaveCb.push(cb); },
        onCampaignRequest: (cb) => { campaignRequestCb.push(cb); },
        onAchievementUnlocked: (cb) => { achievementUnlockedCb.push(cb); },
        sendSessionContext: (payload) => sendToGame(MessageType.SESSION_CONTEXT, payload),
        sendLoadProgress: (payload) => sendToGame(MessageType.LOAD_PROGRESS, payload),
        sendSaveConfirmed: () => sendToGame(MessageType.SAVE_CONFIRMED, undefined),
        sendCampaignResponse: (payload) => sendToGame(MessageType.CAMPAIGN_RESPONSE, payload, payload.requestId),
        sendEndSession: (payload) => sendToGame(MessageType.END_SESSION, payload ?? { reason: 'navigate_away' }),
        sendPause: () => sendToGame(MessageType.PAUSE, undefined),
        sendResume: () => sendToGame(MessageType.RESUME, undefined),
        get gameProtocolVersion() { return _gameProtocolVersion; },
        ready: readyPromise,
        destroy: () => {
            destroyed = true;
            clearTimeout(readyTimer);
            window.removeEventListener('message', onMessage);
            gameReadyCb = [];
            gameStartedCb = [];
            gameCompletedCb = [];
            scoreUpdatedCb = [];
            requestFullscreenCb = [];
            exitGameCb = [];
            errorCb = [];
            requestSaveCb = [];
            campaignRequestCb = [];
            achievementUnlockedCb = [];
        },
    };
    return instance;
}
//# sourceMappingURL=game-container.js.map