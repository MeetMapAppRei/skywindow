import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Settings } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.js'
import { useShellHeader } from '../context/ShellHeaderContext.jsx'
import { useNightConditions } from '../hooks/useNightConditions.js'
import { getUserEquipment } from '../lib/equipment.js'
import { formatSupabaseClientMessage } from '../lib/supabaseErrors.js'
import { getRecommendedTargets } from '../lib/targetEngine.js'
import {
  getHorizonAltitudeAtAzimuth,
  getTargetRiseMinutesFromNightStart,
} from '../lib/astronomy.js'
import ConditionsBar from '../components/ConditionsBar.jsx'
import TargetCard from '../components/TargetCard.jsx'
import FilterBar from '../components/FilterBar.jsx'
import HorizonSilhouette from '../components/HorizonSilhouette.jsx'
import { addTargetToPlan, useObservationPlan } from '../lib/observationPlan.js'
import { getTargetTypeBadge } from '../lib/targetLabels.js'

const LS_EQUIP = 'skywindow:activeEquipmentId'
import { LS_ACTIVE_SKY_PROFILE, rememberActiveSkyProfile } from '../lib/skyProfiles.js'

const SKY_NONE = '__none__'

const selectStyle = {
  width: '100%',
  marginTop: '0.35rem',
  padding: '0.55rem 0.65rem',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(0,0,0,0.25)',
  color: '#e8eef7',
  fontSize: '0.9rem',
}

function matchesCategory(target, cat) {
  if (cat === 'all') return true
  const tags = new Set(target.tags || [])
  const type = target.type || ''
  if (cat === 'galaxy') return tags.has('galaxy') || type === 'galaxy'
  if (cat === 'cluster') return tags.has('cluster') || type.includes('cluster')
  if (cat === 'double_star') return tags.has('double_star') || type === 'double_star'
  if (cat === 'nebula') {
    return (
      tags.has('nebula') ||
      tags.has('emission_nebula') ||
      tags.has('planetary_nebula') ||
      type.includes('nebula') ||
      type === 'supernova_remnant' ||
      type === 'milky_way_patch'
    )
  }
  return true
}

function horizonHasPoints(horizonData) {
  if (!horizonData) return false
  const pts = Array.isArray(horizonData) ? horizonData : horizonData.points
  return Array.isArray(pts) && pts.length > 0
}

function passesTonightOnly(target, horizonData) {
  const terrain = getHorizonAltitudeAtAzimuth(horizonData, target.visibility?.azimuthAtBest ?? 0)
  const clearance = (Number(target.visibility?.maxAlt) || 0) - terrain
  if (horizonHasPoints(horizonData)) return clearance >= 5
  return (Number(target.visibility?.maxAlt) || 0) >= 22
}

function TargetListSkeleton() {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <li
          key={i}
          aria-hidden
          style={{
            height: 108,
            borderRadius: 12,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.05) 100%)',
            backgroundSize: '200% 100%',
            animation: 'tonight-shimmer 1.1s ease-in-out infinite',
          }}
        />
      ))}
      <style>{`@keyframes tonight-shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }`}</style>
    </ul>
  )
}

