import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Telescope, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { useShellHeader } from '../context/ShellHeaderContext.jsx'
import { deleteEquipment, getUserEquipment } from '../lib/equipment.js'
import { formatSupabaseClientMessage } from '../lib/supabaseErrors.js'
import EquipmentForm from '../components/EquipmentForm.jsx'

const TYPE_LABEL = {
  visual: 'Visual',
  camera: 'Camera',
  smart: 'Smart Scope',
}

export default function Equipment() {
  const { t } = useTranslation()
  const { user, loading: authLoading } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const { setHeaderAction } = useShellHeader()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [mode, setMode] = useState('list')
  const [editingRow, setEditingRow] = useState(null)
  const [quickSeestar, setQuickSeestar] = useState(false)

  const refresh = useCallback(async (opts = {}) => {
    const quiet = Boolean(opts.quiet)
    if (!user) return
    if (!quiet) setLoading(true)
    setError('')
    try {
      const { data, error: qErr } = await getUserEquipment(user.id)
      if (qErr) throw qErr
      setItems(data ?? [])
    } catch (err) {
      const raw = err && typeof err === 'object' && 'message' in err ? err.message : ''
      setError(
        formatSupabaseClientMessage(raw) || raw || t('equipment.loadFailed'),
      )
      setItems([])
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [user, t])

  useEffect(() => {
    if (authLoading || !user) return
    refresh()
  }, [authLoading, user, refresh])

  useEffect(() => {
    if (searchParams.get('new') !== '1') return
    if (authLoading || !user) return
    setEditingRow(null)
    setQuickSeestar(false)
    setMode('form')
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams, authLoading, user])

  useLayoutEffect(() => {
    if (mode !== 'list') {
      setHeaderAction(null)
      return () => setHeaderAction(null)
    }
    setHeaderAction(
      <Link
        to="/equipment?new=1"
        viewTransition
        replace
        className="shell-header-action"
        aria-label={t('equipment.addAria')}
      >
        <Plus size={20} aria-hidden />
      </Link>,
    )
    return () => setHeaderAction(null)
  }, [mode, setHeaderAction, t])

  async function handleDelete(row) {
    if (!window.confirm(`Delete “${row.name}”? This cannot be undone.`)) return
    setError('')
    try {
      const { error: dErr } = await deleteEquipment(row.id)
      if (dErr) throw dErr
      await refresh({ quiet: true })
    } catch (err) {
      setError(err.message ?? 'Could not delete equipment')
    }
  }

  function openAdd(options = {}) {
    setEditingRow(null)
    setQuickSeestar(Boolean(options.quickSeestar))
    setMode('form')
  }

  function openEdit(row) {
    setEditingRow(row)
    setQuickSeestar(false)
    setMode('form')
  }

  function closeForm() {
    setMode('list')
    setEditingRow(null)
    setQuickSeestar(false)
  }

  if (authLoading || (user && loading && mode === 'list')) {
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
        {t('equipment.loading')}
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const empty = !loading && items.length === 0

  return (
    <main
      style={{
        maxWidth: 560,
        margin: '0 auto',
        padding: '1.25rem',
        minHeight: '100dvh',
      }}
    >
      <header style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <Telescope aria-hidden size={28} />
        <h1 style={{ fontSize: '1.35rem', margin: 0 }}>{t('equipment.title')}</h1>
      </header>
      <p style={{ marginTop: '0.75rem', color: '#b7c0d4', fontSize: '0.95rem', lineHeight: 1.5 }}>
        Save telescopes and cameras so SkyWindow can tailor target suggestions to your gear.
      </p>

      {error ? (
        <p role="alert" style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#ff9b9b' }}>
          {error}
        </p>
      ) : null}

      {mode === 'form' && user ? (
        <section style={{ marginTop: '1.25rem' }}>
          <h2 style={{ fontSize: '1.05rem', margin: '0 0 1rem', color: '#e8eef7' }}>
            {editingRow ? 'Edit equipment' : 'Add equipment'}
          </h2>
          <EquipmentForm
            key={editingRow?.id ?? (quickSeestar ? 'new-seestar' : 'new')}
            userId={user.id}
            initialRow={
              editingRow ??
              (quickSeestar
                ? {
                    name: 'Seestar S30',
                    type: 'smart',
                    aperture_mm: 50,
                    focal_length_mm: 250,
                    fov_degrees: 1.0,
                    is_seestar: true,
                  }
                : null)
            }
            submitLabel={editingRow ? 'Save changes' : 'Save equipment'}
            onSaved={async () => {
              closeForm()
              await refresh({ quiet: true })
            }}
            onCancel={closeForm}
          />
        </section>
      ) : null}

      {mode === 'list' ? (
        <>
          {!empty ? (
            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => openAdd()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem 0.9rem',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #5b7cfa, #8a4dff)',
                  color: '#fff',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Plus size={18} aria-hidden />
                Add equipment
              </button>
            </div>
          ) : null}

          {empty ? (
            <div
              style={{
                marginTop: '1.75rem',
                padding: '1.25rem',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.04)',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: 0, color: '#e8eef7', lineHeight: 1.55 }}>
                Add your telescope or camera to get personalized target recommendations.
              </p>
              <div
                style={{
                  marginTop: '1.1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => openAdd()}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(135deg, #5b7cfa, #8a4dff)',
                    color: '#fff',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Add Equipment
                </button>
                <button
                  type="button"
                  onClick={() => openAdd({ quickSeestar: true })}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: 'rgba(0,0,0,0.2)',
                    color: '#e8eef7',
                    fontSize: '1rem',
                    cursor: 'pointer',
                  }}
                >
                  Quick Add: Seestar S30
                </button>
              </div>
            </div>
          ) : (
            <ul
              style={{
                margin: '1.25rem 0 0',
                padding: 0,
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
              }}
            >
              {items.map((row) => (
                <li
                  key={row.id}
                  style={{
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.05)',
                    padding: '1rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '0.65rem',
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#f1f5ff' }}>
                        {row.name}
                      </p>
                      <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', color: '#b7c0d4' }}>
                        {TYPE_LABEL[row.type] ?? row.type} · {row.aperture_mm} mm aperture
                      </p>
                      {row.is_seestar ? (
                        <span
                          style={{
                            display: 'inline-block',
                            marginTop: '0.5rem',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            padding: '0.25rem 0.5rem',
                            borderRadius: 6,
                            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                            color: '#fff',
                          }}
                        >
                          Seestar S30
                        </span>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        aria-label={`Edit ${row.name}`}
                        title="Edit"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          border: '1px solid rgba(255,255,255,0.14)',
                          background: 'rgba(0,0,0,0.2)',
                          color: '#e8eef7',
                          cursor: 'pointer',
                        }}
                      >
                        <Pencil size={18} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        aria-label={`Delete ${row.name}`}
                        title="Delete"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          border: '1px solid rgba(255,80,80,0.35)',
                          background: 'rgba(80,0,0,0.2)',
                          color: '#fecaca',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={18} aria-hidden />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      <p style={{ marginTop: '1.5rem', textAlign: 'center', color: '#b7c0d4', fontSize: '0.9rem' }}>
        <Link to="/dashboard" style={{ color: '#8aa4ff' }}>
          Back to dashboard
        </Link>
        {' · '}
        <Link to="/profile" style={{ color: '#8aa4ff' }}>
          Profile
        </Link>
      </p>
    </main>
  )
}
