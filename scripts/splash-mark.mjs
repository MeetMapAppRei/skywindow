import { PNG } from 'pngjs'

export const SPLASH_BG = { r: 10, g: 14, b: 26 }
export const SPLASH_ACCENT = { r: 77, g: 217, b: 192 }
export const SPLASH_TEXT = { r: 232, g: 238, b: 247 }

function blend(c, alpha) {
  return {
    r: Math.round(c.r * alpha + SPLASH_BG.r * (1 - alpha)),
    g: Math.round(c.g * alpha + SPLASH_BG.g * (1 - alpha)),
    b: Math.round(c.b * alpha + SPLASH_BG.b * (1 - alpha)),
  }
}

function setPixel(png, x, y, c) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  if (xi < 0 || yi < 0 || xi >= png.width || yi >= png.height) return
  const i = (png.width * yi + xi) << 2
  png.data[i] = c.r
  png.data[i + 1] = c.g
  png.data[i + 2] = c.b
  png.data[i + 3] = 255
}

function insideRoundRect(x, y, rx, ry, rw, rh, rr) {
  if (x < rx || y < ry || x > rx + rw || y > ry + rh) return false
  const r = Math.min(rr, rw / 2, rh / 2)
  if (x >= rx + r && x <= rx + rw - r) return true
  if (y >= ry + r && y <= ry + rh - r) return true
  const corners = [
    [rx + r, ry + r],
    [rx + rw - r, ry + r],
    [rx + r, ry + rh - r],
    [rx + rw - r, ry + rh - r],
  ]
  for (const [cx, cy] of corners) {
    const dx = x - cx
    const dy = y - cy
    if (dx * dx + dy * dy <= r * r) return true
  }
  return false
}

function cubicPoint(t, p0, p1, p2, p3) {
  const u = 1 - t
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  }
}

function drawThickCurve(png, points, width, color) {
  const radius = Math.max(1, width / 2)
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          setPixel(png, p.x + dx, p.y + dy, color)
        }
      }
    }
    if (i > 0) {
      const a = points[i - 1]
      const b = p
      const steps = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)))
      for (let s = 1; s < steps; s++) {
        const t = s / steps
        const x = a.x + (b.x - a.x) * t
        const y = a.y + (b.y - a.y) * t
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy <= radius * radius) {
              setPixel(png, x + dx, y + dy, color)
            }
          }
        }
      }
    }
  }
}

function addArc(samples, cx, cy, radius, a0, a1, step = 0.08) {
  const count = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step))
  for (let i = 0; i <= count; i++) {
    const a = a0 + ((a1 - a0) * i) / count
    samples.push({ x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius })
  }
}

function addLine(samples, x0, y0, x1, y1, step = 1) {
  const len = Math.hypot(x1 - x0, y1 - y0)
  const count = Math.max(1, Math.ceil(len / step))
  for (let i = 0; i <= count; i++) {
    const t = i / count
    samples.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t })
  }
}

function drawRoundRectStroke(png, x, y, w, h, r, stroke, strokeWidth) {
  const samples = []
  addArc(samples, x + w - r, y + r, r, -Math.PI / 2, 0)
  addLine(samples, x + w - r, y, x + r, y)
  addArc(samples, x + r, y + r, r, Math.PI, Math.PI * 1.5)
  addLine(samples, x, y + r, x, y + h - r)
  addArc(samples, x + r, y + h - r, r, Math.PI / 2, Math.PI)
  addLine(samples, x + r, y + h, x + w - r, y + h)
  addArc(samples, x + w - r, y + h - r, r, 0, Math.PI / 2)
  addLine(samples, x + w, y + h - r, x + w, y + r)
  drawThickCurve(png, samples, strokeWidth, stroke)
}

function fillRoundRectGradient(png, x, y, w, h, r, topColor, topAlpha, bottomColor, bottomAlpha) {
  for (let py = Math.floor(y); py <= Math.ceil(y + h); py++) {
    for (let px = Math.floor(x); px <= Math.ceil(x + w); px++) {
      if (!insideRoundRect(px + 0.5, py + 0.5, x, y, w, h, r)) continue
      const t = (py - y) / h
      const ta = topAlpha + (bottomAlpha - topAlpha) * t
      const c = {
        r: Math.round(topColor.r * ta + bottomColor.r * (1 - ta)),
        g: Math.round(topColor.g * ta + bottomColor.g * (1 - ta)),
        b: Math.round(topColor.b * ta + bottomColor.b * (1 - ta)),
      }
      setPixel(png, px, py, c)
    }
  }
}

/** Renders the Splash.jsx window mark centered on an existing PNG canvas. */
export function drawSplashMark(png, centerX, centerY, markSize) {
  const s = markSize / 56
  const left = centerX - markSize / 2
  const top = centerY - markSize / 2
  const map = (vx, vy) => ({ x: left + vx * s, y: top + vy * s })

  const frame = { x: 6 * s + left, y: 10 * s + top, w: 44 * s, h: 36 * s, r: 5 * s }
  const sky = { x: 8.5 * s + left, y: 12.5 * s + top, w: 39 * s, h: 31 * s, r: 3.5 * s }

  fillRoundRectGradient(
    png,
    sky.x,
    sky.y,
    sky.w,
    sky.h,
    sky.r,
    SPLASH_ACCENT,
    0.55,
    SPLASH_BG,
    0.2,
  )

  const horizonPts = []
  const p0 = map(8.5, 32)
  const p1 = map(20, 26)
  const p2 = map(36, 26)
  const p3 = map(47.5, 32)
  for (let t = 0; t <= 1; t += 0.02) {
    horizonPts.push(cubicPoint(t, p0, p1, p2, p3))
  }
  drawThickCurve(png, horizonPts, 1.25 * s, blend(SPLASH_ACCENT, 0.85))

  drawRoundRectStroke(png, frame.x, frame.y, frame.w, frame.h, frame.r, blend(SPLASH_ACCENT, 0.9), 1.5 * s)
}

export function createSplashIcon(size) {
  const png = new PNG({ width: size, height: size })
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      setPixel(png, x, y, SPLASH_BG)
    }
  }
  drawSplashMark(png, size / 2, size / 2, size * 0.64)
  return png
}
