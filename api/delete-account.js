import { runDeleteAccount } from '../server/deleteAccount.mjs'

/** Vercel Node serverless: DELETE + `Authorization: Bearer <access_token>`. */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'DELETE') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const auth = req.headers.authorization
  const { status, json } = await runDeleteAccount({
    authorization: typeof auth === 'string' ? auth : '',
  })
  res.status(status).json(json)
}
