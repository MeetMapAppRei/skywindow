import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { Image, Trash2 } from 'lucide-react'

import { supabase } from '../lib/supabase.js'

import { useAuth } from '../hooks/useAuth.js'

import { useShellHeader } from '../context/ShellHeaderContext.jsx'

import { formatSupabaseClientMessage } from '../lib/supabaseErrors.js'

import { deleteSkyProfile, insertSkyProfile, rememberActiveSkyProfile } from '../lib/skyProfiles.js'

import HorizonCaptureEight from '../components/HorizonCaptureEight.jsx'

import HorizonSilhouette from '../components/HorizonSilhouette.jsx'



function horizonHasPoints(horizonData) {

  if (!horizonData) return false

  const pts = Array.isArray(horizonData) ? horizonData : horizonData.points

  return Array.isArray(pts) && pts.length > 0

}



export default function SkyProfiles() {
  const { t } = useTranslation()
  const { user, loading: authLoading } = useAuth()

  const navigate = useNavigate()

  const { setHeaderAction } = useShellHeader()

  const [rows, setRows] = useState([])

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState('')

  const [newLabel, setNewLabel] = useState('')

  const [pendingHorizon, setPendingHorizon] = useState(null)

  const [saveBusy, setSaveBusy] = useState(false)

  const [saveError, setSaveError] = useState('')

  const [saveOk, setSaveOk] = useState('')
  const [deleteBusyId, setDeleteBusyId] = useState(null)



  const refresh = useCallback(async (uid) => {

    if (!uid) {

      setRows([])

      return

    }

    const { data, error: qErr } = await supabase

      .from('sky_profiles')

      .select('id, label, horizon_data, created_at')

      .eq('user_id', uid)

      .order('created_at', { ascending: false })

    if (qErr) throw qErr

    setRows(data ?? [])

  }, [])



  useLayoutEffect(() => {
    setNewLabel((prev) => prev || t('sky.defaultLabel'))
  }, [t])

  useLayoutEffect(() => {

    setHeaderAction(null)

    return () => setHeaderAction(null)

  }, [setHeaderAction])



  useEffect(() => {

    if (authLoading || !user) return

    let cancelled = false

    ;(async () => {

      setLoading(true)

      setError('')

      try {

        await refresh(user.id)

      } catch (e) {

        if (!cancelled) setError(e?.message ?? t('sky.loadFailed'))

      } finally {

        if (!cancelled) setLoading(false)

      }

    })()

    return () => {

      cancelled = true

    }

  }, [authLoading, user, refresh, t])



  async function handleSaveProfile() {

    setSaveError('')

    setSaveOk('')

    const pts = pendingHorizon?.points

    if (!Array.isArray(pts) || pts.length < 3) {

      setSaveError(t('sky.saveFinishError'))

      return

    }

    if (!user?.id) {

      setSaveError(t('sky.sessionExpired'))

      return

    }

    setSaveBusy(true)

    try {

      const { data: authData, error: authErr } = await supabase.auth.getUser()

      if (authErr) throw authErr

      const uid = authData?.user?.id ?? user.id

      if (!uid) throw new Error(t('sky.sessionExpired'))



      const { data, error: insErr } = await insertSkyProfile({

        userId: uid,

        label: newLabel,

        horizonData: pendingHorizon,

      })

      if (insErr) throw insErr

      if (!data?.id) throw new Error('Save succeeded but no profile id returned.')



      rememberActiveSkyProfile(data.id)

      setPendingHorizon(null)

      setSaveOk(t('sky.savedOk', { label: data.label || newLabel }))

      await refresh(uid)

      window.setTimeout(() => {

        navigate('/tonight', {

          replace: false,

          state: {
            selectSkyProfileId: data.id,
            toast: t('sky.activeOnTonight', { label: data.label || t('sky.title') }),
          },

        })

      }, 600)

    } catch (e) {

      const raw = e?.message ?? ''

      setSaveError(formatSupabaseClientMessage(raw) || raw || t('sky.saveFailed'))

    } finally {

      setSaveBusy(false)

    }

  }



  async function handleDelete(row) {
    if (!window.confirm(t('sky.deleteConfirm', { label: row.label || t('common.untitled') }))) return
    setDeleteBusyId(row.id)
    setError('')
    try {
      const { error: dErr } = await deleteSkyProfile(row.id)
      if (dErr) throw dErr
      await refresh(user.id)
    } catch (e) {
      const raw = e?.message ?? ''
      setError(formatSupabaseClientMessage(raw) || raw || t('sky.deleteFailed'))
    } finally {
      setDeleteBusyId(null)
    }
  }



  if (authLoading || (user && loading)) {

    return (

      <div className="page-loading" aria-busy="true">

        {t('common.loading')}

      </div>

    )

  }



  if (!user) {

    return <Navigate to="/login" replace />

  }



  const pendingCount = pendingHorizon?.points?.length ?? 0



  return (

    <div className="page">

      <header className="page__header">

        <Image aria-hidden size={28} />

        <h1 className="page__title">{t('sky.title')}</h1>

      </header>

      <p className="page__lede">
        {t('sky.ledeBefore')}{' '}
        <Link to="/tonight" className="page__link">{t('nav.tonight')}</Link>{' '}
        {t('sky.ledeAfter')}
      </p>



      <section className="page__section" style={{ marginTop: '1.25rem' }}>

        <h2 className="page__subtitle" style={{ fontSize: '1.05rem', margin: '0 0 0.5rem' }}>

          {t('sky.newProfile')}

        </h2>

        <label htmlFor="skyprof-label" className="page__label" style={{ display: 'block', marginBottom: '0.35rem' }}>

          {t('sky.label')}

        </label>

        <input

          id="skyprof-label"

          value={newLabel}

          onChange={(e) => setNewLabel(e.target.value)}

          className="page__input"

          style={{

            width: '100%',

            padding: '0.65rem 0.75rem',

            borderRadius: 10,

            border: '1px solid rgba(255,255,255,0.14)',

            background: 'rgba(0,0,0,0.25)',

            color: '#e8eef7',

            marginBottom: '0.85rem',

          }}

        />

        <ol
          className="page__muted"
          style={{ margin: '0 0 0.85rem', paddingLeft: '1.15rem', fontSize: '0.88rem', lineHeight: 1.55 }}
        >
          <li>
            <strong style={{ color: '#dbe6ff' }}>{t('sky.stepCapture')}</strong> — {t('sky.stepCaptureDetail')}
          </li>
          <li>
            <strong style={{ color: '#dbe6ff' }}>{t('sky.stepAnalyze')}</strong> — {t('sky.stepAnalyzeDetail')}
          </li>
          <li>
            <strong style={{ color: '#dbe6ff' }}>{t('sky.stepSave')}</strong> — {t('sky.stepSaveDetail')}
          </li>
        </ol>

        <HorizonCaptureEight
          disabled={saveBusy}
          onComplete={(data) => {
            setSaveError('')
            setSaveOk('')
            setPendingHorizon(data)
          }}
        />

        {pendingCount >= 3 ? (
          <p className="page__muted" style={{ marginTop: '0.75rem' }}>
            <strong style={{ color: '#86efac' }}>{t('common.step', { n: 3 })}:</strong> {t('sky.step3Ready')}{' '}
            <strong style={{ color: '#dbe6ff' }}>{t('sky.step3Save')}</strong> {t('sky.step3Below')}
          </p>
        ) : null}



        <button

          type="button"

          disabled={saveBusy || pendingCount < 3}

          onClick={handleSaveProfile}

          style={{

            marginTop: '0.85rem',

            width: '100%',

            padding: '0.75rem 1rem',

            borderRadius: 12,

            border: 'none',

            background: 'linear-gradient(135deg, #5b7cfa, #8a4dff)',

            color: '#fff',

            fontSize: '0.95rem',

            fontWeight: 700,

            cursor: saveBusy || pendingCount < 3 ? 'not-allowed' : 'pointer',

            opacity: saveBusy || pendingCount < 3 ? 0.55 : 1,

          }}

        >

          {saveBusy ? t('common.saving') : t('sky.saveProfile')}

        </button>



        {saveOk ? (

          <p role="status" style={{ marginTop: '0.65rem', color: '#86efac', fontSize: '0.9rem' }}>

            {saveOk}

          </p>

        ) : null}

        {saveError ? (

          <p role="alert" style={{ marginTop: '0.65rem', color: '#fca5a5', fontSize: '0.9rem' }}>

            {saveError}

          </p>

        ) : null}

      </section>



      {error ? (

        <p className="page__error" role="alert">

          {error}

        </p>

      ) : null}



      {rows.length === 0 && !error ? (

        <p className="page__muted" style={{ marginTop: '1rem' }}>

          {t('sky.noProfilesBefore')}{' '}
          <Link to="/tonight" viewTransition className="page__link">
            {t('nav.tonight')}
          </Link>{' '}
          {t('sky.noProfilesAfter')}

        </p>

      ) : (

        <ul className="sky-profile-list" style={{ marginTop: '1rem' }}>

          {rows.map((row) => {

            const ok = horizonHasPoints(row.horizon_data)

            return (

              <li key={row.id} className="sky-profile-list__item">

                <div className="sky-profile-list__label">{row.label || t('common.untitled')}</div>

                <div className="sky-profile-list__meta">

                  {ok ? (

                    <span className="sky-profile-list__badge sky-profile-list__badge--ok">{t('sky.horizonData')}</span>

                  ) : (

                    <span className="sky-profile-list__badge">{t('sky.noHorizonPoints')}</span>

                  )}

                </div>

                {ok ? (

                  <div style={{ marginTop: '0.65rem' }}>

                    <HorizonSilhouette horizonData={row.horizon_data} height={80} showLabels />

                  </div>

                ) : null}

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.65rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      rememberActiveSkyProfile(row.id)
                      navigate('/tonight', { state: { selectSkyProfileId: row.id } })
                    }}
                    style={{
                      flex: 1,
                      padding: '0.5rem 0.75rem',
                      borderRadius: 10,
                      border: '1px solid rgba(138,164,255,0.45)',
                      background: 'rgba(138,164,255,0.1)',
                      color: '#dbe6ff',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {t('sky.useOnTonight')}
                  </button>
                  <button
                    type="button"
                    disabled={deleteBusyId === row.id}
                    onClick={() => handleDelete(row)}
                    aria-label={t('sky.deleteProfile', { label: row.label || t('common.untitled') })}
                    title={t('common.delete')}
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
                      cursor: deleteBusyId === row.id ? 'wait' : 'pointer',
                    }}
                  >
                    <Trash2 size={18} aria-hidden />
                  </button>
                </div>

              </li>

            )

          })}

        </ul>

      )}

    </div>

  )

}


