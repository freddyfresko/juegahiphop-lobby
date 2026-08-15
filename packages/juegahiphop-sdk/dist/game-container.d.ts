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
import type { GameClientOptions } from './types';
import type { GameReadyPayload, GameStartedPayload, GameCompletedPayload, ScoreUpdatedPayload, ExitGamePayload, ErrorPayload, SaveProgressPayload, LoadProgressPayload, UnlockAchievementPayload, CampaignRequestPayload, ResetProgressPayload, ResetResultPayload, SessionContextPayload, SaveResultPayload, ProgressDataPayload, AchievementResultPayload, CampaignResponsePayload, EndSessionPayload, ViewportPayload, MessageCallback } from './types';
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
    onSaveProgress: (cb: MessageCallback<SaveProgressPayload>) => void;
    /** El juego solicita cargar progreso */
    onLoadProgress: (cb: MessageCallback<LoadProgressPayload>) => void;
    /** El juego solicita registrar un logro */
    onUnlockAchievement: (cb: MessageCallback<UnlockAchievementPayload>) => void;
    /** El juego solicita campaña recompensada */
    onCampaignRequest: (cb: MessageCallback<CampaignRequestPayload>) => void;
    /** El juego solicita RESETEAR su progreso */
    onResetProgress: (cb: MessageCallback<ResetProgressPayload>) => void;
    /** Responder a save_progress */
    sendSaveResult: (payload: SaveResultPayload) => void;
    /** Responder a load_progress */
    sendProgressData: (payload: ProgressDataPayload) => void;
    /** Responder a unlock_achievement */
    sendAchievementResult: (payload: AchievementResultPayload) => void;
    /** Responder a campaign_request */
    sendCampaignResponse: (payload: CampaignResponsePayload) => void;
    /** Responder a reset_progress */
    sendResetResult: (payload: ResetResultPayload) => void;
    /** Enviar contexto de sesión al juego (después de game_ready) */
    sendSessionContext: (payload: SessionContextPayload) => void;
    /** Cerrar sesión de juego */
    sendEndSession: (payload?: EndSessionPayload) => void;
    /** Pausar el juego */
    sendPause: () => void;
    /** Reanudar el juego */
    sendResume: () => void;
    /** Notificar el viewport real del iframe al juego */
    sendViewportChanged: (payload: ViewportPayload) => void;
    /** Destruir la instancia */
    destroy: () => void;
    /** Promesa que se resuelve cuando el juego envía game_ready, o rechaza en timeout */
    ready: Promise<GameReadyPayload>;
    /** Versión del protocolo que el juego declaró (disponible después de ready) */
    gameProtocolVersion?: string;
}
export declare function createGameClient(iframe: HTMLIFrameElement | null, options: GameClientOptions): GameClientInstance;
//# sourceMappingURL=game-container.d.ts.map