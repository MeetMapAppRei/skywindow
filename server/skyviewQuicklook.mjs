const SKYVIEW_RUNQUERY = 'https://skyview.gsfc.nasa.gov/current/cgi/runquery.pl'

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

function parseQuicklookPath(html) {
  const m = html.match(/tempspace\/fits\/skv\d+\.(?:jpg|jpeg|png)/i)
  return m ? m[0] : null
}

/**
 * Calls NASA SkyView runquery (HTML UI), parses the quicklook JPEG path, returns an absolute URL.
 * The legacy nph-pskcall direct-PNG endpoint returns 404 as of 2026; this follows the current flow.
 *
 * @param {{ raHours: number, decDeg: number, sizeArcmin: number }} p
 * @returns {Promise<string>}
 */
export async function getSkyViewQuicklookLocation({ raHours, decDeg, sizeArcmin }) {
  const raH = Number(raHours)
  const dec = Number(decDeg)
  const arcmin = Number(sizeArcmin)
  if (!Number.isFinite(raH) || raH < 0 || raH >= 24) {
    throw new Error('Invalid RA (hours)')
  }
  if (!Number.isFinite(dec) || dec < -90 || dec > 90) {
    throw new Error('Invalid Dec (degrees)')
  }
  if (!Number.isFinite(arcmin) || arcmin <= 0 || arcmin > 600) {
    throw new Error('Invalid size (arcminutes)')
  }

  const raDeg = raH * 15
  const fovDeg = clamp((arcmin * 3.5) / 60, 0.08, 5)

  const q = new URL(SKYVIEW_RUNQUERY)
  q.searchParams.set('Position', `${raDeg.toFixed(6)},${dec.toFixed(6)}`)
  q.searchParams.set('survey', 'DSS2 Red')
  q.searchParams.set('pixels', '300')
  q.searchParams.set('size', fovDeg.toFixed(6))
  q.searchParams.set('scaling', 'Log')

  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 45000)
  let res
  try {
    res = await fetch(q.toString(), {
      signal: ac.signal,
      headers: { Accept: 'text/html,*/*' },
      redirect: 'follow',
    })
  } finally {
    clearTimeout(t)
  }

  if (!res.ok) {
    throw new Error(`SkyView HTTP ${res.status}`)
  }
  const html = await res.text()
  const path = parseQuicklookPath(html)
  if (!path) {
    throw new Error('SkyView response missing quicklook path')
  }
  return `https://skyview.gsfc.nasa.gov/${path}`
}
