import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { getMoonPhase } from './astronomy.js'
import { getRecommendedTargets } from './targetEngine.js'
import { supabase } from './supabase.js'
import { getObservingForecast } from './weather.js'

const PERMISSION_KEY = 'skywindow-notification-permission-v1'
const GOOD_NIGHT_SCHEDULE_ID = 9001
const GOOD_NIGHT_ALERT_BASE_ID = 9100
const NATIVE_CHANNEL_ID = 'skywindow-good-nights'

let nativeChannelReady = false
let nativeResumeCheckDay = null
let nativeTimeoutId = null

function isNative() {
  return Capacitor.isNativePlatform()
}

function hasWebNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window
}

function hasServiceWorker() {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator
}

function storePermission(value) {
  try {
    localStorage.setItem(PERMISSION_KEY, value)
  } catch {
    /* ignore */
  }
}

function nextLocalEightPm(now = new Date()) {
  const t = new Date(now)
  t.setHours(20, 0, 0, 0)
  if (t.getTime() <= now.getTime()) t.setDate(t.getDate() + 1)
  return t
}

function buildGoodNightTitle(targets) {
  const names = (targets || []).map((t) => t?.name).filter(Boolean)
  const first = names[0] || 'Tonight'
  const second = names[1]
  const more = Math.max(0, names.length - 2)

  if (!second) return `🔭 Good skies tonight — ${first} is up`
  if (more <= 0) return `🔭 Good skies tonight — ${first}, ${second} are up`
  return `🔭 Good skies tonight — ${first}, ${second} and ${more} more targets are up`
}

async function ensureNativeChannel() {
  if (!isNative() || nativeChannelReady) return
  if (Capacitor.getPlatform() === 'android') {
    await LocalNotifications.createChannel({
      id: NATIVE_CHANNEL_ID,
      name: 'Good night alerts',
      description: 'Alerts when observing conditions look favorable tonight',
      importance: 4,
      visibility: 1,
    })
  }
  nativeChannelReady = true
}

function mapNativePermission(result) {
  const display = result?.display
  if (display === 'granted') return 'granted'
  if (display === 'denied') return 'denied'
  return 'prompt'
}

export async function requestPermission() {
  if (isNative()) {
    try {
      await ensureNativeChannel()
      const current = await LocalNotifications.checkPermissions()
      if (mapNativePermission(current) === 'granted') {
        storePermission('granted')
        return 'granted'
      }
      const result = await LocalNotifications.requestPermissions()
      const mapped = mapNativePermission(result)
      storePermission(mapped === 'granted' ? 'granted' : 'denied')
      return mapped === 'granted' ? 'granted' : 'denied'
    } catch {
      storePermission('denied')
      return 'denied'
    }
  }

  if (!hasWebNotifications()) return 'unsupported'
  try {
    const result = await Notification.requestPermission()
    storePermission(result)
    return result
  } catch {
    storePermission('denied')
    return 'denied'
  }
}

async function sendNativeGoodNightAlert(targets) {
  await ensureNativeChannel()
  const title = buildGoodNightTitle(targets)
  const id = GOOD_NIGHT_ALERT_BASE_ID + (Date.now() % 1000)
  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title,
        body: 'Tap to see your verdict and tonight’s list.',
        channelId: NATIVE_CHANNEL_ID,
        extra: { url: '/verdict' },
      },
    ],
  })
}

async function sendWebGoodNightAlert(targets) {
  if (!hasWebNotifications()) return
  if (Notification.permission !== 'granted') return

  const title = buildGoodNightTitle(targets)

  try {
    if (hasServiceWorker()) {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification(title, {
        body: 'Tap to see your verdict and tonight’s list.',
        tag: 'skywindow-good-night',
        renotify: false,
        data: { url: '/verdict' },
      })
      return
    }
  } catch {
    // fall back to page notifications
  }

  try {
    new Notification(title, { data: { url: '/verdict' } })
  } catch {
    /* ignore */
  }
}

export async function sendGoodNightAlert(targets) {
  if (isNative()) {
    await sendNativeGoodNightAlert(targets)
    return
  }
  await sendWebGoodNightAlert(targets)
}

