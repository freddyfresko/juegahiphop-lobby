import type { Banner } from '@/lib/types'

/**
 * Banners VIGENTES en la fecha dada, ordenados por sort_order.
 * start_at/end_at NULL = sin límite (vigente mientras active=true).
 */
export function getActiveBanners(banners: Banner[], now: Date = new Date()): Banner[] {
  const t = now.getTime()
  return banners
    .filter((b) => {
      if (!b.active) return false
      if (b.start_at && new Date(b.start_at).getTime() > t) return false
      if (b.end_at && new Date(b.end_at).getTime() < t) return false
      return true
    })
    .sort((a, b) => a.sort_order - b.sort_order)
}

/**
 * Convierte un ISO de la DB a valor para <input type="datetime-local">
 * (fecha/hora LOCAL del navegador, que es lo que espera el input).
 */
export function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Rango legible para badges del admin: '01/08 10:00 → 15/08 23:59'.
 * Devuelve null si no hay vigencia programada.
 */
export function formatScheduleRange(startAt: string | null, endAt: string | null): string | null {
  if (!startAt && !endAt) return null
  const fmt = (iso: string | null) => {
    if (!iso) return '∞'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '?'
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  return `${fmt(startAt)} → ${fmt(endAt)}`
}
