import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'
import './i18n.js'
import './index.css'
import { AuthProvider, useAuth } from './hooks/useAuth.js'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AppShell from './components/AppShell.jsx'
import Splash from './components/Splash.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { Capacitor } from '@capacitor/core'
import { checkGoodNightNow } from './lib/notifications.js'
import { bootstrapNativeShell } from './lib/nativeBootstrap.js'

const Login = lazy(() => import('./pages/Login.jsx'))
const Register = lazy(() => import('./pages/Register.jsx'))
const Onboarding = lazy(() => import('./pages/Onboarding.jsx'))
const Tonight = lazy(() => import('./pages/Tonight.jsx'))
const SkyProfiles = lazy(() => import('./pages/SkyProfiles.jsx'))
const Equipment = lazy(() => import('./pages/Equipment.jsx'))
const Sessions = lazy(() => import('./pages/Sessions.jsx'))
const Profile = lazy(() => import('./pages/Profile.jsx'))
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const NightTargets = lazy(() => import('./pages/NightTargets.jsx'))
const LogSession = lazy(() => import('./pages/LogSession.jsx'))
const Verdict = lazy(() => import('./pages/Verdict.jsx'))
const Calendar = lazy(() => import('./pages/Calendar.jsx'))
const Planner = lazy(() => import('./pages/Planner.jsx'))
const Privacy = lazy(() => import('./pages/Privacy.jsx'))
const DeleteAccount = lazy(() => import('./pages/DeleteAccount.jsx'))
const DeleteData = lazy(() => import('./pages/DeleteData.jsx'))

bootstrapNativeShell()

if (import.meta.env.PROD && !Capacitor.isNativePlatform()) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true })
  })
}

if (import.meta.env.PROD && !Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const msg = event?.data
    if (msg?.type === 'SKYWINDOW_RUN_GOOD_NIGHT_CHECK') {
      checkGoodNightNow().catch(() => {})
    }
  })
}

function IndexRedirect() {
  const { user } = useAuth()
  return <Navigate to={user ? '/verdict' : '/login'} replace />
}

function AppRoutes() {
  const { loading } = useAuth()
  if (loading) {
    return <Splash />
  }

  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route path="/" element={<IndexRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/delete-account" element={<DeleteAccount />} />
        <Route path="/delete-data" element={<DeleteData />} />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          }
        />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/verdict" element={<Verdict />} />
            <Route path="/tonight" element={<Tonight />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/planner" element={<Planner />} />
            <Route path="/sky-profiles" element={<SkyProfiles />} />
            <Route path="/equipment" element={<Equipment />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/targets"
          element={
            <ProtectedRoute>
              <NightTargets />
            </ProtectedRoute>
          }
        />
        <Route
          path="/log-session"
          element={
            <ProtectedRoute>
              <LogSession />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
