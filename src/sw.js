/* eslint-env serviceworker */
import { precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { createHandlerBoundToURL } from 'workbox-precaching'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

precacheAndRoute(self.__WB_MANIFEST)

const navigationHandler = createHandlerBoundToURL('/index.html')
const navigationRoute = new NavigationRoute(navigationHandler, {
  denylist: [/^\/api\//],
})
registerRoute(navigationRoute)

registerRoute(
  ({ request, url }) => request.destination === 'script' && /target/i.test(url.pathname),
  new CacheFirst({
    cacheName: 'skywindow-target-data',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 8,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
    ],
  }),
)

function isNearLocalEightPm(date = new Date()) {
  const h = date.getHours()
  const m = date.getMinutes()
  // Allow a small window; periodic sync timing is approximate.
  return h === 20 || (h === 21 && m < 10)
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag !== 'skywindow-good-nights') return
  if (!isNearLocalEightPm(new Date())) return
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const c of allClients) {
        c.postMessage({ type: 'SKYWINDOW_RUN_GOOD_NIGHT_CHECK' })
      }
    })(),
  )
})

self.addEventListener('message', (event) => {
  const msg = event?.data
  if (!msg || typeof msg !== 'object') return

  if (msg.type === 'SKYWINDOW_NOTIFY_INIT') {
    // no-op for now; reserved for future config/data
    return
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification?.close?.()
  event.waitUntil(
    (async () => {
      const url = '/verdict'
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of allClients) {
        try {
          const clientUrl = new URL(client.url)
          if (clientUrl.pathname === url) {
            await client.focus()
            return
          }
        } catch {
          /* ignore */
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url)
    })(),
  )
})

