# 🎮 REGLAS GENERALES PARA JUEGOS — JuegaHipHop.cl

> **Plataforma:** JuegaHipHop (lobby + juegos)
> **Protocolo:** `jh:*` postMessage v2.0.0 · **SDK:** `@juegahiphop/sdk`
> **Última actualización:** 2026-08-14
>
> Este documento es el **manual oficial** para desarrollar o actualizar juegos
> de la plataforma. Léelo completo antes de empezar y úsalo como referencia.

---

## 1. Arquitectura: cómo funciona la plataforma

```
┌──────────────────────────────────────────────────────────────┐
│  LOBBY (juegahiphop.cl)                                      │
│  · Next.js + Supabase — el CEREBRO                          │
│  · Único que toca la base de datos                           │
│  · Maneja: usuarios, sesiones, rankings, logros, ads,        │
│    persistencia, progreso                                    │
│  · Renderiza tu juego dentro de un <iframe>                  │
└──────────────▲───────────────────────────────────────────────┘
               │ postMessage (protocolo jh:*)
└──────────────┴───────────────────────────────────────────────┐
│  TU JUEGO (ej: sopa.juegahiphop.cl)                          │
│  · Build estático (Vite/React recomendado)                   │
│  · STATELESS: no toca Supabase directo                       │
│  · Se comunica SOLO vía el SDK (postMessage)                 │
└──────────────────────────────────────────────────────────────┘
```

**Regla de oro:** el juego es una caja que recibe contexto y envía eventos.
No sabe (ni le importa) quién es el usuario ni dónde se guardan los datos:
todo eso lo resuelve el lobby.

---

## 2. Requisitos técnicos del juego

| Requisito | Detalle |
|-----------|---------|
| **Build** | Estático (Vite/React, o cualquier framework que compile a HTML/JS/CSS) |
| **URL** | Deploy en un subdominio propio (`sopa.juegahiphop.cl`) o donde sea — el lobby la embebe en un iframe |
| **HTTPS** | Obligatorio en producción |
| **Sin acceso a Supabase** | El juego NO usa la API de Supabase. Todo pasa por el lobby |
| **Comunicación** | postMessage con el protocolo `jh:*` (vía SDK) |
| **Idioma** | Español (es-CL) — el lobby envía `locale: 'es-CL'` |

---

## 3. Instalación del SDK

```bash
# Opción A: paquete compartido (monorepo)
npm install @juegahiphop/sdk

# Opción B: copia local (como hacen Sopa/Puzzle)
# Copia la carpeta src/lib/sdk/ de un juego existente
# (mantenla sincronizada con packages/juegahiphop-sdk/)
```

**Estructura del SDK** (`src/lib/sdk/`):
```
sdk/
├── types.ts          # Protocolo: tipos de mensajes + payloads
├── messages.ts       # Helpers de postMessage
└── lobby-client.ts   # Cliente del juego (createLobbyClient)
```

---

## 4. Ciclo de vida de una partida (flujo completo)

```
TU JUEGO                                    LOBBY
─────────────────────────────────────────────────────────────
1. Cargas y llamas createLobbyClient()
2. Envías sendReady()                        → crea la sesión
3. Recibes SESSION_CONTEXT (usuario, perfil, sessionId)
4. Recibes VIEWPORT_CHANGED (tamaño real del iframe)
5. El jugador empieza: sendGameStarted()     → marca inicio + tiempo
6. (opcional) sendScoreUpdated() en vivo     → telemetría (throttle 5s)
7. La partida termina: sendGameCompleted()   → ⭐ cierra sesión + RANKING
8. (opcional) saveProgress() / unlockAchievement() / requestCampaign()
9. Volver al lobby: sendExitGame()
```

