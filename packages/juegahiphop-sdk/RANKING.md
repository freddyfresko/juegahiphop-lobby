# 🏆 RANKING PROTOCOL — Reglas del Lobby para Juegos

> **Versión:** 1.0.0 · **Protocolo postMessage:** `jh:*` (v2.0.0)
> **Última actualización:** 2026-08-14
>
> Este documento define **qué debe reportar cada juego** para que el lobby
> arme los rankings (general y por juego). Si desarrollas o adaptas un juego
> (Sopa, Puzzle, Fighters, etc.), **esta es la ley**: seguí estas reglas y tu
> juego rankea solo, sin tocar el lobby.

---

## 1. Cómo funciona (en 30 segundos)

El **lobby es el cerebro**: es el único que toca Supabase. Los juegos corren
dentro de un iframe y se comunican por `postMessage`. Cada partida se registra
como una **sesión** y el lobby agrega los resultados en los rankings.

```
┌─────────┐  jh:game_started      ┌──────────────────────────────┐
│  JUEGO  │ ────────────────────► │ LOBBY (GameContainer)        │
│ (iframe)│  jh:score_updated     │  · crea la sesión            │
│         │ ────────────────────► │  · mide tiempo               │
│         │  jh:game_completed    │  · guarda score/resultado    │
│         │ ────────────────────► │  · cierra la sesión          │
└─────────┘                       └──────────────┬───────────────┘
                                                 ▼
                          Supabase: game_sessions → rankings
                          · Ranking GENERAL  = suma de scores
                          · Ranking POR JUEGO = best score + suma
```

**En una partida solo importan 3 mensajes.** El que define el ranking es
`jh:game_completed`.

---

## 2. Los 3 mensajes de una partida

### 2.1 `jh:game_started` — cuando el jugador empieza

El lobby crea la sesión (o la actualiza con dificultad/nivel) y ancla el
tiempo de inicio.

```ts
lobby.sendGameStarted({
  difficulty: 'normal',   // opcional
  levelId: 'nivel-3',     // opcional
})
```

### 2.2 `jh:score_updated` — opcional (telemetría en vivo)

Puntaje en vivo mientras juega. **NO cuenta para el ranking** — solo el
`game_completed` final es el que puntúa.

```ts
lobby.sendScoreUpdated({ score: 120, progress: 0.5 })
```

### 2.3 `jh:game_completed` — ⭐ EL que cuenta para el ranking

Se envía **una sola vez**, cuando la partida termina (ganada, perdida o
abandonada). Con este payload el lobby cierra la sesión y actualiza rankings.

```ts
lobby.sendGameCompleted({
  score: 120,          // REQUERIDO — puntos de ESTA partida
  completed: true,     // REQUERIDO — ¿logró el objetivo?
  timeSpent: 95,       // opcional — segundos jugados
  difficulty: 'normal',// opcional
  metadata: {          // opcional — JSON libre, no afecta rankings
    wordsFound: 8,
    totalWords: 10,
  },
})
```

---

## 3. Reglas de oro (la ley)

| # | Regla | Por qué |
|---|-------|---------|
| 1 | **`score` = puntos ganados en ESA partida** | El ranking suma scores de partidas. Si mandas el XP acumulado del jugador o su progreso histórico, el ranking se infla o queda en 0. |
| 2 | **`score` es un entero ≥ 0** | Nada de negativos, decimales ni strings. El lobby normaliza, pero mándalo bien. |
| 3 | **`completed` SIEMPRE explícito** | `true` = logró el objetivo de la partida (cuenta como *completada*). `false` = abandonó, perdió o salió (no cuenta como completada). Si NO se manda, el lobby lo trata como **no completada**. |
| 4 | **Un `game_completed` por partida** | El lobby cierra la sesión al recibirlo; un segundo envío se ignora. |
| 5 | **`timeSpent` en segundos** (opcional) | Si no lo mandas, el lobby lo calcula desde `game_started`. |
| 6 | **La escala de puntos es tuya, pero consistente** | La Sopa da 20 XP/palabra. Puzzle puede dar 1000/partida. El ranking general suma en bruto: define tu escala para que partidas similares den puntos similares. |
| 7 | **`save_progress` NO es ranking** | Guardar el estado del juego (progreso, monedas, palabras encontradas) es separado del ranking. El ranking solo mira `game_completed`. |
| 8 | **El score se gana, aunque abandones** | Si el jugador ganó puntos y abandonó después, esos puntos suman al ranking general (pero no cuenta como completada). |

