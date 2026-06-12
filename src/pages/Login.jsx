import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Telescope } from 'lucide-react'
import { supabase, signUpWithProfile } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.js'
import Splash from '../components/Splash.jsx'

const fieldStyle = {
  width: '100%',
  padding: '0.75rem 0.85rem',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(0,0,0,0.25)',
  color: '#e8eef7',
  fontSize: '1rem',
}

const labelStyle = {
  display: 'block',
  fontSize: '0.85rem',
  color: '#b7c0d4',
  marginBottom: '0.35rem',
}

export default function Login() {
  const { t } = useTranslation()
  const { user, loading, authError } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (loading) {
    return <Splash />
  }

  if (authError) {
    return (
      <main
        style={{
          maxWidth: 420,
          margin: '0 auto',
          padding: '1.25rem',
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <p role="alert" style={{ color: '#fca5a5', lineHeight: 1.55 }}>
          {authError}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: '1.25rem',
            padding: '0.75rem 1rem',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(135deg, #5b7cfa, #8a4dff)',
            color: '#fff',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('common.reload')}
        </button>
      </main>
    )
  }

  if (user) {
    return <Navigate to="/verdict" replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (signInError) throw signInError
        const uid = signInData.user?.id
        if (uid) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('location_lat')
            .eq('user_id', uid)
            .maybeSingle()
          navigate(prof?.location_lat == null ? '/onboarding' : '/verdict', { replace: true })
        } else {
          navigate('/verdict', { replace: true })
        }
      } else {
        const signUpData = await signUpWithProfile(email.trim(), password)
        const uid = signUpData?.user?.id
        if (uid) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('location_lat')
            .eq('user_id', uid)
            .maybeSingle()
          navigate(prof?.location_lat == null ? '/onboarding' : '/verdict', { replace: true })
        } else {
          navigate('/verdict', { replace: true })
        }
      }
    } catch (err) {
      setError(err.message ?? t('auth.somethingWrong'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main
      style={{
        maxWidth: 420,
        margin: '0 auto',
        padding: '1.25rem',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <header
        style={{
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center',
          marginBottom: '1.25rem',
        }}
      >
        <Telescope aria-hidden size={28} />
        <h1 style={{ fontSize: '1.35rem', margin: 0 }}>SkyWindow</h1>
      </header>

      <div
        role="tablist"
        aria-label={t('auth.signInOrUp')}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.5rem',
          marginBottom: '1.25rem',
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signin'}
          onClick={() => {
            setMode('signin')
            setError('')
          }}
          style={{
            padding: '0.6rem 0.5rem',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.12)',
            background:
              mode === 'signin' ? 'rgba(138,164,255,0.18)' : 'rgba(255,255,255,0.04)',
            color: '#e8eef7',
            fontSize: '0.95rem',
            cursor: 'pointer',
          }}
        >
          {t('auth.signIn')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          onClick={() => {
            setMode('signup')
            setError('')
          }}
          style={{
            padding: '0.6rem 0.5rem',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.12)',
            background:
              mode === 'signup' ? 'rgba(138,164,255,0.18)' : 'rgba(255,255,255,0.04)',
            color: '#e8eef7',
            fontSize: '0.95rem',
            cursor: 'pointer',
          }}
        >
          {t('auth.signUp')}
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label htmlFor="login-email" style={labelStyle}>
            {t('auth.email')}
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={fieldStyle}
          />
        </div>
        <div>
          <label htmlFor="login-password" style={labelStyle}>
            {t('auth.password')}
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={fieldStyle}
          />
        </div>

        {error ? (
          <p
            role="alert"
            style={{
              margin: 0,
              fontSize: '0.9rem',
              color: '#ff9b9b',
            }}
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          style={{
            marginTop: '0.25rem',
            padding: '0.75rem 1rem',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(135deg, #5b7cfa, #8a4dff)',
            color: '#fff',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.75 : 1,
          }}
        >
          {busy ? t('common.pleaseWait') : mode === 'signin' ? t('auth.signIn') : t('auth.createAccount')}
        </button>
      </form>

      <p style={{ marginTop: '1.25rem', textAlign: 'center', color: '#b7c0d4', fontSize: '0.9rem' }}>
        <Link to="/register" style={{ color: '#8aa4ff' }}>
          {t('auth.fullRegistration')}
        </Link>
        {' · '}
        <Link to="/privacy" style={{ color: '#8aa4ff' }}>
          {t('auth.privacy')}
        </Link>
        {' · '}
        <Link to="/" style={{ color: '#8aa4ff' }}>
          {t('profile.home')}
        </Link>
      </p>
    </main>
  )
}
