/* eslint-disable react/prop-types -- plain JS project; props documented in JSDoc */
import { computeLifeListStats } from '../lib/sessions.js'

const tileBase = {
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)',
  padding: '0.65rem 0.75rem',
  minWidth: 0,
  flex: '1 1 0',
}

/**
 * Compact stat tiles for the Sessions page header.
 * @param {{ sessions: object[] }} props
 */
export default function LifeListSummary({ sessions }) {
  const { uniqueObjects, sessionCount, topTypeLabel } = computeLifeListStats(sessions)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '0.5rem',
        marginBottom: '1rem',
      }}
    >
      <div style={tileBase}>
        <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Objects (life list)
        </p>
        <p style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: 700, color: '#f0f4ff' }}>{uniqueObjects}</p>
      </div>
      <div style={tileBase}>
        <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Sessions
        </p>
        <p style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: 700, color: '#f0f4ff' }}>{sessionCount}</p>
      </div>
      <div style={tileBase}>
        <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Top type
        </p>
        <p
          style={{
            margin: '0.25rem 0 0',
            fontSize: '0.95rem',
            fontWeight: 600,
            color: '#dbe6ff',
            lineHeight: 1.25,
            wordBreak: 'break-word',
          }}
          title={topTypeLabel}
        >
          {topTypeLabel}
        </p>
      </div>
    </div>
  )
}