async function runGoodNightCheckNow() {
  if (isNative()) {
    const { display } = await LocalNotifications.checkPermissions()
    if (display !== 'granted') return
  } else {
    if (!hasWebNotifications()) return
    if (Notification.permission !== 'granted') return
  }

  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) return

  const { data: prof } = await supabase
    .from('profiles')
    .select('location_lat, location_lng, bortle_zone, notify_good_nights')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!prof?.notify_good_nights) return
  if (prof.location_lat == null || prof.location_lng == null) return

  const lat = Number(prof.location_lat)
  const lng = Number(prof.location_lng)
  const bortleZone = Number(prof.bortle_zone) || 5

  const now = new Date()
  const moonPhase = getMoonPhase(now)
  const weather = await getObservingForecast(lat, lng, now).catch(() => null)

  const { visible } = getRecommendedTargets({
    date: now,
    lat,
    lng,
    bortleZone,
    horizonData: null,
    apertureMm: 200,
    equipmentType: 'visual',
    excludeMoonlit: false,
    moonPhase,
    weather: weather ?? undefined,
  })

  const cloud = Math.max(0, Math.min(100, Number(weather?.tonight?.avgCloudCover) || 100))
  const maxCloud = Math.max(0, Math.min(100, Number(weather?.tonight?.maxCloudCover) || cloud))
  const lateCloud = Math.max(0, Math.min(100, Number(weather?.tonight?.lateCloudCover) || cloud))
  const cloudTrend = weather?.tonight?.cloudTrend ?? 'mixed'
  const illum = Math.max(0, Math.min(100, Number(moonPhase?.illumination) || 100))
  const goodCount = visible.filter((t) => (Number(t.conditionScore) || 0) > 60).length

  const skiesClearEnough =
    cloud < 25 &&
    maxCloud < 60 &&
    !(cloudTrend === 'building' && lateCloud >= 35)

  const isGoodNight = skiesClearEnough && illum < 40 && goodCount >= 3
  if (!isGoodNight) return

  await sendGoodNightAlert(visible.slice(0, 6))
}

export async function checkGoodNightNow() {
  return runGoodNightCheckNow()
}

export function maybeCheckGoodNightOnResume() {
  const now = new Date()
  if (now.getHours() < 20) return
  const dayKey = now.toDateString()
  if (nativeResumeCheckDay === dayKey) return
  nativeResumeCheckDay = dayKey
  runGoodNightCheckNow().catch(() => {})
}

function clearNativeTimeout() {
  if (nativeTimeoutId != null) {
    clearTimeout(nativeTimeoutId)
    nativeTimeoutId = null
  }
}

function scheduleNativeOpenTimeout() {
  clearNativeTimeout()
  const now = new Date()
  const next = nextLocalEightPm(now)
  const delay = Math.max(1000, next.getTime() - now.getTime())
  nativeTimeoutId = setTimeout(() => {
    runGoodNightCheckNow()
      .catch(() => {})
      .finally(() => {
        scheduleNativeOpenTimeout()
      })
  }, delay)
}

async function scheduleNativeNightCheck() {
  await ensureNativeChannel()
  await LocalNotifications.cancel({ notifications: [{ id: GOOD_NIGHT_SCHEDULE_ID }] })

  await LocalNotifications.schedule({
    notifications: [
      {
        id: GOOD_NIGHT_SCHEDULE_ID,
        title: 'SkyWindow',
        body: 'Checking tonight’s observing conditions…',
        channelId: NATIVE_CHANNEL_ID,
        schedule: {
          on: { hour: 20, minute: 0 },
          allowWhileIdle: true,
          repeats: true,
        },
        extra: { action: 'good-night-check', url: '/verdict' },
      },
    ],
  })

  scheduleNativeOpenTimeout()
  return { ok: true, nextRunAt: nextLocalEightPm().toISOString() }
}

export async function cancelNightCheck() {
  clearNativeTimeout()
  if (!isNative()) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: GOOD_NIGHT_SCHEDULE_ID }] })
  } catch {
    /* ignore */
  }
}

async function scheduleWebNightCheck() {
  if (!hasWebNotifications()) return { ok: false, reason: 'unsupported' }
  if (Notification.permission !== 'granted') return { ok: false, reason: 'permission' }

  if (hasServiceWorker()) {
    try {
      const reg = await navigator.serviceWorker.ready
      reg.active?.postMessage({ type: 'SKYWINDOW_NOTIFY_INIT', payload: { url: '/verdict' } })

      if ('periodicSync' in reg) {
        await reg.periodicSync.register('skywindow-good-nights', { minInterval: 24 * 60 * 60 * 1000 })
      }
    } catch {
      /* ignore */
    }
  }

  const now = new Date()
  const next = nextLocalEightPm(now)
  const delay = Math.max(1000, next.getTime() - now.getTime())

  setTimeout(() => {
    runGoodNightCheckNow().finally(() => {
      scheduleWebNightCheck()
    })
  }, delay)

  return { ok: true, nextRunAt: next.toISOString() }
}

export async function scheduleNightCheck() {
  if (isNative()) {
    const { display } = await LocalNotifications.checkPermissions()
    if (display !== 'granted') return { ok: false, reason: 'permission' }
    return scheduleNativeNightCheck()
  }
  return scheduleWebNightCheck()
}

export function openNotificationUrl(url = '/verdict') {
  if (typeof window === 'undefined') return
  const path = url.startsWith('/') ? url : `/${url}`
  if (window.location.pathname !== path) {
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
}
