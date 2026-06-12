import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Telescope } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.js'
import { getUserEquipment } from '../lib/equipment.js'
import { formatSupabaseClientMessage } from '../lib/supabaseErrors.js'
import { saveSession } from '../lib/sessions.js'
import { TARGETS } from '../data/targets.js'
import LocationPicker from '../components/LocationPicker.jsx'

const SKY_NONE = '__none__'

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

const selectStyle = {
  width: '100%',
  marginTop: '0.35rem',
  padding: '0.55rem 0.65rem',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(0,0,0,0.25)',
  color: '#e8eef7',
  fontSize: '0.9rem',
}

function defaultLocalDateString() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const LS_EQUIP = 'skywindow:activeEquipmentId'
const LS_SKY = 'skywindow:activeSkyProfileId'

/**
 * @typedef {{ id: string; notes: string }} ObservedTarget
 */

export default function LogSession() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [profileLat, setProfileLat] = useState(null)
  const [profileLng, setProfileLng] = useState(null)
  const [equipmentList, setEquipmentList] = useState([])
  const [skyProfiles, setSkyProfiles] = useState([])

  const [sessionDate, setSessionDate] = useState(defaultLocalDateString)
  const [equipmentId, setEquipmentId] = useState('')
  const [skyProfileId, setSkyProfileId] = useState(SKY_NONE)
  const [locationMode, setLocationMode] = useState('profile')
  const [overrideLocation, setOverrideLocation] = useState({
    lat: null,
    lng: null,
    placeName: '',
  })

  const [targetQuery, setTargetQuery] = useState('')
  /** @type {[Map<string, string>, function]} — id -> per-target notes */
  const [observedNotes, setObservedNotes] = useState(() => new Map())
  const [generalNotes, setGeneralNotes] = useState('')

  const [saveBusy, setSaveBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const [{ data: prof, error: pErr }, { data: eqRows, error: eErr }, { data: skyRows, error: sErr }] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('location_lat, location_lng')
            .eq('user_id', user.id)
            .maybeSingle(),
          getUserEquipment(user.id),
          supabase
            .from('sky_profiles')
            .select('id, label, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
        ])
      if (pErr) throw pErr
      if (eErr) throw eErr
      if (sErr) throw sErr

      setProfileLat(prof?.location_lat ?? null)
      setProfileLng(prof?.location_lng ?? null)
      setEquipmentList(eqRows ?? [])
      setSkyProfiles(skyRows ?? [])

      try {
        const lsEq = localStorage.getItem(LS_EQUIP)
        if (lsEq && (eqRows ?? []).some((r) => r.id === lsEq)) setEquipmentId(lsEq)
        else if ((eqRows ?? []).length) setEquipmentId(eqRows[0].id)
        else setEquipmentId('')

        const lsSky = localStorage.getItem(LS_SKY)
        if (lsSky === SKY_NONE) setSkyProfileId(SKY_NONE)
        else if (lsSky && (skyRows ?? []).some((r) => r.id === lsSky)) setSkyProfileId(lsSky)
        else setSkyProfileId(SKY_NONE)
      } catch {
        /* ignore */
      }
    } catch (err) {
      const raw = err && typeof err === 'object' && 'message' in err ? err.message : ''
      setError(formatSupabaseClientMessage(raw) || raw || 'Could not load form data')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (authLoading || !user) return
    load()
  }, [authLoading, user, load])

  const filteredTargets = useMemo(() => {
    const q = targetQuery.trim().toLowerCase()
    if (!q) return TARGETS.slice(0, 12)
    return TARGETS.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        (t.type && t.type.toLowerCase().includes(q)),
    ).slice(0, 20)
  }, [targetQuery])

  const selectedIds = useMemo(() => [...observedNotes.keys()], [observedNotes])

  function addTarget(id) {
    setObservedNotes((prev) => {
      const next = new Map(prev)
      if (!next.has(id)) next.set(id, '')
      return next
    })
    setTargetQuery('')
  }

  function removeTarget(id) {
    setObservedNotes((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }

  function setNotesForTarget(id, notes) {
    setObservedNotes((prev) => {
      const next = new Map(prev)
      if (next.has(id)) next.set(id, notes)
      return next
    })
  }

  const effectiveLatLng = useMemo(() => {
    if (locationMode === 'override') {
      return { lat: overrideLocation.lat, lng: overrideLocation.lng }
    }
    return { lat: profileLat, lng: profileLng }
  }, [locationMode, overrideLocation.lat, overrideLocation.lng, profileLat, profileLng])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!user) return
    setError('')
    const { lat, lng } = effectiveLatLng
    if (lat == null || lng == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
      setError(
        locationMode === 'profile'
          ? 'Your profile has no saved location. Set one under Profile or use GPS override below.'
          : 'Set a valid override location (GPS or coordinates).',
      )
      return
    }
    if (equipmentList.length > 0 && !equipmentId) {
      setError('Select the equipment you used.')
      return
    }

    const targets_observed = selectedIds.map((id) => ({
      id,
      notes: (observedNotes.get(id) ?? '').trim(),
    }))

    setSaveBusy(true)
    try {
      const { error: insErr } = await saveSession({
        user_id: user.id,
        date: sessionDate,
        equipment_id: equipmentId || null,
        sky_profile_id: skyProfileId === SKY_NONE ? null : skyProfileId,
        location_lat: lat,
        location_lng: lng,
        notes: generalNotes.trim() || null,
        targets_observed,
      })
      if (insErr) throw insErr
      navigate('/sessions')
    } catch (err) {
      setError(err.message ?? 'Could not save session')
    } finally {
      setSaveBusy(false)
    }
  }

  if (authLoading || (user && loading)) {
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
        <h1 style={{ fontSize: '1.35rem', margin: 0 }}>Log session</h1>
      </header>
      <p style={{ marginTop: '0.75rem', color: '#b7c0d4', fontSize: '0.95rem', lineHeight: 1.5 }}>
        Record what you saw, where you were, and how the sky behaved — builds your personal life list.
      </p>

      <form onSubmit={handleSubmit} style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        <div>
          <label htmlFor="session-date" style={labelStyle}>
            Date
          </label>
          <input
            id="session-date"
            name="sessionDate"
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            style={fieldStyle}
          />
        </div>

        <div>
          <label htmlFor="session-equipment" style={labelStyle}>
            Equipment
          </label>
          {equipmentList.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8' }}>
              No saved equipment.{' '}
              <Link to="/equipment" style={{ color: '#8aa4ff' }}>
                Add equipment
              </Link>{' '}
              first, or save without linking gear.
            </p>
          ) : (
            <select
              id="session-equipment"
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              style={selectStyle}
            >
              {equipmentList.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label htmlFor="session-sky" style={labelStyle}>
            Sky profile
          </label>
          <select
            id="session-sky"
            value={skyProfileId}
            onChange={(e) => setSkyProfileId(e.target.value)}
            style={selectStyle}
          >
            <option value={SKY_NONE}>None</option>
            {skyProfiles.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label || 'Unlabeled horizon'}
              </option>
            ))}
          </select>
        </div>

        <fieldset style={{ margin: 0, padding: 0, border: 'none' }}>
          <legend style={{ ...labelStyle, marginBottom: '0.5rem' }}>Location</legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#dbe6ff', fontSize: '0.95rem' }}>
              <input
                type="radio"
                name="locMode"
                checked={locationMode === 'profile'}
                onChange={() => setLocationMode('profile')}
              />
              Use saved profile location
            </label>
            {locationMode === 'profile' ? (
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#94a3b8' }}>
                {profileLat != null && profileLng != null
                  ? `Lat ${Number(profileLat).toFixed(4)}, lng ${Number(profileLng).toFixed(4)}`
                  : 'No coordinates on your profile yet.'}
              </p>
            ) : null}

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#dbe6ff', fontSize: '0.95rem' }}>
              <input
                type="radio"
                name="locMode"
                checked={locationMode === 'override'}
                onChange={() => setLocationMode('override')}
              />
              Override with GPS / manual coordinates
            </label>
            {locationMode === 'override' ? (
              <LocationPicker value={overrideLocation} onChange={setOverrideLocation} disabled={saveBusy} />
            ) : null}
          </div>
        </fieldset>

        <div>
          <label htmlFor="target-search" style={labelStyle}>
            Targets observed
          </label>
          <input
            id="target-search"
            type="search"
            placeholder="Search catalog (e.g. M42, Andromeda)…"
            value={targetQuery}
            onChange={(e) => setTargetQuery(e.target.value)}
            style={fieldStyle}
            autoComplete="off"
          />
          {targetQuery.trim() ? (
            <ul
              style={{
                listStyle: 'none',
                margin: '0.35rem 0 0',
                padding: 0,
                maxHeight: 180,
                overflowY: 'auto',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.2)',
              }}
            >
              {filteredTargets.length === 0 ? (
                <li style={{ padding: '0.65rem 0.75rem', color: '#64748b', fontSize: '0.88rem' }}>No matches</li>
              ) : (
                filteredTargets.map((t) => (
                  <li key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <button
                      type="button"
                      disabled={observedNotes.has(t.id)}
                      onClick={() => addTarget(t.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.55rem 0.75rem',
                        border: 'none',
                        background: observedNotes.has(t.id) ? 'rgba(255,255,255,0.04)' : 'transparent',
                        color: observedNotes.has(t.id) ? '#64748b' : '#e8eef7',
                        fontSize: '0.88rem',
                        cursor: observedNotes.has(t.id) ? 'default' : 'pointer',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{t.name}</span>
                      <span style={{ color: '#94a3b8', marginLeft: 6, fontSize: '0.8rem' }}>{t.id}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : (
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              Type to search; suggestions appear below. Tap a row to add it to this session.
            </p>
          )}
        </div>

        {selectedIds.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <p style={{ ...labelStyle, marginBottom: 0 }}>Selected targets & notes</p>
            {selectedIds.map((id) => {
              const t = TARGETS.find((x) => x.id === id)
              return (
                <div
                  key={id}
                  style={{
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '0.65rem 0.75rem',
                    background: 'rgba(255,255,255,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', color: '#dbe6ff', fontWeight: 600 }}>{t?.name ?? id}</span>
                    <button
                      type="button"
                      onClick={() => removeTarget(id)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#f87171',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      Remove
                    </button>
                  </div>
                  <label htmlFor={`notes-${id}`} style={{ ...labelStyle, marginTop: '0.45rem', fontSize: '0.75rem' }}>
                    Notes for this object
                  </label>
                  <input
                    id={`notes-${id}`}
                    value={observedNotes.get(id) ?? ''}
                    onChange={(e) => setNotesForTarget(id, e.target.value)}
                    placeholder='e.g. "Great detail in core"'
                    style={{ ...fieldStyle, padding: '0.5rem 0.65rem', fontSize: '0.88rem' }}
                  />
                </div>
              )
            })}
          </div>
        ) : null}

        <div>
          <label htmlFor="session-notes" style={labelStyle}>
            General session notes
          </label>
          <textarea
            id="session-notes"
            name="generalNotes"
            rows={4}
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            placeholder="Seeing, transparency, session story…"
            style={{ ...fieldStyle, resize: 'vertical', minHeight: 96 }}
          />
        </div>

        {error ? (
          <p role="alert" style={{ margin: 0, fontSize: '0.9rem', color: '#ff9b9b' }}>
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={saveBusy}
          style={{
            marginTop: '0.25rem',
            padding: '0.75rem 1rem',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(135deg, #5b7cfa, #8a4dff)',
            color: '#fff',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: saveBusy ? 'wait' : 'pointer',
            opacity: saveBusy ? 0.8 : 1,
          }}
        >
          {saveBusy ? 'Saving…' : 'Save session'}
        </button>
      </form>

      <p style={{ marginTop: '1.25rem', textAlign: 'center', color: '#b7c0d4', fontSize: '0.9rem' }}>
        <Link to="/sessions" style={{ color: '#8aa4ff' }}>
          Session history
        </Link>
        {' · '}
        <Link to="/dashboard" style={{ color: '#8aa4ff' }}>
          Dashboard
        </Link>
      </p>
    </main>
  )
}
