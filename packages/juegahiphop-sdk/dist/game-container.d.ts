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
import type { GameClientOptions } from './types';
import type { GameReadyPayload, GameStartedPayload, GameCompletedPayload, ScoreUpdatedPayload, ExitGamePayload, ErrorPayload, RequestSavePayload, CampaignRequestPayload, AchievementUnlockedPayload, SessionContextPayload, LoadProgressPayload, CampaignResponsePayload, EndSessionPayload, MessageCallback } from './types';
export interface GameClientInstance {
    /** El juego está listo */
    onGameReady: (cb: MessageCallback<GameReadyPayload>) => void;
    /** El juego empezó una partida */
    onGameStarted: (cb: MessageCallback<GameStartedPayload>) => void;
    /** La partida terminó */
    onGameCompleted: (cb: MessageCallback<GameCompletedPayload>) => void;
    /** Puntaje actualizado en vivo */
    onScoreUpdated: (cb: MessageCallback<ScoreUpdatedPayload>) => void;
    /** El juego pide pantalla completa */
    onRequestFullscreen: (cb: MessageCallback) => void;
    /** El juego pide volver al lobby */
    onExitGame: (cb: MessageCallback<ExitGamePayload>) => void;
    /** Error desde el juego */
    onError: (cb: MessageCallback<ErrorPayload>) => void;
    /** El juego solicita guardar progreso */
    onRequestSave: (cb: MessageCallback<RequestSavePayload>) => void;
    /** El juego solicita campaña recompensada */
    onCampaignRequest: (cb: MessageCallback<CampaignRequestPayload>) => void;
    /** El juego notifica logro desbloqueado */
    onAchievementUnlocked: (cb: MessageCallback<AchievementUnlockedPayload>) => void;
    /** Enviar contexto de sesión al juego (después de game_ready) */
    sendSessionContext: (payload: SessionContextPayload) => void;
    /** Enviar progreso guardado al juego */
    sendLoadProgress: (payload: LoadProgressPayload) => void;
    /** Confirmar guardado exitoso */
    sendSaveConfirmed: () => void;
    /** Responder a solicitud de campaña recompensada */
    sendCampaignResponse: (payload: CampaignResponsePayload) => void;
    /** Cerrar sesión de juego */
    sendEndSession: (payload?: EndSessionPayload) => void;
    /** Pausar el juego */
    sendPause: () => void;
    /** Reanudar el juego */
    sendResume: () => void;
    /** Destruir la instancia */
    destroy: () => void;
    /** Promesa que se resuelve cuando el juego envía game_ready, o rechaza en timeout */
    ready: Promise<GameReadyPayload>;
    /** Versión del protocolo que el juego declaró (disponible después de ready) */
    gameProtocolVersion?: string;
}
export declare function createGameClient(iframe: HTMLIFrameElement | null, options: GameClientOptions): GameClientInstance;
//# sourceMappingURL=game-container.d.ts.map