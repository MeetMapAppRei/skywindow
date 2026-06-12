import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const srcPath = path.join(root, 'public', 'pwa-512.png')
const appIconDir = path.join(root, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset')
const splashDir = path.join(root, 'ios', 'App', 'App', 'Assets.xcassets', 'Splash.imageset')

function resizeNearest(src, size) {
  const out = new PNG({ width: size, height: size })
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.floor((x / size) * src.width)
      const sy = Math.floor((y / size) * src.height)
      const si = (src.width * sy + sx) << 2
      const oi = (size * y + x) << 2
      out.data[oi] = src.data[si]
      out.data[oi + 1] = src.data[si + 1]
      out.data[oi + 2] = src.data[si + 2]
      out.data[oi + 3] = src.data[si + 3]
    }
  }
  return out
}

if (!fs.existsSync(srcPath)) {
  console.error('Missing public/pwa-512.png — run npm run icons first')
  process.exit(1)
}

const src = PNG.sync.read(fs.readFileSync(srcPath))
fs.mkdirSync(appIconDir, { recursive: true })
fs.mkdirSync(splashDir, { recursive: true })

const appIcon = resizeNearest(src, 1024)
const appIconPath = path.join(appIconDir, 'AppIcon-512@2x.png')
fs.writeFileSync(appIconPath, PNG.sync.write(appIcon))
console.log('wrote', appIconPath)

const splash = resizeNearest(src, 512)
const splashPath = path.join(splashDir, 'splash-512.png')
fs.writeFileSync(splashPath, PNG.sync.write(splash))
console.log('wrote', splashPath)

const splashContents = {
  images: [
    {
      filename: 'splash-512.png',
      idiom: 'universal',
      scale: '1x',
    },
    {
      idiom: 'universal',
      scale: '2x',
    },
    {
      idiom: 'universal',
      scale: '3x',
    },
  ],
  info: { author: 'xcode', version: 1 },
}
fs.writeFileSync(path.join(splashDir, 'Contents.json'), `${JSON.stringify(splashContents, null, 2)}\n`)
