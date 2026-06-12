/** Normalize degrees to 0–360. */
export function normalizeHeading(deg) {
  const n = Number(deg)
  if (!Number.isFinite(n)) return null
  return ((n % 360) + 360) % 360
}

/**
 * Compass heading from a DeviceOrientationEvent (degrees, 0 = North).
 * @param {DeviceOrientationEvent} e
 */
export function headingFromOrientationEvent(e) {
  if (
    typeof e.webkitCompassHeading === 'number' &&
    Number.isFinite(e.webkitCompassHeading) &&
    (e.webkitCompassAccuracy == null || e.webkitCompassAccuracy >= 0)
  ) {
    return normalizeHeading(e.webkitCompassHeading)
  }
  if (!Number.isFinite(e.alpha)) return null
  const screenAngle =
    typeof window !== 'undefined' && window.screen?.orientation?.angle != null
      ? window.screen.orientation.angle
      : typeof window.orientation === 'number'
        ? window.orientation
        : 0
  return normalizeHeading(360 - e.alpha + screenAngle)
}

const COMPASS_LABELS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
]

/** @param {number} deg */
export function headingToCompassLabel(deg) {
  const h = normalizeHeading(deg)
  if (h == null) return '—'
  const idx = Math.round(h / 22.5) % 16
  return COMPASS_LABELS[idx]
}

/** Shortest signed difference target − current (−180..180). */
export function headingDelta(current, target) {
  const a = normalizeHeading(current)
  const b = normalizeHeading(target)
  if (a == null || b == null) return null
  let d = b - a
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

export function isHeadingNear(current, target, toleranceDeg = 22.5) {
  const d = headingDelta(current, target)
  if (d == null) return false
  return Math.abs(d) <= toleranceDeg
}

/** @param {number} delta signed degrees */
export function turnHint(delta) {
  if (delta == null || !Number.isFinite(delta)) return null
  if (Math.abs(delta) <= 8) return 'Hold steady — you are lined up.'
  const deg = Math.round(Math.abs(delta))
  return delta > 0 ? `Turn right about ${deg}°` : `Turn left about ${deg}°`
}

export function needsCompassPermission() {
  if (typeof window === 'undefined') return false
  return (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function'
  )
}

/** Call from a click handler on iOS. */
export async function requestCompassPermission() {
  if (!needsCompassPermission()) return true
  try {
    const state = await DeviceOrientationEvent.requestPermission()
    return state === 'granted'
  } catch {
    return false
  }
}
