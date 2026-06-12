import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Cloud, Moon } from 'lucide-react'
import { computeNightConditionsSummary, getLocalNightWindow } from '../lib/weather.js'
import { translateConditionsLabel, translateMoonPhase } from '../lib/targetLabels.js'

function bortleStyle(zone) {
  const z = Math.min(9, Math.max(1, Number(zone) || 5))
  if (z <= 2) return { bg: 'rgba(34,197,94,0.25)', border: 'rgba(34,197,94,0.5)', fg: '#86efac' }
  if (z <= 4) return { bg: 'rgba(56,189,248,0.2)', border: 'rgba(56,189,248,0.45)', fg: '#7dd3fc' }
  if (z <= 6) return { bg: 'rgba(250,204,21,0.2)', border: 'rgba(250,204,21,0.45)', fg: '#fde047' }
  return { bg: 'rgba(248,113,113,0.2)', border: 'rgba(248,113,113,0.45)', fg: '#fca5a5' }
}

/**
 * @param {{ phase: number, name: string, illumination: number } | null} props.moonPhase
 * @param {{ tonight: { avgCloudCover: number }, hourly: object[] } | null} props.weather
 * @param {{ score: number, label: string, bortle: number } | null} props.conditions
 * @param {number | null} props.bortleZone — fallback if `conditions` missing
 * @param {Date} [props.nightDate]
 */
export default function ConditionsBar({
  moonPhase,
  weather,
  conditions: conditionsProp,
  bortleZone = null,
  nightDate = new Date(),
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const conditions =
    conditionsProp ??
    (moonPhase ? computeNightConditionsSummary(moonPhase, weather, bortleZone ?? 5) : null)

  const bortle = conditions?.bortle ?? bortleZone ?? 5
  const bs = bortleStyle(bortle)

  const chartHours = useMemo(() => {
    if (!weather?.hourly?.length) return []
    const { start, end } = getLocalNightWindow(nightDate)
    return weather.hourly.filter((h) => {
      const t = new Date(h.time)
      return t >= start && t <= end
    })
  }, [weather, nightDate])

  const cloudPct =
    weather?.tonight?.avgCloudCover != null ? Math.round(weather.tonight.avgCloudCover) : null

  const label = translateConditionsLabel(conditions?.label, t) ?? '—'
  const moonLabel = translateMoonPhase(moonPhase?.name, t)
  const illum = moonPhase?.illumination != null ? `${moonPhase.illumination}%` : '—'

  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.04)',
        overflow: 'hidden',
        marginBottom: '1rem',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.5rem 0.75rem',
          padding: '0.55rem 0.75rem',
          border: 'none',
          background: 'transparent',
          color: '#e8eef7',
          cursor: 'pointer',
          textAlign: 'left',
          font: 'inherit',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Moon size={18} aria-hidden style={{ color: '#c4d4ff', flexShrink: 0 }} />
          <span style={{ fontSize: '0.82rem', color: '#dbe6ff' }}>
            {moonLabel} · {illum}
          </span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Cloud size={18} aria-hidden style={{ color: '#9ecfff', flexShrink: 0 }} />
          <span style={{ fontSize: '0.82rem', color: '#dbe6ff' }}>
            {cloudPct != null ? `${cloudPct}%` : '—'}
          </span>
        </span>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            padding: '0.2rem 0.45rem',
            borderRadius: 8,
            border: `1px solid ${bs.border}`,
            background: bs.bg,
            color: bs.fg,
          }}
        >
          {t('conditions.bortle', { n: bortle })}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: '#f0f4ff',
          }}
        >
          {t('conditions.heading', { label })}
        </span>
      </button>
      {open && (
        <div
          style={{
            padding: '0 0.75rem 0.65rem',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <p style={{ margin: '0.45rem 0 0.35rem', fontSize: '0.72rem', color: '#94a3b8' }}>
            {t('conditions.chartCaption')}
          </p>
          {chartHours.length > 0 ? (
            <NightCloudChart hours={chartHours} ariaLabel={t('conditions.chartAria')} />
          ) : (
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              {t('conditions.noHourlyData')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function NightCloudChart({ hours, ariaLabel }) {
  const maxH = Math.max(1, hours.length)
  const w = 280
  const h = 56
  const pad = 4
  const barW = Math.max(2, (w - pad * 2) / maxH - 1)

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${w} ${h}`}
      style={{ display: 'block', maxWidth: 360 }}
      role="img"
      aria-label={ariaLabel}
    >
      {hours.map((row, i) => {
        const pct = row.cloudCover != null ? clamp(row.cloudCover, 0, 100) : 0
        const bh = ((h - pad * 2) * pct) / 100
        const x = pad + i * (barW + 1)
        const y = h - pad - bh
        return (
          <rect
            key={row.time}
            x={x}
            y={y}
            width={barW}
            height={Math.max(bh, pct > 0 ? 1 : 0)}
            rx={1}
            fill="rgba(148,163,184,0.85)"
          />
        )
      })}
      <line
        x1={pad}
        y1={h - pad}
        x2={w - pad}
        y2={h - pad}
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={1}
      />
    </svg>
  )
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}
