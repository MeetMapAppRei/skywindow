/**
 * Self-contained positional astronomy for SkyWindow (no external ephemeris libs).
 * Conventions: RA in hours (0–24), Dec in degrees (−90…90), lat/lng in degrees
 * (east longitude positive), azimuth 0° = north, 90° = east (astronomical).
 */

const DEG = Math.PI / 180
const RAD = 180 / Math.PI

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x))
}

/** Julian Date (UTC) for a JavaScript Date. */
export function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5
}

/**
 * Greenwich Mean Sidereal Time in degrees at instant `date` (UTC-based JD fraction).
 * IAU-style polynomial (Meeus / Vallado, ~1″ class for GMST).
 */
export function greenwichMeanSiderealTimeDegrees(jd) {
  const T = (jd - 2451545.0) / 36525.0
  const d = jd - 2451545.0
  let gmst =
    280.46061837 +
    360.98564736629 * d +
    0.000387933 * T * T -
    (T * T * T) / 38710000.0
  gmst %= 360
  if (gmst < 0) gmst += 360
  return gmst
}

/**
 * Local mean sidereal time in hours [0,24).
 * @param {Date} date
 * @param {number} longitude — degrees, east positive
 */
export function getSiderealTime(date, longitude) {
  const jd = julianDay(date)
  const lstDeg = greenwichMeanSiderealTimeDegrees(jd) + longitude
  const wrapped = ((lstDeg % 360) + 360) % 360
  return wrapped / 15.0
}

function precessJ2000Vector(raRad, decRad, T) {
  const zetaArcsec = 2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T
  const zArcsec = 2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T
  const thArcsec = 2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T
  const ζ = (zetaArcsec / 3600) * DEG
  const z = (zArcsec / 3600) * DEG
  const θ = (thArcsec / 3600) * DEG

  const cosζ = Math.cos(ζ)
  const sinζ = Math.sin(ζ)
  const cosθ = Math.cos(θ)
  const sinθ = Math.sin(θ)
  const cosz = Math.cos(z)
  const sinz = Math.sin(z)

  const x0 = Math.cos(decRad) * Math.cos(raRad)
  const y0 = Math.cos(decRad) * Math.sin(raRad)
  const z0 = Math.sin(decRad)

  const P11 = cosz * cosθ * cosζ - sinz * sinζ
  const P12 = -cosz * cosθ * sinζ - sinz * cosζ
  const P13 = -cosz * sinθ
  const P21 = sinz * cosθ * cosζ + cosz * sinζ
  const P22 = -sinz * cosθ * sinζ + cosz * cosζ
  const P23 = -sinz * sinθ
  const P31 = sinθ * cosζ
  const P32 = -sinθ * sinζ
  const P33 = cosθ

  const x = P11 * x0 + P12 * y0 + P13 * z0
  const y = P21 * x0 + P22 * y0 + P23 * z0
  const zf = P31 * x0 + P32 * y0 + P33 * z0

  const raOut = Math.atan2(y, x)
  const decOut = Math.asin(clamp(zf, -1, 1))
  return { raRad: raOut, decRad: decOut }
}

const ECLIPTIC_OBLIQUITY_J2000 = 23.4392911 * DEG

function eclipticToEquatorial(lonRad, latRad) {
  const sinL = Math.sin(lonRad)
  const cosL = Math.cos(lonRad)
  const sinB = Math.sin(latRad)
  const cosB = Math.cos(latRad)
  const tanB = Math.tan(latRad)
  const sinE = Math.sin(ECLIPTIC_OBLIQUITY_J2000)
  const cosE = Math.cos(ECLIPTIC_OBLIQUITY_J2000)
  const ra = Math.atan2(sinL * cosE - tanB * sinE, cosL)
  const dec = Math.asin(clamp(sinB * cosE + cosB * sinE * sinL, -1, 1))
  return { raRad: ra, decRad: dec }
}

