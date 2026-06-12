import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.js'
import { formatSupabaseClientMessage } from '../lib/supabaseErrors.js'
import { TARGETS } from '../data/targets.js'
import { isTargetVisible } from '../lib/astronomy.js'
import TargetCard from '../components/TargetCard.jsx'

const ACCENT = '#8aa4ff'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function seasonForMonthIndex(mi) {
  if (mi === 11 || mi === 0 || mi === 1) return 'winter'
  if (mi >= 2 && mi <= 4) return 'spring'
  if (mi >= 5 && mi <= 7) return 'summer'
  return 'autumn'
}

function midMonthDate(year, monthIndex) {
  return new Date(year, monthIndex, 15, 0, 0, 0, 0)
}

function typeBadge(target) {
  const tags = new Set(target.tags || [])
  const t = target.type || ''
  if (tags.has('double_star') || t === 'double_star') {
    return { label: 'Double star', bg: 'rgba(167,139,250,0.25)', fg: '#d8b4fe', border: 'rgba(167,139,250,0.45)' }
  }
  if (tags.has('galaxy') || t === 'galaxy') {
    return { label: 'Galaxy', bg: 'rgba(59,130,246,0.22)', fg: '#93c5fd', border: 'rgba(59,130,246,0.45)' }
  }
  if (
    tags.has('nebula') ||
    tags.has('emission_nebula') ||
    tags.has('planetary_nebula') ||
    t.includes('nebula') ||
    t === 'supernova_remnant' ||
    t === 'milky_way_patch'
  ) {
    return { label: 'Nebula', bg: 'rgba(244,114,182,0.2)', fg: '#f9a8d4', border: 'rgba(244,114,182,0.45)' }
  }
  if (tags.has('cluster') || t.includes('cluster')) {
    return { label: 'Cluster', bg: 'rgba(250,204,21,0.2)', fg: '#fde047', border: 'rgba(250,204,21,0.45)' }
  }
  const pretty = t.replace(/_/g, ' ') || 'Target'
  return { label: pretty, bg: 'rgba(148,163,184,0.2)', fg: '#cbd5e1', border: 'rgba(148,163,184,0.4)' }
}

