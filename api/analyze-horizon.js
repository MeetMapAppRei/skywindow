import { runAnalyzeHorizon } from '../server/analyzeHorizon.mjs'

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** Vercel Node serverless: POST JSON `{ base64, mediaType }` + `Authorization: Bearer <access_token>`. */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  let body = {}
  try {
    const raw = await readBody(req)
    body = raw ? JSON.parse(raw) : {}
  } catch {
    res.status(400).json({ error: 'Invalid JSON body.' })
    return
  }

  const auth = req.headers.authorization
  const { status, json } = await runAnalyzeHorizon({
    authorization: typeof auth === 'string' ? auth : '',
    body,
  })
  res.status(status).json(json)
}
