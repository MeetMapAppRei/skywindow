import { TARGETS } from '../data/targets.js'
import {
  angularSeparationDeg,
  getMoonPhase,
  getMoonRaDecJ2000Rough,
  getHorizonAltitudeAtAzimuth,
  getObjectMagnitudeLimit,
  isTargetVisible,
  raDecToAltAz,
} from './astronomy.js'

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

function formatTime12h(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—'
  try {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  } catch {
    const h = date.getHours()
    const mi = date.getMinutes()
    const ampm = h >= 12 ? 'PM' : 'AM'
    let hr = h % 12
    if (hr === 0) hr = 12
    return `${hr}:${String(mi).padStart(2, '0')} ${ampm}`
  }
}

function moonProximityFactor(sepDeg) {
  return clamp(sepDeg / 180, 0.12, 1)
}

function enumerateWindowSamples(sessionStart, sessionEnd) {
  const start = sessionStart instanceof Date ? sessionStart : null
  const end = sessionEnd instanceof Date ? sessionEnd : null
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return []
  if (end.getTime() <= start.getTime()) return []
  const stepMs = 10 * 60 * 1000
  const out = []
  for (let t = start.getTime(); t <= end.getTime(); t += stepMs) out.push(new Date(t))
  if (out.length === 0 || out[out.length - 1].getTime() !== end.getTime()) out.push(new Date(end))
  return out
}

function windowVisibility(target, horizonData, lat, lng, sessionStart, sessionEnd, minAltitude = 20) {
  const minAlt = Number.isFinite(minAltitude) ? minAltitude : 20
  const instants = enumerateWindowSamples(sessionStart, sessionEnd)
  if (instants.length === 0) {
    return {
      hasAnyClear: false,
      windowBestTime: '—',
      windowMaxAlt: -90,
      windowCoverage: 0,
    }
  }

  let hasAnyClear = false
  let bestAlt = -90
  let bestInstant = null

  let samplesUsable = 0
  let totalSamples = 0

  for (const instant of instants) {
    const { altitude, azimuth } = raDecToAltAz(target.ra, target.dec, lat, lng, instant)
    const terrain = getHorizonAltitudeAtAzimuth(horizonData, azimuth)
    const needUsable = Math.max(terrain, minAlt)
    totalSamples += 1
    if (altitude >= needUsable) {
      hasAnyClear = true
      samplesUsable += 1
      if (altitude > bestAlt) {
        bestAlt = altitude
        bestInstant = instant
      }
    }
  }

  const windowCoverage =
    totalSamples > 0 ? Math.round(clamp((samplesUsable / totalSamples) * 100, 0, 100) * 10) / 10 : 0

  return {
    hasAnyClear,
    windowBestTime: bestInstant ? formatTime12h(bestInstant) : '—',
    windowMaxAlt: Math.round(bestAlt * 10) / 10,
    windowCoverage,
  }
}

/**
 * Per-target observing quality from clouds, moon brightness, and separation from Moon.
 * @param {number} avgCloud — 0…100 (tonight average); missing weather → 0
 * @param {number} illumination — 0…100
 * @param {number} sepDeg — angular separation target–Moon
 * @param {{ tonight: { isObservable: boolean } } | null | undefined} weather
 */
export function computeTargetConditionScore(avgCloud, illumination, sepDeg, weather) {
  const cloud = clamp(Number(avgCloud) || 0, 0, 100)
  const illum = clamp(Number(illumination) || 0, 0, 100)
  const cloudClear = clamp(1 - (cloud / 100) * 0.88, 0.18, 1)
  const moonDark = clamp(1 - (illum / 100) * 0.92, 0.2, 1)
  const prox = moonProximityFactor(sepDeg)
  let raw = 100 * cloudClear * moonDark * prox
  if (weather && !weather.tonight.isObservable) raw *= 0.7
  return Math.round(clamp(raw, 0, 100) * 10) / 10
}

