import { apiUrl } from './apiOrigin.js'

/**
 * Same-origin image URL. Resolves to a NASA SkyView DSS2 quicklook (JPEG) via `/api/skyview-image`.
 * The legacy direct `nph-pskcall` PNG endpoint returns 404; SkyView now serves cutouts through `runquery.pl`.
 *
 * @param {number} ra — right ascension in hours (0–24)
 * @param {number} dec — declination in degrees
 * @param {number} [sizeArcmin]
 */
export function getSkyViewImageUrl(ra, dec, sizeArcmin) {
  const q = new URLSearchParams({
    ra: String(Number(ra)),
    dec: String(Number(dec)),
    arcmin: String(Number(sizeArcmin) || 10),
  })
  return `${apiUrl('/api/skyview-image')}?${q.toString()}`
}

export function shouldShowImage(target) {
  const t = target?.type || ''
  const tags = Array.isArray(target?.tags) ? target.tags : []
  if (t === 'double_star') return false
  return !tags.includes('double_star')
}
