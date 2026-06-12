import { useCallback, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getHorizonAltitudeAtAzimuth } from '../lib/astronomy.js'
import { getSkyViewImageUrl, shouldShowImage } from '../lib/skyview.js'
import { getDifficultyRating } from '../lib/targetEngine.js'
import { getClearanceIndicator, getTargetTypeBadge } from '../lib/targetLabels.js'

function formatHm12h(hm) {
  if (!hm || hm === '—') return '—'
  const [hs, ms] = hm.split(':')
  const h = parseInt(hs, 10)
  const mi = parseInt(ms, 10)
  if (!Number.isFinite(h) || !Number.isFinite(mi)) return hm
  const ampm = h >= 12 ? 'PM' : 'AM'
  let hr = h % 12
  if (hr === 0) hr = 12
  return `${hr}:${String(mi).padStart(2, '0')} ${ampm}`
}

/**
 * @param {object} props
 * @param {object} props.target — row from getRecommendedTargets + optional _riseMin
 * @param {object|null} props.horizonData
 * @param {number} [props.apertureMm]
 * @param {number} [props.bortleZone]
 * @param {string} [props.equipmentName] — passed through to difficulty reason copy
 * @param {number} [props.focalLengthMm]
 * @param {(t: object) => void} [props.onAddToPlan]
 * @param {boolean} [props.inPlan]
 */
