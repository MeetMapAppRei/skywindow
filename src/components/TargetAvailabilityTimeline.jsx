import { useMemo } from 'react'

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

function formatTime12h(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—'
  try {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  } catch {
    const h = date.getHours()
    const mi = date.getMinutes()
    const ampm = h >= 12 ? 'PM' : 'AM'
    let hr = h % 12
    if (hr === 0) hr = 12
    return `${hr}:${String(mi).padStart(2, '0')} ${ampm}`
  }
}

function pctInWindow(time, windowStart, windowEnd) {
  const totalMs = windowEnd.getTime() - windowStart.getTime()
  if (totalMs <= 0 || !(time instanceof Date) || Number.isNaN(time.getTime())) return null
  return clamp(((time.getTime() - windowStart.getTime()) / totalMs) * 100, 0, 100)
}

function buildHourTicks(windowStart, windowEnd) {
  const ticks = []
  const cursor = new Date(windowStart)
  cursor.setMinutes(0, 0, 0)
  if (cursor.getTime() <= windowStart.getTime()) cursor.setHours(cursor.getHours() + 1)

  while (cursor.getTime() < windowEnd.getTime()) {
    const pct = pctInWindow(cursor, windowStart, windowEnd)
    if (pct != null && pct > 4 && pct < 96) {
      ticks.push({ pct, label: formatTime12h(cursor) })
    }
    cursor.setHours(cursor.getHours() + 1)
  }
  return ticks
}

/**
 * Session-wide altitude availability with labeled times, hour ticks, slot highlight, and best-time marker.
 */
export default function TargetAvailabilityTimeline({
  segments,
  coverage,
  sessionStart,
  sessionEnd,
  scheduledStart,
  scheduledEnd,
  bestPct,
  bestPlacement = null,
}) {
  const slotStartPct = pctInWindow(scheduledStart, sessionStart, sessionEnd)
  const slotEndPct = pctInWindow(scheduledEnd, sessionStart, sessionEnd)
  const hourTicks = useMemo(() => buildHourTicks(sessionStart, sessionEnd), [sessionStart, sessionEnd])

  const showSlot =
    slotStartPct != null && slotEndPct != null && slotEndPct - slotStartPct > 0.5

  const showBestMarker = bestPlacement === 'in' && bestPct != null
  const showEdgeMarker = bestPlacement === 'before' || bestPlacement === 'after'

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <p style={{ margin: '0 0 0.35rem', fontSize: '0.72rem', color: '#64748b', lineHeight: 1.45 }}>
        <strong style={{ color: '#94a3b8' }}>Tonight&apos;s window</strong> ({formatTime12h(sessionStart)}–
        {formatTime12h(sessionEnd)}): green = 20°+ and clear of your horizon; dark = too low or blocked.
        {showSlot ? (
          <>
            {' '}
            <strong style={{ color: '#a5b4fc' }}>Blue outline</strong> = your assigned slot.
          </>
        ) : null}
        {coverage > 0 ? (
          <>
            {' '}
            Usable ~<strong style={{ color: '#94a3b8' }}>{coverage}%</strong> of the session.
          </>
        ) : null}
      </p>

      <div
        role="img"
        aria-label={`Altitude timeline from ${formatTime12h(sessionStart)} to ${formatTime12h(sessionEnd)}`}
        style={{ position: 'relative', paddingBottom: 2 }}
      >
        <div
          style={{
            height: 14,
            borderRadius: 6,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'rgba(2,6,23,0.85)',
            position: 'relative',
          }}
        >
          {segments.map((seg, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${seg.startPct}%`,
                width: `${Math.max(0, seg.endPct - seg.startPct)}%`,
                top: 0,
                bottom: 0,
                background: seg.ok ? 'rgba(74,222,128,0.88)' : 'rgba(30,41,59,0.95)',
              }}
            />
          ))}

          {hourTicks.map((tick) => (
            <div
              key={tick.pct}
              aria-hidden
              style={{
                position: 'absolute',
                left: `${tick.pct}%`,
                top: 0,
                bottom: 0,
                width: 1,
                marginLeft: -0.5,
                background: 'rgba(255,255,255,0.18)',
                pointerEvents: 'none',
              }}
            />
          ))}

          {showBestMarker ? (
            <div
              title="Best time for this target (within your session)"
              aria-hidden
              style={{
                position: 'absolute',
                left: `${bestPct}%`,
                top: -3,
                bottom: -3,
                width: 2,
                marginLeft: -1,
                background: '#fde047',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.35)',
                pointerEvents: 'none',
                zIndex: 2,
              }}
            />
          ) : null}

          {showEdgeMarker ? (
            <div
              title={
                bestPlacement === 'before'
                  ? 'Best time is before your session window'
                  : 'Best time is after your session window'
              }
              aria-hidden
              style={{
                position: 'absolute',
                left: bestPlacement === 'before' ? 2 : undefined,
                right: bestPlacement === 'after' ? 2 : undefined,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 0,
                height: 0,
                borderTop: '5px solid transparent',
                borderBottom: '5px solid transparent',
                borderLeft: bestPlacement === 'before' ? '7px solid #fbbf24' : undefined,
                borderRight: bestPlacement === 'after' ? '7px solid #fbbf24' : undefined,
                pointerEvents: 'none',
                zIndex: 2,
              }}
            />
          ) : null}

          {showSlot ? (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: `${slotStartPct}%`,
                width: `${slotEndPct - slotStartPct}%`,
                top: -2,
                bottom: -2,
                border: '2px solid rgba(138,164,255,0.8)',
                borderRadius: 5,
                boxSizing: 'border-box',
                pointerEvents: 'none',
                zIndex: 3,
                background: 'rgba(138,164,255,0.08)',
              }}
            />
          ) : null}
        </div>

        <div
          style={{
            position: 'relative',
            marginTop: 4,
            height: 14,
            fontSize: '0.68rem',
            color: '#64748b',
          }}
        >
          <span style={{ position: 'absolute', left: 0 }}>{formatTime12h(sessionStart)}</span>
          {hourTicks.map((tick) => (
            <span
              key={`lbl-${tick.pct}`}
              style={{
                position: 'absolute',
                left: `${tick.pct}%`,
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
              }}
            >
              {tick.label}
            </span>
          ))}
          <span style={{ position: 'absolute', right: 0 }}>{formatTime12h(sessionEnd)}</span>
        </div>

        {showBestMarker ? (
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.68rem', color: '#78716c' }}>
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                marginRight: 4,
                verticalAlign: 'middle',
                background: '#fde047',
                borderRadius: 1,
              }}
            />
            Yellow tick = best time (within this session)
          </p>
        ) : showEdgeMarker ? (
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.68rem', color: '#78716c' }}>
            <span aria-hidden style={{ color: '#fbbf24', marginRight: 4 }}>
              {bestPlacement === 'before' ? '◀' : '▶'}
            </span>
            Amber arrow = best time is {bestPlacement === 'before' ? 'before' : 'after'} this session window
          </p>
        ) : null}
      </div>
    </div>
  )
}