function BottomSheet({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Details'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0 max(0px, env(safe-area-inset-right)) max(0px, env(safe-area-inset-bottom)) max(0px, env(safe-area-inset-left))',
      }}
    >
      <div
        style={{
          width: 'min(560px, 100%)',
          maxHeight: '85dvh',
          overflow: 'auto',
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(15,21,36,0.98)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 -18px 60px rgba(0,0,0,0.55)',
          padding: '0.75rem 0.85rem 1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ fontWeight: 800, letterSpacing: '0.02em' }}>{title}</div>
          <button
            type="button"
            onClick={() => onClose?.()}
            style={{
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.06)',
              color: '#e8eef7',
              borderRadius: 10,
              padding: '0.45rem 0.65rem',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Close
          </button>
        </div>
        <div style={{ marginTop: '0.75rem' }}>{children}</div>
      </div>
    </div>
  )
}

export default function Calendar() {
  const { user, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [ready, setReady] = useState(false)

  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (authLoading || !user) return
    let cancelled = false
    async function load() {
      setReady(false)
      setLoadError('')
      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .select('location_lat, location_lng')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (pErr) {
        setLoadError(formatSupabaseClientMessage(pErr.message) || pErr.message || 'Could not load profile')
        setProfile(null)
        setReady(true)
        return
      }
      setProfile(prof ?? null)
      setReady(true)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [authLoading, user])

  const now = useMemo(() => new Date(), [])
  const year = now.getFullYear()
  const currentMonthIndex = now.getMonth()

  const calendarModel = useMemo(() => {
    const lat = Number(profile?.location_lat)
    const lng = Number(profile?.location_lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

    const visibleCache = new Map()
    const isVisibleForMonth = (target, d) => {
      const key = `${target.id || target.name}|${d.getFullYear()}|${d.getMonth()}`
      if (visibleCache.has(key)) return visibleCache.get(key)
      const v = isTargetVisible(target, null, lat, lng, d, 20)
      visibleCache.set(key, v)
      return v
    }

    const months = MONTHS.map((label, monthIndex) => {
      const season = seasonForMonthIndex(monthIndex)
      const date = midMonthDate(year, monthIndex)

      const best = TARGETS
        .filter((t) => (t.bestSeason || '').toLowerCase() === season)
        .map((t) => {
          const v = isVisibleForMonth(t, date)
          return { target: t, visibility: v }
        })
        .filter((row) => row.visibility?.visible)
        .sort((a, b) => (Number(b.target.magnitude) || 99) - (Number(a.target.magnitude) || 99))
        .slice(0, 4)

      return { label, monthIndex, season, date, best }
    })

    return { lat, lng, months }
  }, [profile?.location_lat, profile?.location_lng, year])

  const openTarget = useCallback((month, row) => {
    const t = row?.target
    const v = row?.visibility
    if (!t || !v) return
    setSelected({
      monthLabel: month.label,
      target: { ...t, visibility: v },
    })
  }, [])

  if (authLoading || !ready) {
    return <div className="page-loading">Loading…</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!profile?.location_lat || !profile?.location_lng) {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <main className="page">
      <header className="page__header">
        <CalendarDays aria-hidden size={28} />
        <div>
          <h1 className="page__title">Calendar</h1>
          <p className="page__lede" style={{ marginTop: '0.25rem' }}>
            Best seasonal targets that rise above 20° from your location.
          </p>
        </div>
      </header>

      {loadError ? (
        <p className="page__error" role="alert">
          {loadError}
        </p>
      ) : null}

      {!calendarModel ? (
        <p className="page__muted">Set your observing location in Profile to see seasonal targets.</p>
      ) : (
        <section aria-label="Seasonal months" style={{ marginTop: '1rem' }}>
          <div
            style={{
              display: 'flex',
              gap: '0.85rem',
              overflowX: 'auto',
              paddingBottom: '0.5rem',
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {calendarModel.months.map((m) => {
              const isCurrent = m.monthIndex === currentMonthIndex
              return (
                <article
                  key={m.monthIndex}
                  style={{
                    flex: '0 0 auto',
                    width: 280,
                    scrollSnapAlign: 'start',
                    borderRadius: 14,
                    border: `1px solid ${isCurrent ? ACCENT : 'rgba(255,255,255,0.1)'}`,
                    background: 'rgba(255,255,255,0.04)',
                    padding: '0.95rem 0.95rem 0.9rem',
                    boxShadow: isCurrent ? '0 0 0 1px rgba(138,164,255,0.25), 0 18px 50px rgba(0,0,0,0.25)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>
                      {m.label}
                    </div>
                    <div
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        padding: '0.18rem 0.5rem',
                        borderRadius: 999,
                        border: `1px solid ${isCurrent ? 'rgba(138,164,255,0.45)' : 'rgba(148,163,184,0.35)'}`,
                        background: isCurrent ? 'rgba(138,164,255,0.12)' : 'rgba(148,163,184,0.12)',
                        color: isCurrent ? '#dbe6ff' : '#cbd5e1',
                      }}
                    >
                      {m.season}
                    </div>
                  </div>

                  <div style={{ marginTop: '0.75rem' }}>
                    {m.best.length ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {m.best.map((row) => {
                          const badge = typeBadge(row.target)
                          return (
                            <button
                              key={row.target.id || row.target.name}
                              type="button"
                              onClick={() => openTarget(m, row)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                borderRadius: 999,
                                border: '1px solid rgba(255,255,255,0.12)',
                                background: 'rgba(0,0,0,0.18)',
                                color: '#e8eef7',
                                padding: '0.35rem 0.5rem',
                                cursor: 'pointer',
                                maxWidth: '100%',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '0.85rem',
                                  fontWeight: 750,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxWidth: 150,
                                }}
                              >
                                {row.target.name}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.65rem',
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.04em',
                                  padding: '0.18rem 0.4rem',
                                  borderRadius: 999,
                                  border: `1px solid ${badge.border}`,
                                  background: badge.bg,
                                  color: badge.fg,
                                  flex: '0 0 auto',
                                }}
                              >
                                {badge.label}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.45 }}>
                        No seasonal targets clear 20° from your latitude this month.
                      </p>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      <BottomSheet
        open={!!selected}
        title={selected?.target?.name ? `${selected.target.name} · ${selected.monthLabel}` : 'Target'}
        onClose={() => setSelected(null)}
      >
        {selected?.target ? <TargetCard target={selected.target} horizonData={null} /> : null}
      </BottomSheet>
    </main>
  )
}

