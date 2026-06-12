import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import { drawSplashMark, SPLASH_ACCENT, SPLASH_BG } from './splash-mark.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const outDir = path.join(root, 'play-store')
const iconSrc = path.join(root, 'public', 'pwa-512.png')

const BG = SPLASH_BG
const BG_SOFT = { r: 18, g: 24, b: 42 }
const STAR = { r: 212, g: 224, b: 255 }
const ACCENT_TEAL = SPLASH_ACCENT
const TEXT = { r: 232, g: 238, b: 247 }
const MUTED = { r: 140, g: 152, b: 170 }
const ACCENT = { r: 96, g: 165, b: 250 }
const GOOD = { r: 74, g: 222, b: 128 }
const CARD = { r: 22, g: 30, b: 48 }

function setPixel(png, x, y, c, alpha = 255) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  if (xi < 0 || yi < 0 || xi >= png.width || yi >= png.height) return
  const i = (png.width * yi + xi) << 2
  if (alpha === 255) {
    png.data[i] = c.r
    png.data[i + 1] = c.g
    png.data[i + 2] = c.b
    png.data[i + 3] = 255
    return
  }
  const a = alpha / 255
  const ia = 1 - a
  png.data[i] = Math.round(c.r * a + png.data[i] * ia)
  png.data[i + 1] = Math.round(c.g * a + png.data[i + 1] * ia)
  png.data[i + 2] = Math.round(c.b * a + png.data[i + 2] * ia)
  png.data[i + 3] = 255
}

function line(png, x0, y0, x1, y1, c) {
  x0 = Math.round(x0)
  y0 = Math.round(y0)
  x1 = Math.round(x1)
  y1 = Math.round(y1)
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy
  let x = x0
  let y = y0
  for (;;) {
    setPixel(png, x, y, c)
    if (x === x1 && y === y1) break
    const e2 = 2 * err
    if (e2 > -dy) {
      err -= dy
      x += sx
    }
    if (e2 < dx) {
      err += dx
      y += sy
    }
  }
}

function fillRect(png, x, y, w, h, c, alpha = 255) {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      setPixel(png, px, py, c, alpha)
    }
  }
}

function fillBackground(png, top = BG, bottom = BG_SOFT) {
  for (let y = 0; y < png.height; y++) {
    const t = y / Math.max(1, png.height - 1)
    const c = {
      r: Math.round(top.r + (bottom.r - top.r) * t),
      g: Math.round(top.g + (bottom.g - top.g) * t),
      b: Math.round(top.b + (bottom.b - top.b) * t),
    }
    for (let x = 0; x < png.width; x++) {
      setPixel(png, x, y, c)
    }
  }
}

function drawSparkles(png, count, seed = 1) {
  let s = seed
  for (let i = 0; i < count; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const x = s % png.width
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const y = s % png.height
    const bright = (s % 100) > 70
    setPixel(png, x, y, bright ? STAR : MUTED, bright ? 220 : 120)
    if (bright) {
      setPixel(png, x + 1, y, STAR, 80)
      setPixel(png, x, y + 1, STAR, 80)
    }
  }
}

const FONT_5X7 = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10011', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10001', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  W: ['10001', '10001', '10001', '10001', '10101', '11011', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['01110', '10001', '00001', '00110', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['01110', '10000', '11110', '10001', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ':': ['00000', '00100', '00000', '00000', '00100', '00000', '00000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '00100', '00100'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
}

function drawText(png, text, x, y, scale, color = TEXT) {
  let cx = x
  const upper = String(text).toUpperCase()
  for (const ch of upper) {
    const glyph = FONT_5X7[ch] || FONT_5X7[' ']
    for (let row = 0; row < glyph.length; row++) {
      for (let col = 0; col < glyph[row].length; col++) {
        if (glyph[row][col] === '1') {
          fillRect(png, cx + col * scale, y + row * scale, scale, scale, color)
        }
      }
    }
    cx += (glyph[0].length + 1) * scale
  }
}

function textWidth(text, scale) {
  let w = 0
  for (const ch of text.toUpperCase()) {
    const glyph = FONT_5X7[ch] || FONT_5X7[' ']
    w += (glyph[0].length + 1) * scale
  }
  return w - scale
}

function blitResize(src, dest, dx, dy, size) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.floor((x / size) * src.width)
      const sy = Math.floor((y / size) * src.height)
      const si = (src.width * sy + sx) << 2
      const di = (dest.width * (dy + y) + (dx + x)) << 2
      dest.data[di] = src.data[si]
      dest.data[di + 1] = src.data[si + 1]
      dest.data[di + 2] = src.data[si + 2]
      dest.data[di + 3] = src.data[si + 3]
    }
  }
}

function writeFeatureGraphic(uploadJpgPath, legacyJpgPath) {
  const ps1 = path.join(root, 'scripts', 'export-feature-graphic.ps1')
  execSync(
    `powershell -ExecutionPolicy Bypass -File "${ps1}" -IconPng "${iconSrc}" -OutJpg "${uploadJpgPath}"`,
    { stdio: 'inherit' },
  )
  fs.copyFileSync(uploadJpgPath, legacyJpgPath)
  console.log('wrote', legacyJpgPath)
}

