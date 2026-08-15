/**
 * @juegahiphop/sdk — GameContainer
 *
 * Copia local sincronizada con packages/juegahiphop-sdk/
 * Mantener actualizado cuando se modifique el paquete.
 *
 * Cliente que se usa en el LOBBY para comunicarse con un juego
 * ejecutándose dentro de un iframe.
 *
 * El lobby es el CEREBRO: recibe solicitudes del juego (save, load,
 * unlock achievement, campaign) y responde con confirmaciones.
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
        const requestId = data.requestId;
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
            case MessageType.SAVE_PROGRESS:
                saveProgressCb.forEach((cb) => cb({ ...data.payload, _requestId: requestId }));
                break;
            case MessageType.LOAD_PROGRESS:
                loadProgressCb.forEach((cb) => cb({ ...data.payload, _requestId: requestId }));
                break;
            case MessageType.UNLOCK_ACHIEVEMENT:
                unlockAchievementCb.forEach((cb) => cb({ ...data.payload, _requestId: requestId }));
                break;
            case MessageType.CAMPAIGN_REQUEST:
                campaignRequestCb.forEach((cb) => cb({ ...data.payload, _requestId: requestId }));
                break;
            case MessageType.RESET_PROGRESS:
                resetProgressCb.forEach((cb) => cb({ ...data.payload, _requestId: requestId }));
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
    let saveProgressCb = [];
    let loadProgressCb = [];
    let unlockAchievementCb = [];
    let campaignRequestCb = [];
    let resetProgressCb = [];
    const instance = {
        // ═══ Listeners ═══
        onGameReady: (cb) => { gameReadyCb.push(cb); },
        onGameStarted: (cb) => { gameStartedCb.push(cb); },
        onGameCompleted: (cb) => { gameCompletedCb.push(cb); },
        onScoreUpdated: (cb) => { scoreUpdatedCb.push(cb); },
        onRequestFullscreen: (cb) => { requestFullscreenCb.push(cb); },
        onExitGame: (cb) => { exitGameCb.push(cb); },
        onError: (cb) => { errorCb.push(cb); },
        onSaveProgress: (cb) => { saveProgressCb.push(cb); },
        onLoadProgress: (cb) => { loadProgressCb.push(cb); },
        onUnlockAchievement: (cb) => { unlockAchievementCb.push(cb); },
        onCampaignRequest: (cb) => { campaignRequestCb.push(cb); },
        onResetProgress: (cb) => { resetProgressCb.push(cb); },
        // ═══ Respuestas ═══
        sendSaveResult: (payload) => sendToGame(MessageType.SAVE_RESULT, payload, payload.requestId),
        sendProgressData: (payload) => sendToGame(MessageType.PROGRESS_DATA, payload, payload.requestId),
        sendAchievementResult: (payload) => sendToGame(MessageType.ACHIEVEMENT_RESULT, payload, payload.requestId),
        sendCampaignResponse: (payload) => sendToGame(MessageType.CAMPAIGN_RESPONSE, payload, payload.requestId),
        sendResetResult: (payload) => sendToGame(MessageType.RESET_RESULT, payload, payload.requestId),
        // ═══ Contexto ═══
        sendSessionContext: (payload) => sendToGame(MessageType.SESSION_CONTEXT, payload),
        sendEndSession: (payload) => sendToGame(MessageType.END_SESSION, payload ?? { reason: 'navigate_away' }),
        sendPause: () => sendToGame(MessageType.PAUSE, undefined),
        sendResume: () => sendToGame(MessageType.RESUME, undefined),
        sendViewportChanged: (payload) => sendToGame(MessageType.VIEWPORT_CHANGED, payload),
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
            saveProgressCb = [];
            loadProgressCb = [];
            unlockAchievementCb = [];
            campaignRequestCb = [];
            resetProgressCb = [];
        },
    };
    return instance;
}
//# sourceMappingURL=game-container.js.map