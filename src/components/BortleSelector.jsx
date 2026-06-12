/* eslint-disable react/prop-types -- plain JS project; props documented in JSDoc */
const ZONES = [
  { zone: 1, label: 'Excellent dark-sky site', color: '#0d4d2d' },
  { zone: 2, label: 'Typical truly dark site', color: '#166534' },
  { zone: 3, label: 'Rural sky', color: '#15803d' },
  { zone: 4, label: 'Rural / suburban transition', color: '#65a30d' },
  { zone: 5, label: 'Suburban sky', color: '#ca8a04' },
  { zone: 6, label: 'Bright suburban sky', color: '#d97706' },
  { zone: 7, label: 'Suburban / urban transition', color: '#ea580c' },
  { zone: 8, label: 'City sky', color: '#dc2626' },
  { zone: 9, label: 'Inner-city sky', color: '#991b1b' },
]

const btnBase = {
  width: '100%',
  textAlign: 'left',
  padding: '0.65rem 0.75rem',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#f8fafc',
  fontSize: '0.95rem',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.2rem',
  transition: 'transform 0.12s ease, box-shadow 0.12s ease',
}

/**
 * @param {object} props
 * @param {number | null} props.value Selected Bortle 1–9, or null
 * @param {(zone: number) => void} props.onChange
 * @param {boolean} [props.disabled]
 */
export default function BortleSelector({ value, onChange, disabled }) {
  return (
    <div
      role="listbox"
      aria-label="Bortle sky brightness scale"
      style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}
    >
      {ZONES.map(({ zone, label, color }) => {
        const selected = value === zone
        return (
          <button
            key={zone}
            type="button"
            role="option"
            aria-selected={selected}
            disabled={disabled}
            onClick={() => onChange(zone)}
            style={{
              ...btnBase,
              background: color,
              opacity: disabled ? 0.55 : 1,
              boxShadow: selected ? '0 0 0 2px #c4d2ff, 0 4px 14px rgba(0,0,0,0.35)' : 'none',
              outline: 'none',
            }}
          >
            <span style={{ fontWeight: 700 }}>Zone {zone}</span>
            <span style={{ fontSize: '0.85rem', opacity: 0.95 }}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}

export { ZONES as BORTLE_ZONES }
