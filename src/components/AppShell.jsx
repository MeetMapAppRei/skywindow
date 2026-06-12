import { useLayoutEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import BottomNav from './BottomNav.jsx'
import { ShellHeaderProvider, useShellHeader } from '../context/ShellHeaderContext.jsx'
import { useInstallPrompt } from '../hooks/useInstallPrompt.js'

function AppHeader() {
  const { rightAction } = useShellHeader()

  return (
    <header className="app-shell__header">
      <span className="app-shell__brand">SkyWindow</span>
      <div className="app-shell__header-actions">{rightAction}</div>
    </header>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [pathname])

  return null
}

function InstallBanner() {
  const { t } = useTranslation()
  const { canInstall, promptInstall } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(false)

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
  const isCapacitorNative = window.Capacitor?.isNativePlatform?.() === true
  if (isIOS || isCapacitorNative) return null

  if (!canInstall || dismissed) return null

  return (
    <div
      className="pwa-install-banner"
      style={{
        margin: '0 0 0.65rem',
        padding: '0.65rem 0.75rem',
        borderRadius: 12,
        border: '1px solid rgba(138,164,255,0.35)',
        background: 'rgba(138,164,255,0.1)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.5rem 0.75rem',
        fontSize: '0.88rem',
        color: '#e8eef7',
      }}
    >
      <span style={{ flex: '1 1 180px' }}>{t('shell.installPrompt')}</span>
      <button
        type="button"
        onClick={async () => {
          await promptInstall()
        }}
        style={{
          padding: '0.45rem 0.85rem',
          borderRadius: 8,
          border: 'none',
          background: 'linear-gradient(135deg, #5b7cfa, #8a4dff)',
          color: '#fff',
          fontWeight: 600,
          fontSize: '0.85rem',
          cursor: 'pointer',
        }}
      >
        {t('shell.installAdd')}
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        style={{
          padding: '0.45rem 0.65rem',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'transparent',
          color: '#b7c0d4',
          fontSize: '0.82rem',
          cursor: 'pointer',
        }}
      >
        {t('common.dismiss')}
      </button>
    </div>
  )
}

export default function AppShell() {
  return (
    <ShellHeaderProvider>
      <div className="app-shell">
        <ScrollToTop />
        <AppHeader />
        <main className="app-shell__main">
          <InstallBanner />
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </ShellHeaderProvider>
  )
}

