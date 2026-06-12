import fs from 'node:fs'

function getEnv(path, key) {
  const text = fs.readFileSync(new URL(path, import.meta.url), 'utf8')
  const m = text.match(new RegExp(`^${key}=(.*)$`, 'm'))
  if (!m) return ''
  let v = m[1].trim()
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1)
  }
  return v
}

const url = getEnv('../.env.prod.local', 'VITE_SUPABASE_URL')
const key = getEnv('../.env.prod.local', 'VITE_SUPABASE_ANON_KEY')
const ep = `${url.replace(/\/$/, '')}/rest/v1/equipment?select=id&limit=1`
const res = await fetch(ep, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
})
console.log('GET', ep)
console.log('STATUS', res.status)
console.log(await res.text())
