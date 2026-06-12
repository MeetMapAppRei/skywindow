import { useEffect, useLayoutEffect, useState } from 'react'

import { Link, Navigate, useNavigate } from 'react-router-dom'

import { useTranslation } from 'react-i18next'

import { LogOut, Telescope } from 'lucide-react'

import { supabase } from '../lib/supabase.js'

import { useAuth } from '../hooks/useAuth.js'

import { useShellHeader } from '../context/ShellHeaderContext.jsx'

import { reverseGeocode } from '../lib/geocoding.js'

import { Capacitor } from '@capacitor/core'
import { cancelNightCheck, requestPermission, scheduleNightCheck } from '../lib/notifications.js'

import { SUPPORTED_LOCALES } from '../lib/locale.js'

import LocationPicker from '../components/LocationPicker.jsx'

import BortleSelector from '../components/BortleSelector.jsx'



const fieldStyle = {

  width: '100%',

  padding: '0.75rem 0.85rem',

  borderRadius: 10,

  border: '1px solid rgba(255,255,255,0.14)',

  background: 'rgba(0,0,0,0.25)',

  color: '#e8eef7',

  fontSize: '1rem',

}



const labelStyle = {

  display: 'block',

  fontSize: '0.85rem',

  color: '#b7c0d4',

  marginBottom: '0.35rem',

}



