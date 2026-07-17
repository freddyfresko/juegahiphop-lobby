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
import type { LobbyClientOptions } from './types';
import type { GameReadyPayload, GameStartedPayload, GameCompletedPayload, ScoreUpdatedPayload, ExitGamePayload, ErrorPayload, RequestSavePayload, CampaignRequestPayload, AchievementUnlockedPayload, SessionContextPayload, LoadProgressPayload, CampaignResponsePayload, EndSessionPayload, MessageCallback } from './types';
export interface LobbyClientInstance {
    /** Anunciar que el juego terminó de cargar */
    sendReady: (payload: GameReadyPayload) => void;
    /** Anunciar que empezó una partida */
    sendGameStarted: (payload?: GameStartedPayload) => void;
    /** Anunciar que una partida terminó */
    sendGameCompleted: (payload: GameCompletedPayload) => void;
    /** Actualizar puntaje en vivo */
    sendScoreUpdated: (payload: ScoreUpdatedPayload) => void;
    /** Solicitar pantalla completa al lobby */
    requestFullscreen: () => void;
    /** Solicitar volver al lobby */
    sendExitGame: (payload?: ExitGamePayload) => void;
    /** Reportar un error */
    sendError: (payload: ErrorPayload) => void;
    /** Solicitar guardar progreso */
    requestSave: (payload: RequestSavePayload) => void;
    /** Solicitar campaña recompensada — devuelve promesa con la respuesta */
    requestCampaign: (payload: CampaignRequestPayload) => Promise<CampaignResponsePayload>;
    /** Reportar logro desbloqueado */
    sendAchievementUnlocked: (payload: AchievementUnlockedPayload) => void;
    /** Escuchar cuando el lobby pausa el juego */
    onPause: (cb: MessageCallback) => void;
    /** Escuchar cuando el lobby reanuda el juego */
    onResume: (cb: MessageCallback) => void;
    /** Escuchar contexto de sesión (perfil, userId, etc.) */
    onSessionContext: (cb: MessageCallback<SessionContextPayload>) => void;
    /** Escuchar carga de progreso guardado */
    onLoadProgress: (cb: MessageCallback<LoadProgressPayload>) => void;
    /** Escuchar confirmación de guardado */
    onSaveConfirmed: (cb: MessageCallback) => void;
    /** Escuchar cierre de sesión */
    onEndSession: (cb: MessageCallback<EndSessionPayload>) => void;
    /** Destruir la instancia y limpiar listeners */
    destroy: () => void;
}
export declare function createLobbyClient(options: LobbyClientOptions): LobbyClientInstance;
//# sourceMappingURL=lobby-client.d.ts.map