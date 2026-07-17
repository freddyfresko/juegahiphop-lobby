import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { validateGameUrl } from '@/lib/game-utils'
import { getDevGameOverride } from '@/lib/dev-override'
import { getPublicGameBySlug } from '@/lib/public-game-catalog'
import GameContainer from '@/components/GameContainer'
import type { GameCatalogEntry } from '@/lib/types'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function JugarSlugPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()

  // Verificar sesión (opcional — el juego funciona sin cuenta)
  const { data: { user } } = await supabase.auth.getUser()

  // Obtener datos del juego desde Supabase (todos los status, no solo activos)
  const { data: game, error } = await supabase
    .from('games')
    .select('*')
    .eq('slug', slug)
    .single()

  const fallbackGame = getPublicGameBySlug(slug)

  if ((error || !game) && !fallbackGame) {
    notFound()
  }

  const typedGame = (game ?? fallbackGame) as GameCatalogEntry

  // ─── Si el juego está en coming_soon → mostrar página de próximente ───
  if (typedGame.status === 'coming_soon') {
    return <ComingSoonPage game={typedGame} />
  }

  // ─── Si el juego está en maintenance → mostrar página de mantención ───
  if (typedGame.status === 'maintenance') {
    return <MaintenancePage game={typedGame} />
  }

  // ─── Si el juego está hidden → 404 ───
  if (typedGame.status === 'hidden') {
    notFound()
  }

  // ─── Dev override: reemplazar URL y origins en desarrollo ───
  const devOverride = getDevGameOverride(slug)
  const gameUrl = devOverride?.url ?? typedGame.external_url
  const allowedOrigins = devOverride
    ? [...typedGame.allowed_origins, ...devOverride.origins]
    : typedGame.allowed_origins

  // Validar URL del juego (acepta localhost en dev)
  const urlCheck = validateGameUrl(gameUrl)
  if (!urlCheck.valid) {
    return (
      <ErrorPage
        title="JUEGO NO DISPONIBLE"
        message={urlCheck.error ?? 'Error de configuración del juego'}
      />
    )
  }

  return (
    <GameContainer
      slug={slug}
      game={{ ...typedGame, allowed_origins: allowedOrigins }}
      validatedUrl={urlCheck.url}
      userId={user?.id ?? null}
    />
  )
}

/** Página de "Próximamente" para juegos no lanzados */
function ComingSoonPage({ game }: { game: GameCatalogEntry }) {
  return (
    <div className="vignette brick-bg flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <div className="relative z-10 max-w-md">
        {/* Cover image */}
        {game.image_url && (
          <div className="mx-auto mb-6 w-48 overflow-hidden rounded-2xl sm:w-56">
            <img src={game.image_url} alt={game.name} className="h-full w-full object-cover" />
          </div>
        )}

        <div className="inline-flex items-center gap-2 rounded-full bg-yellow-500/10 px-4 py-1.5 text-yellow-400">
          <span>🔥</span>
          <span className="text-xs font-bold uppercase tracking-wider">Próximamente</span>
        </div>

        <h1 className="font-archivo mt-4 text-3xl tracking-wide text-white sm:text-4xl">
          {game.name}
        </h1>

        <p className="mt-3 text-xs uppercase tracking-wider text-zinc-400">
          {game.short_description}
        </p>

        {game.release_date && (
          <p className="mt-4 text-sm text-yellow-400/80">
            Disponible{' '}
            {new Date(game.release_date).toLocaleDateString('es-CL', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}

        <Link
          href="/"
          className="mt-8 inline-block rounded-xl bg-yellow-400 px-6 py-3 text-sm font-bold text-black transition-colors hover:bg-yellow-300"
        >
          VOLVER AL LOBBY
        </Link>
      </div>
    </div>
  )
}

/** Página de "En Mantención" */
function MaintenancePage({ game }: { game: GameCatalogEntry }) {
  return (
    <div className="vignette brick-bg flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <div className="relative z-10 max-w-md">
        <div className="text-6xl mb-4">🔧</div>
        <div className="inline-flex items-center gap-2 rounded-full bg-zinc-500/10 px-4 py-1.5 text-zinc-400">
          <span className="text-xs font-bold uppercase tracking-wider">En Mantención</span>
        </div>

        <h1 className="font-archivo mt-4 text-3xl tracking-wide text-white sm:text-4xl">
          {game.name}
        </h1>

        <p className="mt-3 text-xs uppercase tracking-wider text-zinc-500">
          Este juego está en mantención. Vuelve pronto.
        </p>

        <Link
          href="/"
          className="mt-8 inline-block rounded-xl bg-yellow-400 px-6 py-3 text-sm font-bold text-black transition-colors hover:bg-yellow-300"
        >
          VOLVER AL LOBBY
        </Link>
      </div>
    </div>
  )
}

/** Página de error simple cuando el juego no puede cargarse */
function ErrorPage({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <div className="vignette brick-bg flex min-h-dvh flex-col">
      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="font-archivo text-2xl tracking-wide text-white">
          {title}
        </h1>
        <p className="mt-2 text-xs uppercase tracking-wider text-zinc-500">
          {message}
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-yellow-400 px-6 py-3 text-sm font-bold text-black transition-colors hover:bg-yellow-300"
        >
          VOLVER AL LOBBY
        </Link>
      </div>
    </div>
  )
}
