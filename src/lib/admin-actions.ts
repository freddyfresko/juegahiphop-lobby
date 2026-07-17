'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { GameCatalogEntry } from '@/lib/types'

/**
 * Verifica que el usuario autenticado sea admin.
 * Lanza error si no.
 */
async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) throw new Error('No autorizado')

  // Usar función RPC is_admin() que bypassea RLS con SECURITY DEFINER
  const { data: isAdmin, error } = await supabase.rpc('is_admin')

  if (error || !isAdmin) throw new Error('No tienes permisos de administrador')
}

/**
 * Crea un nuevo juego en el catálogo.
 */
export async function createGame(formData: FormData) {
  await assertAdmin()

  const supabase = await createClient()

  const slug = formData.get('slug') as string
  const name = formData.get('name') as string

  if (!slug || !name) {
    throw new Error('slug y name son requeridos')
  }

  const game = {
    slug,
    name,
    emoji: (formData.get('emoji') as string) || '🎮',
    short_description: (formData.get('short_description') as string) || '',
    description: (formData.get('description') as string) || null,
    image_url: (formData.get('image_url') as string) || null,
    color: (formData.get('color') as string) || '#7C3AED',
    accent_color: (formData.get('accent_color') as string) || '#6D28D9',
    status: (formData.get('status') as GameCatalogEntry['status']) || 'coming_soon',
    featured: formData.get('featured') === 'on',
    orientation: (formData.get('orientation') as string) || 'landscape',
    external_url: (formData.get('external_url') as string) || '',
    category: (formData.get('category') as string) || 'games',
    sort_order: parseInt(formData.get('sort_order') as string) || 0,
    total_items: formData.get('total_items')
      ? parseInt(formData.get('total_items') as string)
      : null,
    progress_label: (formData.get('progress_label') as string) || null,
    allowed_origins: formData.get('allowed_origins')
      ? (formData.get('allowed_origins') as string).split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    release_date: formData.get('release_date')
      ? new Date(formData.get('release_date') as string).toISOString()
      : null,
  }

  const { error } = await supabase.from('games').insert(game)

  if (error) throw new Error(`Error al crear el juego: ${error.message}`)

  revalidatePath('/admin')
  revalidatePath('/')
  redirect('/admin')
}

/**
 * Actualiza un juego existente.
 */
export async function updateGame(slug: string, formData: FormData) {
  await assertAdmin()

  const supabase = await createClient()

  const updates: Record<string, unknown> = {
    name: formData.get('name') as string,
    emoji: (formData.get('emoji') as string) || '🎮',
    short_description: (formData.get('short_description') as string) || '',
    description: (formData.get('description') as string) || null,
    image_url: (formData.get('image_url') as string) || null,
    color: (formData.get('color') as string) || '#7C3AED',
    accent_color: (formData.get('accent_color') as string) || '#6D28D9',
    status: (formData.get('status') as GameCatalogEntry['status']) || 'hidden',
    featured: formData.get('featured') === 'on',
    orientation: (formData.get('orientation') as string) || 'landscape',
    external_url: (formData.get('external_url') as string) || '',
    category: (formData.get('category') as string) || 'games',
    sort_order: parseInt(formData.get('sort_order') as string) || 0,
    total_items: formData.get('total_items')
      ? parseInt(formData.get('total_items') as string)
      : null,
    progress_label: (formData.get('progress_label') as string) || null,
    allowed_origins: formData.get('allowed_origins')
      ? (formData.get('allowed_origins') as string).split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    release_date: formData.get('release_date')
      ? new Date(formData.get('release_date') as string).toISOString()
      : null,
  }

  // Si cambia el slug, actualizar también
  const newSlug = formData.get('slug') as string
  if (newSlug && newSlug !== slug) {
    updates.slug = newSlug
  }

  const { error } = await supabase.from('games').update(updates).eq('slug', slug)

  if (error) throw new Error(`Error al actualizar el juego: ${error.message}`)

  revalidatePath('/admin')
  revalidatePath('/')
  revalidatePath(`/admin/games/${newSlug || slug}`)
  redirect('/admin')
}

/**
 * Cambia el estado de un juego rápidamente (toggle).
 */
