import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera } from 'lucide-react'
import { analyzeHorizonPhoto } from '../lib/anthropic.js'
import { supabase } from '../lib/supabase.js'
import { formatSupabaseClientMessage } from '../lib/supabaseErrors.js'
import { useAuth } from '../hooks/useAuth.js'

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const result = r.result
      if (typeof result !== 'string') {
        reject(new Error('Could not read image.'))
        return
      }
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    r.onerror = () => reject(new Error('Could not read image.'))
    r.readAsDataURL(file)
  })
}

function guessMediaType(file) {
  const t = file.type || 'image/jpeg'
  return t === 'image/jpg' ? 'image/jpeg' : t
}

/** Downscale wide panoramas so the JSON POST does not overwhelm the dev server or mobile stacks. */
async function fileToApiImagePayload(file) {
  try {
    const bitmap = await createImageBitmap(file)
    try {
      const w = bitmap.width
      const h = bitmap.height
      const maxEdge = 2400
      const scale = Math.min(1, maxEdge / Math.max(w, h))
      const tw = Math.max(1, Math.round(w * scale))
      const th = Math.max(1, Math.round(h * scale))
      const canvas = document.createElement('canvas')
      canvas.width = tw
      canvas.height = th
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not read image.')
      ctx.drawImage(bitmap, 0, 0, tw, th)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      const comma = dataUrl.indexOf(',')
      const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
      return { base64: b64, mediaType: 'image/jpeg' }
    } finally {
      bitmap.close()
    }
  } catch {
    const base64 = await fileToBase64(file)
    return { base64, mediaType: guessMediaType(file) }
  }
}

const panelStyle = {
  padding: '1rem',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
}

const btnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.45rem',
  width: '100%',
  padding: '0.75rem 1rem',
  borderRadius: 12,
  border: '1px solid rgba(138,164,255,0.45)',
  background: 'rgba(138,164,255,0.12)',
  color: '#e8eef7',
  fontSize: '0.95rem',
  fontWeight: 700,
}

/**
 * @param {{
 *   disabled?: boolean
 *   onHorizon?: (horizonData: { points: { azimuth: number; altitude: number }[] }) => void
 *   onComplete?: (horizonData: { points: { azimuth: number; altitude: number }[] }) => void
 *   label?: string
 *   onSaved?: () => void
 * }} props
 */
