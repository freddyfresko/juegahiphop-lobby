PROYECTO: JuegaHipHop Lobby / Hub
Descripción
Aplicación web que funciona como lobby central de la plataforma JuegaHipHop. Muestra los 3 juegos disponibles, el perfil del jugador con XP global y permite acceder a cada juego.

Tech Stack
Next.js 15 (App Router)
TypeScript 5+
Tailwind CSS 4
Supabase (mismo proyecto que los juegos)
Ubicación
E:\dev\JuegaHipHop\lobby

Diseño / Inspiración
App estilo mobile-first con temática hip hop. Fondo oscuro (#0F0F0F), acento amarillo neón (#FFC107), púrpura (#7C3AED), verde (#10B981). Fuentes: Archivo Black para títulos, Inter para cuerpo.

Similar a Apple Arcade o Google Play Pass — un grid de juegos con tarjetas.

Supabase
URL: foidlmqxshklejyxsymf.supabase.co
Anon Key: eyJhbG...tEhA
Auth: Supabase Auth (email + Google)
Tablas a usar:
auth.users (manejado por Supabase)
player_profiles (xp, level, current_streak, last_played_date)
game_state (para leer progreso por juego vía game_id)
Funcionalidades
Login / Registro

Pantalla de login con email + contraseña
Botón "Google" (opcional)
Si ya hay sesión activa, ir directo al lobby
Manejar sesión con cookies SSR (@supabase/ssr)
Lobby (pantalla principal)

Header con logo "JUEGA HIP HOP" + avatar del usuario
Tarjeta de perfil: nivel global, XP, racha 🔥
Grid de juegos (3 tarjetas):
Juego	Emoji	Descripción	Ruta
Sopa de Knowledge	🔤	Sopa de letras con 930 conceptos de hip hop	/juego/sopa
Hip Hop Puzzle	🧩	Rompecabezas con imágenes del hip hop	/juego/puzzle
Hip Hop Fighters	🥊	Beat 'em up 2D con personajes del hip hop	/juego/fighters
Cada tarjeta debe mostrar:

Nombre + emoji
Brief description
Progreso del jugador en ese juego (ej: "Palabras: 45/930" para sopa)
Botón "JUGAR"
Perfil

Página /perfil con estadísticas globales
XP total, nivel, racha, juegos completados
Logros acumulados desde achievement_unlocks
Botón cerrar sesión
Redirección a juegos

Cada tarjeta debe linkear al juego correspondiente
Los juegos son apps separadas, no rutas del mismo proyecto
Abrir en nueva pestaña o redirigir a:
sopa.juegahiphop.cl (futuro dominio)
puzzle.juegahiphop.cl
fighters.juegahiphop.cl
Por ahora, usar rutas /juego/sopa que expliquen que está en desarrollo
Componentes principales
src/ ├── app/ │ ├── layout.tsx # Layout con fuente, meta, Supabase listener │ ├── page.tsx # Lobby (login si no auth, grid si auth) │ ├── login/page.tsx # Página de login dedicada │ └── perfil/page.tsx # Perfil del jugador ├── components/ │ ├── AuthForm.tsx # Formulario login/registro │ ├── GameCard.tsx # Tarjeta de juego (nombre, desc, progreso, botón) │ ├── ProfileCard.tsx # Tarjeta de perfil (avatar, nivel, XP, racha) │ └── Header.tsx # Navbar con logo + avatar ├── lib/ │ ├── supabase/ │ │ ├── client.ts # Browser client │ │ └── server.ts # Server client (SSR cookies) │ └── types.ts # Tipos compartidos └── middleware.ts # Proteger rutas con auth

Consideraciones
Responsive: mobile-first (320px → 1440px)
Los 3 juegos ya existen en E:\dev\JuegaHipHop\ con su propio build
No mover los juegos — el lobby solo redirige a ellos
Usar Supabase SSR (@supabase/ssr) para manejo de sesión con cookies
El diseño debe verse profesional, nada infantil — estilo app store de juegos indie