export default function Profile() {

  const { t, i18n } = useTranslation()

  const { user, loading: authLoading, signOut } = useAuth()

  const navigate = useNavigate()

  const { setHeaderAction } = useShellHeader()

  const [loading, setLoading] = useState(true)

  const [displayName, setDisplayName] = useState('')

  const [notifyGoodNights, setNotifyGoodNights] = useState(false)

  const [notifyBusy, setNotifyBusy] = useState(false)

  const [location, setLocation] = useState({

    lat: null,

    lng: null,

    placeName: '',

  })

  const [bortle, setBortle] = useState(null)

  const [saveBusy, setSaveBusy] = useState(false)

  const [error, setError] = useState('')

  const [savedMsg, setSavedMsg] = useState('')



  useEffect(() => {

    if (authLoading || !user) return



    let cancelled = false

    async function load() {

      setLoading(true)

      setError('')

      try {

        const { data, error: qErr } = await supabase

          .from('profiles')

          .select('display_name, location_lat, location_lng, bortle_zone, notify_good_nights')

          .eq('user_id', user.id)

          .maybeSingle()

        if (qErr) throw qErr

        if (cancelled) return

        setDisplayName(data?.display_name ?? '')

        setNotifyGoodNights(Boolean(data?.notify_good_nights))

        const lat = data?.location_lat ?? null

        const lng = data?.location_lng ?? null

        const bz = data?.bortle_zone

        const bzNum = bz == null ? NaN : Number(bz)

        setBortle(Number.isFinite(bzNum) ? bzNum : null)

        if (lat != null && lng != null) {

          try {

            const { displayName: place } = await reverseGeocode(lat, lng)

            setLocation({ lat, lng, placeName: place })

          } catch {

            setLocation({ lat, lng, placeName: '' })

          }

        } else {

          setLocation({ lat: null, lng: null, placeName: '' })

        }

      } catch (err) {

        if (!cancelled) setError(err.message ?? t('profile.loadFailed'))

      } finally {

        if (!cancelled) setLoading(false)

      }

    }

    load()

    return () => {

      cancelled = true

    }

  }, [authLoading, user, t])



  useEffect(() => {

    if (authLoading || loading || !user) return

    if (!notifyGoodNights) return

    scheduleNightCheck().catch(() => {})

  }, [authLoading, loading, user, notifyGoodNights])



  useLayoutEffect(() => {

    if (authLoading || loading || !user) {

      setHeaderAction(null)

      return () => setHeaderAction(null)

    }

    setHeaderAction(

      <button

        type="button"

        className="shell-header-action shell-header-action--danger"

        onClick={async () => {

          await signOut()

          navigate('/login', { replace: true })

        }}

      >

        <LogOut size={18} aria-hidden />

        <span>{t('common.signOut')}</span>

      </button>,

    )

    return () => setHeaderAction(null)

  }, [authLoading, loading, user, setHeaderAction, signOut, navigate, t])



  async function handleSave(e) {

    e.preventDefault()

    if (!user) return

    setSavedMsg('')

    if (!displayName.trim()) {

      setError(t('profile.displayNameRequired'))

      return

    }

    if (location.lat == null || location.lng == null) {

      setError(t('profile.locationRequired'))

      return

    }

    if (bortle == null) {

      setError(t('profile.bortleRequired'))

      return

    }

    setError('')

    setSaveBusy(true)

    try {

      const { error: upErr } = await supabase

        .from('profiles')

        .update({

          display_name: displayName.trim(),

          location_lat: location.lat,

          location_lng: location.lng,

          bortle_zone: bortle,

          notify_good_nights: notifyGoodNights,

        })

        .eq('user_id', user.id)

      if (upErr) throw upErr

      setSavedMsg(t('profile.saved'))

    } catch (err) {

      setError(err.message ?? t('profile.saveFailed'))

    } finally {

      setSaveBusy(false)

    }

  }



  if (authLoading || loading) {

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

        {t('common.loading')}

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

      <header style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>

        <Telescope aria-hidden size={28} />

        <h1 style={{ fontSize: '1.35rem', margin: 0 }}>{t('profile.title')}</h1>

      </header>

      <p style={{ marginTop: '0.75rem', color: '#b7c0d4', fontSize: '0.95rem', lineHeight: 1.5 }}>

        {t('profile.lede')}

      </p>



      <form onSubmit={handleSave} style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

        <div>

          <label htmlFor="profile-language" style={labelStyle}>

            {t('language.label')}

          </label>

          <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.4 }}>

            {t('language.hint')}

          </p>

          <select

            id="profile-language"

            value={i18n.language?.split('-')[0] || 'en'}

            onChange={(e) => i18n.changeLanguage(e.target.value)}

            style={fieldStyle}

          >

            {SUPPORTED_LOCALES.map(({ code, native }) => (

              <option key={code} value={code}>

                {native}

              </option>

            ))}

          </select>

        </div>



        <div>

          <label htmlFor="profile-name" style={labelStyle}>

            {t('profile.displayName')}

          </label>

          <input

            id="profile-name"

            name="displayName"

            autoComplete="nickname"

            value={displayName}

            onChange={(e) => setDisplayName(e.target.value)}

            style={fieldStyle}

          />

        </div>



        <div>

          <p style={{ ...labelStyle, marginBottom: '0.5rem' }}>{t('profile.observingLocation')}</p>

          <LocationPicker value={location} onChange={setLocation} disabled={saveBusy} />

        </div>



        <div>

          <p style={{ ...labelStyle, marginBottom: '0.5rem' }}>{t('profile.bortleZone')}</p>

          <BortleSelector value={bortle} onChange={setBortle} disabled={saveBusy} />

        </div>



        <div>

          <p style={{ ...labelStyle, marginBottom: '0.5rem' }}>{t('profile.notifications')}</p>

          <label

            style={{

              display: 'flex',

              alignItems: 'center',

              justifyContent: 'space-between',

              gap: '0.75rem',

              padding: '0.85rem 0.9rem',

              borderRadius: 12,

              border: '1px solid rgba(255,255,255,0.14)',

              background: 'rgba(0,0,0,0.18)',

            }}

          >

            <span style={{ display: 'grid', gap: '0.25rem' }}>

              <span style={{ color: '#e8eef7', fontWeight: 650 }}>{t('profile.notifyGoodNights')}</span>

              <span style={{ color: '#b7c0d4', fontSize: '0.85rem', lineHeight: 1.35 }}>

                {t(Capacitor.isNativePlatform() ? 'profile.notifyHintNative' : 'profile.notifyHint')}

              </span>

            </span>

            <input

              type="checkbox"

              checked={notifyGoodNights}

              disabled={saveBusy || notifyBusy}

              onChange={async (e) => {

                const enabled = e.target.checked

                setSavedMsg('')

                setError('')

                setNotifyBusy(true)

                setNotifyGoodNights(enabled)

                try {

                  if (enabled) {

                    const perm = await requestPermission()

                    if (perm !== 'granted') {

                      setNotifyGoodNights(false)

                      setError(
                        t(
                          Capacitor.isNativePlatform()
                            ? 'profile.notifyBlockedNative'
                            : 'profile.notifyBlocked',
                        ),
                      )

                      await supabase.from('profiles').update({ notify_good_nights: false }).eq('user_id', user.id)

                      return

                    }

                    await scheduleNightCheck()

                  } else {

                    await cancelNightCheck()

                  }



                  const { error: upErr } = await supabase

                    .from('profiles')

                    .update({ notify_good_nights: enabled })

                    .eq('user_id', user.id)

                  if (upErr) throw upErr

                  setSavedMsg(enabled ? t('profile.notifyEnabled') : t('profile.notifyDisabled'))

                } catch (err) {

                  setNotifyGoodNights(false)

                  setError(err.message ?? t('profile.notifyUpdateFailed'))

                } finally {

                  setNotifyBusy(false)

                }

              }}

              style={{ width: 22, height: 22 }}

              aria-label={t('profile.notifyGoodNights')}

            />

          </label>

        </div>



        {error ? (

          <p role="alert" style={{ margin: 0, fontSize: '0.9rem', color: '#ff9b9b' }}>

            {error}

          </p>

        ) : null}

        {savedMsg ? (

          <p role="status" style={{ margin: 0, fontSize: '0.9rem', color: '#86efac' }}>

            {savedMsg}

          </p>

        ) : null}



        <button

          type="submit"

          disabled={saveBusy}

          style={{

            marginTop: '0.25rem',

            padding: '0.75rem 1rem',

            borderRadius: 10,

            border: 'none',

            background: 'linear-gradient(135deg, #5b7cfa, #8a4dff)',

            color: '#fff',

            fontSize: '1rem',

            fontWeight: 600,

            cursor: saveBusy ? 'wait' : 'pointer',

            opacity: saveBusy ? 0.8 : 1,

          }}

        >

          {saveBusy ? t('common.saving') : t('profile.saveChanges')}

        </button>

      </form>



      <p style={{ marginTop: '1.25rem', textAlign: 'center', color: '#b7c0d4', fontSize: '0.9rem' }}>

        <Link to="/dashboard" style={{ color: '#8aa4ff' }}>

          {t('profile.backDashboard')}

        </Link>

        {' · '}

        <Link to="/delete-account" style={{ color: '#8aa4ff' }}>

          {t('profile.deleteAccount')}

        </Link>

        {' · '}

        <Link to="/" style={{ color: '#8aa4ff' }}>

          {t('profile.home')}

        </Link>

      </p>

    </main>

  )

}


