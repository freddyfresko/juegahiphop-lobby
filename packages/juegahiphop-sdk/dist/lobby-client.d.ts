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
import type { LobbyClientOptions } from './types';
import type { GameReadyPayload, GameStartedPayload, GameCompletedPayload, ScoreUpdatedPayload, ExitGamePayload, ErrorPayload, SaveProgressPayload, LoadProgressPayload, UnlockAchievementPayload, CampaignRequestPayload, ResetProgressPayload, ResetResultPayload, SessionContextPayload, ProgressDataPayload, SaveResultPayload, AchievementResultPayload, CampaignResponsePayload, EndSessionPayload, MessageCallback } from './types';
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
    /** Guardar el estado del juego en el backend (vía lobby) */
    saveProgress: (payload: SaveProgressPayload) => Promise<SaveResultPayload>;
    /** Cargar el estado guardado del juego (vía lobby) */
    loadProgress: (payload?: LoadProgressPayload) => Promise<ProgressDataPayload>;
    /** Registrar un logro desbloqueado (vía lobby) */
    unlockAchievement: (payload: UnlockAchievementPayload) => Promise<AchievementResultPayload>;
    /** Solicitar campaña recompensada (vía lobby) */
    requestCampaign: (payload: CampaignRequestPayload) => Promise<CampaignResponsePayload>;
    /** RESETEAR el progreso del juego (vía lobby — borra todo en Supabase) */
    resetProgress: (payload?: ResetProgressPayload) => Promise<ResetResultPayload>;
    /** Escuchar contexto de sesión (perfil, userId, etc.) */
    onSessionContext: (cb: MessageCallback<SessionContextPayload>) => void;
    /** Escuchar pausa del lobby */
    onPause: (cb: MessageCallback) => void;
    /** Escuchar reanudación del lobby */
    onResume: (cb: MessageCallback) => void;
    /** Escuchar cierre de sesión */
    onEndSession: (cb: MessageCallback<EndSessionPayload>) => void;
    /** Destruir la instancia y limpiar listeners */
    destroy: () => void;
}
export declare function createLobbyClient(options: LobbyClientOptions): LobbyClientInstance;
//# sourceMappingURL=lobby-client.d.ts.map