function seasonFromDate(date) {
  const month = date.getMonth()
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'autumn'
  return 'winter'
}

function effectiveMagnitude(target) {
  let m = Number(target.magnitude) || 99
  const tags = target.tags || []
  const large = (Number(target.size_arcmin) || 0) > 25
  if (tags.includes('emission_nebula') || (tags.includes('nebula') && large)) m += 1.1
  if (tags.includes('galaxy') && large) m += 0.9
  if (target.type === 'galaxy' && large) m += 0.35
  return m
}

function formatArcminForReason(arcmin) {
  const x = Number(arcmin)
  if (!Number.isFinite(x) || x <= 0) return null
  const rounded = x < 10 ? Math.round(x * 10) / 10 : Math.round(x)
  const s = Number.isInteger(rounded) ? String(rounded) : String(rounded)
  return `${s}′`
}

function gearPhrases(equipmentName, apMm) {
  const name = typeof equipmentName === 'string' ? equipmentName.trim() : ''
  const ap = Number(apMm)
  const hasAp = Number.isFinite(ap) && ap > 0
  if (name) return { yourGear: `your ${name}`, faintGear: `your ${name}` }
  if (hasAp) {
    const mm = `${Math.round(ap)}mm`
    return { yourGear: `your ${mm} aperture`, faintGear: `${mm} aperture` }
  }
  return { yourGear: 'your setup', faintGear: 'your gear' }
}

/**
 * Difficulty rating for a target given aperture and sky darkness.
 * @param {object} target
 * @param {number} apertureMm
 * @param {number} bortleZone — 1…9
 * @param {{ equipmentName?: string, focalLengthMm?: number } | null | undefined} [options]
 * @returns {{ label: 'Easy'|'Stretch'|'Skip', color: '#4ade80'|'#facc15'|'#f87171', reason: string }}
 */
