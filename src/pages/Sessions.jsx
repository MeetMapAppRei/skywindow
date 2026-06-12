import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Moon, Plus, Telescope, Trash2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { useShellHeader } from '../context/ShellHeaderContext.jsx'
import { getMoonPhase } from '../lib/astronomy.js'
import { deleteSession, getUserSessions, normalizeTargetsObserved } from '../lib/sessions.js'
import { TARGETS } from '../data/targets.js'
import LifeListSummary from '../components/LifeListSummary.jsx'

const targetById = new Map(TARGETS.map((t) => [t.id, t]))

function sessionLocalNoon(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return new Date()
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return new Date()
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

function moonBadgeStyle(phaseName) {
  const n = (phaseName || '').toLowerCase()
  if (n.includes('full')) return { bg: 'rgba(250,204,21,0.2)', border: 'rgba(250,204,21,0.45)', fg: '#fde047' }
  if (n.includes('new')) return { bg: 'rgba(148,163,184,0.2)', border: 'rgba(148,163,184,0.4)', fg: '#cbd5e1' }
  if (n.includes('quarter')) return { bg: 'rgba(56,189,248,0.18)', border: 'rgba(56,189,248,0.4)', fg: '#7dd3fc' }
  if (n.includes('gibbous')) return { bg: 'rgba(167,139,250,0.2)', border: 'rgba(167,139,250,0.45)', fg: '#ddd6fe' }
  if (n.includes('crescent')) return { bg: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.4)', fg: '#6ee7b7' }
  return { bg: 'rgba(148,163,184,0.15)', border: 'rgba(148,163,184,0.35)', fg: '#e2e8f0' }
}

export default function Sessions() {
  const { t } = useTranslation()
  const { user, loading: authLoading } = useAuth()
  const { setHeaderAction } = useShellHeader()
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState([])
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [deleteBusyId, setDeleteBusyId] = useState(null)

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const { data, error: qErr } = await getUserSessions(user.id)
      if (qErr) throw qErr
      setSessions(data ?? [])
    } catch (err) {
      setError(err.message ?? t('sessions.loadFailed'))
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [user, t])

  useEffect(() => {
    if (authLoading || !user) return
    refresh()
  }, [authLoading, user, refresh])

  useLayoutEffect(() => {
    setHeaderAction(
      <Link
        to="/log-session"
        viewTransition
        className="shell-header-action"
      >
        <Plus size={18} aria-hidden />
        <span>{t('sessions.log')}</span>
      </Link>,
    )
    return () => setHeaderAction(null)
  }, [setHeaderAction, t])

  async function handleDelete(row) {
    if (!window.confirm(t('sessions.deleteConfirm', { date: row.date ?? 'this night' }))) return
    setDeleteBusyId(row.id)
    setError('')
    try {
      const { error: dErr } = await deleteSession(row.id)
      if (dErr) throw dErr
      if (expandedId === row.id) setExpandedId(null)
      await refresh()
    } catch (err) {
      setError(err.message ?? t('sessions.deleteFailed'))
    } finally {
      setDeleteBusyId(null)
    }
  }

  if (authLoading || (user && loading)) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          color: '#b7c0d4',
          padding: '1.25rem',
        }}
      >
        {t('sessions.loading')}
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <main
      style={{
        maxWidth: 520,
        margin: '0 auto',
        padding: '1.25rem',
        minHeight: '100dvh',
      }}
    >
      <header style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Telescope aria-hidden size={28} />
        <h1 style={{ fontSize: '1.35rem', margin: 0 }}>{t('sessions.title')}</h1>
      </header>
      <p style={{ marginTop: '0.65rem', color: '#b7c0d4', fontSize: '0.95rem', lineHeight: 1.5 }}>
        Your observing history and life list, with moon phase for each night.
      </p>

      <div style={{ marginTop: '1rem' }}>
        <LifeListSummary sessions={sessions} />
      </div>

      {error ? (
        <div style={{ marginTop: '0.35rem' }}>
          <p role="alert" style={{ color: '#ff9b9b', fontSize: '0.9rem', margin: '0 0 0.5rem' }}>
            {error}
          </p>
          <button
            type="button"
            onClick={() => refresh()}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: 8,
              border: '1px solid rgba(138,164,255,0.45)',
              background: 'rgba(138,164,255,0.12)',
              color: '#e8eef7',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      ) : null}

      {sessions.length === 0 && !error ? (
        <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
          No sessions yet.{' '}
          <Link to="/log-session" style={{ color: '#8aa4ff' }}>
            Log your first night
          </Link>
          .
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {sessions.map((row) => {
            const obs = normalizeTargetsObserved(row.targets_observed)
            const equipName = row.equipment?.name ?? '—'
            const expanded = expandedId === row.id
            const moon = getMoonPhase(sessionLocalNoon(row.date))
            const mb = moonBadgeStyle(moon.name)

            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : row.id)}
                  aria-expanded={expanded}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.04)',
                    padding: '0.65rem 0.75rem',
                    color: '#e8eef7',
                    cursor: 'pointer',
                    font: 'inherit',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <span style={{ marginTop: 2, color: '#94a3b8', flexShrink: 0 }} aria-hidden>
                      {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem 0.5rem' }}>
                        <span style={{ fontWeight: 700, color: '#f0f4ff' }}>{row.date ?? '—'}</span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.45rem',
                            borderRadius: 8,
                            border: `1px solid ${mb.border}`,
                            background: mb.bg,
                            color: mb.fg,
                          }}
                          title={`${moon.name} (${moon.illumination}% lit)`}
                        >
                          <Moon size={12} aria-hidden />
                          {moon.name}
                        </span>
                      </div>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: '#b7c0d4' }}>
                        {equipName}
                        <span style={{ color: '#64748b' }}> · </span>
                        {obs.length} object{obs.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                </button>
                {expanded ? (
                  <div
                    style={{
                      marginTop: 4,
                      padding: '0.65rem 0.75rem 0.75rem 2.25rem',
                      borderRadius: '0 0 12px 12px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderTop: 'none',
                      background: 'rgba(0,0,0,0.18)',
                    }}
                  >
                    {row.sky_profiles?.label ? (
                      <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                        Sky profile: <span style={{ color: '#dbe6ff' }}>{row.sky_profiles.label}</span>
                      </p>
                    ) : null}
                    {row.notes ? (
                      <p style={{ margin: '0 0 0.65rem', fontSize: '0.88rem', color: '#dbe6ff', lineHeight: 1.5 }}>
                        {row.notes}
                      </p>
                    ) : (
                      <p style={{ margin: '0 0 0.65rem', fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic' }}>
                        No general notes for this session.
                      </p>
                    )}
                    <p style={{ margin: '0 0 0.35rem', fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Observed targets
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {obs.length === 0 ? (
                        <li style={{ fontSize: '0.85rem', color: '#64748b' }}>None recorded</li>
                      ) : (
                        obs.map((o) => {
                          const meta = targetById.get(o.id)
                          return (
                            <li
                              key={o.id}
                              style={{
                                fontSize: '0.86rem',
                                padding: '0.45rem 0.55rem',
                                borderRadius: 8,
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.06)',
                              }}
                            >
                              <span style={{ fontWeight: 600, color: '#e8eef7' }}>{meta?.name ?? o.id}</span>
                              {meta?.type ? (
                                <span style={{ color: '#64748b', fontSize: '0.75rem', marginLeft: 6 }}>({meta.type})</span>
                              ) : null}
                              {o.notes ? (
                                <p style={{ margin: '0.25rem 0 0', color: '#b7c0d4', fontSize: '0.82rem', lineHeight: 1.45 }}>
                                  {o.notes}
                                </p>
                              ) : null}
                            </li>
                          )
                        })
                      )}
                    </ul>
                    <button
                      type="button"
                      disabled={deleteBusyId === row.id}
                      onClick={() => handleDelete(row)}
                      style={{
                        marginTop: '0.75rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '0.45rem 0.7rem',
                        borderRadius: 8,
                        border: '1px solid rgba(255,80,80,0.35)',
                        background: 'rgba(80,0,0,0.2)',
                        color: '#fecaca',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: deleteBusyId === row.id ? 'wait' : 'pointer',
                      }}
                    >
                      <Trash2 size={15} aria-hidden />
                      Delete session
                    </button>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <p style={{ marginTop: '1.25rem', textAlign: 'center', color: '#b7c0d4', fontSize: '0.9rem' }}>
        <Link to="/delete-data" style={{ color: '#8aa4ff' }}>
          Delete data
        </Link>
        {' · '}
        <Link to="/dashboard" style={{ color: '#8aa4ff' }}>
          Dashboard
        </Link>
        {' · '}
        <Link to="/tonight" style={{ color: '#8aa4ff' }}>
          Tonight
        </Link>
      </p>
    </main>
  )
}
