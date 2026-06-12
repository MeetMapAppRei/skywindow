import { useTranslation } from 'react-i18next'

const pillBase = {
  flex: '0 0 auto',
  padding: '0.38rem 0.65rem',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.14)',
  fontSize: '0.78rem',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

/**
 * @param {object} props
 * @param {'all'|'galaxy'|'nebula'|'cluster'|'double_star'} props.category
 * @param {(c: 'all'|'galaxy'|'nebula'|'cluster'|'double_star') => void} props.onCategoryChange
 * @param {boolean} props.tonightOnly
 * @param {(v: boolean) => void} props.onTonightOnlyChange
 * @param {'score'|'rise'|'magnitude'} props.sortBy
 * @param {(s: 'score'|'rise'|'magnitude') => void} props.onSortChange
 */
export default function FilterBar({
  category,
  onCategoryChange,
  tonightOnly,
  onTonightOnlyChange,
  sortBy,
  onSortChange,
}) {
  const { t } = useTranslation()

  const cats = [
    { id: 'all', labelKey: 'filters.all' },
    { id: 'galaxy', labelKey: 'filters.galaxies' },
    { id: 'nebula', labelKey: 'filters.nebulae' },
    { id: 'cluster', labelKey: 'filters.clusters' },
    { id: 'double_star', labelKey: 'filters.doubleStars' },
  ]

  const sorts = [
    { id: 'score', labelKey: 'filters.byScore' },
    { id: 'rise', labelKey: 'filters.byRise' },
    { id: 'magnitude', labelKey: 'filters.byMagnitude' },
  ]

  return (
    <div style={{ marginBottom: '0.85rem' }}>
      <div
        role="tablist"
        aria-label={t('filters.objectType')}
        style={{
          display: 'flex',
          gap: '0.35rem',
          overflowX: 'auto',
          paddingBottom: '0.45rem',
          marginBottom: '0.55rem',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {cats.map((c) => {
          const active = category === c.id
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onCategoryChange(c.id)}
              style={{
                ...pillBase,
                background: active ? 'rgba(138,164,255,0.22)' : 'rgba(255,255,255,0.05)',
                color: active ? '#e8eef7' : '#b7c0d4',
                borderColor: active ? 'rgba(138,164,255,0.45)' : 'rgba(255,255,255,0.14)',
              }}
            >
              {t(c.labelKey)}
            </button>
          )
        })}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.5rem 0.75rem',
        }}
      >
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.82rem',
            color: '#dbe6ff',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={tonightOnly}
            onChange={(e) => onTonightOnlyChange(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: '#8aa4ff' }}
          />
          {t('filters.tonightOnly')}
        </label>
        <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.75rem' }} aria-hidden>
          |
        </span>
        <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginRight: 2 }}>{t('filters.sort')}</span>
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
          aria-label={t('filters.sortTargets')}
          style={{
            flex: '1 1 140px',
            minWidth: 0,
            maxWidth: 220,
            padding: '0.4rem 0.5rem',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'rgba(0,0,0,0.25)',
            color: '#e8eef7',
            fontSize: '0.82rem',
          }}
        >
          {sorts.map((s) => (
            <option key={s.id} value={s.id}>
              {t(s.labelKey)}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