export function getDifficultyRating(target, apertureMm, bortleZone, options) {
  const opt = options && typeof options === 'object' ? options : {}
  const equipmentName = opt.equipmentName
  const focalLen = Number(opt.focalLengthMm)

  const ap = Number(apertureMm)
  const bIn = Number(bortleZone)
  const b = Math.min(9, Math.max(1, Number.isFinite(bIn) ? bIn : 5))

  const limitMag = Number.isFinite(ap) && ap > 0 ? 2 + 5 * Math.log10(ap) : 0

  const tags = new Set(target?.tags || [])
  const t = String(target?.type || '')
  const isNebulaOrGalaxy =
    tags.has('galaxy') ||
    t === 'galaxy' ||
    tags.has('nebula') ||
    tags.has('emission_nebula') ||
    tags.has('planetary_nebula') ||
    t.includes('nebula') ||
    t === 'supernova_remnant' ||
    t === 'milky_way_patch'
  const isCluster = tags.has('cluster') || t.includes('cluster')

  const bortleOver = Math.max(0, b - 4)
  const penaltyPer = isCluster ? 0.3 : isNebulaOrGalaxy ? 0.5 : 0.4
  const bortlePenalty = bortleOver * penaltyPer

  const baseMag = effectiveMagnitude(target)
  const effMag = baseMag + bortlePenalty

  let label = /** @type {'Easy'|'Stretch'|'Skip'} */ ('Skip')
  let color = /** @type {'#4ade80'|'#facc15'|'#f87171'} */ ('#f87171')

  if (effMag < limitMag - 2) {
    label = 'Easy'
    color = '#4ade80'
  } else if (effMag < limitMag) {
    label = 'Stretch'
    color = '#facc15'
  }

  const { yourGear, faintGear } = gearPhrases(equipmentName, ap)
  const listedMag = Number(target?.magnitude)
  const magPhrase =
    Number.isFinite(listedMag) && listedMag < 90
      ? `listed magnitude ~${Math.round(listedMag * 10) / 10}`
      : 'how faint the object is'

  const sizeArc = Number(target?.size_arcmin)
  const sizeStr = formatArcminForReason(sizeArc)
  const hasFocal = Number.isFinite(focalLen) && focalLen > 0
  const smallForFocal =
    sizeStr != null &&
    hasFocal &&
    Number.isFinite(sizeArc) &&
    sizeArc > 0 &&
    sizeArc < 5 &&
    !tags.has('cluster')

  const bortleLabel = b >= 8 ? `Bortle ${b} skies` : `Bortle ${b}`

  /** @type {string} */
  let reason = ''

  if (label === 'Easy') {
    if (b >= 5) {
      reason = `Bright enough for ${yourGear} even from ${bortleLabel}`
    } else {
      reason = `Comfortably within reach for ${yourGear} under ${bortleLabel}`
    }
  } else if (label === 'Stretch') {
    if (smallForFocal) {
      reason = `Small angular size (${sizeStr}) — detail limited at your ${Math.round(focalLen)}mm focal length under ${bortleLabel}`
    } else if (isNebulaOrGalaxy && b >= 6) {
      reason = `Low surface brightness — needs dark skies, may be washed out at ${bortleLabel} with ${yourGear}`
    } else if (isNebulaOrGalaxy && b >= 5 && bortlePenalty >= 0.25) {
      reason = `Low surface brightness — light pollution at ${bortleLabel} steals contrast for ${yourGear}`
    } else if (bortlePenalty >= 0.45 && baseMag < limitMag - 0.35) {
      reason = `Bortle ${b} adds about ${Math.round(bortlePenalty * 10) / 10} mag of effective dimming — that pushes this (${magPhrase}) to the limit for ${yourGear}`
    } else {
      reason = `Near your observing limit for ${yourGear} at ${bortleLabel} given ${magPhrase} and sky glow`
    }
  } else {
    if (isNebulaOrGalaxy && b >= 6) {
      reason = `Low surface brightness — needs dark skies; likely lost in glow at ${bortleLabel} for ${faintGear}`
    } else if (effMag > limitMag && bortlePenalty >= 0.5) {
      reason = `Sky brightness at ${bortleLabel} adds too much effective dimming for ${faintGear} — ${magPhrase} stays out of reach`
    } else {
      reason = `Too faint for ${faintGear} from ${bortleLabel} given ${magPhrase}`
    }
  }

  return { label, color, reason }
}

function bortleContrastWeight(target, bortle) {
  const tags = new Set(target.tags || [])
  const b = Math.min(9, Math.max(1, Number(bortle) || 5))
  const stress =
    (tags.has('emission_nebula') ? 2.2 : 0) +
    (tags.has('nebula') && !tags.has('planetary_nebula') ? 0.8 : 0) +
    (tags.has('galaxy') ? 1.4 : 0) +
    (tags.has('planetary_nebula') ? 0.9 : 0) +
    (tags.has('cluster') ? 0.25 : 0) +
    (tags.has('double_star') ? 0.1 : 0)
  return 1 + (stress * (b - 1)) / 18
}

function scoreTarget(target, ctx) {
  const { maxAlt } = ctx.visibility
  const bortle = ctx.bortleZone
  const headroom = ctx.headroom
  const seasonBoost = target.bestSeason === ctx.season ? 22 : 0

  const altScore = (maxAlt / 90) * 38
  const headroomScore = clamp(headroom * 6, -12, 28)
  const contrastPenalty = bortleContrastWeight(target, bortle)
  const raw = (altScore + headroomScore + seasonBoost) / contrastPenalty

  return Math.round(raw * 10) / 10
}

