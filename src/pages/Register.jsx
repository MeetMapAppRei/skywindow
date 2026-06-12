import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
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

export default function Register() {
  const { user, loading, authError } = useAuth()
  const navigate = useNavigate()
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
          Reload
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
    } catch (err) {
      setError(err.message ?? 'Something went wrong')
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
          marginBottom: '0.75rem',
        }}
      >
        <Telescope aria-hidden size={28} />
        <h1 style={{ fontSize: '1.35rem', margin: 0 }}>Create account</h1>
      </header>
      <p style={{ margin: '0 0 1.25rem', color: '#b7c0d4', fontSize: '0.95rem', lineHeight: 1.5 }}>
        We will create your SkyWindow account and a blank profile row so you can add gear, sky
        profiles, and sessions next.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label htmlFor="register-email" style={labelStyle}>
            Email
          </label>
          <input
            id="register-email"
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
          <label htmlFor="register-password" style={labelStyle}>
            Password
          </label>
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
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
          {busy ? 'Creating account…' : 'Register'}
        </button>
      </form>

      <p style={{ marginTop: '1.25rem', textAlign: 'center', color: '#b7c0d4', fontSize: '0.9rem' }}>
        Already have an account?{' '}
        <Link to="/login" style={{ color: '#8aa4ff' }}>
          Sign in
        </Link>
      </p>
    </main>
  )
}
