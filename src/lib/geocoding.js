/**
 * Reverse geocode via Nominatim (OpenStreetMap).
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{ displayName: string, raw: object }>}
 */
export async function reverseGeocode(lat, lng) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('zoom', '18')
  url.searchParams.set('addressdetails', '1')

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    throw new Error(`Geocoding failed (${res.status})`)
  }

  const raw = await res.json()
  if (raw.error) {
    throw new Error(raw.error)
  }

  const displayName =
    typeof raw.display_name === 'string' && raw.display_name.length > 0
      ? raw.display_name
      : formatShortAddress(raw.address)

  return { displayName, raw }
}

function formatShortAddress(addr) {
  if (!addr || typeof addr !== 'object') return 'Unknown place'
  const parts = [
    addr.village,
    addr.town,
    addr.city,
    addr.state,
    addr.country,
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : 'Unknown place'
}