```ts
// ─── Ejemplo mínimo de integración ───
import { createLobbyClient } from '@juegahiphop/sdk'

const lobby = createLobbyClient({
  lobbyOrigin: 'http://localhost:3000', // en prod: 'https://juegahiphop.cl'
  gameId: 'mijuego',
})

// 1. Avisar que cargamos
lobby.sendReady({ version: '1.0.0' })

// 2. Recibir al jugador
lobby.onSessionContext((ctx) => {
  console.log('Jugador:', ctx.displayName, '| invitado:', ctx.isGuest)
  // ctx: { userId, displayName, avatarUrl, level, xp, isGuest, sessionId, capabilities }
})

// 3. Recibir el tamaño real del iframe (rotación, fullscreen, teclado móvil)
lobby.onViewportChanged((vp) => {
  console.log('Viewport:', vp.width, 'x', vp.height, vp.orientation)
})

// 4. Empezar partida
lobby.sendGameStarted({ difficulty: 'normal' })

// 5. Terminar partida — UNA vez — ⭐
lobby.sendGameCompleted({
  score: puntosDeEstaPartida,   // ← lo ganado en ESTA partida
  completed: true,              // ← siempre explícito
  timeSpent: segundosJugados,
  difficulty: 'normal',
  metadata: { /* lo que quieras (no afecta ranking) */ },
})
```

---

## 5. API del SDK — todos los métodos

### 5.1 Juego → Lobby (eventos)

| Método | Mensaje | Cuándo |
|--------|---------|--------|
| `sendReady({ version })` | `jh:game_ready` | Al cargar (obligatorio — el lobby espera el handshake) |
| `sendGameStarted({ difficulty, levelId })` | `jh:game_started` | Al iniciar cada partida |
| `sendGameCompleted({ score, completed, timeSpent, difficulty, metadata })` | `jh:game_completed` | ⭐ Al terminar (rankings) |
| `sendScoreUpdated({ score, progress })` | `jh:score_updated` | Opcional, en vivo (solo telemetría) |
| `requestFullscreen()` | `jh:request_fullscreen` | Botón de pantalla completa |
| `sendExitGame({ reason, saveBeforeExit })` | `jh:exit_game` | Volver al lobby |
| `sendError({ code, message, fatal })` | `jh:error` | Error del juego (fatal → pantalla de error) |

### 5.2 Juego → Lobby (request/response — devuelven Promesa)

| Método | Mensaje | Respuesta |
|--------|---------|-----------|
| `await saveProgress({ gameState, score?, metadata? })` | `jh:save_progress` | `{ success, error? }` |
| `await loadProgress({ schemaVersion? })` | `jh:load_progress` | `{ success, gameState, bestScore?, error? }` |
| `await unlockAchievement({ achievementId, metadata? })` | `jh:unlock_achievement` | `{ success, alreadyUnlocked?, error? }` |
| `await requestCampaign({ placement, rewardIds, metadata? })` | `jh:campaign_request` | `{ status, campaignId?, rewardedIds?, message? }` |

### 5.3 Lobby → Juego (listeners)

| Listener | Mensaje | Payload |
|----------|---------|---------|
| `onSessionContext(cb)` | `jh:session_context` | `{ userId, displayName, avatarUrl, level, xp, isGuest, sessionId, capabilities }` |
| `onViewportChanged(cb)` | `jh:viewport_changed` | `{ width, height, isFullscreen, orientation, devicePixelRatio }` |
| `onPause(cb)` | `jh:pause` | — (pausa del lobby) |
| `onResume(cb)` | `jh:resume` | — |
| `onEndSession(cb)` | `jh:end_session` | `{ reason }` (el lobby cerró la sesión) |

---

## 6. Reglas de RANKING (resumen — ver `RANKING-PROTOCOL.md`)

Los rankings (general y por juego) se alimentan **exclusivamente** del
`jh:game_completed`. Reglas:

1. **`score` = puntos ganados en ESA partida** — entero ≥ 0. NUNCA el XP
   acumulado del jugador ni su progreso histórico.
2. **`completed` SIEMPRE explícito**: `true` = logró el objetivo (cuenta
   como completada), `false` = abandonó/perdió.
3. **Un `game_completed` por partida.**
4. **`timeSpent`** en segundos (opcional — el lobby lo calcula si falta).
5. La escala de puntos es tuya, pero **consistente entre partidas**.