export default function HorizonCapture({ disabled = false, onHorizon, onComplete, label, onSaved }) {
  const notifyHorizon = onComplete ?? onHorizon
  const { user } = useAuth()
  const navigate = useNavigate()
  const cameraInputRef = useRef(null)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [lastFile, setLastFile] = useState(null)
  const [horizonData, setHorizonData] = useState(null)
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    },
    [previewUrl],
  )

  const runAnalysis = useCallback(
    async (file) => {
      if (!file) return
      setBusy(true)
      try {
        const { base64, mediaType } = await fileToApiImagePayload(file)
        const { points } = await analyzeHorizonPhoto({ base64, mediaType })
        const data = { points }
        setHorizonData(data)
        if (typeof notifyHorizon === 'function') notifyHorizon(data)
      } catch (e) {
        setHorizonData(null)
        setError(e?.message ?? 'Horizon analysis failed.')
      } finally {
        setBusy(false)
      }
    },
    [notifyHorizon],
  )

  const handleFileChosen = useCallback(
    async (file) => {
      if (busy || disabled) return
      if (!file) return
      setError('')
      setHorizonData(null)
      setLastFile(file)
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(file)
      })
      await runAnalysis(file)
    },
    [busy, disabled, runAnalysis],
  )

  function onFileInputChange(e) {
    const file = e.target.files?.[0]
    // Clear input so the same file can be chosen again; capture File before reset.
    e.target.value = ''
    handleFileChosen(file)
  }

  async function handleSave() {
    if (!horizonData) return
    setSaveError('')
    setSaveBusy(true)
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser()
      if (authErr) throw authErr
      const uid = authData?.user?.id ?? user?.id
      if (!uid) throw new Error('Your session expired. Please sign in again.')
      const labelFinal = String(label ?? '').trim() || 'Home site'
      const { error: insErr } = await supabase.from('sky_profiles').insert({
        user_id: uid,
        label: labelFinal,
        horizon_data: horizonData,
      })
      if (insErr) throw insErr
      if (typeof onSaved === 'function') onSaved()
      navigate('/sky-profiles', { replace: true, state: { toast: 'Home site saved' } })
    } catch (e) {
      const raw = e?.message ?? ''
      setSaveError(formatSupabaseClientMessage(raw) || raw || 'Could not save sky profile.')
    } finally {
      setSaveBusy(false)
    }
  }

  const inputsDisabled = disabled || busy

  return (
    <div style={panelStyle}>
      <p style={{ margin: '0 0 0.85rem', fontSize: '0.88rem', color: '#b7c0d4', lineHeight: 1.5 }}>
        Upload a horizon panorama or take a photo. Claude traces your skyline into azimuth / altitude points
        for the Tonight planner.
      </p>

      <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>
        Upload photo
        <input
          type="file"
          accept="image/*"
          disabled={inputsDisabled}
          style={{ display: 'block', marginTop: '0.45rem', fontSize: '0.85rem', color: '#e8eef7', width: '100%' }}
          onChange={onFileInputChange}
        />
      </label>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        disabled={inputsDisabled}
        style={{ display: 'none' }}
        onChange={onFileInputChange}
      />

      <button
        type="button"
        disabled={inputsDisabled}
        onClick={() => cameraInputRef.current?.click()}
        style={{
          ...btnStyle,
          marginTop: '0.6rem',
          cursor: inputsDisabled ? 'not-allowed' : 'pointer',
          opacity: inputsDisabled ? 0.6 : 1,
        }}
      >
        <Camera size={18} aria-hidden />
        Take photo
      </button>

      {previewUrl ? (
        <img
          src={previewUrl}
          alt=""
          style={{
            marginTop: '0.75rem',
            width: '100%',
            maxHeight: 160,
            objectFit: 'cover',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        />
      ) : null}

      {busy ? (
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.45 }}>
          Tracing horizon with Claude… this takes ~10 seconds.
        </p>
      ) : null}

      {error ? (
        <div style={{ marginTop: '0.85rem' }}>
          <p role="alert" style={{ margin: '0 0 0.65rem', fontSize: '0.88rem', color: '#fca5a5', lineHeight: 1.45 }}>
            {error}
          </p>
          <button
            type="button"
            disabled={inputsDisabled || !lastFile}
            onClick={() => lastFile && handleFileChosen(lastFile)}
            style={{
              ...btnStyle,
              cursor: inputsDisabled || !lastFile ? 'not-allowed' : 'pointer',
              opacity: inputsDisabled || !lastFile ? 0.6 : 1,
            }}
          >
            Try again
          </button>
        </div>
      ) : null}

      {horizonData ? (
        <button
          type="button"
          disabled={saveBusy || disabled}
          onClick={handleSave}
          style={{
            marginTop: '0.85rem',
            ...btnStyle,
            border: 'none',
            background: 'linear-gradient(135deg, #5b7cfa, #8a4dff)',
            color: '#fff',
            cursor: saveBusy || disabled ? 'wait' : 'pointer',
            opacity: saveBusy || disabled ? 0.85 : 1,
          }}
        >
          {saveBusy ? 'Saving…' : 'Save sky profile'}
        </button>
      ) : null}

      {saveError ? (
        <p role="alert" style={{ margin: '0.75rem 0 0', fontSize: '0.88rem', color: '#fca5a5', lineHeight: 1.45 }}>
          {saveError}
        </p>
      ) : null}
    </div>
  )
}