export default function Tonight() {
  const { t, i18n } = useTranslation()
  const { user, loading: authLoading } = useAuth()
  const location = useLocation()
  const [pageToast, setPageToast] = useState('')
  const {
    moonPhase,
    weather,
    conditions,
    loading: condLoading,
    error: conditionsError,
  } = useNightConditions()
  const nightDate = useMemo(() => new Date(), [])

  const [gateReady, setGateReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [retryNonce, setRetryNonce] = useState(0)
  const [profile, setProfile] = useState(null)
  const [equipmentList, setEquipmentList] = useState([])
  const [skyProfiles, setSkyProfiles] = useState([])
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('')
  const [selectedSkyProfileId, setSelectedSkyProfileId] = useState(SKY_NONE)

  const [category, setCategory] = useState('all')
  const [tonightOnly, setTonightOnly] = useState(false)
  const [sortBy, setSortBy] = useState('score')

  const [planHint, setPlanHint] = useState('')
  const planState = useObservationPlan(nightDate)

  const { setHeaderAction } = useShellHeader()

  useLayoutEffect(() => {
    setHeaderAction(
      <Link
        to="/profile"
        viewTransition
        aria-label={t('common.settingsProfile')}
        className="shell-header-action"
      >
        <Settings size={20} aria-hidden />
      </Link>,
    )
    return () => setHeaderAction(null)
  }, [setHeaderAction, t])

  useEffect(() => {
    if (authLoading || !user) return

    let cancelled = false
    async function load() {
      setLoadError('')
      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .select('location_lat, location_lng, bortle_zone')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (pErr) {
        setLoadError(
          formatSupabaseClientMessage(pErr.message) || pErr.message || t('common.loadProfileFailed'),
        )
        setProfile(null)
        setGateReady(true)
        return
      }
      if (prof?.location_lat == null) {
        setProfile(null)
        setGateReady(true)
        return
      }
      setProfile(prof)

      const [{ data: eqRows, error: eErr }, { data: skyRows, error: sErr }] = await Promise.all([
        getUserEquipment(user.id),
        supabase
          .from('sky_profiles')
          .select('id, label, horizon_data, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ])
      if (cancelled) return

      if (eErr) {
        setLoadError(
          formatSupabaseClientMessage(eErr.message) || eErr.message || t('common.loadEquipmentFailed'),
        )
      }
      if (sErr && !eErr) {
        setLoadError(
          formatSupabaseClientMessage(sErr.message) ||
            sErr.message ||
            t('sky.loadFailed'),
        )
      }

      setEquipmentList(eqRows ?? [])
      setSkyProfiles(skyRows ?? [])

      try {
        const lsEq = localStorage.getItem(LS_EQUIP)
        if (lsEq && (eqRows ?? []).some((r) => r.id === lsEq)) setSelectedEquipmentId(lsEq)
        else if ((eqRows ?? []).length) setSelectedEquipmentId(eqRows[0].id)

        const pickId = location?.state?.selectSkyProfileId
        if (pickId && (skyRows ?? []).some((r) => r.id === pickId)) {
          setSelectedSkyProfileId(pickId)
          rememberActiveSkyProfile(pickId)
        } else {
          const lsSky = localStorage.getItem(LS_ACTIVE_SKY_PROFILE)
          if (lsSky === SKY_NONE) setSelectedSkyProfileId(SKY_NONE)
          else if (lsSky && (skyRows ?? []).some((r) => r.id === lsSky)) setSelectedSkyProfileId(lsSky)
          else if ((skyRows ?? []).length) setSelectedSkyProfileId(skyRows[0].id)
          else setSelectedSkyProfileId(SKY_NONE)
        }
      } catch {
        /* ignore */
      }

      setGateReady(true)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [authLoading, user, retryNonce, location?.state?.selectSkyProfileId, t])

  useEffect(() => {
    const msg = location?.state?.toast
    if (!msg) return
    setPageToast(String(msg))
    const t = window.setTimeout(() => setPageToast(''), 2800)
    return () => window.clearTimeout(t)
  }, [location?.state?.toast])

  const activeEquipment = useMemo(() => {
    if (!equipmentList.length) return null
    return equipmentList.find((r) => r.id === selectedEquipmentId) ?? equipmentList[0]
  }, [equipmentList, selectedEquipmentId])

  const activeHorizon = useMemo(() => {
    if (selectedSkyProfileId === SKY_NONE) return null
    const row = skyProfiles.find((s) => s.id === selectedSkyProfileId)
    return row?.horizon_data ?? null
  }, [skyProfiles, selectedSkyProfileId])

  const showHorizonPreview = useMemo(() => horizonHasPoints(activeHorizon), [activeHorizon])

  const equipmentForEngine = useMemo(() => {
    if (activeEquipment) {
      return {
        apertureMm: Number(activeEquipment.aperture_mm) || 200,
        equipmentType: activeEquipment.type || 'visual',
      }
    }
    return { apertureMm: 200, equipmentType: 'visual' }
  }, [activeEquipment])

  const engineResults = useMemo(() => {
    if (!profile?.location_lat || !gateReady) return []
    const lat = Number(profile.location_lat)
    const lng = Number(profile.location_lng)
    const bortleZone = Number(profile.bortle_zone) || 5
    const res = getRecommendedTargets({
      date: nightDate,
      lat,
      lng,
      bortleZone,
      horizonData: activeHorizon,
      apertureMm: equipmentForEngine.apertureMm,
      equipmentType: equipmentForEngine.equipmentType,
      excludeMoonlit: false,
      moonPhase: moonPhase ?? undefined,
      weather: weather ?? undefined,
    })
    return {
      visible: (res.visible ?? []).map((t) => ({
        ...t,
        _riseMin: getTargetRiseMinutesFromNightStart(t, activeHorizon, lat, lng, nightDate, 20),
      })),
      blocked: res.blocked ?? [],
    }
  }, [
    profile?.location_lat,
    profile?.location_lng,
    profile?.bortle_zone,
    gateReady,
    activeHorizon,
    equipmentForEngine.apertureMm,
    equipmentForEngine.equipmentType,
    moonPhase,
    weather,
    nightDate,
  ])

  const rawTargets = engineResults?.visible ?? []
  const blockedTargets = engineResults?.blocked ?? []

  const filteredSorted = useMemo(() => {
    let rows = rawTargets.filter((t) => matchesCategory(t, category))
    if (tonightOnly) rows = rows.filter((t) => passesTonightOnly(t, activeHorizon))
    const out = [...rows]
    if (sortBy === 'score') out.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    else if (sortBy === 'rise') out.sort((a, b) => (a._riseMin ?? 999) - (b._riseMin ?? 999))
    else out.sort((a, b) => (Number(a.magnitude) || 99) - (Number(b.magnitude) || 99))
    return out
  }, [rawTargets, category, tonightOnly, sortBy, activeHorizon])

  const missingEquipment = equipmentList.length === 0
  const missingSkyProfile = skyProfiles.length === 0

  const showTargetSkeleton =
    condLoading &&
    moonPhase == null &&
    weather == null &&
    conditions == null &&
    !conditionsError

  const setEquipId = useCallback((id) => {
    setSelectedEquipmentId(id)
    try {
      localStorage.setItem(LS_EQUIP, id)
    } catch {
      /* ignore */
    }
  }, [])

  const setSkyId = useCallback((id) => {
    setSelectedSkyProfileId(id)
    try {
      if (id === SKY_NONE) localStorage.setItem(LS_ACTIVE_SKY_PROFILE, SKY_NONE)
      else rememberActiveSkyProfile(id)
    } catch {
      /* ignore */
    }
  }, [])

  const handleAddToPlan = useCallback(
    (target) => {
      addTargetToPlan(target.id, nightDate)
      setPlanHint(t('tonight.addedToPlan', { name: target.name }))
      setTimeout(() => setPlanHint(''), 3200)
    },
    [nightDate, t],
  )

  const dateLabel = nightDate.toLocaleDateString(i18n.language, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  if (authLoading || !gateReady) {
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

  if (!profile?.location_lat) {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <main
      style={{
        maxWidth: 520,
        margin: '0 auto',
        padding: '1.25rem',
        minHeight: '100dvh',
        paddingBottom: '2rem',
      }}
    >
      <header style={{ marginBottom: '0.85rem' }}>
        <h1 style={{ fontSize: '1.35rem', margin: 0, fontWeight: 700 }}>{t('tonight.title')}</h1>
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>{dateLabel}</p>
      </header>

      <ConditionsBar
        moonPhase={moonPhase}
        weather={weather}
        conditions={conditions}
        bortleZone={profile?.bortle_zone != null ? Number(profile.bortle_zone) : null}
        nightDate={nightDate}
      />

      {condLoading && !moonPhase ? (
        <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginTop: '-0.35rem' }}>{t('tonight.updatingConditions')}</p>
      ) : null}

      {conditionsError ? (
        <p role="alert" style={{ marginTop: '0.35rem', color: '#fca5a5', fontSize: '0.88rem' }}>
          {conditionsError}
        </p>
      ) : null}

      {loadError ? (
        <div style={{ marginTop: '0.35rem' }}>
          <p role="alert" style={{ margin: '0 0 0.5rem', color: '#fca5a5', fontSize: '0.88rem' }}>
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => {
              setGateReady(false)
              setRetryNonce((n) => n + 1)
            }}
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
            {t('common.tryAgain')}
          </button>
        </div>
      ) : null}

      {pageToast ? (
        <p
          role="status"
          style={{
            marginTop: '0.65rem',
            padding: '0.5rem 0.65rem',
            borderRadius: 10,
            background: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.35)',
            color: '#86efac',
            fontSize: '0.88rem',
          }}
        >
          {pageToast}
        </p>
      ) : null}

      <section
        style={{
          marginTop: '1rem',
          padding: '0.85rem',
          borderRadius: 12,
          border: '1px solid rgba(138,164,255,0.35)',
          background: 'rgba(138,164,255,0.08)',
        }}
      >
        <label style={{ display: 'block', fontSize: '0.85rem', color: '#dbe6ff', fontWeight: 700 }}>
          {t('tonight.skyProfileLabel')}
          <select
            value={selectedSkyProfileId}
            onChange={(e) => setSkyId(e.target.value)}
            style={{ ...selectStyle, marginTop: '0.45rem' }}
          >
            <option value={SKY_NONE}>{t('tonight.noProfileOption')}</option>
            {skyProfiles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label || t('tonight.untitledProfile')}
              </option>
            ))}
          </select>
        </label>
        {missingSkyProfile ? (
          <p style={{ margin: '0.55rem 0 0', fontSize: '0.85rem', color: '#fde68a', lineHeight: 1.45 }}>
            {t('tonight.noProfilesHintBefore')}{' '}
            <Link to="/sky-profiles" style={{ color: '#8aa4ff' }}>
              {t('tonight.captureHorizonLink')}
            </Link>
            .
          </p>
        ) : selectedSkyProfileId !== SKY_NONE ? (
          <p style={{ margin: '0.55rem 0 0', fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.45 }}>
            {t('tonight.usingProfileBefore')}{' '}
            <strong style={{ color: '#e8eef7' }}>
              {skyProfiles.find((s) => s.id === selectedSkyProfileId)?.label || 'profile'}
            </strong>{' '}
            {t('tonight.usingProfileAfter')}
          </p>
        ) : (
          <p style={{ margin: '0.55rem 0 0', fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.45 }}>
            {t('tonight.selectSiteHint')}
          </p>
        )}
        {showHorizonPreview ? (
          <div style={{ marginTop: '0.55rem' }}>
            <HorizonSilhouette horizonData={activeHorizon} height={60} showLabels />
          </div>
        ) : null}
      </section>

      {missingEquipment ? (
        <p style={{ marginTop: '0.65rem', fontSize: '0.85rem', color: '#fde68a', lineHeight: 1.45 }}>
          {t('tonight.missingEquipmentBefore')}{' '}
          <Link to="/equipment" style={{ color: '#8aa4ff' }}>
            {t('tonight.addGearLink')}
          </Link>
        </p>
      ) : null}

      <>

          <label
            style={{
              display: 'block',
              fontSize: '0.78rem',
              color: '#94a3b8',
              fontWeight: 600,
              marginTop: '0.85rem',
            }}
          >
            {t('tonight.activeEquipment')}
            <select
              value={activeEquipment?.id ?? ''}
              onChange={(e) => setEquipId(e.target.value)}
              style={selectStyle}
              disabled={!equipmentList.length}
            >
              {!equipmentList.length ? (
                <option value="">{t('tonight.noEquipmentSaved')}</option>
              ) : null}
              {equipmentList.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name}
                  {eq.is_seestar ? t('tonight.seestarSuffix') : ''}
                </option>
              ))}
            </select>
          </label>

          <FilterBar
            category={category}
            onCategoryChange={setCategory}
            tonightOnly={tonightOnly}
            onTonightOnlyChange={setTonightOnly}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />

          {planHint ? (
            <p role="status" style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: '#86efac' }}>
              {planHint}
            </p>
          ) : null}

          {showTargetSkeleton ? (
            <TargetListSkeleton />
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {filteredSorted.map((t) => (
                <li key={t.id}>
                  <TargetCard
                    target={t}
                    horizonData={activeHorizon}
                    apertureMm={equipmentForEngine.apertureMm}
                    bortleZone={Number(profile?.bortle_zone) || 5}
                    equipmentName={activeEquipment?.name}
                    focalLengthMm={
                      activeEquipment?.focal_length_mm != null
                        ? Number(activeEquipment.focal_length_mm)
                        : undefined
                    }
                    onAddToPlan={handleAddToPlan}
                    inPlan={
                      planState.pinnedIds.includes(t.id) && !planState.hiddenIds.includes(t.id)
                    }
                  />
                </li>
              ))}
            </ul>
          )}

          {!showTargetSkeleton && filteredSorted.length === 0 ? (
            <p style={{ marginTop: '0.75rem', fontSize: '0.88rem', color: '#94a3b8' }}>
              {t('tonight.noMatchFilters')}
            </p>
          ) : null}

          {blockedTargets.length ? (
            <details
              style={{
                marginTop: '0.95rem',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                overflow: 'hidden',
              }}
            >
              <summary
                style={{
                  listStyle: 'none',
                  cursor: 'pointer',
                  padding: '0.75rem 0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  color: '#e8eef7',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                }}
              >
                <span>{t('tonight.blockedHeading')}</span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.5rem',
                    borderRadius: 999,
                    border: '1px solid rgba(148,163,184,0.35)',
                    background: 'rgba(148,163,184,0.12)',
                    color: '#cbd5e1',
                    flex: '0 0 auto',
                  }}
                >
                  {t('tonight.blockedCount', { count: blockedTargets.length })}
                </span>
              </summary>
              <div style={{ padding: '0 0.85rem 0.85rem' }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  {blockedTargets.map((target) => {
                    const badge = getTargetTypeBadge(target, t)
                    return (
                      <li
                        key={target.id ?? target.name}
                        style={{
                          padding: '0.65rem 0.75rem',
                          borderRadius: 10,
                          border: '1px solid rgba(255,255,255,0.08)',
                          background: 'rgba(0,0,0,0.18)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <div style={{ flex: '1 1 auto', minWidth: 0, fontWeight: 650, color: '#e8eef7' }}>{target.name}</div>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              padding: '0.2rem 0.45rem',
                              borderRadius: 8,
                              border: `1px solid ${badge.border}`,
                              background: badge.bg,
                              color: badge.fg,
                              flex: '0 0 auto',
                            }}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <div style={{ marginTop: '0.35rem', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.4 }}>
                          {target.blockedReason}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </details>
          ) : null}
      </>

      <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        <Link to="/dashboard" style={{ color: '#8aa4ff', textDecoration: 'none', fontSize: '0.9rem' }}>
          {t('tonight.moreTools')}
        </Link>
        <Link to="/targets" style={{ color: '#8aa4ff', textDecoration: 'none', fontSize: '0.9rem' }}>
          {t('tonight.legacyList')}
        </Link>
      </div>
    </main>
  )
}