function sunEclipticLonRad(jd) {
  const d = jd - 2451545.0
  const g = (357.529 + 0.98560028 * d) * DEG
  const q = (280.459 + 0.98564736 * d) * DEG
  return q + (1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG
}

function moonEclipticCoordsRad(jd) {
  const d = jd - 2451545.0
  const L = (218.316 + 13.176396 * d) * DEG
  const M = (134.963 + 13.064993 * d) * DEG
  const F = (93.272 + 13.22935 * d) * DEG
  return {
    lonRad: L + (6.289 * Math.sin(M)) * DEG,
    latRad: (5.128 * Math.sin(F)) * DEG,
  }
}

/** Low-precision geocentric Moon (ecliptic longitude/latitude) → RA/Dec, radians. */
function moonRaDecRad(jd) {
  const { lonRad, latRad } = moonEclipticCoordsRad(jd)
  return eclipticToEquatorial(lonRad, latRad)
}

/** Low-precision geocentric Sun → RA/Dec, radians. */
function sunRaDecRad(jd) {
  return eclipticToEquatorial(sunEclipticLonRad(jd), 0)
}

/** Sun altitude in degrees at a local instant (positive = above horizon). */
export function getSunAltitude(lat, lng, date) {
  const jd = julianDay(date)
  const sun = sunRaDecRad(jd)
  const raHours = (sun.raRad / (2 * Math.PI)) * 24
  const decDeg = sun.decRad * RAD
  return raDecToAltAz(raHours, decDeg, lat, lng, date).altitude
}

/** True when the sky is astronomically dark (Sun at or below −18°). */
export function isAstronomicalDark(lat, lng, date) {
  return getSunAltitude(lat, lng, date) <= -18
}

/**
 * J2000 RA/Dec → altitude & azimuth (degrees) at location and instant.
 * @param {number} ra — hours
 * @param {number} dec — degrees
 * @param {number} lat — degrees
 * @param {number} lng — degrees east
 * @param {Date} date
 */
export function raDecToAltAz(ra, dec, lat, lng, date) {
  const jd = julianDay(date)
  const T = (jd - 2451545.0) / 36525.0
  const raRad = (ra / 24) * (2 * Math.PI)
  const decRad = dec * DEG
  const { raRad: raDate, decRad: decDate } = precessJ2000Vector(raRad, decRad, T)

  const lstDeg = greenwichMeanSiderealTimeDegrees(jd) + lng
  const lstRad = (((lstDeg % 360) + 360) % 360) * DEG
  const haRad = lstRad - raDate

  const latRad = lat * DEG
  const sinAlt =
    Math.sin(latRad) * Math.sin(decDate) +
    Math.cos(latRad) * Math.cos(decDate) * Math.cos(haRad)
  const altRad = Math.asin(clamp(sinAlt, -1, 1))

  const y = -Math.sin(haRad) * Math.cos(decDate)
  const x = Math.cos(haRad) * Math.cos(decDate) * Math.sin(latRad) - Math.sin(decDate) * Math.cos(latRad)
  let azRad = Math.atan2(y, x)
  let azDeg = azRad * RAD
  if (azDeg < 0) azDeg += 360

  return {
    altitude: altRad * RAD,
    azimuth: azDeg,
  }
}

const PHASE_NAMES = [
  'New Moon',
  'Waxing Crescent',
  'First Quarter',
  'Waxing Gibbous',
  'Full Moon',
  'Waning Gibbous',
  'Last Quarter',
  'Waning Crescent',
]

/**
 * @returns {{ phase: number, name: string, illumination: number }}
 * phase 0 = new, 0.25 first quarter, 0.5 full, etc. (aligned with common UI wheels)
 */
export function getMoonPhase(date) {
  const jd = julianDay(date)
  let diff = moonEclipticCoordsRad(jd).lonRad - sunEclipticLonRad(jd)
  while (diff < 0) diff += 2 * Math.PI
  while (diff >= 2 * Math.PI) diff -= 2 * Math.PI

  const phase = diff / (2 * Math.PI)
  const elongation = diff <= Math.PI ? diff : 2 * Math.PI - diff
  const illumination = Math.round(((1 - Math.cos(elongation)) / 2) * 1000) / 10

  const idx = Math.round(phase * 8) % 8
  const name = PHASE_NAMES[idx]

  return { phase, name, illumination }
}

/** Interpolated terrain/obstruction altitude (degrees) at compass azimuth from a saved horizon profile. */
export function getHorizonAltitudeAtAzimuth(horizonData, azDeg) {
  if (!horizonData) return 0
  const pts = Array.isArray(horizonData) ? horizonData : horizonData.points
  if (!pts || pts.length === 0) return 0

  const sorted = [...pts].sort((a, b) => a.azimuth - b.azimuth)
  const az = ((azDeg % 360) + 360) % 360

  const get = (p) => {
    const alt = p.altitude ?? p.alt ?? p.h ?? 0
    const azi = p.azimuth ?? p.az ?? p.bearing ?? 0
    return { azimuth: ((azi % 360) + 360) % 360, altitude: Number(alt) || 0 }
  }

  const p0 = sorted.map(get)
  const interp = (a1, h1, a2, h2, a) => {
    let da = a2 - a1
    if (da > 180) da -= 360
    if (da < -180) da += 360
    let daq = a - a1
    if (daq > 180) daq -= 360
    if (daq < -180) daq += 360
    if (Math.abs(da) < 1e-9) return h1
    const t = daq / da
    return h1 + t * (h2 - h1)
  }

  for (let i = 0; i < p0.length; i++) {
    const j = (i + 1) % p0.length
    const A1 = p0[i].azimuth
    const H1 = p0[i].altitude
    const A2 = p0[j].azimuth
    const H2 = p0[j].altitude
    let a1 = A1
    let a2 = A2
    let aa = az
    if (j === 0 && A2 < A1) {
      if (az >= A1) {
        return interp(A1, H1, A2 + 360, H2, az)
      }
      if (az <= A2) {
        return interp(A1 - 360, H1, A2, H2, az)
      }
    } else {
      if (a2 < a1) a2 += 360
      if (aa < a1) aa += 360
      if (aa >= a1 && aa <= a2) return interp(a1, H1, a2, H2, aa)
    }
  }
  return p0[0].altitude
}

function enumerateNightSamples(date, lat, lng) {
  const y = date.getFullYear()
  const m = date.getMonth()
  const d = date.getDate()
  const start = new Date(y, m, d, 18, 0, 0, 0)
  const end = new Date(y, m, d + 1, 6, 0, 0, 0)
  const stepMs = 20 * 60 * 1000
  const out = []
  for (let t = start.getTime(); t <= end.getTime(); t += stepMs) {
    const instant = new Date(t)
    if (Number.isFinite(lat) && Number.isFinite(lng) && !isAstronomicalDark(lat, lng, instant)) continue
    out.push(instant)
  }
  return out
}

function formatHm(d) {
  const h = d.getHours()
  const mi = d.getMinutes()
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
}

/** 24h "HH:MM" → "h:mm AM/PM" for UI labels. */
export function formatHm12h(hm) {
  if (!hm || hm === '—') return '—'
  const m = String(hm).trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return hm
  const h = parseInt(m[1], 10)
  const mi = parseInt(m[2], 10)
  if (!Number.isFinite(h) || !Number.isFinite(mi)) return hm
  const ampm = h >= 12 ? 'PM' : 'AM'
  let hr = h % 12
  if (hr === 0) hr = 12
  return `${hr}:${String(mi).padStart(2, '0')} ${ampm}`
}

/**
 * Parse 24h "HH:MM" on a local observing night into a Date.
 * Evening hours (noon–midnight) use `nightDate`'s calendar day; morning hours use the next day.
 */
export function parseNightHmIntoDate(hm, nightDate) {
  if (!hm || hm === '—' || !(nightDate instanceof Date) || Number.isNaN(nightDate.getTime())) return null
  const m = String(hm).trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const mi = parseInt(m[2], 10)
  if (!Number.isFinite(h) || !Number.isFinite(mi) || h < 0 || h > 23 || mi < 0 || mi > 59) return null
  const y = nightDate.getFullYear()
  const mo = nightDate.getMonth()
  const d = nightDate.getDate()
  if (h < 12) return new Date(y, mo, d + 1, h, mi, 0, 0)
  return new Date(y, mo, d, h, mi, 0, 0)
}

/**
 * @param {object} target — expects `ra` (hours), `dec` (degrees) J2000
 * @param {object|null} horizonData — `{ points: [{ azimuth, altitude }] }` or array of same
 * @param {number} lat
 * @param {number} lng
 * @param {Date} date — calendar night in local timezone (same TZ as enumerateNightSamples)
 * @param {number} minAltitude — degrees above *both* mathematical horizon profile and this minimum
 */
export function isTargetVisible(target, horizonData, lat, lng, date, minAltitude) {
  const minAlt = Number.isFinite(minAltitude) ? minAltitude : 20
  let maxAlt = -90
  let bestTime = '—'
  let azimuthAtBest = 0
  let visible = false
  let clearsMinAlt = false

  const pts = horizonData ? (Array.isArray(horizonData) ? horizonData : horizonData.points) : null
  const hasHorizon = Array.isArray(pts) && pts.length > 0
  let bestHorizonDiff = -1e9
  let bestHorizonInstant = null
  let bestHorizonAzimuth = 0
  let bestHorizonTerrain = 0

  for (const instant of enumerateNightSamples(date, lat, lng)) {
    const { altitude, azimuth } = raDecToAltAz(target.ra, target.dec, lat, lng, instant)
    const terrain = getHorizonAltitudeAtAzimuth(horizonData, azimuth)
    const need = Math.max(terrain, minAlt)
    if (altitude >= minAlt) clearsMinAlt = true
    if (altitude >= need) {
      visible = true
      if (altitude > maxAlt) {
        maxAlt = altitude
        bestTime = formatHm(instant)
        azimuthAtBest = azimuth
      }
    }
    if (hasHorizon) {
      const diff = altitude - terrain
      if (diff > bestHorizonDiff) {
        bestHorizonDiff = diff
        bestHorizonInstant = instant
        bestHorizonAzimuth = azimuth
        bestHorizonTerrain = terrain
      }
    }
  }

  const blockedByHorizon =
    !visible &&
    hasHorizon &&
    clearsMinAlt &&
    Number.isFinite(bestHorizonDiff) &&
    bestHorizonDiff < 0 &&
    bestHorizonInstant != null &&
    bestHorizonTerrain > minAlt

  return {
    visible,
    maxAlt,
    bestTime,
    azimuthAtBest,
    blockedByHorizon,
    horizonBlock: blockedByHorizon
      ? {
          time: bestHorizonInstant,
          azimuth: bestHorizonAzimuth,
          requiredAltitude: bestHorizonTerrain,
          diff: bestHorizonDiff,
        }
      : null,
  }
}

/**
 * Rough limiting magnitudes for planning (zenith, experienced observer, clear air).
 * @param {number} bortleZone — 1 (excellent) … 9 (inner city)
 * @param {number} apertureMm
 * @returns {{ visual: number, imaging: number }}
 */
export function getObjectMagnitudeLimit(bortleZone, apertureMm) {
  const b = clamp(Number(bortleZone) || 5, 1, 9)
  const D = Math.max(1, Number(apertureMm) || 100)
  const log = Math.log10(D)
  const skyPenalty = (b - 1) * 0.55
  const visual = clamp(3.7 + 5 * log - skyPenalty, -1, 16)
  const imaging = clamp(visual + 3.2 + 0.15 * (b <= 4 ? 1 : 0), -1, 20)
  return { visual, imaging }
}

/** Angular separation in degrees (spherical), RA in hours, Dec in degrees. */
export function angularSeparationDeg(ra1, dec1, ra2, dec2) {
  const a1 = (ra1 / 24) * 2 * Math.PI
  const d1 = dec1 * DEG
  const a2 = (ra2 / 24) * 2 * Math.PI
  const d2 = dec2 * DEG
  const cosD =
    Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(a1 - a2)
  return Math.acos(clamp(cosD, -1, 1)) * RAD
}

export function getMoonRaDecJ2000Rough(date) {
  const jd = julianDay(date)
  const moon = moonRaDecRad(jd)
  return { ra: (moon.raRad / (2 * Math.PI)) * 24, dec: moon.decRad * RAD }
}

/**
 * Minutes after local 6pm on `date` when the target first clears max(terrain, minAltitude).
 * Used for sorting by rise time; large value if never visible in the night window.
 */
export function getTargetRiseMinutesFromNightStart(target, horizonData, lat, lng, date, minAltitude = 20) {
  const minAlt = Number.isFinite(minAltitude) ? minAltitude : 20
  const y = date.getFullYear()
  const m = date.getMonth()
  const d = date.getDate()
  const start = new Date(y, m, d, 18, 0, 0, 0)
  const end = new Date(y, m, d + 1, 6, 0, 0, 0)
  const stepMs = 20 * 60 * 1000
  for (let t = start.getTime(); t <= end.getTime(); t += stepMs) {
    const instant = new Date(t)
    if (!isAstronomicalDark(lat, lng, instant)) continue
    const { altitude, azimuth } = raDecToAltAz(target.ra, target.dec, lat, lng, instant)
    const terrain = getHorizonAltitudeAtAzimuth(horizonData, azimuth)
    const need = Math.max(terrain, minAlt)
    if (altitude >= need) {
      return Math.round((t - start.getTime()) / 60000)
    }
  }
  return 24 * 60
}
