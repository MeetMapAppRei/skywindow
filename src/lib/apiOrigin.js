import { Capacitor } from '@capacitor/core'

/**
 * Web app origin for same-origin `/api` routes.
 * On native (Capacitor), the bundle is local — API calls must hit the deployed Vercel host.
 */
export function getAppOrigin() {
  if (!Capacitor.isNativePlatform()) return ''

  const origin = String(import.meta.env.VITE_APP_ORIGIN || '').trim().replace(/\/$/, '')
  if (!origin) {
    console.warn(
      '[SkyWindow] Set VITE_APP_ORIGIN to your production URL (e.g. https://skywindow.vercel.app) before building the native app.',
    )
  }
  return origin
}

/** @param {string} path — e.g. `/api/analyze-horizon` */
export function apiUrl(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const origin = getAppOrigin()
  return origin ? `${origin}${normalized}` : normalized
}

export function isNativeApp() {
  return Capacitor.isNativePlatform()
}
