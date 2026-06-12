/* eslint-disable react/prop-types -- plain JS project; props documented in JSDoc */
import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { reverseGeocode } from '../lib/geocoding.js'

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

/**
 * @typedef {{ lat: number | null; lng: number | null; placeName: string }} LocationValue
 */

function parseCoord(raw, kind) {
  const t = String(raw).trim()
  if (!t) return null
  const n = Number(t)
  if (!Number.isFinite(n)) return NaN
  if (kind === 'lat' && (n < -90 || n > 90)) return NaN
  if (kind === 'lng' && (n < -180 || n > 180)) return NaN
  return n
}

/**
 * @param {object} props
 * @param {LocationValue} props.value
 * @param {(next: LocationValue) => void} props.onChange
 * @param {boolean} [props.disabled]
 */
export default function LocationPicker({ value, onChange, disabled }) {
  const [latText, setLatText] = useState(
    value.lat == null ? '' : String(value.lat),
  )
  const [lngText, setLngText] = useState(
    value.lng == null ? '' : String(value.lng),
  )
  const [gpsBusy, setGpsBusy] = useState(false)
  const [geoBusy, setGeoBusy] = useState(false)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    setLatText(value.lat == null ? '' : String(value.lat))
    setLngText(value.lng == null ? '' : String(value.lng))
  }, [value.lat, value.lng])

  async function applyCoords(lat, lng) {
    setLocalError('')
    setGeoBusy(true)
    try {
      const { displayName } = await reverseGeocode(lat, lng)
      onChange({ lat, lng, placeName: displayName })
    } catch (err) {
      onChange({ lat, lng, placeName: '' })
      setLocalError(err.message ?? 'Could not resolve place name')
    } finally {
      setGeoBusy(false)
    }
  }

  function handleUseGps() {
    if (!navigator.geolocation) {
      setLocalError('Geolocation is not supported in this browser.')
      return
    }
    setLocalError('')
    setGpsBusy(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setGpsBusy(false)
        await applyCoords(lat, lng)
      },
      (err) => {
        setGpsBusy(false)
        setLocalError(err.message ?? 'Could not read GPS position')
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 },
    )
  }

  async function handleManualCommit() {
    const lat = parseCoord(latText, 'lat')
    const lng = parseCoord(lngText, 'lng')
    if (!latText.trim() && !lngText.trim()) {
      onChange({ lat: null, lng: null, placeName: '' })
      setLocalError('')
      return
    }
    if (lat === null || lng === null) {
      setLocalError('Enter both latitude and longitude, or clear both fields.')
      return
    }
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setLocalError('Enter valid latitude (−90…90) and longitude (−180…180).')
      return
    }
    await applyCoords(lat, lng)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <button
        type="button"
        onClick={handleUseGps}
        disabled={disabled || gpsBusy || geoBusy}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          padding: '0.75rem 1rem',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.14)',
          background: 'rgba(138,164,255,0.14)',
          color: '#e8eef7',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: disabled || gpsBusy || geoBusy ? 'wait' : 'pointer',
        }}
      >
        <MapPin size={18} aria-hidden />
        {gpsBusy || geoBusy ? 'Getting location…' : 'Use current location (GPS)'}
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
        <div>
          <label htmlFor="loc-lat" style={labelStyle}>
            Latitude
          </label>
          <input
            id="loc-lat"
            name="latitude"
            inputMode="decimal"
            autoComplete="off"
            disabled={disabled || geoBusy}
            value={latText}
            onChange={(e) => setLatText(e.target.value)}
            onBlur={handleManualCommit}
            placeholder="e.g. 40.7128"
            style={fieldStyle}
          />
        </div>
        <div>
          <label htmlFor="loc-lng" style={labelStyle}>
            Longitude
          </label>
          <input
            id="loc-lng"
            name="longitude"
            inputMode="decimal"
            autoComplete="off"
            disabled={disabled || geoBusy}
            value={lngText}
            onChange={(e) => setLngText(e.target.value)}
            onBlur={handleManualCommit}
            placeholder="e.g. -74.0060"
            style={fieldStyle}
          />
        </div>
      </div>

      {value.lat != null && value.lng != null ? (
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#b7c0d4' }}>
          <span style={{ color: '#dbe6ff' }}>Coordinates:</span>{' '}
          {Number(value.lat).toFixed(5)}, {Number(value.lng).toFixed(5)}
        </p>
      ) : null}

      {value.placeName ? (
        <div
          style={{
            padding: '0.75rem 0.85rem',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)',
            fontSize: '0.92rem',
            lineHeight: 1.45,
            color: '#dbe6ff',
          }}
        >
          {value.placeName}
        </div>
      ) : geoBusy ? (
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#b7c0d4' }}>Looking up place name…</p>
      ) : null}

      {localError ? (
        <p role="alert" style={{ margin: 0, fontSize: '0.88rem', color: '#ff9b9b' }}>
          {localError}
        </p>
      ) : null}
    </div>
  )
}
