import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const srcPath = path.join(root, 'public', 'pwa-512.png')

const DENSITIES = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
]

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
const resRoot = path.join(root, 'android', 'app', 'src', 'main', 'res')

for (const { folder, size } of DENSITIES) {
  const dir = path.join(resRoot, folder)
  fs.mkdirSync(dir, { recursive: true })
  const png = resizeNearest(src, size)
  for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
    const outPath = path.join(dir, name)
    fs.writeFileSync(outPath, PNG.sync.write(png))
    console.log('wrote', outPath)
  }
}