> El lobby normaliza: score inválido → 0, y si `completed` no viene explícito,
> la partida NO cuenta como completada.

---

## 7. Persistencia (guardar/cargar el estado del juego)

El juego es stateless: el **estado completo vive en el lobby** (tabla
`game_state` → JSONB).

```ts
// Guardar (cada vez que cambie algo importante)
const res = await lobby.saveProgress({
  gameState: {
    nivel: 12,
    palabrasEncontradas: [...],
    monedas: 350,
  },
  score: 1200,      // opcional → actualiza best_score
  metadata: { ... },
})
if (res.success) { /* todo ok */ }

// Cargar (al iniciar, después del session_context)
const data = await lobby.loadProgress()
if (data.success && data.gameState) {
  // restaurar data.gameState
}
```

> ⚠️ `save_progress` es para el ESTADO del juego — **NO** para el ranking.
> El ranking solo mira `game_completed`.

---

## 8. Logros

```ts
const res = await lobby.unlockAchievement({
  achievementId: 'primer_nivel',   // ID que TU defines
  metadata: { nivel: 1 },
})
// res: { success, alreadyUnlocked? }
```

- Los logros se muestran en el perfil del jugador (tabla `achievement_unlocks`).
- Si el logro ya estaba desbloqueado, `alreadyUnlocked: true` (no duplica).

---

## 9. Campañas / publicidad (opcional)

El lobby maneja la publicidad (AdinPlay, NitroPay, Google Ads, sponsors).
Tu juego solo pide una campaña en un "placement" (momento):

```ts
// Ej: entre niveles
const res = await lobby.requestCampaign({
  placement: 'game_level_complete',  // tú defines el nombre
  rewardIds: [],                      // recompensas si es rewarded ad
})

if (res.status === 'approved') {
  // El lobby mostró el ad (overlay). El juego queda tapado/pausado.
  // Al cerrar el ad, resuelve la promesa con las recompensas.
}
```

Placements usados actualmente: `game_level_complete`, `game_results`.

---

## 10. Contexto de sesión (qué sabes del jugador)

Después del handshake recibes `jh:session_context`:

```ts
interface SessionContextPayload {
  userId: string      // 'guest' si no inició sesión
  displayName?: string
  avatarUrl?: string
  level?: number      // nivel global del jugador
  xp?: number
  locale: 'es-CL'
  isGuest: boolean    // true = jugando sin cuenta
  sessionId: string   // id de la sesión actual (para game_completed)
  capabilities?: string[]
}
```

- **Invitado** (`isGuest: true`): el lobby confirma guardados sin persistir —
  tu juego debe funcionar igual con localStorage como caché local.
- El `level`/`xp` vienen del perfil global del jugador en el lobby.

---

## 11. Viewport / responsive

El lobby te notifica el **tamaño real del iframe** (`jh:viewport_changed`)
cuando: cambia la ventana, entra/sale fullscreen, rota el celular, o aparece
el teclado móvil. Escuchalo para re-layoutear tu juego.

```ts
lobby.onViewportChanged((vp) => {
  // vp: { width, height, isFullscreen, orientation, devicePixelRatio }
})
```

---

## 12. Fullscreen, salir y errores

```ts
// Botón de pantalla completa (el lobby la gestiona)
lobby.requestFullscreen()

// Volver al lobby (termina la sesión: 'completed' o 'abandoned')
lobby.sendExitGame({ reason: 'user_quit' })

// Error del juego
lobby.sendError({ code: 'ASSETS_FAILED', message: 'No cargaron los assets', fatal: false })
```

Si el jugador cierra la pestaña o navega fuera, el lobby cierra la sesión
como `abandoned` automáticamente (sendBeacon). No necesitas hacer nada.

---

## 13. Registrar tu juego en el catálogo

El lobby lee la tabla `games` (Supabase) para mostrar las tarjetas y montar
el iframe. Ejemplo de INSERT (o edítalo en el panel admin `/admin`):

