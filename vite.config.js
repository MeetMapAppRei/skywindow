import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { runAnalyzeHorizon } from './server/analyzeHorizon.mjs'
import { runDeleteAccount } from './server/deleteAccount.mjs'
import { getSkyViewQuicklookLocation } from './server/skyviewQuicklook.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(readFileSync(path.join(__dirname, 'public/manifest.json'), 'utf8'))

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const forCapacitor = process.env.CAPACITOR === 'true'

  return {
    base: forCapacitor ? './' : '/',
    plugins: [
    {
      name: 'skywindow-api-analyze-horizon',
      configureServer(server) {
        // Run after Vite’s internal middleware so POST /api is not swallowed.
        return () => {
          server.middlewares.use(async (req, res, next) => {
            const pathname = (req.originalUrl ?? req.url ?? '').split('?')[0]
            if (pathname === '/api/delete-account') {
              if (req.method === 'OPTIONS') {
                res.statusCode = 204
                res.end()
                return
              }
              if (req.method !== 'DELETE') {
                res.statusCode = 405
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Method not allowed' }))
                return
              }
              Object.assign(process.env, env)
              const auth = req.headers.authorization
              const { status, json } = await runDeleteAccount({
                authorization: typeof auth === 'string' ? auth : '',
              })
              res.statusCode = status
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(json))
              return
            }
            if (pathname === '/api/skyview-image') {
              if (req.method === 'OPTIONS') {
                res.statusCode = 204
                res.end()
                return
              }
              if (req.method !== 'GET') {
                res.statusCode = 405
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Method not allowed' }))
                return
              }
              try {
                const u = new URL(req.originalUrl ?? req.url ?? '', 'http://local')
                const ra = Number(u.searchParams.get('ra'))
                const dec = Number(u.searchParams.get('dec'))
                const arcminRaw = u.searchParams.get('arcmin')
                const arcmin = arcminRaw != null && arcminRaw !== '' ? Number(arcminRaw) : 10
                const location = await getSkyViewQuicklookLocation({
                  raHours: ra,
                  decDeg: dec,
                  sizeArcmin: arcmin,
                })
                res.statusCode = 302
                res.setHeader('Cache-Control', 'public, max-age=86400')
                res.setHeader('Location', location)
                res.end()
              } catch (e) {
                res.statusCode = 502
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: e?.message || 'SkyView lookup failed' }))
              }
              return
            }
            if (pathname !== '/api/analyze-horizon') {
              next()
              return
            }
            if (req.method === 'OPTIONS') {
              res.statusCode = 204
              res.end()
              return
            }
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Method not allowed' }))
              return
            }
            const auth = req.headers.authorization
            try {
              const raw = await readRequestBody(req)
              const body = raw ? JSON.parse(raw) : {}
              Object.assign(process.env, env)
              const { status, json } = await runAnalyzeHorizon({
                authorization: typeof auth === 'string' ? auth : '',
                body,
              })
              res.statusCode = status
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(json))
            } catch (e) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: e?.message || 'Server error' }))
            }
          })
        }
      },
    },
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-192.png', 'pwa-512.png', 'vite.svg'],
      manifest,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json,webmanifest}'],
      },
    }),
    ],
  }
})
