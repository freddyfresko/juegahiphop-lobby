-- ============================================================
-- JuegaHipHop — Seed del catálogo con portadas locales
-- Migration 00013: registra/actualiza los juegos del catálogo
--
-- Las portadas viven en el lobby (public/covers/*.jpg) y se
-- sirven desde el mismo dominio → image_url usa ruta RELATIVA
-- ('/covers/sopa.jpg'), que se resuelve contra el origin actual
-- (localhost en dev, juegahiphop.cl en producción).
--
-- Idempotente: INSERT ... ON CONFLICT (slug) DO UPDATE.
-- Corre esto DESPUÉS de la 00012 (no tiene dependencias, pero
-- mantén el orden).
-- ============================================================

INSERT INTO games (
  slug, name, emoji, short_description, description,
  image_url, color, accent_color, status, featured, orientation,
  external_url, category, sort_order, total_items, progress_label,
  allowed_origins, version, protocol_version, progress_schema_version
)
VALUES
  (
    'sopa',
    'Sopa de Knowledge',
    '🔤',
    'Demuestra cuánto sabes de la cultura hip hop en cada ronda.',
    'Sopa de letras con 930 conceptos del hip hop. Encuentra palabras sobre rap, DJ, breakdance, graffiti y más.',
    '/covers/sopa.jpg',
    '#10B981', '#059669',
    'active', true, 'portrait',
    'https://sopa.juegahiphop.cl',
    'games', 1, 930, 'Palabras',
    ARRAY['https://sopa.juegahiphop.cl'],
    '1.0.0', '1.0.0', '1.0.0'
  ),
  (
    'puzzle',
    'Puzzle H2',
    '🧩',
    'Arma el puzzle, descubre leyendas del hip hop.',
    'Rompecabezas con imágenes icónicas del hip hop. Arma las piezas y aprende historia mientras juegas.',
    '/covers/puzzle.jpg',
    '#7C3AED', '#6D28D9',
    'active', true, 'landscape',
    'https://puzzle.juegahiphop.cl',
    'games', 2, NULL, 'Completados',
    ARRAY['https://puzzle.juegahiphop.cl'],
    '1.0.0', '1.0.0', '1.0.0'
  ),
  (
    'fighters',
    'Hip Hop Fighters',
    '🥊',
    'Enfrenta a los mejores en batallas épicas de hip hop.',
    'Beat ''em up 2D con personajes del hip hop. Pelea a través de escenarios icónicos y derrota a los bosses.',
    '/covers/fighters.jpg',
    '#EF4444', '#DC2626',
    'active', true, 'landscape',
    'https://fighters.juegahiphop.cl',
    'games', 3, NULL, 'Niveles',
    ARRAY['https://fighters.juegahiphop.cl'],
    '1.0.0', '1.0.0', '1.0.0'
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  emoji = EXCLUDED.emoji,
  short_description = EXCLUDED.short_description,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url,
  color = EXCLUDED.color,
  accent_color = EXCLUDED.accent_color,
  status = EXCLUDED.status,
  featured = EXCLUDED.featured,
  orientation = EXCLUDED.orientation,
  external_url = EXCLUDED.external_url,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  total_items = EXCLUDED.total_items,
  progress_label = EXCLUDED.progress_label,
  allowed_origins = EXCLUDED.allowed_origins,
  version = EXCLUDED.version,
  protocol_version = EXCLUDED.protocol_version,
  progress_schema_version = EXCLUDED.progress_schema_version,
  updated_at = NOW();

-- ============================================================
-- Verificación rápida
-- ============================================================
-- SELECT slug, name, status, featured, image_url, sort_order FROM games ORDER BY sort_order;
