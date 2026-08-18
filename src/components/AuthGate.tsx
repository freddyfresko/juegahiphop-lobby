import Link from 'next/link'
import Logo from '@/components/Logo'
import type { GameCatalogEntry } from '@/lib/types'

interface AuthGateProps {
  game: GameCatalogEntry
  slug: string
}

/**
 * Gate de cuenta para /jugar/[slug]: sin sesión no se monta el juego.
 * Render server-side (SEO amigable — los crawlers ven la portada y el
 * texto) con CTA a /login?next=... para volver directo al juego tras
 * iniciar sesión (mínimo de taps).
 */
export default function AuthGate({ game, slug }: AuthGateProps) {
  const accentColor = game.accent_color ?? game.color ?? '#facc15'
  const nextPath = `/jugar/${slug}`

  return (
    <div className="vignette brick-bg graffiti-spray min-h-dvh">
      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 py-12 text-center">
        <div className="w-full max-w-md">
          {/* Portada del juego */}
          {game.image_url ? (
            <div className="mx-auto mb-6 w-44 overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/60 sm:w-52">
              <img
                src={`${game.image_url}?v=${new Date(game.updated_at).getTime()}`}
                alt={game.name}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div
              className="mx-auto mb-6 flex h-40 w-40 items-center justify-center rounded-2xl border border-white/10 sm:h-48 sm:w-48"
              style={{
                background: `radial-gradient(circle at 30% 20%, ${accentColor}33 0%, transparent 60%), linear-gradient(160deg, ${accentColor}26 0%, #0a0a0a 70%)`,
              }}
            >
              <span className="text-7xl">{game.emoji}</span>
            </div>
          )}

          <div className="inline-flex items-center gap-2 rounded-full bg-yellow-500/10 px-4 py-1.5 text-yellow-400">
            <span>🔒</span>
            <span className="text-xs font-bold uppercase tracking-wider">Cuenta requerida</span>
          </div>

          <h1 className="font-archivo mt-4 text-3xl tracking-wide text-white sm:text-4xl">
            {game.name}
          </h1>

          <p className="mt-3 text-xs uppercase tracking-wider text-zinc-400">
            {game.short_description}
          </p>

          <p className="mx-auto mt-5 max-w-sm text-[11px] uppercase tracking-wider text-zinc-500">
            Todos los juegos requieren una cuenta: guarda tu progreso, suma XP y desbloquea logros.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <Link
              href={`/login?next=${encodeURIComponent(nextPath)}`}
              className="flex min-h-12 items-center justify-center rounded-xl bg-yellow-400 px-6 text-sm font-bold text-black transition-colors hover:bg-yellow-300"
            >
              INICIAR SESIÓN
            </Link>
            <Link
              href={`/login?view=register&next=${encodeURIComponent(nextPath)}`}
              className="flex min-h-12 items-center justify-center rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-6 text-sm font-bold text-yellow-400 transition-colors hover:bg-yellow-400/20"
            >
              CREAR CUENTA GRATIS
            </Link>
          </div>

          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:text-zinc-300"
          >
            <span className="text-xs">←</span> VOLVER AL LOBBY
          </Link>
        </div>
      </div>
    </div>
  )
}
