import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import { createSplashIcon } from './splash-mark.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '..', 'public')

function writeIcon(size, outPath) {
  const png = createSplashIcon(size)
  fs.writeFileSync(outPath, PNG.sync.write(png))
  console.log('wrote', outPath)
}

fs.mkdirSync(publicDir, { recursive: true })
writeIcon(192, path.join(publicDir, 'pwa-192.png'))
writeIcon(512, path.join(publicDir, 'pwa-512.png'))
