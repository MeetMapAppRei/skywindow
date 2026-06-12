/**
 * Rough Bortle estimate from lat/lng using Nominatim place context.
 * lightpollutionmap.info has no public CORS API for tiles; this uses
 * settlement type / population hints from OSM reverse geocoding.
 */
export async function estimateBortleFromCoordinates(lat, lng) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('zoom', '10')
  url.searchParams.set('addressdetails', '1')

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    throw new Error(`Could not estimate sky brightness (${res.status})`)
  }

  const data = await res.json()
  if (data.error) {
    throw new Error(data.error)
  }

  return estimateFromNominatim(data)
}

/**
 * @param {object} data Nominatim reverse JSON
 * @returns {number} Bortle 1–9
 */
function estimateFromNominatim(data) {
  const addr = data.address || {}
  const clas = data.class || ''
  const typ = data.type || ''
  const rank = typeof data.place_rank === 'number' ? data.place_rank : 30

  if (clas === 'natural' && (typ === 'peak' || typ === 'volcano')) {
    return clampBortle(2 + (rank > 25 ? 1 : 0))
  }

  if (typ === 'national_park' || typ === 'protected_area') {
    return 3
  }

  if (addr.marine || addr.ocean || addr.sea) {
    return 2
  }

  const pop = parseInt(String(addr.population || data.extratags?.population || '0'), 10)

  if (addr.city || addr.town || addr.municipality) {
    if (pop > 2_000_000) return 9
    if (pop > 500_000) return 8
    if (pop > 80_000) return 7
    if (pop > 15_000) return 6
    return rank >= 16 ? 7 : 6
  }

  if (addr.suburb || addr.neighbourhood || addr.quarter) {
    return pop > 200_000 ? 8 : 7
  }

  if (addr.village) {
    if (pop > 8_000) return 6
    if (pop > 2_000) return 5
    return 4
  }

  if (addr.hamlet || addr.isolated_dwelling || addr.farm) {
    return 4
  }

  if (addr.county || addr.state_district) {
    return 5
  }

  if (addr.state && !addr.city && !addr.town && !addr.village) {
    return 4
  }

  return 5
}

function clampBortle(n) {
  return Math.min(9, Math.max(1, Math.round(n)))
}
