import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sun } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.js'
import { useNightConditions } from '../hooks/useNightConditions.js'
import { formatSupabaseClientMessage } from '../lib/supabaseErrors.js'
import { getUserEquipment } from '../lib/equipment.js'
import { getRecommendedTargets } from '../lib/targetEngine.js'
import { LS_ACTIVE_SKY_PROFILE } from '../lib/skyProfiles.js'
import TargetCard from '../components/TargetCard.jsx'
import HorizonSilhouette from '../components/HorizonSilhouette.jsx'

const LS_EQUIP = 'skywindow:activeEquipmentId'
const SKY_NONE = '__none__'

const DEFAULT_EQUIPMENT = { aperture_mm: 200, type: 'visual', name: 'Default 200mm visual' }

function horizonHasPoints(horizonData) {
  if (!horizonData) return false
  const pts = Array.isArray(horizonData) ? horizonData : horizonData.points
  return Array.isArray(pts) && pts.length > 0
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

function pct(n) {
  const v = Math.round(clamp(Number(n) || 0, 0, 100))
  return `${v}%`
}

function verdictStyles(v) {
  if (v === 'GO') return { bg: 'rgba(74,222,128,0.18)', fg: '#4ade80', border: 'rgba(74,222,128,0.45)' }
  if (v === 'MAYBE') return { bg: 'rgba(250,204,21,0.16)', fg: '#fde047', border: 'rgba(250,204,21,0.45)' }
  return { bg: 'rgba(248,113,113,0.14)', fg: '#f87171', border: 'rgba(248,113,113,0.4)' }
}

function verdictLabel(code, t) {
  if (code === 'GO') return t('verdict.go')
  if (code === 'MAYBE') return t('verdict.maybe')
  return t('verdict.stayIn')
}

function computeReasonLines(
  {
    cloud,
    maxCloud,
    lateCloud,
    cloudTrend,
    illum,
    goodCount,
    visibleCount,
    weatherMissing,
    moonMissing,
  },
  t,
) {
  const lines = []

  if (weatherMissing) lines.push(t('verdict.reasonForecastMissing'))
  else if (cloudTrend === 'overcast' || cloud >= 50)
    lines.push(t('verdict.reasonCloudHigh', { pct: pct(cloud) }))
  else if (cloudTrend === 'building' && (lateCloud >= 35 || maxCloud >= 55))
    lines.push(t('verdict.reasonCloudBuilding', { pct: pct(maxCloud) }))
  else if (cloud < 25) lines.push(t('verdict.reasonSkiesClear'))
  else if (cloud < 50) lines.push(t('verdict.reasonCloudSome', { pct: pct(cloud) }))
  else lines.push(t('verdict.reasonCloudHigh', { pct: pct(cloud) }))

  if (moonMissing) lines.push(t('verdict.reasonMoonMissing'))
  else if (illum < 40) lines.push(t('verdict.reasonMoonDim'))
  else if (illum < 65) lines.push(t('verdict.reasonMoonMid', { pct: pct(illum) }))
  else lines.push(t('verdict.reasonMoonBright', { pct: pct(illum) }))

  if (visibleCount <= 0) lines.push(t('verdict.reasonNoVisible'))
  else if (goodCount >= 3) lines.push(t('verdict.reasonStrongMany', { count: goodCount }))
  else if (goodCount >= 1) {
    lines.push(
      goodCount === 1
        ? t('verdict.reasonDecentOne')
        : t('verdict.reasonDecentMany', { count: goodCount }),
    )
  } else lines.push(t('verdict.reasonVisibleRough', { count: visibleCount }))

  return lines.slice(0, 3)
}

export default function Verdict() {
  const { t } = useTranslation()
  const { user, loading: authLoading } = useAuth()
  const { moonPhase, weather, loading: condLoading, error: conditionsError } = useNightConditions()

  const [profile, setProfile] = useState(null)
  const [equipmentList, setEquipmentList] = useState([])
  const [skyProfiles, setSkyProfiles] = useState([])
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('')
  const [selectedSkyProfileId, setSelectedSkyProfileId] = useState(SKY_NONE)
  const [loadError, setLoadError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (authLoading || !user) return

    let cancelled = false
    async function load() {
      setLoadError('')
      setReady(false)

      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .select('location_lat, location_lng, bortle_zone')
        .eq('user_id', user.id)
        .maybeSingle()

      if (cancelled) return
      if (pErr) {
        setLoadError(formatSupabaseClientMessage(pErr.message) || pErr.message || t('common.loadProfileFailed'))
        setReady(true)
        return
      }

      setProfile(prof ?? null)

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
        setLoadError(formatSupabaseClientMessage(eErr.message) || eErr.message || t('common.loadEquipmentFailed'))
      }
      if (sErr && !eErr) {
        setLoadError(formatSupabaseClientMessage(sErr.message) || sErr.message || t('sky.loadFailed'))
      }

      setEquipmentList(eqRows ?? [])
      setSkyProfiles(skyRows ?? [])

      try {
        const lsEq = localStorage.getItem(LS_EQUIP)
        if (lsEq && (eqRows ?? []).some((r) => r.id === lsEq)) setSelectedEquipmentId(lsEq)
        else if ((eqRows ?? []).length) setSelectedEquipmentId(eqRows[0].id)

        const lsSky = localStorage.getItem(LS_ACTIVE_SKY_PROFILE)
        if (lsSky === SKY_NONE) setSelectedSkyProfileId(SKY_NONE)
        else if (lsSky && (skyRows ?? []).some((r) => r.id === lsSky)) setSelectedSkyProfileId(lsSky)
        else if ((skyRows ?? []).length) setSelectedSkyProfileId(skyRows[0].id)
        else setSelectedSkyProfileId(SKY_NONE)
      } catch {
        /* ignore */
      }

      setReady(true)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [authLoading, user, t])

  const activeEquipment = useMemo(() => {
    if (!equipmentList.length) return DEFAULT_EQUIPMENT
    return equipmentList.find((r) => r.id === selectedEquipmentId) ?? equipmentList[0]
  }, [equipmentList, selectedEquipmentId])

  const activeHorizon = useMemo(() => {
    if (selectedSkyProfileId === SKY_NONE) return null
    const row = skyProfiles.find((s) => s.id === selectedSkyProfileId)
    return row?.horizon_data ?? null
  }, [skyProfiles, selectedSkyProfileId])

  const activeSkyLabel = useMemo(() => {
    if (selectedSkyProfileId === SKY_NONE || !horizonHasPoints(activeHorizon)) {
      return t('verdict.flatHorizon')
    }
    const row = skyProfiles.find((s) => s.id === selectedSkyProfileId)
    return row?.label?.trim() || t('tonight.untitledProfile')
  }, [skyProfiles, selectedSkyProfileId, activeHorizon, t])

  const showHorizonPreview = useMemo(() => horizonHasPoints(activeHorizon), [activeHorizon])
  const missingSkyProfiles = skyProfiles.length === 0

  const nightDate = useMemo(() => new Date(), [])

  const targets = useMemo(() => {
    if (!profile?.location_lat || !activeEquipment) return []
    const { visible } = getRecommendedTargets({
      date: nightDate,
      lat: Number(profile.location_lat),
      lng: Number(profile.location_lng),
      bortleZone: Number(profile.bortle_zone) || 5,
      horizonData: activeHorizon,
      apertureMm: Number(activeEquipment.aperture_mm) || 200,
      equipmentType: activeEquipment.type || 'visual',
      excludeMoonlit: false,
      moonPhase: moonPhase ?? undefined,
      weather: weather ?? undefined,
    })
    return visible
  }, [profile, activeEquipment, activeHorizon, moonPhase, weather, nightDate])

  const { verdict, reasonLines, top3 } = useMemo(() => {
    const weatherMissing = !weather?.tonight
    const moonMissing = !moonPhase

    const cloud = clamp(weather?.tonight?.avgCloudCover, 0, 100)
    const maxCloud = clamp(weather?.tonight?.maxCloudCover ?? cloud, 0, 100)
    const lateCloud = clamp(weather?.tonight?.lateCloudCover ?? cloud, 0, 100)
    const cloudTrend = weather?.tonight?.cloudTrend ?? 'mixed'
    const illum = clamp(moonPhase?.illumination, 0, 100)

    const visibleCount = targets.length
    const goodCount = targets.filter((row) => (Number(row.conditionScore) || 0) > 60).length
    const top3 = targets.slice(0, 3)

    const skiesClearEnough =
      cloud < 25 && maxCloud < 60 && !(cloudTrend === 'building' && lateCloud >= 35)

    let verdict = 'STAY IN'
    if (!weatherMissing && !moonMissing && skiesClearEnough && illum < 40 && goodCount >= 3) verdict = 'GO'
    else if (
      (!weatherMissing && cloud < 50 && cloudTrend !== 'overcast') ||
      (!moonMissing && illum < 65)
    ) {
      if (visibleCount >= 1) verdict = 'MAYBE'
    }

    const reasonLines = computeReasonLines(
      {
        cloud,
        maxCloud,
        lateCloud,
        cloudTrend,
        illum,
        goodCount,
        visibleCount,
        weatherMissing,
        moonMissing,
      },
      t,
    )

    return { verdict, reasonLines, top3 }
  }, [targets, moonPhase, weather, t])

  if (authLoading || condLoading || !ready) {
    return (
      <main
        style={{
          maxWidth: 520,
          margin: '0 auto',
          padding: '1.25rem',
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '0.75rem',
        }}
        aria-busy="true"
      >
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.95rem' }}>{t('verdict.loading')}</p>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!profile?.location_lat) {
    return <Navigate to="/onboarding" replace />
  }

  const pill = verdictStyles(verdict)

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
        <Sun aria-hidden size={28} />
        <h1 style={{ fontSize: '1.35rem', margin: 0 }}>{t('verdict.title')}</h1>
      </header>

      {loadError || conditionsError ? (
        <p role="alert" style={{ marginTop: '0.65rem', color: '#fca5a5', fontSize: '0.9rem' }}>
          {loadError || conditionsError}
        </p>
      ) : null}

      <p style={{ margin: '0.85rem 0 0', color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.45 }}>
        {t('verdict.basedOn', {
          sky: activeSkyLabel,
          equipment: activeEquipment?.name || t('verdict.defaultEquipment'),
        })}
      </p>

      {showHorizonPreview ? (
        <div style={{ marginTop: '0.65rem' }}>
          <HorizonSilhouette horizonData={activeHorizon} height={60} showLabels />
        </div>
      ) : null}

      {missingSkyProfiles ? (
        <p style={{ margin: '0.55rem 0 0', fontSize: '0.88rem', lineHeight: 1.45 }}>
          <span style={{ color: '#94a3b8' }}>{t('tonight.noProfilesHintBefore')} </span>
          <Link to="/sky-profiles" style={{ color: '#8aa4ff', textDecoration: 'none' }}>
            {t('tonight.captureHorizonLink')}
          </Link>
        </p>
      ) : null}

      <div style={{ marginTop: '1.25rem', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.55rem 1.1rem',
            borderRadius: 999,
            border: `1px solid ${pill.border}`,
            background: pill.bg,
            color: pill.fg,
            fontWeight: 800,
            letterSpacing: '0.04em',
            fontSize: '3rem',
            lineHeight: 1.05,
          }}
        >
          {verdictLabel(verdict, t)}
        </div>
      </div>

      <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.45rem' }}>
        {reasonLines.map((line, i) => (
          <p key={i} style={{ margin: 0, color: '#cbd5e1', fontSize: '0.98rem', lineHeight: 1.45 }}>
            {line}
          </p>
        ))}
      </div>

      <section style={{ marginTop: '1.25rem' }} aria-label={t('verdict.topTargetsAria')}>
        <h2 style={{ margin: '0 0 0.65rem', fontSize: '1.05rem' }}>{t('verdict.topTargets')}</h2>
        {top3.length ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {top3.map((row) => (
              <li key={row.id || row.name}>
                <TargetCard
                  target={row}
                  horizonData={activeHorizon}
                  apertureMm={Number(activeEquipment?.aperture_mm) || 200}
                  bortleZone={Number(profile?.bortle_zone) || 5}
                  equipmentName={activeEquipment?.name}
                  focalLengthMm={
                    activeEquipment?.focal_length_mm != null
                      ? Number(activeEquipment.focal_length_mm)
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.92rem' }}>
            {t('verdict.noTargets')}
          </p>
        )}
      </section>

      <div style={{ marginTop: '1.1rem' }}>
        <Link to="/tonight" style={{ color: '#8aa4ff', textDecoration: 'none', fontSize: '0.95rem' }}>
          {t('verdict.seeFullList')}
        </Link>
      </div>
    </main>
  )
}
