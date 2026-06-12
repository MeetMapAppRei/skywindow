import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Telescope } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.js'
import { useNightConditions } from '../hooks/useNightConditions.js'
import { getUserEquipment } from '../lib/equipment.js'
import { formatSupabaseClientMessage } from '../lib/supabaseErrors.js'
import { getRecommendedTargets } from '../lib/targetEngine.js'
import ConditionsBar from '../components/ConditionsBar.jsx'
import HorizonSilhouette from '../components/HorizonSilhouette.jsx'

const LS_SKY = 'skywindow:activeSkyProfileId'
const SKY_NONE = '__none__'

function horizonHasPoints(horizonData) {
  if (!horizonData) return false
  const pts = Array.isArray(horizonData) ? horizonData : horizonData.points
  return Array.isArray(pts) && pts.length > 0
}

export default function NightTargets() {
  const { user, loading: authLoading } = useAuth()
  const {
    moonPhase,
    weather,
    conditions,
    loading: condLoading,
    error: conditionsError,
  } = useNightConditions()
  const [profile, setProfile] = useState(null)
  const [primaryEquipment, setPrimaryEquipment] = useState(null)
  const [skyProfiles, setSkyProfiles] = useState([])
  const [selectedSkyProfileId, setSelectedSkyProfileId] = useState(SKY_NONE)
  const [loadError, setLoadError] = useState('')
  const [ready, setReady] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    if (authLoading || !user) return

    let cancelled = false
    async function load() {
      setLoadError('')
      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .select('location_lat, location_lng, bortle_zone')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (pErr) {
        setLoadError(
          formatSupabaseClientMessage(pErr.message) || pErr.message || 'Could not load profile',
        )
        setReady(true)
        return
      }
      if (prof?.location_lat == null) {
        setProfile(null)
        setReady(true)
        return
      }
      setProfile(prof)

      const [{ data: eqRows, error: eErr }, { data: skyRows, error: sErr }] = await Promise.all([
        getUserEquipment(user.id),
        supabase
          .from('sky_profiles')
          .select('id, label, horizon_data, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ])
      if (cancelled) return
      if (eErr) {
        setLoadError(
          formatSupabaseClientMessage(eErr.message) || eErr.message || 'Could not load equipment',
        )
        setPrimaryEquipment({ aperture_mm: 200, type: 'visual' })
        setSkyProfiles(skyRows ?? [])
        setReady(true)
        return
      }
      if (sErr && !eErr) {
        setLoadError(
          formatSupabaseClientMessage(sErr.message) || sErr.message || 'Could not load sky profiles',
        )
      }
      const first = eqRows?.[0]
      setPrimaryEquipment(
        first ?? { aperture_mm: 200, type: 'visual', name: 'Default 200mm visual' },
      )
      setSkyProfiles(skyRows ?? [])

      try {
        const lsSky = localStorage.getItem(LS_SKY)
        if (lsSky === SKY_NONE) setSelectedSkyProfileId(SKY_NONE)
        else if (lsSky && (skyRows ?? []).some((r) => r.id === lsSky)) setSelectedSkyProfileId(lsSky)
        else setSelectedSkyProfileId(SKY_NONE)
      } catch {
        /* ignore */
      }
      setReady(true)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [authLoading, user, retryNonce])

  const nightDate = useMemo(() => new Date(), [])

  const activeHorizon = useMemo(() => {
    if (selectedSkyProfileId === SKY_NONE) return null
    const row = skyProfiles.find((s) => s.id === selectedSkyProfileId)
    return row?.horizon_data ?? null
  }, [skyProfiles, selectedSkyProfileId])

  const targets = useMemo(() => {
    if (!profile?.location_lat || !primaryEquipment) return []
    const { visible } = getRecommendedTargets({
      date: nightDate,
      lat: Number(profile.location_lat),
      lng: Number(profile.location_lng),
      bortleZone: Number(profile.bortle_zone) || 5,
      horizonData: null,
      apertureMm: Number(primaryEquipment.aperture_mm) || 200,
      equipmentType: primaryEquipment.type || 'visual',
      excludeMoonlit: false,
      moonPhase: moonPhase ?? undefined,
      weather: weather ?? undefined,
    })
    return visible
  }, [profile, primaryEquipment, moonPhase, weather, nightDate])

  if (authLoading || !ready) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '0.65rem',
          maxWidth: 520,
          margin: '0 auto',
          padding: '1.25rem',
        }}
        aria-busy="true"
      >
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>Loading targets…</p>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: 72,
              borderRadius: 10,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.05) 100%)',
              backgroundSize: '200% 100%',
              animation: 'nt-shimmer 1.1s ease-in-out infinite',
            }}
          />
        ))}
        <style>{`@keyframes nt-shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }`}</style>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!profile?.location_lat) {
    return <Navigate to="/onboarding" replace />
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
      <header style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Telescope aria-hidden size={28} />
        <h1 style={{ fontSize: '1.35rem', margin: 0 }}>Tonight&apos;s targets</h1>
      </header>

      {loadError ? (
        <div style={{ marginTop: '0.75rem' }}>
          <p role="alert" style={{ margin: '0 0 0.5rem', color: '#fca5a5', fontSize: '0.9rem' }}>
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => {
              setReady(false)
              setRetryNonce((n) => n + 1)
            }}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: 8,
              border: '1px solid rgba(138,164,255,0.45)',
              background: 'rgba(138,164,255,0.12)',
              color: '#e8eef7',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      ) : null}

      {conditionsError ? (
        <p role="alert" style={{ marginTop: '0.5rem', color: '#fca5a5', fontSize: '0.9rem' }}>
          {conditionsError}
        </p>
      ) : null}

      <ConditionsBar
        moonPhase={moonPhase}
        weather={weather}
        conditions={conditions}
        bortleZone={profile?.bortle_zone != null ? Number(profile.bortle_zone) : null}
        nightDate={nightDate}
      />

      {condLoading && !moonPhase ? (
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Updating sky conditions…</p>
      ) : null}

      <p style={{ marginTop: '0.25rem', marginBottom: '0.75rem', color: '#b7c0d4', fontSize: '0.88rem' }}>
        Using {primaryEquipment?.name ?? 'equipment'} · ranked by visibility score; condition score
        includes clouds, moon brightness, and distance from the Moon.
      </p>

      {horizonHasPoints(activeHorizon) ? (
        <div style={{ margin: '0.75rem 0 0.9rem' }}>
          <HorizonSilhouette horizonData={activeHorizon} height={70} showLabels />
        </div>
      ) : null}

      {!loadError && targets.length === 0 ? (
        <p style={{ marginTop: '0.85rem', color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.55 }}>
          No ranked targets for this combination yet. Confirm your profile location under{' '}
          <Link to="/profile" style={{ color: '#8aa4ff' }}>
            Profile
          </Link>
          , add equipment, then open{' '}
          <Link to="/tonight" style={{ color: '#8aa4ff' }}>
            Tonight
          </Link>{' '}
          for the full filterable list.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {targets.map((t) => (
            <li
              key={t.id}
              style={{
                padding: '0.75rem 0.85rem',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              <div style={{ fontWeight: 600, color: '#e8eef7' }}>{t.name}</div>
              <div style={{ marginTop: '0.35rem', fontSize: '0.82rem', color: '#94a3b8' }}>
                Best ~{t.visibility.bestTime} · max alt {t.visibility.maxAlt}° · score {t.score} ·
                conditions {t.conditionScore}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Link to="/tonight" style={{ color: '#8aa4ff', textDecoration: 'none', fontSize: '0.95rem' }}>
          Tonight dashboard
        </Link>
        <Link
          to="/dashboard"
          style={{ color: '#8aa4ff', textDecoration: 'none', fontSize: '0.95rem' }}
        >
          Back to dashboard
        </Link>
        <Link to="/equipment" style={{ color: '#8aa4ff', textDecoration: 'none', fontSize: '0.95rem' }}>
          My equipment
        </Link>
      </div>
    </main>
  )
}