export async function setGameStatus(slug: string, status: GameCatalogEntry['status']) {
  await assertAdmin()

  const supabase = await createClient()
  const { error } = await supabase.from('games').update({ status }).eq('slug', slug)

  if (error) throw new Error(`Error al cambiar estado: ${error.message}`)

  revalidatePath('/admin')
  revalidatePath('/')
}

/**
 * Elimina un juego del catálogo.
 */
export async function deleteGame(slug: string) {
  await assertAdmin()

  const supabase = await createClient()
  const { error } = await supabase.from('games').delete().eq('slug', slug)

  if (error) throw new Error(`Error al eliminar el juego: ${error.message}`)

  revalidatePath('/admin')
  revalidatePath('/')
  redirect('/admin')
}

/**
 * Reordena los juegos (batch update sort_order).
 */
export async function reorderGames(orderedSlugs: string[]) {
  await assertAdmin()
  const supabase = await createClient()
  for (let i = 0; i < orderedSlugs.length; i++) {
    const { error } = await supabase
      .from('games')
      .update({ sort_order: (i + 1) * 10 })
      .eq('slug', orderedSlugs[i])
    if (error) throw new Error(`Error al reordenar: ${error.message}`)
  }
  revalidatePath('/admin')
  revalidatePath('/')
}

/**
 * Guarda la URL de la portada tras subir a Storage.
 */
export async function saveGameImage(slug: string, imageUrl: string) {
  await assertAdmin()
  const supabase = await createClient()
  const { error } = await supabase
    .from('games')
    .update({ image_url: imageUrl })
    .eq('slug', slug)
  if (error) throw new Error(`Error al guardar imagen: ${error.message}`)
  revalidatePath('/admin')
  revalidatePath('/')
  revalidatePath(`/admin/games/${slug}`)
}

// ═══════════════════════════════════════════════
// Banners CRUD
// ═══════════════════════════════════════════════

export interface BannerInput {
  title?: string
  subtitle?: string | null
  description?: string | null
  image_url?: string | null
  link_url?: string | null
  link_label?: string
  overlay_opacity?: number
  text_color?: string
  accent_color?: string
  sort_order?: number
  active?: boolean
}

/**
 * Crea un nuevo banner.
 */
export async function createBanner(data: BannerInput) {
  await assertAdmin()

  const supabase = await createClient()
  const { error } = await supabase.from('banners').insert({
    title: data.title || 'Nuevo Banner',
    subtitle: data.subtitle || null,
    description: data.description || null,
    image_url: data.image_url || null,
    link_url: data.link_url || null,
    link_label: data.link_label || 'JUGAR AHORA',
    overlay_opacity: data.overlay_opacity ?? 0.4,
    text_color: data.text_color || '#ffffff',
    accent_color: data.accent_color || '#facc15',
    sort_order: data.sort_order ?? 0,
    active: data.active ?? true,
  })

  if (error) throw new Error(`Error al crear banner: ${error.message}`)
  revalidatePath('/admin')
  revalidatePath('/')
}

/**
 * Actualiza un banner existente.
 */
export async function updateBanner(id: string, data: BannerInput) {
  await assertAdmin()

  const supabase = await createClient()
  const { error } = await supabase.from('banners').update(data).eq('id', id)

  if (error) throw new Error(`Error al actualizar banner: ${error.message}`)
  revalidatePath('/admin')
  revalidatePath('/')
}

/**
 * Activa/desactiva un banner.
 */
export async function toggleBanner(id: string, active: boolean) {
  await assertAdmin()

  const supabase = await createClient()
  const { error } = await supabase.from('banners').update({ active }).eq('id', id)

  if (error) throw new Error(`Error al cambiar estado: ${error.message}`)
  revalidatePath('/admin')
  revalidatePath('/')
}

/**
 * Elimina un banner.
 */
export async function deleteBanner(id: string) {
  await assertAdmin()

  const supabase = await createClient()
  const { error } = await supabase.from('banners').delete().eq('id', id)

  if (error) throw new Error(`Error al eliminar banner: ${error.message}`)
  revalidatePath('/admin')
  revalidatePath('/')
}

/**
 * Reordena banners.
 */
export async function reorderBanners(orderedIds: string[]) {
  await assertAdmin()
  const supabase = await createClient()
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('banners')
      .update({ sort_order: (i + 1) * 10 })
      .eq('id', orderedIds[i])
    if (error) throw new Error(`Error al reordenar: ${error.message}`)
  }
  revalidatePath('/admin')
  revalidatePath('/')
}