```sql
INSERT INTO games (
  slug, name, emoji, short_description, description,
  color, accent_color, status, featured, orientation,
  external_url, category, sort_order, total_items, progress_label, allowed_origins
) VALUES (
  'mijuego', 'Mi Juego', '🎯',
  'Descripción corta para la tarjeta.',
  'Descripción larga.',
  '#10B981', '#059669',
  'beta',          -- active | beta | coming_soon | maintenance | hidden
  false,
  'landscape',     -- landscape | portrait | any
  'https://mijuego.juegahiphop.cl',
  'games',
  10,
  NULL,            -- total_items: pa la barra de progreso (ej: 930 palabras)
  'Completados',   -- progress_label
  ARRAY['https://mijuego.juegahiphop.cl']  -- allowed_origins del iframe
);
```

**Campos clave:**
- `external_url`: la URL que se embebe en el iframe
- `allowed_origins`: orígenes permitidos para el postMessage (seguridad)
- `status`: `active` (visible y jugable), `beta`, `coming_soon`, `maintenance`, `hidden`
- `orientation`: cómo se ve la tarjeta/juego en el lobby
- `featured`: si sale en DESTACADOS

---

## 14. Checklist de desarrollo (nuevo juego o actualización)

**Integración SDK:**
- [ ] `createLobbyClient` con `lobbyOrigin` correcto (prod: `https://juegahiphop.cl`)
- [ ] `sendReady()` al cargar
- [ ] `onSessionContext` → mostrar nombre/avatar/level si hay sesión
- [ ] `onViewportChanged` → layout responsive
- [ ] `onEndSession` / `onPause` / `onResume` → pausar el juego

**Partida y ranking:**
- [ ] `sendGameStarted({ difficulty })` al iniciar
- [ ] `scoreDeEstaPartida` calculado (nunca el XP acumulado del jugador)
- [ ] `sendGameCompleted({ score, completed: true|false, timeSpent })` **una vez** al terminar
- [ ] No mandar `game_completed` al salir sin terminar (el lobby cierra como abandonada)

**Persistencia y extras:**
- [ ] `loadProgress()` al inicio → restaurar estado
- [ ] `saveProgress()` en momentos clave (nivel completado, salir)
- [ ] `unlockAchievement()` en logros
- [ ] `requestCampaign()` en los placements (si quieres ads)
- [ ] Funciona como invitado (`isGuest`) con localStorage

**Despliegue:**
- [ ] Build estático + HTTPS
- [ ] Registrar en tabla `games` (o admin panel)
- [ ] Deploy del juego (ej: Firebase Hosting) y del lobby si cambió algo

---

## 15. Errores comunes

| ❌ Error | ✅ Correcto |
|---------|------------|
| `score: progress.xp` (XP acumulado histórico) | `score: Math.max(0, progress.xp - xpAlInicioDeLaPartida)` |
| No mandar `completed` | `completed: true` o `false` siempre |
| `sendGameCompleted` repetido por palabra/nivel | Una sola vez al terminar la partida |
| Tocar Supabase directo desde el juego | Todo por el SDK (el lobby es el cerebro) |
| `saveProgress` con score para "sumar al ranking" | El ranking solo mira `game_completed` |
| No escuchar `viewport_changed` (se ve cortado en móvil) | Layout dinámico con `onViewportChanged` |
| `lobbyOrigin` incorrecto (postMessage silencioso) | Verificar el origen exacto del lobby |

---

## 16. Referencias (archivos clave en el repo)

| Archivo | Para qué |
|---------|----------|
| `packages/juegahiphop-sdk/src/types.ts` | Protocolo completo (mensajes + payloads) |
| `packages/juegahiphop-sdk/src/lobby-client.ts` | Cliente del juego (métodos) |
| `packages/juegahiphop-sdk/RANKING.md` | Reglas del ranking |
| `lobby/src/components/GameContainer.tsx` | Cómo el lobby procesa cada mensaje |
| `lobby/docs/RANKING-PROTOCOL.md` | Spec del ranking |
| `sopadeletras/src/App.tsx` | Ejemplo real de integración completa |

---

*Documento mantenido en `lobby/docs/REGLAS-GENERALES-JUEGOS.md`.*
