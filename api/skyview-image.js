import { getSkyViewQuicklookLocation } from '../server/skyviewQuicklook.mjs'

/** GET ?ra=<hours>&dec=<deg>&arcmin= — 302 to NASA SkyView quicklook JPEG (DSS2 Red). */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ra = Number(req.query?.ra)
  const dec = Number(req.query?.dec)
  const arcmin = req.query?.arcmin != null ? Number(req.query.arcmin) : 10

  try {
    const location = await getSkyViewQuicklookLocation({
      raHours: ra,
      decDeg: dec,
      sizeArcmin: arcmin,
    })
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800')
    res.redirect(302, location)
  } catch (e) {
    res.status(502).json({ error: e?.message || 'SkyView lookup failed' })
  }
}
