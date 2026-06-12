/**
 * Anthropic (Claude) access for the app — through same-origin `/api` so the browser
 * is not blocked by CORS (Anthropic does not allow direct browser calls).
 */

import { supabase } from './supabase.js'
import { densifyHorizonPoints } from './horizonPoints.js'
import { apiUrl } from './apiOrigin.js'

export const ANALYZE_HORIZON_ENDPOINT = apiUrl('/api/analyze-horizon')

/**
 * Ask Claude Vision to trace the land horizon from a panorama / horizon photo.
 * @param {{ base64: string; mediaType?: string }} image — raw base64 (no data: prefix)
 * @returns {Promise<{ points: { azimuth: number; altitude: number }[] }>}
 */
export async function analyzeHorizonPhoto({ base64, mediaType = 'image/jpeg' }) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()
  if (sessionError) {
    throw sessionError instanceof Error ? sessionError : new Error(String(sessionError))
  }
  if (!session?.access_token) {
    throw new Error('You must be signed in to analyze a horizon photo.')
  }

  let res
  try {
    res = await fetch(ANALYZE_HORIZON_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ base64, mediaType }),
    })
  } catch (err) {
    const m = err && typeof err === 'object' && 'message' in err ? String(err.message) : ''
    if (m === 'Failed to fetch' || err?.name === 'TypeError') {
      throw new Error(
        'Could not reach the horizon service (photo may be too large, or the dev server needs a restart). Try again with a slightly smaller image.',
      )
    }
    throw err instanceof Error ? err : new Error(m || 'Network error.')
  }

  let payload = null
  let rawBody = ''
  try {
    rawBody = await res.text()
    if (rawBody) {
      try {
        payload = JSON.parse(rawBody)
      } catch {
        /* not JSON */
      }
    }
  } catch {
    /* body read failed */
  }

  if (!res.ok) {
    let msg =
      (payload && typeof payload.error === 'string' && payload.error) ||
      `Horizon analysis failed (HTTP ${res.status}).`
    if (import.meta.env.DEV && payload === null && rawBody) {
      msg = `${msg} Response body: ${rawBody.slice(0, 300)}`
    }
    throw new Error(msg)
  }

  const points = payload?.points
  if (!Array.isArray(points) || points.length < 3) {
    throw new Error(
      'Horizon service returned no usable points — the photo may not show a clear skyline.',
    )
  }

  return { points }
}

/**
 * Multi-shot capture set (8 directions) → one analysis request.
 * @param {{ images: { base64: string; mediaType?: string; azimuth?: number }[] }} params
 * @returns {Promise<{ points: { azimuth: number; altitude: number }[] }>}
 */
export async function analyzeHorizonCaptureSet({ images }) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (!session?.access_token) {
    throw new Error('You must be signed in to analyze a horizon photo.')
  }

  if (!Array.isArray(images) || images.length < 1) {
    throw new Error('Missing capture images.')
  }

  const payloadImages = images
    .map((img) => ({
      base64: String(img?.base64 || ''),
      mediaType:
        typeof img?.mediaType === 'string' && img.mediaType.startsWith('image/')
          ? img.mediaType
          : 'image/jpeg',
      azimuth: Number.isFinite(Number(img?.azimuth)) ? Number(img.azimuth) : undefined,
    }))
    .filter((img) => img.base64 && img.base64.length >= 100)

  if (payloadImages.length < 1) {
    throw new Error('Missing capture images.')
  }

  let res
  try {
    res = await fetch(apiUrl('/api/analyze-horizon'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ images: payloadImages }),
    })
  } catch (err) {
    const m = err && typeof err === 'object' && 'message' in err ? String(err.message) : ''
    if (m === 'Failed to fetch' || err?.name === 'TypeError') {
      throw new Error(
        'Could not reach the horizon service (photos may be too large, or the dev server needs a restart). Try again with slightly smaller frames.',
      )
    }
    throw err instanceof Error ? err : new Error(m || 'Network error.')
  }

  let body = null
  try {
    body = await res.json()
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    const msg =
      (body && typeof body.error === 'string' && body.error) ||
      `Horizon analysis failed (HTTP ${res.status}).`
    throw new Error(msg)
  }

  let points = body?.points
  if (!Array.isArray(points) || points.length < 3) {
    throw new Error('Invalid response from horizon service.')
  }

  if (payloadImages.length > 1 && points.length < 24) {
    points = densifyHorizonPoints(points, 5)
  }

  return { points }
}