function drawPhoneChrome(png, padX, padY, phoneW, phoneH) {
  fillRect(png, padX - 8, padY - 8, phoneW + 16, phoneH + 16, { r: 30, g: 36, b: 52 })
  fillRect(png, padX, padY, phoneW, phoneH, BG)
  fillRect(png, padX + phoneW / 2 - 40, padY + 14, 80, 6, { r: 40, g: 48, b: 66 })
}

function drawBottomNav(png, padX, padY, phoneW, phoneH) {
  const navY = padY + phoneH - 72
  fillRect(png, padX, navY, phoneW, 72, { r: 14, g: 20, b: 34 })
  const labels = ['HOME', 'NIGHT', 'SKY', 'PLAN', 'LOG']
  const step = phoneW / labels.length
  labels.forEach((label, i) => {
    const cx = padX + step * i + step / 2
    fillRect(png, cx - 10, navY + 16, 20, 20, i === 1 ? ACCENT : MUTED, i === 1 ? 255 : 120)
    drawText(png, label, cx - textWidth(label, 2) / 2, navY + 44, 2, i === 1 ? TEXT : MUTED)
  })
}

function drawCard(png, x, y, w, h, title, subtitle, accent = ACCENT) {
  fillRect(png, x, y, w, h, CARD)
  fillRect(png, x, y, 6, h, accent)
  drawText(png, title, x + 20, y + 24, 3, TEXT)
  drawText(png, subtitle, x + 20, y + 58, 2, MUTED)
}

function writeScreenshot(outPath, icon, config) {
  const W = 1080
  const H = 1920
  const png = new PNG({ width: W, height: H })
  fillBackground(png)
  drawSparkles(png, 120, config.seed)

  const padX = 60
  const padY = 80
  const phoneW = W - 120
  const phoneH = H - 160
  drawPhoneChrome(png, padX, padY, phoneW, phoneH)

  drawText(png, config.title, padX + 36, padY + 48, 4, TEXT)
  drawSplashMark(png, padX + phoneW - 60, padY + 56, 56)

  config.cards.forEach((card, i) => {
    drawCard(png, padX + 28, padY + 120 + i * 150, phoneW - 56, 120, card.title, card.subtitle, card.accent || ACCENT)
  })

  if (config.badge) {
    fillRect(png, padX + 28, padY + 120 + config.cards.length * 150 + 20, 220, 48, config.badge.color)
    drawText(png, config.badge.text, padX + 40, padY + 120 + config.cards.length * 150 + 34, 3, BG)
  }

  drawBottomNav(png, padX, padY, phoneW, phoneH)
  fs.writeFileSync(outPath, PNG.sync.write(png))
  console.log('wrote', outPath)
}

function ensureIcon() {
  if (!fs.existsSync(iconSrc)) {
    console.error('Missing public/pwa-512.png — run: npm run icons')
    process.exit(1)
  }
  return PNG.sync.read(fs.readFileSync(iconSrc))
}

fs.mkdirSync(outDir, { recursive: true })

const icon = ensureIcon()
fs.copyFileSync(iconSrc, path.join(outDir, 'app-icon-512.png'))
console.log('wrote', path.join(outDir, 'app-icon-512.png'))

const uploadJpg = path.join(outDir, 'skywindow-feature-graphic-upload.jpg')
writeFeatureGraphic(uploadJpg, path.join(outDir, 'feature-graphic-1024x500.jpg'))

const screenshots = [
  {
    file: 'screenshot-01-verdict.png',
    title: 'TONIGHT VERDICT',
    seed: 11,
    cards: [
      { title: 'GO OBSERVE', subtitle: 'Clear skies and low moon', accent: GOOD },
      { title: 'BORTLE 4', subtitle: 'Suburban sky at your site' },
      { title: 'BEST WINDOW', subtitle: '9:30 PM - 1:15 AM' },
    ],
    badge: { text: 'GOOD NIGHT', color: GOOD },
  },
  {
    file: 'screenshot-02-tonight.png',
    title: 'TONIGHT TARGETS',
    seed: 22,
    cards: [
      { title: 'M42 ORION NEBULA', subtitle: 'Rises 8:12 PM - Great for visual', accent: ACCENT },
      { title: 'M31 ANDROMEDA', subtitle: 'High overhead by 10 PM' },
      { title: 'M45 PLEIADES', subtitle: 'Easy binocular target' },
    ],
  },
  {
    file: 'screenshot-03-planner.png',
    title: 'NIGHT PLANNER',
    seed: 33,
    cards: [
      { title: 'SESSION PLAN', subtitle: 'Drag targets into your queue', accent: ACCENT },
      { title: 'M81 BODE GALAXY', subtitle: 'Planned for 10:40 PM' },
      { title: 'M82 CIGAR GALAXY', subtitle: 'Pair with M81 tonight' },
    ],
  },
  {
    file: 'screenshot-04-sky-profiles.png',
    title: 'SKY PROFILES',
    seed: 44,
    cards: [
      { title: 'BACKYARD EAST', subtitle: 'Horizon analyzed from photo', accent: ACCENT },
      { title: 'TREE LINE SOUTH', subtitle: 'Blocks low southern targets' },
      { title: 'ADD PROFILE', subtitle: 'Capture a new horizon view' },
    ],
  },
]

for (const shot of screenshots) {
  writeScreenshot(path.join(outDir, shot.file), icon, shot)
}

console.log('\nPlay Store assets ready in:', outDir)
