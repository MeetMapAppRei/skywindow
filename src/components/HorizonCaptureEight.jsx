import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { analyzeHorizonCaptureSet } from '../lib/anthropic.js'
import {
  headingDelta,
  headingToCompassLabel,
  isHeadingNear,
  normalizeHeading,
} from '../lib/deviceHeading.js'
import { useDeviceHeading } from '../hooks/useDeviceHeading.js'
import { applyWidestCameraZoom, WIDE_CAMERA_VIDEO } from '../lib/cameraStream.js'

const DIRECTIONS = [0, 45, 90, 135, 180, 225, 270, 315]
const PANEL_BORDER = 'rgba(255,255,255,0.10)'
const PANEL_BG = 'rgba(255,255,255,0.04)'

const CAPTURE_MODE_KEYS = [
  { key: 'sky', labelKey: 'capture.modeSkyLabel', detailKey: 'capture.modeSkyDetail' },
  { key: 'horizon', labelKey: 'capture.modeHorizonLabel', detailKey: 'capture.modeHorizonDetail' },
]

/** Soft framing hint only — never blocks capture. */
function skyFramingHint(tilt, t) {
  if (!Number.isFinite(tilt)) return null
  if (tilt > 105) return t('capture.tipTiltDown')
  if (tilt < 35) return t('capture.tipIncludeTreetops')
  return null
}

function turnHintText(delta, t) {
  if (delta == null || !Number.isFinite(delta)) return null
  if (Math.abs(delta) <= 8) return t('capture.turnHold')
  const deg = Math.round(Math.abs(delta))
  return delta > 0 ? t('capture.turnRight', { deg }) : t('capture.turnLeft', { deg })
}

function dirLabel(deg) {
  const map = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }
  return map[deg] ?? `${Math.round(deg)}°`
}

function shotLabel(shot, slotDeg) {
  const az = shot?.actualAzimuth
  if (Number.isFinite(az)) return `${headingToCompassLabel(az)} (${Math.round(az)}°)`
  return dirLabel(slotDeg)
}

const CAPTURE_MAX_EDGE = 1280

function stripDataUrl(dataUrl) {
  const s = String(dataUrl || '')
  const comma = s.indexOf(',')
  return comma >= 0 ? s.slice(comma + 1) : s
}

const panelStyle = {
  borderRadius: 12,
  border: `1px solid ${PANEL_BORDER}`,
  background: PANEL_BG,
}

/**
 * @param {{ disabled?: boolean; onComplete?: (data: { points: object[] }) => void }} props
 */