/**
 * Ranked list of targets for one calendar night (local date on `params.date`).
 * @param {object} params
 * @param {Date} params.date
 * @param {number} params.lat
 * @param {number} params.lng
 * @param {number} params.bortleZone — 1…9
 * @param {object|null} params.horizonData — `{ points: [{ azimuth, altitude }] }` or array of same
 * @param {number} params.apertureMm
 * @param {'visual'|'camera'|'smart'} params.equipmentType
 * @param {boolean} params.excludeMoonlit
 * @param {number} [params.minAltitude=20] — degrees above terrain and quality bar
 * @param {Date} [params.sessionStart] — optional; when provided with `sessionEnd`, filters targets to those clear at any point in that window
 * @param {Date} [params.sessionEnd] — optional; when provided with `sessionStart`, filters targets to those clear at any point in that window
 * @param {{ phase: number, name: string, illumination: number } | null | undefined} [params.moonPhase] — from `getMoonPhase()`; defaults from `date` at local midnight
 * @param {{ tonight: { avgCloudCover: number, isObservable: boolean } } | null | undefined} [params.weather] — from `getObservingForecast()`
 */
export function getRecommendedTargets(params) {
  const {
    date,
    lat,
    lng,
    bortleZone,
    horizonData,
    apertureMm,
    equipmentType,
    excludeMoonlit,
    minAltitude = 20,
    sessionStart,
    sessionEnd,
    moonPhase: moonPhaseIn,
    weather,
  } = params

  const limits = getObjectMagnitudeLimit(bortleZone, apertureMm)
  const limitMag =
    equipmentType === 'visual' ? limits.visual : Math.max(limits.visual, limits.imaging)

  const season = seasonFromDate(date)
  const moonAtMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
  const moonPos = getMoonRaDecJ2000Rough(moonAtMidnight)
  const moonPhase = moonPhaseIn ?? getMoonPhase(moonAtMidnight)
  const avgCloud = weather?.tonight?.avgCloudCover ?? 0

  const visible = []
  const blocked = []

  for (const target of TARGETS) {
    const visibility = isTargetVisible(target, horizonData, lat, lng, date, minAltitude)
    if (!visibility.visible) {
      if (visibility.blockedByHorizon && visibility.horizonBlock) {
        const az = Math.round(visibility.horizonBlock.azimuth)
        const need = Math.round(visibility.horizonBlock.requiredAltitude)
        const timeLabel = formatTime12h(visibility.horizonBlock.time)
        blocked.push({
          ...target,
          blockedReason: `Clips your horizon at ${timeLabel} (az ${az}°, need ${need}° clearance)`,
        })
      }
      continue
    }

    const win =
      sessionStart instanceof Date && sessionEnd instanceof Date
        ? windowVisibility(target, horizonData, lat, lng, sessionStart, sessionEnd, minAltitude)
        : null
    if (win && !win.hasAnyClear) continue

    if (excludeMoonlit) {
      const sep = angularSeparationDeg(target.ra, target.dec, moonPos.ra, moonPos.dec)
      if (sep < 30) continue
    }

    const effMag = effectiveMagnitude(target)
    if (effMag > limitMag + 0.35) continue

    const headroom = limitMag - effMag
    const score = scoreTarget(target, {
      bortleZone,
      season,
      headroom,
      visibility,
    })

    const sepMoon = angularSeparationDeg(target.ra, target.dec, moonPos.ra, moonPos.dec)
    const conditionScore = computeTargetConditionScore(
      avgCloud,
      moonPhase.illumination,
      sepMoon,
      weather,
    )

    visible.push({
      ...target,
      visibility: {
        maxAlt: Math.round(visibility.maxAlt * 10) / 10,
        bestTime: visibility.bestTime,
        azimuthAtBest: Math.round(visibility.azimuthAtBest * 10) / 10,
        windowBestTime: win?.windowBestTime,
        windowMaxAlt: win?.windowMaxAlt,
        windowCoverage: win?.windowCoverage,
      },
      score,
      conditionScore,
    })
  }

  visible.sort((a, b) => b.score - a.score)
  blocked.sort((a, b) => a.name.localeCompare(b.name))
  return { visible, blocked }
}
