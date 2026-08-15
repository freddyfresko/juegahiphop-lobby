import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidad',
  description: 'Política de privacidad de Juega Hip Hop: qué datos recopilamos, cómo los usamos y tus derechos.',
  alternates: {
    canonical: '/privacidad',
  },
}

/**
 * Página de Política de Privacidad — requisito obligatorio para las redes
 * de publicidad (AdSense, AdinPlay, NitroPay) y para la normativa vigente.
 *
 * COMPLETAMENTE PÚBLICA — sin autenticación.
 */
export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        {/* ─── Header ─── */}
        <header className="mb-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">
            Juega Hip Hop
          </p>
          <h1 className="font-archivo mt-2 text-4xl tracking-wide text-white sm:text-5xl">
            POLÍTICA DE PRIVACIDAD
          </h1>
          <p className="mt-3 text-sm text-zinc-400">
            Última actualización: agosto 2026
          </p>
        </header>

        <div className="space-y-8 text-sm leading-relaxed text-zinc-300">
          {/* ─── 1. Introducción ─── */}
          <section>
            <h2 className="font-archivo mb-2 text-xl tracking-wide text-white">
              1. QUIÉNES SOMOS
            </h2>
            <p>
              Juega Hip Hop (en adelante, &ldquo;la plataforma&rdquo;) es una plataforma
              de juegos educativos con temática de hip hop disponible en{' '}
              <span className="text-yellow-400">juegahiphop.cl</span>. Al usar la
              plataforma aceptas los términos de esta política.
            </p>
          </section>

          {/* ─── 2. Datos que recopilamos ─── */}
          <section>
            <h2 className="font-archivo mb-2 text-xl tracking-wide text-white">
              2. QUÉ DATOS RECOPILAMOS
            </h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-white">Datos de cuenta:</strong> correo
                electrónico, nombre de usuario (display name) y avatar, cuando creas
                una cuenta.
              </li>
              <li>
                <strong className="text-white">Datos de progreso:</strong> puntajes,
                niveles completados, logros y sesiones de juego, para guardar tu
                avance.
              </li>
              <li>
                <strong className="text-white">Datos técnicos:</strong> tipo de
                dispositivo, navegador, idioma y dirección IP aproximada, para el
                funcionamiento técnico de la plataforma.
              </li>
              <li>
                <strong className="text-white">Datos de publicidad:</strong> cuando
                vemos publicidad de terceros, esos proveedores pueden recopilar datos
                según sus propias políticas (ver sección 5).
              </li>
            </ul>
            <p className="mt-3">
              Puedes jugar sin registrarte. Sin cuenta, tu progreso se guarda solo
              en tu dispositivo y se pierde al borrar los datos del navegador.
            </p>
          </section>

          {/* ─── 3. Uso de los datos ─── */}
          <section>
            <h2 className="font-archivo mb-2 text-xl tracking-wide text-white">
              3. PARA QUÉ USAMOS TUS DATOS
            </h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Guardar y sincronizar tu progreso y logros entre dispositivos.</li>
              <li>Mostrar rankings y estadísticas de la plataforma.</li>
              <li>Mejorar los juegos y corregir errores técnicos.</li>
              <li>
                Mostrar publicidad que financia la plataforma (con tu consentimiento
                cuando la ley lo exija).
              </li>
              <li>Responder solicitudes de soporte.</li>
            </ul>
          </section>

          {/* ─── 4. Almacenamiento y cookies ─── */}
          <section>
            <h2 className="font-archivo mb-2 text-xl tracking-wide text-white">
              4. ALMACENAMIENTO LOCAL Y COOKIES
            </h2>
            <p>
              Usamos almacenamiento local del navegador (localStorage) para recordar
              tu sesión, preferencias y progreso sin registro. También usamos cookies
              técnicas esenciales para el funcionamiento de la plataforma y la
              autenticación.
            </p>
            <p className="mt-3">
              Puedes bloquear o eliminar estas cookies desde la configuración de tu
              navegador, pero algunas funciones de la plataforma podrían dejar de
              funcionar correctamente.
            </p>
          </section>

          {/* ─── 5. Publicidad de terceros ─── */}
          <section>
            <h2 className="font-archivo mb-2 text-xl tracking-wide text-white">
              5. PUBLICIDAD DE TERCEROS
            </h2>
            <p>
              La plataforma se financia con publicidad. Trabajamos (o podemos
              trabajar) con proveedores de publicidad como{' '}
              <strong className="text-white">Google AdSense</strong>,{' '}
              <strong className="text-white">AdinPlay</strong> y{' '}
              <strong className="text-white">NitroPay</strong>. Estos proveedores
              pueden:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Usar cookies u otras tecnologías para mostrar anuncios relevantes y
                medir su rendimiento.
              </li>
              <li>
                Recopilar información sobre tus visitas a esta y otras webs para
                ofrecer publicidad personalizada, cuando nos hayas dado
                consentimiento.
              </li>
              <li>Servir anuncios contextuales no personalizados.</li>
            </ul>
            <p className="mt-3">
              Cada proveedor gestiona los datos bajo su propia política de privacidad:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>
                Google:{' '}
                <a
                  href="https://policies.google.com/technologies/partner-sites"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-400 underline underline-offset-2 hover:text-yellow-300"
                >
                  policies.google.com/technologies/partner-sites
                </a>
              </li>
              <li>
                AdinPlay / Venatus:{' '}
                <a
                  href="https://adinplay.com/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-400 underline underline-offset-2 hover:text-yellow-300"
                >
                  adinplay.com/privacy-policy
                </a>
              </li>
              <li>
                NitroPay / Overwolf:{' '}
                <a
                  href="https://nitropay.com/privacy-policy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-400 underline underline-offset-2 hover:text-yellow-300"
                >
                  nitropay.com/privacy-policy
                </a>
              </li>
            </ul>
            <p className="mt-3">
              Si estás en la Unión Europea o el Reino Unido, la publicidad
              personalizada solo se activará con tu consentimiento expreso.
            </p>
          </section>

          {/* ─── 6. Compartición de datos ─── */}
          <section>
            <h2 className="font-archivo mb-2 text-xl tracking-wide text-white">
              6. CON QUIÉN COMPARTIMOS TUS DATOS
            </h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-white">Proveedores de infraestructura:</strong>{' '}
                Supabase (base de datos y autenticación) y Firebase/Google Cloud
                (hosting). Tratan los datos bajo sus condiciones de servicio.
              </li>
              <li>
                <strong className="text-white">Proveedores de publicidad:</strong>{' '}
                solo en la medida descrita en la sección 5.
              </li>
              <li>
                <strong className="text-white">Autoridades:</strong> cuando la ley lo
                exija.
              </li>
            </ul>
            <p className="mt-3">
              No vendemos tus datos personales a terceros.
            </p>
          </section>

          {/* ─── 7. Seguridad ─── */}
          <section>
            <h2 className="font-archivo mb-2 text-xl tracking-wide text-white">
              7. SEGURIDAD DE TUS DATOS
            </h2>
            <p>
              Protegemos tus datos con cifrado en tránsito (HTTPS), contraseñas
              hasheadas y políticas de acceso restringido a la base de datos. Ningún
              sistema es 100% seguro, pero aplicamos medidas razonables de la
              industria para proteger tu información.
            </p>
          </section>

          {/* ─── 8. Tus derechos ─── */}
          <section>
            <h2 className="font-archivo mb-2 text-xl tracking-wide text-white">
              8. TUS DERECHOS
            </h2>
            <p>Según la legislación aplicable, puedes:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Acceder a tus datos personales.</li>
              <li>Corregir datos inexactos.</li>
              <li>Solicitar la eliminación de tu cuenta y tus datos.</li>
              <li>Retirar tu consentimiento para publicidad personalizada.</li>
              <li>Exportar tus datos de progreso.</li>
            </ul>
            <p className="mt-3">
              Para ejercer cualquiera de estos derechos, escríbenos al correo de
              contacto indicado en la sección 10.
            </p>
          </section>

          {/* ─── 9. Menores ─── */}
          <section>
            <h2 className="font-archivo mb-2 text-xl tracking-wide text-white">
              9. MENORES DE EDAD
            </h2>
            <p>
              La plataforma está dirigida a público general. Si tienes menos de 13
              años (o la edad mínima de consentimiento digital de tu país), pide a un
              padre, madre o tutor que revise esta política y cree la cuenta por ti.
            </p>
          </section>

          {/* ─── 10. Contacto ─── */}
          <section>
            <h2 className="font-archivo mb-2 text-xl tracking-wide text-white">
              10. CONTACTO
            </h2>
            <p>
              Ante cualquier duda sobre esta política o sobre tus datos, contáctanos
              a través del formulario de contacto de la plataforma o por correo a{' '}
              <a
                href="mailto:contacto@juegahiphop.cl"
                className="text-yellow-400 underline underline-offset-2 hover:text-yellow-300"
              >
                contacto@juegahiphop.cl
              </a>
              .
            </p>
          </section>

          {/* ─── 11. Cambios ─── */}
          <section>
            <h2 className="font-archivo mb-2 text-xl tracking-wide text-white">
              11. CAMBIOS A ESTA POLÍTICA
            </h2>
            <p>
              Podemos actualizar esta política periódicamente. Publicaremos cualquier
              cambio en esta página con la fecha de actualización al inicio. El uso
              continuado de la plataforma tras un cambio implica su aceptación.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
