import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Telescope } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.js'
import { estimateBortleFromCoordinates } from '../lib/bortleEstimate.js'
import LocationPicker from '../components/LocationPicker.jsx'
import BortleSelector from '../components/BortleSelector.jsx'

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

const primaryBtn = {
  marginTop: '0.25rem',
  padding: '0.75rem 1rem',
  borderRadius: 10,
  border: 'none',
  background: 'linear-gradient(135deg, #5b7cfa, #8a4dff)',
  color: '#fff',
  fontSize: '1rem',
  fontWeight: 600,
  cursor: 'pointer',
}

const ghostBtn = {
  padding: '0.65rem 0.9rem',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.05)',
  color: '#e8eef7',
  fontSize: '0.95rem',
  cursor: 'pointer',
}

export default function Onboarding() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [profileLoading, setProfileLoading] = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(true)
  const [step, setStep] = useState(1)
  const [displayName, setDisplayName] = useState('')
  const [location, setLocation] = useState({
    lat: null,
    lng: null,
    placeName: '',
  })
  const [bortle, setBortle] = useState(null)
  const [estimateBusy, setEstimateBusy] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading || !user) return

    let cancelled = false
    async function load() {
      setProfileLoading(true)
      try {
        const { data, error: qErr } = await supabase
          .from('profiles')
          .select('location_lat, display_name')
          .eq('user_id', user.id)
          .maybeSingle()
        if (qErr) throw qErr
        if (cancelled) return
        if (data?.location_lat != null) {
          setNeedsOnboarding(false)
        } else {
          setNeedsOnboarding(true)
          if (data?.display_name) setDisplayName(data.display_name)
        }
      } catch (err) {
        if (!cancelled) setError(err.message ?? 'Could not load profile')
      } finally {
        if (!cancelled) setProfileLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [authLoading, user])

  async function handleEstimateBortle() {
    if (location.lat == null || location.lng == null) {
      setError('Set your location first so we can estimate sky brightness.')
      return
    }
    setError('')
    setEstimateBusy(true)
    try {
      const z = await estimateBortleFromCoordinates(location.lat, location.lng)
      setBortle(z)
    } catch (err) {
      setError(err.message ?? 'Estimate failed')
    } finally {
      setEstimateBusy(false)
    }
  }

  async function handleFinish() {
    if (!user) return
    if (!displayName.trim()) {
      setError('Please enter a display name.')
      return
    }
    if (location.lat == null || location.lng == null) {
      setError('Please set your observing location.')
      return
    }
    if (bortle == null) {
      setError('Please choose a Bortle zone or use the estimate option.')
      return
    }
    setError('')
    setSaveBusy(true)
    try {
      const { error: upErr } = await supabase.from('profiles').upsert(
        {
          user_id: user.id,
          display_name: displayName.trim(),
          location_lat: location.lat,
          location_lng: location.lng,
          bortle_zone: bortle,
        },
        { onConflict: 'user_id' },
      )
      if (upErr) throw upErr
      navigate('/verdict', { replace: true })
    } catch (err) {
      setError(err.message ?? 'Could not save profile')
    } finally {
      setSaveBusy(false)
    }
  }

  if (authLoading || profileLoading) {
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

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!needsOnboarding) {
    return <Navigate to="/verdict" replace />
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
        <div>
          <h1 style={{ fontSize: '1.35rem', margin: 0 }}>Welcome to SkyWindow</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#b7c0d4', fontSize: '0.9rem' }}>
            Step {step} of 3
          </p>
        </div>
      </header>

      <div
        style={{
          marginTop: '1.25rem',
          display: 'flex',
          gap: '0.35rem',
        }}
        aria-hidden
      >
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 999,
              background: n <= step ? 'linear-gradient(90deg, #5b7cfa, #8a4dff)' : 'rgba(255,255,255,0.1)',
            }}
          />
        ))}
      </div>

      {step === 1 ? (
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>What should we call you?</h2>
          <p style={{ margin: '0 0 1rem', color: '#b7c0d4', fontSize: '0.95rem', lineHeight: 1.5 }}>
            This name appears on your dashboard and saved sessions.
          </p>
          <label htmlFor="onb-name" style={labelStyle}>
            Display name
          </label>
          <input
            id="onb-name"
            name="displayName"
            autoComplete="nickname"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Alex"
            style={fieldStyle}
          />
          <button
            type="button"
            onClick={() => {
              setError('')
              if (!displayName.trim()) {
                setError('Please enter a display name.')
                return
              }
              setStep(2)
            }}
            style={{ ...primaryBtn, width: '100%', marginTop: '1rem' }}
          >
            Continue
          </button>
        </section>
      ) : null}

      {step === 2 ? (
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>Set your observing location</h2>
          <p style={{ margin: '0 0 1rem', color: '#b7c0d4', fontSize: '0.95rem', lineHeight: 1.5 }}>
            We use this to filter targets for your horizon, weather, and sky brightness. GPS is optional;
            you can paste coordinates from a map app.
          </p>
          <LocationPicker value={location} onChange={setLocation} disabled={saveBusy} />
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setStep(1)} style={ghostBtn}>
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                setError('')
                if (location.lat == null || location.lng == null) {
                  setError('Use GPS or enter latitude and longitude, then tab out of the fields to confirm.')
                  return
                }
                setStep(3)
              }}
              style={{ ...primaryBtn, flex: '1 1 160px' }}
            >
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>What&apos;s your Bortle zone?</h2>
          <p style={{ margin: '0 0 1rem', color: '#b7c0d4', fontSize: '0.95rem', lineHeight: 1.5 }}>
            Pick the sky brightness at your site (1 = pristine dark sky, 9 = inner city). If you are
            unsure, we can suggest a rough value from your coordinates and OpenStreetMap context
            (not a radiance tile — see help text on the button).
          </p>
          <button
            type="button"
            onClick={handleEstimateBortle}
            disabled={estimateBusy || saveBusy}
            style={{
              ...ghostBtn,
              width: '100%',
              marginBottom: '0.75rem',
              cursor: estimateBusy ? 'wait' : 'pointer',
            }}
          >
            {estimateBusy ? 'Estimating…' : "I don't know — estimate for me"}
          </button>
          <BortleSelector value={bortle} onChange={setBortle} disabled={saveBusy} />
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setStep(2)} style={ghostBtn} disabled={saveBusy}>
              Back
            </button>
            <button
              type="button"
              onClick={handleFinish}
              disabled={saveBusy}
              style={{
                ...primaryBtn,
                flex: '1 1 200px',
                opacity: saveBusy ? 0.75 : 1,
                cursor: saveBusy ? 'wait' : 'pointer',
              }}
            >
              {saveBusy ? 'Saving…' : 'Finish & go to Tonight'}
            </button>
          </div>
        </section>
      ) : null}

      {error ? (
        <p
          role="alert"
          style={{
            marginTop: '1rem',
            fontSize: '0.9rem',
            color: '#ff9b9b',
          }}
        >
          {error}
        </p>
      ) : null}
    </main>
  )
}
