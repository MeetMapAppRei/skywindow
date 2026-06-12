import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import {
  checkGoodNightNow,
  maybeCheckGoodNightOnResume,
  openNotificationUrl,
} from './notifications.js'

/** One-time native shell setup (status bar, splash, notifications). Safe to call on web. */
export async function bootstrapNativeShell() {
  if (!Capacitor.isNativePlatform()) return

  try {
    await StatusBar.setStyle({ style: Style.Dark })
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#0a0e1a' })
    }
  } catch {
    /* plugin unavailable in browser dev */
  }

  try {
    await SplashScreen.hide()
  } catch {
    /* ignore */
  }

  try {
    await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      const extra = event.notification?.extra || {}
      if (extra.action === 'good-night-check') {
        checkGoodNightNow().catch(() => {})
      }
      openNotificationUrl(extra.url || '/verdict')
    })

    await LocalNotifications.addListener('localNotificationReceived', (event) => {
      if (event.id === 9001) {
        checkGoodNightNow().catch(() => {})
      }
    })

    await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) maybeCheckGoodNightOnResume()
    })
  } catch {
    /* notifications unavailable */
  }
}
