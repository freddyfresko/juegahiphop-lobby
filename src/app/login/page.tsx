import AuthForm from '@/components/AuthForm'

interface LoginPageProps {
  searchParams: Promise<{ error?: string; error_description?: string; reason?: string; view?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const errorFromUrl = params.error
  const errorDescription = params.error_description
  const reason = params.reason
  const initialView = params.view

  // Mapa de errores conocidos
  const errorMessages: Record<string, { title: string; description: string }> = {
    AuthError: {
      title: 'Error de autenticación',
      description: 'No se pudo completar la autenticación. Intenta de nuevo.',
    },
    SessionError: {
      title: 'Error al iniciar sesión',
      description: 'No se pudo establecer la sesión. Intenta de nuevo.',
    },
    InvalidCredentials: {
      title: 'Datos incorrectos',
      description: 'El correo o contraseña no coinciden en Supabase.',
    },
    EmailNotConfirmed: {
      title: 'Correo no confirmado',
      description: 'Supabase exige confirmar el correo antes de iniciar sesión. Revisa tu bandeja de entrada.',
    },
    MissingCredentials: {
      title: 'Faltan datos',
      description: 'Ingresa correo y contraseña para continuar.',
    },
    ConfigurationError: {
      title: 'Error de configuración',
      description: 'Hay un problema con la configuración de la plataforma.',
    },
  }

  // Motivos de redirect (desde LobbyClient, middleware, etc.)
  const reasonMessages: Record<string, { title: string; description: string }> = {
    no_session: {
      title: 'Sesión no encontrada',
      description: 'No pudimos verificar tu sesión. Ingresa tu correo y contraseña para continuar.',
    },
    auth_required: {
      title: 'Inicia sesión primero',
      description: 'Necesitas iniciar sesión para acceder a esta sección.',
    },
  }

  const errorInfo = errorFromUrl ? errorMessages[errorFromUrl] : null
  const reasonInfo = reason ? reasonMessages[reason] : null

  return (
    <div className="vignette brick-bg graffiti-spray flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <svg className="mx-auto mb-3 h-8 w-8 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 19l2-12 4 3 4-5 4 5 4-3 2 12H2zM12 5l-3 4 3-1 3 1-3-4z"/>
          </svg>
          <h1 className="font-archivo text-3xl font-normal tracking-wide text-white sm:text-4xl">
            JUEGA <span className="text-yellow-400">HIP HOP</span>
          </h1>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
            Tu portal de juegos del hip hop
          </p>
        </div>

        {/* Error desde URL (callback falló, etc.) */}
        {errorInfo && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-400">
              {errorInfo.title}
            </p>
            <p className="mt-1 text-[10px] text-red-400/70">{errorInfo.description}</p>
            {errorDescription && (
              <p className="mt-1 text-[10px] text-red-400/50">Detalle: {errorDescription}</p>
            )}
          </div>
        )}

        {/* Razón de redirect (sesión no encontrada, etc.) */}
        {reasonInfo && !errorInfo && (
          <div className="mb-4 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-yellow-400">
              {reasonInfo.title}
            </p>
            <p className="mt-1 text-[10px] text-yellow-400/70">{reasonInfo.description}</p>
          </div>
        )}

        {/* Form */}
        <AuthForm initialView={initialView} />

        {/* Footer */}
        <p className="mt-10 text-center text-[10px] uppercase tracking-wider text-zinc-700">
          © 2025 Juega Hip Hop
        </p>
      </div>
    </div>
  )
}
