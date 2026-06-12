/**
 * Open-Meteo forecast (no API key).
 * Note: the API expects `cloud_cover` in the hourly list (not `cloudcover`).
 * @see https://open-meteo.com/en/docs
 */

const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast'

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

/** Local night window for calendar date `nightDate`: 20:00 same day → 05:00 next day. */
export function getLocalNightWindow(nightDate) {
  const y = nightDate.getFullYear()
  const m = nightDate.getMonth()
  const d = nightDate.getDate()
  const start = new Date(y, m, d, 20, 0, 0, 0)
  const end = new Date(y, m, d + 1, 5, 0, 0, 0)
  return { start, end }
}

function avgCloudSlice(hours) {
  let sum = 0
  let n = 0
  for (const h of hours) {
    if (h.cloudCover != null && !Number.isNaN(h.cloudCover)) {
      sum += h.cloudCover
      n += 1
    }
  }
  return n > 0 ? Math.round((sum / n) * 10) / 10 : 0
}

/** @param {object[]} nightHours */
function summarizeCloudTrend(nightHours) {
  if (!nightHours.length) {
    return { maxCloudCover: 0, lateCloudCover: 0, cloudTrend: 'mixed' }
  }

  let maxCloudCover = 0
  for (const h of nightHours) {
    if (h.cloudCover != null && !Number.isNaN(h.cloudCover)) {
      maxCloudCover = Math.max(maxCloudCover, h.cloudCover)
    }
  }

  const lateHours = nightHours.slice(-3)
  const lateCloudCover = avgCloudSlice(lateHours)

  const mid = Math.ceil(nightHours.length / 2)
  const earlyAvg = avgCloudSlice(nightHours.slice(0, mid))
  const lateAvg = avgCloudSlice(nightHours.slice(mid))
  const avgCloudCover = avgCloudSlice(nightHours)

  let cloudTrend = 'mixed'
  if (avgCloudCover >= 50) cloudTrend = 'overcast'
  else if (lateAvg - earlyAvg >= 20 || (maxCloudCover >= 55 && lateCloudCover >= 35)) cloudTrend = 'building'
  else if (earlyAvg - lateAvg >= 20) cloudTrend = 'clearing'
  else if (avgCloudCover < 25 && maxCloudCover < 40) cloudTrend = 'clear'

  return {
    maxCloudCover: Math.round(maxCloudCover * 10) / 10,
    lateCloudCover,
    cloudTrend,
  }
}

/**
 * @param {number} lat
 * @param {number} lng
 * @param {Date} [nightDate=new Date()] — local calendar night to score (tonight’s 8pm–2am window)
 * @returns {Promise<{ tonight: object, hourly: object[] }>}
 */
export async function getObservingForecast(lat, lng, nightDate = new Date()) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: ['cloud_cover', 'visibility', 'precipitation'].join(','),
    timezone: 'auto',
    forecast_days: '2',
  })
  const url = `${FORECAST_BASE}?${params.toString()}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Weather request failed (${res.status})`)
  }
  const data = await res.json()
  const times = data?.hourly?.time ?? []
  const cloud = data?.hourly?.cloud_cover ?? []
  const vis = data?.hourly?.visibility ?? []
  const precip = data?.hourly?.precipitation ?? []

  const hourly = times.map((time, i) => ({
    time,
    cloudCover: cloud[i] != null ? Number(cloud[i]) : null,
    visibility: vis[i] != null ? Number(vis[i]) : null,
    precipitation: precip[i] != null ? Number(precip[i]) : null,
  }))

  const { start, end } = getLocalNightWindow(nightDate)
  const nightHours = hourly.filter((h) => {
    const t = new Date(h.time)
    return t >= start && t <= end
  })

  let sumCloud = 0
  let nCloud = 0
  let minVisibility = Infinity
  let hoursWithPrecip = 0

  for (const h of nightHours) {
    if (h.cloudCover != null && !Number.isNaN(h.cloudCover)) {
      sumCloud += h.cloudCover
      nCloud += 1
    }
    if (h.visibility != null && !Number.isNaN(h.visibility)) {
      minVisibility = Math.min(minVisibility, h.visibility)
    }
    const p = h.precipitation ?? 0
    if (p > 0.05) hoursWithPrecip += 1
  }

  const avgCloudCover = nCloud > 0 ? Math.round((sumCloud / nCloud) * 10) / 10 : 0
  const { maxCloudCover, lateCloudCover, cloudTrend } = summarizeCloudTrend(nightHours)
  const minVisOut =
    Number.isFinite(minVisibility) && minVisibility !== Infinity
      ? Math.round(minVisibility)
      : null
  const chanceOfPrecip =
    nightHours.length > 0 ? Math.round((hoursWithPrecip / nightHours.length) * 1000) / 10 : 0

  const noPrecipInWindow = hoursWithPrecip === 0
  const isObservable =
    avgCloudCover < 40 &&
    maxCloudCover < 75 &&
    avgCloudCover < 50 &&
    cloudTrend !== 'building' &&
    noPrecipInWindow

  return {
    tonight: {
      avgCloudCover,
      maxCloudCover,
      lateCloudCover,
      cloudTrend,
      minVisibility: minVisOut,
      chanceOfPrecip,
      isObservable,
    },
    hourly,
  }
}

/**
 * Shared “conditions” strip for UI + hooks (0–100 score, label).
 * @param {{ illumination: number }} moonPhase
 * @param {{ tonight: { avgCloudCover: number, isObservable: boolean } } } | null weather
 * @param {number} bortleZone — 1…9
 */
export function computeNightConditionsSummary(moonPhase, weather, bortleZone) {
  const illum = clamp(Number(moonPhase?.illumination) || 0, 0, 100)
  const cloud = clamp(Number(weather?.tonight?.avgCloudCover) || 0, 0, 100)
  const b = clamp(Number(bortleZone) || 5, 1, 9)

  let score = 100
  score -= cloud * 0.45
  score -= illum * 0.22
  score -= (b - 1) * 2.8
  if (weather && !weather.tonight.isObservable) score -= 28
  score = clamp(Math.round(score * 10) / 10, 0, 100)

  let label = 'Excellent'
  if (score < 78) label = 'Good'
  if (score < 62) label = 'Fair'
  if (score < 42) label = 'Poor'

  return { score, label, bortle: b }
}
