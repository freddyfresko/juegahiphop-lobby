import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

/**
 * robots.txt — permite todo y apunta al sitemap.
 * Las páginas privadas (login/perfil/admin) se excluyen vía
 * metadata robots noindex (robots.txt no las lista).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
