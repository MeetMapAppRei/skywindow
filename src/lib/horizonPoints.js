/** Interpolate sparse horizon samples to ~every stepDeg around the compass. */
export function densifyHorizonPoints(points, stepDeg = 5) {
  const sorted = (Array.isArray(points) ? points : [])
    .map((p) => ({
      azimuth: ((Number(p.azimuth) % 360) + 360) % 360,
      altitude: Number(p.altitude),
    }))
    .filter((p) => Number.isFinite(p.azimuth) && Number.isFinite(p.altitude))
    .sort((a, b) => a.azimuth - b.azimuth)

  if (sorted.length < 2) return sorted

  const extended = [...sorted, { ...sorted[0], azimuth: sorted[0].azimuth + 360 }]
  const out = []
  for (let x = 0; x < 360; x += stepDeg) {
    let i = 0
    while (i + 1 < extended.length && extended[i + 1].azimuth < x) i += 1
    const a = extended[i]
    const b = extended[Math.min(i + 1, extended.length - 1)]
    const denom = b.azimuth - a.azimuth
    const t = denom === 0 ? 0 : (x - a.azimuth) / denom
    out.push({
      azimuth: x,
      altitude: a.altitude + (b.altitude - a.altitude) * t,
    })
  }
  return out
}