export default function HorizonCaptureEight({ disabled = false, onComplete }) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState('landing')
  const [error, setError] = useState('')
  const [flash, setFlash] = useState(null)
  const [tilt, setTilt] = useState(null)
  const [shots, setShots] = useState({})
  const [captureMode, setCaptureMode] = useState('sky')
  const { heading, permission, enableCompass, needsPermission } = useDeviceHeading({
    enabled: phase === 'camera',
  })

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const flashTimer = useRef(null)

  const count = Object.keys(shots).length
  const allCaptured = count === 8
  const targetDir = useMemo(() => DIRECTIONS.find((d) => !shots[d]) ?? null, [shots])
  const modeDetail =
    captureMode === 'horizon' ? t('capture.modeHorizonDetail') : t('capture.modeSkyDetail')
  const framingTip = captureMode === 'sky' ? skyFramingHint(tilt, t) : null
  const aligned =
    targetDir != null && heading != null ? isHeadingNear(heading, targetDir, 22.5) : false
  const turn =
    targetDir != null ? turnHintText(headingDelta(heading, targetDir), t) : null

  const startCamera = useCallback(async () => {
    setError('')
    if (needsPermission) await enableCompass()
    setPhase('camera')
  }, [needsPermission, enableCompass])

  useEffect(() => {
    if (phase !== 'camera') return undefined
    let alive = true
    ;(async () => {
      try {
        let stream
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: WIDE_CAMERA_VIDEO,
            audio: false,
          })
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false,
          })
        }
        if (!alive) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const videoTrack = stream.getVideoTracks()[0]
        await applyWidestCameraZoom(videoTrack)
        streamRef.current = stream
        const v = videoRef.current
        if (v) {
          v.srcObject = stream
          await v.play()
        }
      } catch (e) {
        setError(e?.message || 'Could not start camera.')
      }
    })()
    return () => {
      alive = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'camera' || typeof window === 'undefined') return undefined
    function onOrient(e) {
      if (Number.isFinite(e.beta)) setTilt(Number(e.beta))
    }
    window.addEventListener('deviceorientation', onOrient, { passive: true })
    return () => window.removeEventListener('deviceorientation', onOrient)
  }, [phase])

  useEffect(
    () => () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current)
    },
    [],
  )

  useEffect(() => {
    if (phase !== 'camera' || count < 8) return undefined
    const t = window.setTimeout(() => setPhase('review'), 1100)
    return () => window.clearTimeout(t)
  }, [phase, count])

  const captureShot = useCallback(() => {
    if (targetDir == null) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) {
      setError('Camera not ready — wait a moment and try again.')
      return
    }
    const scale = Math.min(1, CAPTURE_MAX_EDGE / Math.max(w, h))
    const tw = Math.max(1, Math.round(w * scale))
    const th = Math.max(1, Math.round(h * scale))
    canvas.width = tw
    canvas.height = th
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, tw, th)
    const b64 = stripDataUrl(canvas.toDataURL('image/jpeg', 0.65))
    const actualAzimuth = normalizeHeading(heading) ?? targetDir
    setShots((prev) => ({
      ...prev,
      [targetDir]: {
        slotAzimuth: targetDir,
        actualAzimuth,
        imageData: b64,
        mediaType: 'image/jpeg',
      },
    }))
    setError('')
    setFlash({ text: `✓ ${headingToCompassLabel(actualAzimuth)}` })
    if (flashTimer.current) window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(null), 700)
  }, [targetDir, heading])

  const runAnalyze = useCallback(async () => {
    if (!allCaptured) return
    setPhase('analyzing')
    setError('')
    try {
      const images = DIRECTIONS.map((d) => ({
        base64: shots[d]?.imageData || '',
        mediaType: 'image/jpeg',
        azimuth: Number.isFinite(shots[d]?.actualAzimuth) ? shots[d].actualAzimuth : d,
      }))
      const { points } = await analyzeHorizonCaptureSet({ images })
      if (typeof onComplete === 'function') onComplete({ points })
      setPhase('done')
    } catch (e) {
      setError(e?.message || t('capture.analysisFailed'))
      setPhase('review')
    }
  }, [allCaptured, shots, onComplete, t])

  if (phase === 'landing') {
    return (
      <div style={{ ...panelStyle, padding: '1rem' }}>
        <p style={{ margin: '0 0 0.65rem', fontSize: '0.9rem', color: '#b7c0d4', lineHeight: 1.5 }}>
          {t('capture.intro')}
        </p>
        <fieldset
          style={{
            margin: '0 0 0.75rem',
            padding: '0.65rem',
            borderRadius: 10,
            border: `1px solid ${PANEL_BORDER}`,
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          <legend style={{ fontSize: '0.78rem', color: '#94a3b8', padding: '0 0.25rem' }}>
            {t('capture.aimLegend')}
          </legend>
          {CAPTURE_MODE_KEYS.map(({ key, labelKey, detailKey }) => (
            <label
              key={key}
              style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'flex-start',
                marginTop: key === 'sky' ? 0 : '0.45rem',
                fontSize: '0.85rem',
                color: '#e8eef7',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="captureMode"
                value={key}
                checked={captureMode === key}
                onChange={() => setCaptureMode(key)}
                style={{ marginTop: 3 }}
              />
              <span>
                <strong>{t(labelKey)}</strong>
                <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginTop: 2 }}>
                  {t(detailKey)}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <button
          type="button"
          disabled={disabled}
          onClick={startCamera}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            borderRadius: 12,
            border: '1px solid rgba(138,164,255,0.45)',
            background: 'rgba(138,164,255,0.12)',
            color: '#e8eef7',
            fontWeight: 700,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {t('capture.startCapture')}
        </button>
        {error ? (
          <p role="alert" style={{ margin: '0.75rem 0 0', color: '#fca5a5', fontSize: '0.88rem' }}>
            {error}
          </p>
        ) : null}
      </div>
    )
  }

  if (phase === 'review' || phase === 'analyzing' || phase === 'done') {
    return (
      <div style={{ ...panelStyle, padding: '1rem' }}>
        <p style={{ margin: '0 0 0.65rem', fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.45 }}>
          <strong style={{ color: '#dbe6ff' }}>{t('capture.step2')}</strong> — {t('capture.step2Tap')}{' '}
          <strong style={{ color: '#86efac' }}>{t('capture.step2Analyze')}</strong> {t('capture.step2Below')}
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <span style={{ fontWeight: 800, color: '#e8eef7' }}>{t('capture.reviewCaptures')}</span>
          <span style={{ color: '#94a3b8', fontWeight: 600 }}>{count}/8</span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: '0.5rem',
          }}
        >
          {DIRECTIONS.map((d) => {
            const shot = shots[d]
            const src = shot?.imageData ? `data:image/jpeg;base64,${shot.imageData}` : ''
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setShots((prev) => {
                    const next = { ...prev }
                    delete next[d]
                    return next
                  })
                  setPhase('camera')
                }}
                style={{
                  padding: '0.4rem',
                  borderRadius: 10,
                  border: `1px solid ${shot ? 'rgba(138,164,255,0.35)' : PANEL_BORDER}`,
                  background: shot ? 'rgba(138,164,255,0.08)' : PANEL_BG,
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#e8eef7', lineHeight: 1.2 }}>
                  {shot ? shotLabel(shot, d) : dirLabel(d)}
                </div>
                <div style={{ marginTop: 4, aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: '#000' }}>
                  {src ? (
                    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>
        {phase === 'done' ? (
          <p role="status" style={{ margin: '0.85rem 0 0', color: '#86efac', fontSize: '0.9rem' }}>
            {t('capture.analyzedSave')}
          </p>
        ) : null}
        {error ? (
          <p role="alert" style={{ margin: '0.85rem 0 0', color: '#fca5a5', fontSize: '0.88rem' }}>
            {error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={!allCaptured || phase === 'analyzing' || phase === 'done'}
          onClick={runAnalyze}
          style={{
            width: '100%',
            marginTop: '0.9rem',
            padding: '0.85rem 1rem',
            borderRadius: 12,
            border: 'none',
            background:
              allCaptured && phase !== 'done'
                ? 'linear-gradient(135deg, #5b7cfa, #8a4dff)'
                : 'rgba(255,255,255,0.08)',
            color: '#fff',
            fontWeight: 800,
            fontSize: '1rem',
            cursor: !allCaptured || phase === 'analyzing' || phase === 'done' ? 'not-allowed' : 'pointer',
            opacity: phase === 'analyzing' ? 0.7 : !allCaptured ? 0.5 : 1,
          }}
        >
          {phase === 'analyzing'
            ? t('capture.analyzing')
            : phase === 'done'
              ? t('capture.analysisComplete')
              : allCaptured
                ? t('capture.analyzeHorizon')
                : t('capture.analyzeHorizonCount', { count })}
        </button>
        <button
          type="button"
          disabled={phase === 'analyzing'}
          onClick={() => setPhase('camera')}
          style={{
            width: '100%',
            marginTop: '0.5rem',
            padding: '0.55rem',
            borderRadius: 10,
            border: `1px solid ${PANEL_BORDER}`,
            background: 'transparent',
            color: '#94a3b8',
            fontWeight: 600,
            fontSize: '0.85rem',
          }}
        >
          {t('capture.backToCamera')}
        </button>
      </div>
    )
  }

  const nextLabel = targetDir != null ? dirLabel(targetDir) : '—'

  return (
    <div style={{ ...panelStyle, padding: '0.65rem' }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: captureMode === 'sky' ? '16 / 9' : '4 / 3',
          borderRadius: 10,
          overflow: 'hidden',
          background: '#000',
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        {flash ? (
          <div
            aria-live="polite"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              background: 'rgba(34,197,94,0.35)',
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                color: '#fff',
                fontWeight: 800,
                fontSize: '1.1rem',
                textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}
            >
              {flash.text}
            </span>
          </div>
        ) : null}
        <span
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            padding: '0.2rem 0.45rem',
            borderRadius: 6,
            background: 'rgba(0,0,0,0.55)',
            color: '#e8eef7',
            fontSize: '0.75rem',
            fontWeight: 700,
          }}
        >
          {count}/8
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 4,
          marginTop: '0.5rem',
        }}
        aria-label={t('capture.progress')}
      >
        {DIRECTIONS.map((d) => {
          const done = !!shots[d]
          const next = d === targetDir
          return (
            <span
              key={d}
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: '0.62rem',
                fontWeight: 800,
                padding: '0.2rem 0',
                borderRadius: 4,
                color: done ? '#86efac' : next ? '#dbe6ff' : '#64748b',
                background: next ? 'rgba(138,164,255,0.15)' : 'transparent',
              }}
            >
              {dirLabel(d)}
              {done ? '✓' : ''}
            </span>
          )
        })}
      </div>

      {needsPermission && permission !== 'granted' ? (
        <button
          type="button"
          onClick={() => enableCompass()}
          style={{
            width: '100%',
            marginTop: '0.65rem',
            padding: '0.65rem',
            borderRadius: 10,
            border: '1px solid rgba(253,224,71,0.45)',
            background: 'rgba(253,224,71,0.12)',
            color: '#fde68a',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer',
          }}
        >
          {permission === 'denied' ? t('capture.compassBlocked') : t('capture.compassEnable')}
        </button>
      ) : null}

      <div
        style={{
          marginTop: '0.65rem',
          padding: '0.65rem',
          borderRadius: 10,
          border: `1px solid ${aligned ? 'rgba(134,239,172,0.45)' : PANEL_BORDER}`,
          background: aligned ? 'rgba(34,197,94,0.1)' : 'rgba(0,0,0,0.25)',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>{t('capture.pointing')}</p>
        <p style={{ margin: '0.2rem 0 0', fontSize: '1.15rem', fontWeight: 800, color: '#e8eef7' }}>
          {heading != null ? (
            <>
              {headingToCompassLabel(heading)}{' '}
              <span style={{ color: '#8aa4ff', fontSize: '0.95rem' }}>({Math.round(heading)}°)</span>
            </>
          ) : (
            <span style={{ color: '#fde68a' }}>{t('capture.compassWaiting')}</span>
          )}
        </p>
        <p style={{ margin: '0.45rem 0 0', fontSize: '0.85rem', color: '#b7c0d4', lineHeight: 1.45 }}>
          {t('capture.nextSlot')} <strong style={{ color: '#8aa4ff' }}>{nextLabel}</strong>
          {turn ? (
            <>
              {' '}
              — <span style={{ color: aligned ? '#86efac' : '#fde68a' }}>{turn}</span>
            </>
          ) : null}
        </p>
      </div>

      <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.45 }}>
        {modeDetail}
      </p>
      {framingTip ? (
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: '#fde68a', lineHeight: 1.4 }}>{framingTip}</p>
      ) : null}

      <button
        type="button"
        disabled={disabled || targetDir == null}
        onClick={captureShot}
        style={{
          width: '100%',
          marginTop: '0.75rem',
          padding: '0.8rem 1rem',
          borderRadius: 12,
          border: 'none',
          background: 'linear-gradient(135deg, #5b7cfa, #8a4dff)',
          color: '#fff',
          fontWeight: 800,
          fontSize: '1rem',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {t('capture.captureBtn', { dir: nextLabel })}
      </button>

      {error ? (
        <p role="alert" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#fca5a5', lineHeight: 1.4 }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
