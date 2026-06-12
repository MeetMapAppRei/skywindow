import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Telescope } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.js'

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [gate, setGate] = useState('loading')
  const [profileError, setProfileError] = useState('')

  const checkProfile = useCallback(async () => {
    if (!user) return
    setGate('loading')
    setProfileError('')
    const { data, error } = await supabase
      .from('profiles')
      .select('location_lat')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) {
      setProfileError(error.message ?? 'Could not load your profile.')
      setGate('error')
      return
    }
    if (data?.location_lat == null) {
      navigate('/onboarding', { replace: true })
      return
    }
    setGate('ready')
  }, [user, navigate])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      await checkProfile()
      if (cancelled) return
    })()
    return () => {
      cancelled = true
    }
  }, [user, checkProfile])

  if (gate === 'loading') {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          color: '#b7c0d4',
          padding: '1.25rem',
        }}
      >
        Loading…
      </div>
    )
  }

  if (gate === 'error') {
    return (
      <main
        style={{
          maxWidth: 520,
          margin: '0 auto',
          padding: '1.25rem',
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <header style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Telescope aria-hidden size={28} />
          <h1 style={{ fontSize: '1.35rem', margin: 0 }}>Dashboard</h1>
        </header>
        <p role="alert" style={{ marginTop: '1rem', color: '#fca5a5', lineHeight: 1.5 }}>
          {profileError}
        </p>
        <button
          type="button"
          onClick={() => checkProfile()}
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
          Try again
        </button>
        <Link to="/tonight" style={{ marginTop: '1rem', color: '#8aa4ff', textDecoration: 'none' }}>
          Skip to Tonight
        </Link>
      </main>
    )
  }

  return (
    <main
      style={{
        maxWidth: 520,
        margin: '0 auto',
        padding: '1.25rem',
        minHeight: '100dvh',
      }}
    >
      <header style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <Telescope aria-hidden size={28} />
        <h1 style={{ fontSize: '1.35rem', margin: 0 }}>Dashboard</h1>
      </header>
      <p style={{ marginTop: '1rem', color: '#b7c0d4' }}>
        Signed in as <span style={{ color: '#dbe6ff' }}>{user?.email ?? '—'}</span>
      </p>
      <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <Link
          to="/tonight"
          style={{
            textAlign: 'center',
            padding: '0.65rem 1rem',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(138,164,255,0.14)',
            color: '#e8eef7',
            fontSize: '1rem',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Tonight dashboard
        </Link>
        <Link
          to="/targets"
          style={{
            textAlign: 'center',
            padding: '0.65rem 1rem',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)',
            color: '#e8eef7',
            fontSize: '1rem',
            textDecoration: 'none',
          }}
        >
          Simple target list
        </Link>
        <Link
          to="/profile"
          style={{
            textAlign: 'center',
            padding: '0.65rem 1rem',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)',
            color: '#e8eef7',
            fontSize: '1rem',
            textDecoration: 'none',
          }}
        >
          Edit profile & location
        </Link>
        <Link
          to="/equipment"
          style={{
            textAlign: 'center',
            padding: '0.65rem 1rem',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)',
            color: '#e8eef7',
            fontSize: '1rem',
            textDecoration: 'none',
          }}
        >
          My equipment
        </Link>
        <Link
          to="/sessions"
          style={{
            textAlign: 'center',
            padding: '0.65rem 1rem',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)',
            color: '#e8eef7',
            fontSize: '1rem',
            textDecoration: 'none',
          }}
        >
          Session history
        </Link>
        <Link
          to="/log-session"
          style={{
            textAlign: 'center',
            padding: '0.65rem 1rem',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(138,164,255,0.14)',
            color: '#e8eef7',
            fontSize: '1rem',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Log a session
        </Link>
        <button
          type="button"
          onClick={() => signOut()}
          style={{
            padding: '0.65rem 1rem',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)',
            color: '#e8eef7',
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          Sign out
        </button>
        <Link
          to="/"
          style={{
            textAlign: 'center',
            color: '#8aa4ff',
            textDecoration: 'none',
            fontSize: '0.95rem',
          }}
        >
          Back to home
        </Link>
      </div>
    </main>
  )
}
