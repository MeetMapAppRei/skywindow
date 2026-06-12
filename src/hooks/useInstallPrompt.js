import { useCallback, useEffect, useState } from 'react'

/**
 * Captures the PWA `beforeinstallprompt` event so the UI can offer “Add to Home Screen”.
 * @returns {{ canInstall: boolean; promptInstall: () => Promise<{ outcome: string }> }}
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null)

  useEffect(() => {
    function onBeforeInstall(e) {
      e.preventDefault()
      setDeferred(e)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferred) {
      return { outcome: 'unavailable' }
    }
    deferred.prompt()
    const { outcome } = await deferred.userChoice
    setDeferred(null)
    return { outcome }
  }, [deferred])

  return {
    canInstall: Boolean(deferred),
    promptInstall,
  }
}