export default function TargetCard({
  target,
  horizonData,
  apertureMm,
  bortleZone,
  equipmentName,
  focalLengthMm,
  onAddToPlan,
  inPlan = false,
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [thumbState, setThumbState] = useState('loading')
  const [imageState, setImageState] = useState('loading')
  const panelId = useId()
  const titleId = useId()
  const badge = getTargetTypeBadge(target, t)
  const difficulty =
    apertureMm != null && bortleZone != null
      ? getDifficultyRating(target, apertureMm, bortleZone, {
          equipmentName,
          focalLengthMm: focalLengthMm != null && Number.isFinite(Number(focalLengthMm)) ? Number(focalLengthMm) : undefined,
        })
      : null

  const terrain = getHorizonAltitudeAtAzimuth(horizonData, target.visibility?.azimuthAtBest ?? 0)
  const clearance = (Number(target.visibility?.maxAlt) || 0) - terrain
  const ind = getClearanceIndicator(clearance, t)
  const showImage = shouldShowImage(target)
  const imageUrl = showImage
    ? target.imageUrl || getSkyViewImageUrl(target.ra, target.dec, target.size_arcmin ?? 10)
    : null

  const toggle = useCallback(() => setOpen((o) => !o), [])

  const onHeaderKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        toggle()
      }
    },
    [toggle],
  )

  const mag = target.magnitude != null ? String(target.magnitude) : '—'
  const size = target.size_arcmin != null ? `${target.size_arcmin}′` : '—'
  const desc = target.description || ''

  return (
    <article
      style={{
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.04)',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes skywindowShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      {/* Must not use <button> here: HTML forbids flow content (div/h2/p) inside buttons; mobile
          browsers "fix" the DOM and React then crashes on update. Use role="button" instead. */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={panelId}
        aria-labelledby={titleId}
        onClick={toggle}
        onKeyDown={onHeaderKeyDown}
        style={{
          width: '100%',
          display: 'block',
          padding: '0.75rem 0.85rem',
          border: 'none',
          background: 'transparent',
          color: '#e8eef7',
          cursor: 'pointer',
          textAlign: 'left',
          font: 'inherit',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flex: '1 1 auto', minWidth: 0 }}>
            <span
              id={titleId}
              role="heading"
              aria-level={2}
              style={{
                margin: 0,
                fontSize: '1.05rem',
                fontWeight: 700,
                flex: '1 1 auto',
                minWidth: 0,
                lineHeight: 1.25,
                overflowWrap: 'break-word',
                display: 'block',
              }}
            >
              {target.name}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem', flex: '0 0 auto' }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  padding: '0.2rem 0.45rem',
                  borderRadius: 8,
                  border: `1px solid ${badge.border}`,
                  background: badge.bg,
                  color: badge.fg,
                  flex: '0 0 auto',
                }}
              >
                {badge.label}
              </span>
              {difficulty ? (
                <span
                  style={{
                    fontFamily: 'inherit',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '0.2rem 0.45rem',
                    borderRadius: 8,
                    border: `1px solid rgba(255,255,255,0.16)`,
                    background: 'rgba(255,255,255,0.06)',
                    color: difficulty.color,
                    flex: '0 0 auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  {difficulty.label}
                </span>
              ) : null}
            </div>
          </div>
          <div
            aria-hidden
            style={{
              width: 52,
              height: 52,
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.12)',
              background: '#050810',
              overflow: 'hidden',
              flex: '0 0 auto',
              position: 'relative',
            }}
          >
            {showImage ? (
              thumbState === 'error' ? (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '1.25rem',
                    color: '#cbd5e1',
                    background: '#050810',
                  }}
                >
                  🔭
                </div>
              ) : (
                <>
                  <img
                    src={imageUrl || ''}
                    loading="lazy"
                    alt=""
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      filter: 'brightness(1.2) contrast(1.15)',
                      display: 'block',
                      opacity: thumbState === 'loaded' ? 1 : 0,
                      transition: 'opacity 160ms ease-out',
                    }}
                    onLoad={() => setThumbState('loaded')}
                    onError={() => setThumbState('error')}
                  />
                  {thumbState !== 'loaded' ? (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background:
                          'linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.14), rgba(255,255,255,0.06))',
                        backgroundSize: '200% 100%',
                        animation: 'skywindowShimmer 1.2s ease-in-out infinite',
                      }}
                    />
                  ) : null}
                </>
              )
            ) : null}
          </div>
        </div>
        {difficulty ? (
          <p
            style={{
              margin: '0.45rem 0 0',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              fontSize: '0.78rem',
              color: '#94a3b8',
              lineHeight: 1.45,
              overflowWrap: 'break-word',
              wordBreak: 'break-word',
            }}
          >
            {difficulty.reason}
          </p>
        ) : null}
        <p style={{ margin: difficulty ? '0.35rem 0 0' : '0.45rem 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
          {t('targets.bestAt', {
            time: formatHm12h(target.visibility?.bestTime),
            alt: target.visibility?.maxAlt ?? '—',
          })}
        </p>
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: '#b7c0d4' }}>
          {t('targets.magSize', { mag, size })}
        </p>
        <p
          style={{
            margin: '0.4rem 0 0',
            fontSize: '0.8rem',
            color: '#cbd5e1',
            lineHeight: 1.45,
            display: open ? 'block' : '-webkit-box',
            WebkitLineClamp: open ? 'unset' : 1,
            WebkitBoxOrient: 'vertical',
            overflow: open ? 'visible' : 'hidden',
          }}
        >
          {desc}
        </p>
        <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.72rem', color: '#64748b' }}>
          {open ? t('targets.tapCollapse') : t('targets.tapDetails')}
        </span>
      </div>

      {open ? (
        <div
          id={panelId}
          style={{
            padding: '0 0.85rem 0.85rem',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <p style={{ margin: '0.65rem 0 0', fontSize: '0.82rem', color: '#dbe6ff', lineHeight: 1.5 }}>{desc}</p>
          <div
            style={{
              marginTop: '0.65rem',
              width: '100%',
              aspectRatio: '16 / 9',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
              background: '#050810',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {showImage ? (
              imageState === 'error' ? (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '2rem',
                    color: '#cbd5e1',
                    background: '#050810',
                  }}
                >
                  🔭
                </div>
              ) : (
                <>
                  <img
                    src={imageUrl || ''}
                    loading="lazy"
                    alt=""
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      filter: 'brightness(1.2) contrast(1.15)',
                      display: 'block',
                      opacity: imageState === 'loaded' ? 1 : 0,
                      transition: 'opacity 180ms ease-out',
                    }}
                    onLoad={() => setImageState('loaded')}
                    onError={() => setImageState('error')}
                  />
                  {imageState !== 'loaded' ? (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background:
                          'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.12), rgba(255,255,255,0.04))',
                        backgroundSize: '200% 100%',
                        animation: 'skywindowShimmer 1.2s ease-in-out infinite',
                      }}
                    />
                  ) : null}
                  {imageState === 'loaded' ? (
                    <div
                      style={{
                        position: 'absolute',
                        right: 8,
                        bottom: 6,
                        fontSize: '0.65rem',
                        color: 'rgba(255,255,255,0.65)',
                        opacity: 0.6,
                        background: 'rgba(5,8,16,0.55)',
                        padding: '0.15rem 0.35rem',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.12)',
                      }}
                    >
                      DSS2 · NASA SkyView
                    </div>
                  ) : null}
                </>
              )
            ) : null}
          </div>
          <dl
            style={{
              margin: '0.65rem 0 0',
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '0.35rem 0.65rem',
              fontSize: '0.8rem',
              color: '#94a3b8',
            }}
          >
            <dt style={{ margin: 0 }}>RA / Dec</dt>
            <dd style={{ margin: 0, color: '#e8eef7' }}>
              {Number(target.ra).toFixed(3)}h · {Number(target.dec).toFixed(2)}°
            </dd>
            <dt style={{ margin: 0 }}>Azimuth at best</dt>
            <dd style={{ margin: 0, color: '#e8eef7' }}>
              {target.visibility?.azimuthAtBest != null
                ? `${Math.round(target.visibility.azimuthAtBest)}°`
                : '—'}
            </dd>
            <dt style={{ margin: 0 }}>Horizon clearance</dt>
            <dd style={{ margin: 0 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0.2rem 0.45rem',
                  borderRadius: 8,
                  background: ind.bg,
                  color: ind.color,
                  fontWeight: 600,
                  fontSize: '0.78rem',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: ind.color,
                    boxShadow: `0 0 0 2px rgba(255,255,255,0.12)`,
                  }}
                />
                {ind.label} ({clearance.toFixed(1)}°)
              </span>
            </dd>
          </dl>
          {onAddToPlan ? (
            <button
              type="button"
              disabled={inPlan}
              onClick={(e) => {
                e.stopPropagation()
                if (!inPlan) onAddToPlan(target)
              }}
              style={{
                marginTop: '0.75rem',
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: 10,
                border: inPlan ? '1px solid rgba(74,222,128,0.35)' : 'none',
                background: inPlan
                  ? 'rgba(74,222,128,0.12)'
                  : 'linear-gradient(135deg, #5b7cfa, #8a4dff)',
                color: inPlan ? '#86efac' : '#fff',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: inPlan ? 'default' : 'pointer',
                opacity: inPlan ? 0.95 : 1,
              }}
            >
              {inPlan ? t('targets.inPlan') : t('targets.addToPlan')}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
