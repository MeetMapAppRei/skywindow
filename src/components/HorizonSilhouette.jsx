import { useMemo } from 'react'

function normalizePoints(horizonData) {
  if (!horizonData) return []
  const pts = Array.isArray(horizonData) ? horizonData : horizonData.points
  if (!Array.isArray(pts)) return []
  return pts
    .map((p) => ({
      azimuth: Number(p?.azimuth),
      altitude: Number(p?.altitude),
    }))
    .filter((p) => Number.isFinite(p.azimuth) && Number.isFinite(p.altitude))
}

function wrap360(deg) {
  const n = ((Number(deg) % 360) + 360) % 360
  return n
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

function toCssHeight(height) {
  if (height == null) return '80px'
  if (typeof height === 'number' && Number.isFinite(height)) return `${height}px`
  return String(height)
}

function sampleHorizon(points, stepDeg = 1) {
  if (!points.length) return []

  const sorted = [...points]
    .map((p) => ({ azimuth: wrap360(p.azimuth), altitude: p.altitude }))
    .sort((a, b) => a.azimuth - b.azimuth)

  // Ensure we can interpolate across the 360° wrap seam.
  const extended = [...sorted, { ...sorted[0], azimuth: sorted[0].azimuth + 360 }]

  const out = []
  let i = 0
  for (let x = 0; x <= 360; x += stepDeg) {
    while (i + 1 < extended.length && extended[i + 1].azimuth < x) i++
    const a = extended[i]
    const b = extended[Math.min(i + 1, extended.length - 1)]
    const denom = b.azimuth - a.azimuth
    const t = denom === 0 ? 0 : (x - a.azimuth) / denom
    const alt = a.altitude + (b.altitude - a.altitude) * t
    out.push({ azimuth: x, altitude: alt })
  }
  return out
}

export default function HorizonSilhouette({ horizonData, height = '80px', showLabels = true }) {
  const pts = useMemo(() => normalizePoints(horizonData), [horizonData])

  // Cap the visible altitude range so low horizons still show detail.
  const maxAlt = 45
  const samples = useMemo(() => sampleHorizon(pts, 1), [pts])

  const lineD = useMemo(() => {
    if (!samples.length) return ''
    const parts = []
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i]
      const alt = clamp(s.altitude, 0, maxAlt)
      const y = maxAlt - alt
      const cmd = i === 0 ? 'M' : 'L'
      parts.push(`${cmd}${s.azimuth.toFixed(2)},${y.toFixed(2)}`)
    }
    return parts.join(' ')
  }, [samples])

  const fillD = useMemo(() => {
    if (!lineD) return ''
    return `${lineD} L360,${maxAlt} L0,${maxAlt} Z`
  }, [lineD])

  const h = toCssHeight(height)
  const hasData = pts.length > 0

  return (
    <div style={{ width: '100%', height: h }}>
      <svg
        viewBox={`0 0 360 ${maxAlt}`}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        role="img"
        aria-label="Horizon silhouette"
        style={{ display: 'block' }}
      >
        <rect x="0" y="0" width="360" height={maxAlt} fill="rgba(0,0,0,0)" />

        {hasData ? (
          <>
            <path d={fillD} fill="rgba(15,20,40,0.9)" stroke="none" />
            <path d={lineD} fill="none" stroke="rgba(138,164,255,0.6)" strokeWidth="0.9" />
          </>
        ) : (
          <path
            d={`M0,${maxAlt} L360,${maxAlt}`}
            fill="none"
            stroke="rgba(138,164,255,0.25)"
            strokeWidth="0.9"
          />
        )}

        {showLabels ? (
          <g
            aria-hidden="true"
            fill="rgba(180,190,210,0.55)"
            fontSize="4.8"
            fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
            fontWeight="600"
          >
            <text x="0" y={maxAlt - 1.2} textAnchor="start">
              N
            </text>
            <text x="90" y={maxAlt - 1.2} textAnchor="middle">
              E
            </text>
            <text x="180" y={maxAlt - 1.2} textAnchor="middle">
              S
            </text>
            <text x="270" y={maxAlt - 1.2} textAnchor="middle">
              W
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  )
}

