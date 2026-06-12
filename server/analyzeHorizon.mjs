/**
 * Shared horizon-analysis logic for Vercel `/api` and Vite dev middleware.
 * Runs only in Node — not bundled for the browser.
 */

import { createClient } from '@supabase/supabase-js'

const ANTHROPIC_VERSION = '2023-06-01'
const HORIZON_MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS_SINGLE = 2048
const MAX_TOKENS_MULTI = 2048

const HORIZON_PROMPT_SINGLE =
  'You are an astronomer\'s sky-obstruction mapper. The image shows the real sky view from a backyard or suburban observing site (often aimed upward, not a classic sea horizon). Trees, buildings, and rooflines block part of the sky. Trace the silhouette where obstructions meet open sky — use the highest points of trees/buildings along the view. Return ONLY valid JSON — no markdown — in this shape: { "points": [ { "azimuth": <0-360, 0=North, 90=East>, "altitude": <degrees above the flat mathematical horizon to the TOP of obstructions, often 5-45> }, ... ] }. Produce one point roughly every 10 degrees of azimuth (about 36 points). If compass orientation is unknown, assume the left edge is 0° (North) and the right edge is 360°.'

const HORIZON_PROMPT_MULTI =
  'You are an astronomer\'s sky-obstruction mapper. You receive several photos taken while the photographer faced known compass directions (phone compass). Each photo shows mostly open sky with trees, buildings, or rooflines along the bottom or edges. For EACH image in order, estimate one number: the altitude in degrees above the flat mathematical horizon to the TOP of the tallest obstruction near the center of that frame (typical range 5–45). Return ONLY valid JSON — no markdown — exactly: { "points": [ { "azimuth": <use the heading given for that image>, "altitude": <number> }, ... ] }. Include exactly one point per image, in the same order as the images, using the azimuth values provided in the user message (do not invent different azimuths).'

function extractJsonObject(text) {
  if (!text || typeof text !== 'string') return null
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fence ? fence[1].trim() : trimmed
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(body.slice(start, end + 1))
  } catch {
    return null
  }
}

function resolveSupabaseAuthKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.VITE_SUPABASE_ANON_KEY?.trim() ||
    ''
  )
}

function resolveAnthropicApiKey() {
  return (
    process.env.ANTHROPIC_API_KEY?.trim() ||
    process.env.VITE_ANTHROPIC_API_KEY?.trim() ||
    ''
  )
}

async function verifySupabaseJwt(supabaseUrl, supabaseKey, accessToken) {
  if (!supabaseUrl || !supabaseKey || !accessToken) return false
  const supabase = createClient(supabaseUrl.replace(/\/$/, ''), supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await supabase.auth.getUser(accessToken)
  return !error && !!data?.user
}

function horizonPromptForImages(images) {
  if (images.length === 1) return HORIZON_PROMPT_SINGLE
  const perImage = images
    .map((img, i) => {
      const az = Number.isFinite(img.azimuth) ? Math.round(img.azimuth) : null
      return az != null ? `Image ${i + 1}: azimuth ${az}°` : `Image ${i + 1}: azimuth unknown`
    })
    .join('\n')
  return `${HORIZON_PROMPT_MULTI}\n\n${perImage}`
}

async function callAnthropicVision(apiKey, images) {
  const imgBlocks = images.map((img) => ({
    type: 'image',
    source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
  }))

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: HORIZON_MODEL,
      max_tokens: images.length > 1 ? MAX_TOKENS_MULTI : MAX_TOKENS_SINGLE,
      messages: [
        {
          role: 'user',
          content: [...imgBlocks, { type: 'text', text: horizonPromptForImages(images) }],
        },
      ],
    }),
  })

  if (!res.ok) {
    let detail = ''
    try {
      detail = await res.text()
    } catch {
      /* ignore */
    }
    const err = new Error(detail || `Horizon analysis failed (HTTP ${res.status}).`)
    err.status = 502
    throw err
  }

  const data = await res.json()
  const block = (data?.content ?? []).find((b) => b.type === 'text')
  const text = block?.text ?? ''
  const parsed = extractJsonObject(text)
  const pts = parsed?.points
  if (!Array.isArray(pts) || pts.length < 3) {
    const err = new Error(
      'The model response did not include a usable horizon point list. Try another photo.',
    )
    err.status = 502
    throw err
  }
  const points = pts
    .map((p) => ({
      azimuth: Number(p.azimuth),
      altitude: Number(p.altitude),
    }))
    .filter((p) => Number.isFinite(p.azimuth) && Number.isFinite(p.altitude))

  if (points.length < 3) {
    const err = new Error('Horizon points were incomplete. Try a clearer horizon shot.')
    err.status = 502
    throw err
  }

  return { points }
}

/**
 * @param {{ authorization?: string; body: { base64?: string; mediaType?: string; images?: object[] } }} params
 * @returns {Promise<{ status: number; json: object }>}
 */
export async function runAnalyzeHorizon({ authorization, body }) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseAuthKey = resolveSupabaseAuthKey()
  const token = authorization?.replace(/^Bearer\s+/i, '')?.trim()

  if (!token) {
    return { status: 401, json: { error: 'Missing or invalid authorization.' } }
  }

  if (!supabaseUrl || !supabaseAuthKey) {
    return {
      status: 500,
      json: {
        error:
          'Server missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY for JWT verify).',
      },
    }
  }

  const ok = await verifySupabaseJwt(supabaseUrl, supabaseAuthKey, token)
  if (!ok) {
    return { status: 401, json: { error: 'Invalid or expired session.' } }
  }

  const apiKey = resolveAnthropicApiKey()
  if (!apiKey) {
    return {
      status: 500,
      json: {
        error:
          'Server missing ANTHROPIC_API_KEY. Add it in Vercel or .env.local (legacy VITE_ANTHROPIC_API_KEY is also accepted).',
      },
    }
  }

  /** @type {{ base64: string; mediaType: string; azimuth?: number }[]} */
  let images = []

  if (Array.isArray(body?.images)) {
    images = body.images
      .map((img) => {
        const base64 = typeof img?.base64 === 'string' ? img.base64 : ''
        const mediaType =
          typeof img?.mediaType === 'string' && img.mediaType.startsWith('image/')
            ? img.mediaType
            : 'image/jpeg'
        const azimuth = Number(img?.azimuth)
        return { base64, mediaType, azimuth: Number.isFinite(azimuth) ? azimuth : undefined }
      })
      .filter((img) => img.base64 && img.base64.length >= 100)
  } else {
    const base64 = typeof body?.base64 === 'string' ? body.base64 : ''
    const mediaType =
      typeof body?.mediaType === 'string' && body.mediaType.startsWith('image/')
        ? body.mediaType
        : 'image/jpeg'
    if (base64 && base64.length >= 100) images = [{ base64, mediaType }]
  }

  if (images.length < 1) {
    return { status: 400, json: { error: 'Missing or invalid image payload.' } }
  }

  try {
    const { points } = await callAnthropicVision(apiKey, images)
    return { status: 200, json: { points } }
  } catch (e) {
    const status = typeof e.status === 'number' ? e.status : 500
    return { status, json: { error: e.message || 'Horizon analysis failed.' } }
  }
}