---

## 4. Cómo se calculan los rankings

Datos agregados por el lobby desde `game_sessions` (partidas cerradas):

| Métrica | Ranking GENERAL | Ranking POR JUEGO |
|---------|-----------------|-------------------|
| **Posición** | `SUM(score)` de tus partidas (XP total) | `MAX(score)` (best score) en ese juego |
| **Partidas** | `COUNT(*)` | `COUNT(*)` por juego |
| **Completadas** | `COUNT(*) WHERE completed = true` | `COUNT(*) WHERE completed = true` |
| **Desempate** | Más partidas → mejor posición | — |

Las sesiones se cierran cuando: el juego manda `game_completed`, el jugador
sale del iframe, o expira el timeout. Las partidas que quedan **abiertas** no
cuentan (no hay `ended_at`).

---

## 5. Errores comunes (ya los vimos en la Sopa ❌→✅)

| ❌ Error | ✅ Correcto |
|---------|------------|
| `score: progress.xp` (XP acumulado histórico) | `score: Math.max(0, progress.xp - xpAlInicioDeLaPartida)` |
| No mandar `completed` | `completed: true` o `false` siempre |
| Mandar `score` como string o negativo | Número entero ≥ 0 |
| `sendGameCompleted` repetido en cada palabra | Una sola vez al terminar la partida |
| Usar `save_progress` con score para "sumar" | El ranking solo mira `game_completed` |

---

## 5b. Caso especial: Trivia — el ranking por juego es del modo competición

La Trivia tiene 3 modos: **Por Área**, **Mixto** (práctica, rondas de 10) y
**Competición** (llegar lo más lejos posible sin equivocarse). El ranking
**por juego** de la trivia (`/ranking`, pestaña por juego) se arma SOLO con
sesiones del modo competición — la migración 00031 filtra
`game_sessions.metadata->>'modo' = 'competencia'`.

Para que una partida cuente en ese ranking, el juego manda:

```ts
lobby.sendGameCompleted({
  score: distancia,          // preguntas seguidas sin fallar (la racha)
  itemId: 'competencia',
  difficulty: 'progresiva', // sube de fácil a experto cada 5 aciertos
  completed: false,         // la racha termina al fallar → no es "completada"
  metadata: { modo: 'competencia' },  // ← CLAVE: el lobby lo guarda en la sesión
})
```

- `metadata.modo` es obligatorio en competición: sin él, la sesión queda
  fuera del ranking por juego de la trivia.
- Las partidas de práctica (área/mixto) siguen sumando XP al ranking
  general, pero no compiten en el ranking de trivia.
- `score` es un entero ≥ 0 (la distancia). El resto de juegos no se ve
  afectado por el filtro.

---

## 6. Checklist para adaptar un juego (ej: Puzzle)

- [ ] Enviar `jh:game_started` al iniciar cada partida (con `difficulty` si existe)
- [ ] Calcular `scoreDeEstaPartida` = puntos ganados en la partida actual (no el acumulado)
- [ ] Enviar `jh:game_completed` **una vez** al terminar con:
  - [ ] `score` entero ≥ 0
  - [ ] `completed` booleano explícito
  - [ ] `timeSpent` en segundos
- [ ] No enviar `game_completed` al navegar/salir sin terminar (el lobby cierra solo como abandonada)
- [ ] Probar: jugar 1 partida → verificar que el ranking general suma el score y el por juego actualiza best score

---

## 7. Referencia rápida del SDK

```ts
import { createLobbyClient } from '@juegahiphop/sdk'

const lobby = createLobbyClient({ lobbyOrigin: 'http://localhost:3000' })

// 1. Al iniciar la partida
lobby.sendGameStarted({ difficulty: 'normal' })

// 2. (opcional) puntaje en vivo
lobby.sendScoreUpdated({ score: 50 })

// 3. Al terminar — UNA vez
lobby.sendGameCompleted({
  score: puntosDeEstaPartida,
  completed: true,
  timeSpent: segundosJugados,
})
```

> Los juegos tienen una copia local del SDK en `src/lib/sdk/` — mantenla
> sincronizada con `packages/juegahiphop-sdk/`.
