import { useCallback, useEffect, useState } from 'react'
import {
  headingFromOrientationEvent,
  needsCompassPermission,
  requestCompassPermission,
} from '../lib/deviceHeading.js'

/**
 * Live phone compass heading (degrees, 0 = North).
 * @param {{ enabled?: boolean }} options
 */
export function useDeviceHeading({ enabled = true } = {}) {
  const [heading, setHeading] = useState(null)
  const [permission, setPermission] = useState(() =>
    needsCompassPermission() ? 'prompt' : 'granted',
  )

  const enableCompass = useCallback(async () => {
    if (!needsCompassPermission()) {
      setPermission('granted')
      return true
    }
    const ok = await requestCompassPermission()
    setPermission(ok ? 'granted' : 'denied')
    return ok
  }, [])

  useEffect(() => {
    if (!enabled || permission !== 'granted') return undefined
    function onOrient(e) {
      const h = headingFromOrientationEvent(e)
      if (h != null) setHeading(h)
    }
    window.addEventListener('deviceorientation', onOrient, { passive: true })
    return () => window.removeEventListener('deviceorientation', onOrient)
  }, [enabled, permission])

  return { heading, permission, enableCompass, needsPermission: needsCompassPermission() }
}
