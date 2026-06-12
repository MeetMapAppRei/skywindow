import fs from 'node:fs'

function getEnv(key, envFile = '../.env.local') {
  const text = fs.readFileSync(new URL(envFile, import.meta.url), 'utf8')
  const m = text.match(new RegExp(`^${key}=(.*)$`, 'm'))
  if (!m) return null
  let v = m[1].trim()
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1)
  }
  return v
}

const envFile = process.argv[2] || '../.env.local'
const url = getEnv('VITE_SUPABASE_URL', envFile)
const anonKey = getEnv('VITE_SUPABASE_ANON_KEY', envFile)

if (!url || !anonKey) {
  console.error(
    `Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in ${envFile.replace('../', '')}`,
  )
  process.exit(1)
}

const endpoint = `${url.replace(/\/$/, '')}/rest/v1/profiles?select=bortle_zone&limit=1`
const res = await fetch(endpoint, {
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  },
})

const body = await res.text()
console.log('GET', endpoint)
console.log('STATUS', res.status)
console.log(body)
