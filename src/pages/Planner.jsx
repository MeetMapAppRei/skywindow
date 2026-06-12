import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, GripVertical, Telescope, Trash2 } from 'lucide-react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.js'
import { useNightConditions } from '../hooks/useNightConditions.js'
import { getUserEquipment } from '../lib/equipment.js'
import { formatSupabaseClientMessage } from '../lib/supabaseErrors.js'
import { formatHm12h, getHorizonAltitudeAtAzimuth, parseNightHmIntoDate, raDecToAltAz } from '../lib/astronomy.js'
import { getDifficultyRating, getRecommendedTargets } from '../lib/targetEngine.js'
import ConditionsBar from '../components/ConditionsBar.jsx'
import TargetAvailabilityTimeline from '../components/TargetAvailabilityTimeline.jsx'
import {
  clearCuratedPlan,
  prunePlanIds,
  removeTargetFromPlan,
  restoreAllHidden,
  setCustomPlanOrder,
  setTargetMinutes,
  useObservationPlan,
} from '../lib/observationPlan.js'

const LS_SKY = 'skywindow:activeSkyProfileId'
const SKY_NONE = '__none__'

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

function bestInstantFromTarget(target, nightDate) {
  return parseNightHmIntoDate(target.visibility?.bestTime, nightDate)
}

function bestInstantSortKey(target, nightDate) {
  const d = bestInstantFromTarget(target, nightDate)
  return d ? d.getTime() : Number.POSITIVE_INFINITY
}

/** Order targets so earlier “best” times come first (better for back-to-back slots from session start). */
function sortTargetsForSessionOrder(targets, nightDate) {
  return [...targets].sort((a, b) => {
    const ta = bestInstantSortKey(a, nightDate)
    const tb = bestInstantSortKey(b, nightDate)
    if (ta !== tb) return ta - tb
    return (Number(b.score) || 0) - (Number(a.score) || 0)
  })
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function formatTime12h(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—'
  try {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  } catch {
    const h = date.getHours()
    const mi = date.getMinutes()
    const ampm = h >= 12 ? 'PM' : 'AM'
    let hr = h % 12
    if (hr === 0) hr = 12
    return `${hr}:${pad2(mi)} ${ampm}`
  }
}

function formatDateTitle(date) {
  try {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return `${date.getMonth() + 1}/${date.getDate()}`
  }
}

function typeMeta(target) {
  const tags = new Set(target.tags || [])
  const t = target.type || ''
  if (tags.has('galaxy') || t === 'galaxy') return { label: 'Galaxy', color: '#60a5fa', key: 'galaxy' }
  if (
    tags.has('nebula') ||
    tags.has('emission_nebula') ||
    tags.has('planetary_nebula') ||
    t.includes('nebula') ||
    t === 'supernova_remnant' ||
    t === 'milky_way_patch'
  )
    return { label: 'Nebula', color: '#f472b6', key: 'nebula' }
  if (tags.has('cluster') || t.includes('cluster'))
    return { label: 'Cluster', color: '#facc15', key: 'cluster' }
  return { label: t.replace(/_/g, ' ') || 'Target', color: '#94a3b8', key: 'other' }
}

function buildSessionDefaults(now = new Date()) {
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()
  const start = new Date(y, m, d, 21, 0, 0, 0)
  const end = new Date(y, m, d + 1, 1, 0, 0, 0)
  return { start, end }
}

function setTimeOnDate(base, hhmm, allowNextDay) {
  const [hs, ms] = String(hhmm || '').split(':')
  const h = parseInt(hs, 10)
  const m = parseInt(ms, 10)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return base
  const out = new Date(base)
  out.setHours(h, m, 0, 0)
  if (allowNextDay) {
    const baseH = base.getHours()
    const baseM = base.getMinutes()
    if (h < baseH || (h === baseH && m < baseM)) out.setDate(out.getDate() + 1)
  }
  return out
}

function enumerateSamples(start, end, stepMin) {
  const s = start instanceof Date ? start : null
  const e = end instanceof Date ? end : null
  if (!s || !e || Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return []
  if (e.getTime() <= s.getTime()) return []
  const stepMs = stepMin * 60 * 1000
  const out = []
  for (let t = s.getTime(); t <= e.getTime(); t += stepMs) out.push(new Date(t))
  if (out.length === 0 || out[out.length - 1].getTime() !== e.getTime()) out.push(new Date(e))
  return out
}

function availabilitySegments(target, horizonData, sessionStart, sessionEnd) {
  const instants = enumerateSamples(sessionStart, sessionEnd, 10)
  if (instants.length < 2) return { segments: [], coverage: 0 }
  const total = instants.length
  let aboveCount = 0
  const bools = instants.map((instant) => {
    const { altitude, azimuth } = raDecToAltAz(target.ra, target.dec, target._lat, target._lng, instant)
    const terrain = getHorizonAltitudeAtAzimuth(horizonData, azimuth)
    const ok = altitude >= Math.max(terrain, 20)
    if (ok) aboveCount += 1
    return ok
  })

  const segments = []
  let i = 0
  while (i < bools.length) {
    const v = bools[i]
    const startI = i
    while (i < bools.length && bools[i] === v) i += 1
    const endI = i
    const startPct = (startI / (total - 1)) * 100
    const endPct = (endI / (total - 1)) * 100
    segments.push({ startPct, endPct, ok: v })
  }

  const coverage = Math.round((aboveCount / total) * 1000) / 10
  return { segments, coverage }
}

function SortablePlanRow({
  item,
  index,
  nightDate,
  sessionStart,
  sessionEnd,
  horizonData,
  bortleZone,
  apertureMm,
  equipmentName,
  focalLengthMm,
  scheduledStart,
  scheduledEnd,
  warning,
  onSetMinutes,
  onRemove,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
  }

  const t = item.target
  const meta = typeMeta(t)
  const difficulty =
    bortleZone != null && apertureMm != null
      ? getDifficultyRating(t, apertureMm, bortleZone, {
          equipmentName,
          focalLengthMm:
            focalLengthMm != null && Number.isFinite(Number(focalLengthMm)) ? Number(focalLengthMm) : undefined,
        })
      : null
  const bestHm = t.visibility?.bestTime
  const bestInstant = useMemo(() => bestInstantFromTarget(t, nightDate), [t, nightDate])
  const bestLabel = bestHm && bestHm !== '—' ? `Best at ${formatHm12h(bestHm)}` : 'Best time —'
  const bestTimingNote = useMemo(() => {
    if (!bestInstant) return ''
    if (bestInstant.getTime() < sessionStart.getTime()) return 'before your session'
    if (bestInstant.getTime() > sessionEnd.getTime()) return 'after your session'
    return ''
  }, [bestInstant, sessionStart, sessionEnd])

  const { segments, coverage } = useMemo(
    () => availabilitySegments(t, horizonData, sessionStart, sessionEnd),
    [t, horizonData, sessionStart, sessionEnd],
  )

  const bestMarker = useMemo(() => {
    if (!bestInstant) return { pct: null, placement: null }
    if (bestInstant.getTime() < sessionStart.getTime()) return { pct: 0, placement: 'before' }
    if (bestInstant.getTime() > sessionEnd.getTime()) return { pct: 100, placement: 'after' }
    const totalMs = sessionEnd.getTime() - sessionStart.getTime()
    if (totalMs <= 0) return { pct: null, placement: null }
    return {
      pct: clamp(((bestInstant.getTime() - sessionStart.getTime()) / totalMs) * 100, 0, 100),
      placement: 'in',
    }
  }, [bestInstant, sessionStart, sessionEnd])

  return (
    <li
      ref={setNodeRef}
      style={{
        ...style,
        padding: '0.75rem 0.85rem',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.1)',
        background: isDragging ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
        display: 'flex',
        gap: '0.7rem',
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        <button
          type="button"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
          style={{
            padding: 6,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(0,0,0,0.18)',
            color: '#cbd5e1',
            cursor: 'grab',
            touchAction: 'none',
          }}
        >
          <GripVertical aria-hidden size={18} />
        </button>
        <button
          type="button"
          aria-label={`Remove ${t.name} from plan`}
          onClick={() => onRemove(item.id)}
          style={{
            padding: 6,
            borderRadius: 10,
            border: '1px solid rgba(248,113,113,0.35)',
            background: 'rgba(248,113,113,0.08)',
            color: '#fca5a5',
            cursor: 'pointer',
          }}
        >
          <Trash2 aria-hidden size={16} />
        </button>
      </div>

      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: '1 1 200px' }}>
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                rowGap: '0.35rem',
              }}
            >
              <div style={{ fontWeight: 750, color: '#e8eef7', fontSize: '1.02rem', lineHeight: 1.25 }}>
                {index + 1}. {t.name}
              </div>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  padding: '0.2rem 0.45rem',
                  borderRadius: 8,
                  border: `1px solid rgba(255,255,255,0.16)`,
                  background: 'rgba(255,255,255,0.06)',
                  color: meta.color,
                  flex: '0 0 auto',
                }}
              >
                {meta.label}
              </span>
              {difficulty ? (
                <span
                  title={difficulty.reason}
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '0.2rem 0.45rem',
                    borderRadius: 8,
                    border: `1px solid rgba(255,255,255,0.16)`,
                    background: 'rgba(255,255,255,0.06)',
                    color: difficulty.color,
                    flex: '0 0 auto',
                  }}
                >
                  {difficulty.label}
                </span>
              ) : null}
            </div>

            <div style={{ marginTop: '0.35rem', fontSize: '0.82rem', color: '#94a3b8', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span>
                {bestLabel}
                {bestTimingNote ? (
                  <span style={{ color: '#78716c' }}> ({bestTimingNote})</span>
                ) : null}
              </span>
              {scheduledStart && scheduledEnd ? (
                <span style={{ color: '#b7c0d4' }}>
                  Your slot {formatTime12h(scheduledStart)}–{formatTime12h(scheduledEnd)}
                </span>
              ) : null}
            </div>

            {warning ? (
              <div
                role="status"
                style={{
                  marginTop: '0.45rem',
                  display: 'flex',
                  gap: '0.45rem',
                  alignItems: 'flex-start',
                  padding: '0.45rem 0.55rem',
                  borderRadius: 10,
                  border: '1px solid rgba(250,204,21,0.35)',
                  background: 'rgba(250,204,21,0.08)',
                  color: '#fde68a',
                  fontSize: '0.78rem',
                  lineHeight: 1.45,
                }}
              >
                <AlertTriangle aria-hidden size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  <strong style={{ fontWeight: 700 }}>Schedule note.</strong> {warning}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <TargetAvailabilityTimeline
          segments={segments}
          coverage={coverage}
          sessionStart={sessionStart}
          sessionEnd={sessionEnd}
          scheduledStart={scheduledStart}
          scheduledEnd={scheduledEnd}
          bestPct={bestMarker.pct}
          bestPlacement={bestMarker.placement}
        />

        <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Time needed</span>
          {[15, 30, 45, 60].map((m) => {
            const active = item.minutes === m
            return (
              <button
                key={m}
                type="button"
                onClick={() => onSetMinutes(item.id, m)}
                style={{
                  padding: '0.28rem 0.5rem',
                  borderRadius: 10,
                  border: active ? '1px solid rgba(138,164,255,0.65)' : '1px solid rgba(255,255,255,0.16)',
                  background: active ? 'rgba(138,164,255,0.14)' : 'rgba(255,255,255,0.05)',
                  color: active ? '#dbe6ff' : '#cbd5e1',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {m}m
              </button>
            )
          })}
        </div>
      </div>
    </li>
  )
}

export default function Planner() {
  const { t } = useTranslation()
  const { user, loading: authLoading } = useAuth()
  const { moonPhase, weather, conditions, loading: condLoading, error: conditionsError } = useNightConditions()
  const [profile, setProfile] = useState(null)
  const [primaryEquipment, setPrimaryEquipment] = useState(null)
  const [skyProfiles, setSkyProfiles] = useState([])
  const [selectedSkyProfileId, setSelectedSkyProfileId] = useState(SKY_NONE)
  const [loadError, setLoadError] = useState('')
  const [ready, setReady] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)

  const nightDate = useMemo(() => new Date(), [])
  const defaults = useMemo(() => buildSessionDefaults(nightDate), [nightDate])
  const [startHm, setStartHm] = useState(`${pad2(defaults.start.getHours())}:${pad2(defaults.start.getMinutes())}`)
  const [endHm, setEndHm] = useState(`${pad2(defaults.end.getHours())}:${pad2(defaults.end.getMinutes())}`)

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
        setLoadError(formatSupabaseClientMessage(pErr.message) || pErr.message || 'Could not load profile')
        setReady(true)
        return
      }
      if (prof?.location_lat == null) {
        setProfile(null)
        setReady(true)
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
        setLoadError(formatSupabaseClientMessage(eErr.message) || eErr.message || 'Could not load equipment')
        setPrimaryEquipment({ aperture_mm: 200, type: 'visual', name: 'Default 200mm visual' })
        setSkyProfiles(skyRows ?? [])
        setReady(true)
        return
      }
      if (sErr && !eErr) {
        setLoadError(formatSupabaseClientMessage(sErr.message) || sErr.message || 'Could not load sky profiles')
      }
      const first = eqRows?.[0]
      setPrimaryEquipment(first ?? { aperture_mm: 200, type: 'visual', name: 'Default 200mm visual' })
      setSkyProfiles(skyRows ?? [])

      try {
        const lsSky = localStorage.getItem(LS_SKY)
        if (lsSky === SKY_NONE) setSelectedSkyProfileId(SKY_NONE)
        else if (lsSky && (skyRows ?? []).some((r) => r.id === lsSky)) setSelectedSkyProfileId(lsSky)
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
  }, [authLoading, user, retryNonce])

  const activeHorizon = useMemo(() => {
    if (selectedSkyProfileId === SKY_NONE) return null
    const row = skyProfiles.find((s) => s.id === selectedSkyProfileId)
    return row?.horizon_data ?? null
  }, [skyProfiles, selectedSkyProfileId])

  const sessionStart = useMemo(() => setTimeOnDate(defaults.start, startHm, false), [defaults, startHm])
  const sessionEnd = useMemo(() => setTimeOnDate(defaults.start, endHm, true), [defaults, endHm])
  const sessionOk = sessionEnd.getTime() > sessionStart.getTime()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const engineBase = useMemo(() => {
    if (!profile?.location_lat || !primaryEquipment) return null
    return {
      lat: Number(profile.location_lat),
      lng: Number(profile.location_lng),
      bortleZone: Number(profile.bortle_zone) || 5,
      apertureMm: Number(primaryEquipment.aperture_mm) || 200,
      equipmentType: primaryEquipment.type || 'visual',
    }
  }, [profile, primaryEquipment])

  const allNightRecommended = useMemo(() => {
    if (!engineBase) return []
    const { visible } = getRecommendedTargets({
      date: nightDate,
      lat: engineBase.lat,
      lng: engineBase.lng,
      bortleZone: engineBase.bortleZone,
      horizonData: activeHorizon,
      apertureMm: engineBase.apertureMm,
      equipmentType: engineBase.equipmentType,
      excludeMoonlit: false,
      moonPhase: moonPhase ?? undefined,
      weather: weather ?? undefined,
    })
    return visible.map((t) => ({ ...t, _lat: engineBase.lat, _lng: engineBase.lng }))
  }, [engineBase, nightDate, activeHorizon, moonPhase, weather])

  const recommended = useMemo(() => {
    if (!engineBase || !sessionOk) return []
    const { visible } = getRecommendedTargets({
      date: nightDate,
      lat: engineBase.lat,
      lng: engineBase.lng,
      bortleZone: engineBase.bortleZone,
      horizonData: activeHorizon,
      apertureMm: engineBase.apertureMm,
      equipmentType: engineBase.equipmentType,
      excludeMoonlit: false,
      moonPhase: moonPhase ?? undefined,
      weather: weather ?? undefined,
      sessionStart,
      sessionEnd,
    })
    return visible.map((t) => ({ ...t, _lat: engineBase.lat, _lng: engineBase.lng }))
  }, [engineBase, sessionOk, nightDate, activeHorizon, moonPhase, weather, sessionStart, sessionEnd])

  const planState = useObservationPlan(nightDate)
  const { pinnedIds, hiddenIds, minutesById, customOrderIds } = planState
  const isCurated = pinnedIds.length > 0

  const skippedSessionTargets = useMemo(() => {
    if (!sessionOk) return []
    const hidden = new Set(hiddenIds)
    const resolveById = new Map(allNightRecommended.map((t) => [t.id, t]))
    const sessionIds = new Set(recommended.map((t) => t.id))
    const ids = isCurated
      ? pinnedIds.filter((id) => !hidden.has(id) && !sessionIds.has(id))
      : []
    return ids.map((id) => resolveById.get(id)).filter(Boolean)
  }, [sessionOk, isCurated, pinnedIds, hiddenIds, allNightRecommended, recommended])

  const [plan, setPlan] = useState([])

  function buildPlanFromTargets(orderedTargets, minutesMap) {
    return orderedTargets.map((t) => ({
      id: t.id,
      target: t,
      minutes: Number(minutesMap[t.id]) > 0 ? Number(minutesMap[t.id]) : 30,
    }))
  }

  useEffect(() => {
    const validIds = allNightRecommended.map((t) => t.id)
    if (validIds.length) prunePlanIds(validIds, nightDate)
  }, [allNightRecommended, nightDate])

  useEffect(() => {
    const hidden = new Set(hiddenIds)
    const resolveById = new Map(allNightRecommended.map((t) => [t.id, t]))
    const sessionById = new Map(recommended.map((t) => [t.id, t]))

    let pool
    if (isCurated) {
      pool = pinnedIds.map((id) => resolveById.get(id) ?? sessionById.get(id)).filter(Boolean)
    } else {
      pool = recommended
    }
    const visibleRec = pool.filter((t) => !hidden.has(t.id))
    const sessionFit = visibleRec.filter((t) => sessionById.has(t.id))

    let ordered
    if (customOrderIds?.length) {
      const visibleIds = new Set(sessionFit.map((t) => t.id))
      const prevIds = customOrderIds.filter((id) => visibleIds.has(id))
      const seen = new Set(prevIds)
      ordered = [
        ...prevIds.map((id) => sessionFit.find((t) => t.id === id)).filter(Boolean),
        ...sortTargetsForSessionOrder(
          sessionFit.filter((t) => !seen.has(t.id)),
          nightDate,
        ),
      ]
    } else {
      ordered = sortTargetsForSessionOrder(sessionFit, nightDate)
    }

    setPlan(buildPlanFromTargets(ordered, minutesById))
  }, [
    recommended,
    allNightRecommended,
    hiddenIds,
    pinnedIds,
    minutesById,
    customOrderIds,
    isCurated,
    sessionStart,
    nightDate,
  ])

  const schedule = useMemo(() => {
    const out = []
    let cursor = new Date(sessionStart)
    for (const item of plan) {
      const start = new Date(cursor)
      const end = new Date(cursor.getTime() + (Number(item.minutes) || 0) * 60000)
      out.push({ id: item.id, start, end })
      cursor = end
    }
    return out
  }, [plan, sessionStart])

  const warnings = useMemo(() => {
    const byId = new Map()
    for (let i = 0; i < plan.length; i += 1) {
      const item = plan[i]
      const bestInstant = bestInstantFromTarget(item.target, nightDate)
      if (!bestInstant) continue
      for (let j = 0; j < schedule.length; j += 1) {
        if (schedule[j].id === item.id) continue
        if (bestInstant >= schedule[j].start && bestInstant < schedule[j].end) {
          const other = plan.find((p) => p.id === schedule[j].id)
          const otherName = other?.target?.name ?? 'another target'
          byId.set(
            item.id,
            `Best time for this object overlaps the time block for “${otherName}” (${formatTime12h(schedule[j].start)}–${formatTime12h(schedule[j].end)}). Put targets you want at their best earlier in the list, shorten “Time needed”, or remove a target.`,
          )
          break
        }
      }
    }
    return byId
  }, [plan, schedule, nightDate])

  function onRemoveFromPlan(id) {
    removeTargetFromPlan(id, nightDate)
  }

  function onDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setPlan((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id)
      const newIndex = items.findIndex((i) => i.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return items
      const next = arrayMove(items, oldIndex, newIndex)
      setCustomPlanOrder(
        next.map((it) => it.id),
        nightDate,
      )
      return next
    })
  }

  function onSetMinutes(id, minutes) {
    setTargetMinutes(id, minutes, nightDate)
    setPlan((items) => items.map((it) => (it.id === id ? { ...it, minutes } : it)))
  }

  const timeline = useMemo(() => {
    const totalMs = Math.max(1, sessionEnd.getTime() - sessionStart.getTime())
    return schedule
      .map((row) => {
        const item = plan.find((p) => p.id === row.id)
        const meta = item ? typeMeta(item.target) : { color: '#94a3b8', key: 'other' }
        const s = clamp(((row.start.getTime() - sessionStart.getTime()) / totalMs) * 100, 0, 100)
        const e = clamp(((row.end.getTime() - sessionStart.getTime()) / totalMs) * 100, 0, 100)
        return { id: row.id, startPct: s, endPct: e, color: meta.color, label: item?.target?.name ?? 'Target' }
      })
      .filter((r) => r.endPct > r.startPct)
  }, [schedule, plan, sessionStart, sessionEnd])

  async function exportPlan() {
    const lines = []
    lines.push(`SkyWindow Plan — ${formatDateTitle(sessionStart)}`)
    for (const row of schedule) {
      const item = plan.find((p) => p.id === row.id)
      if (!item) continue
      lines.push(`${formatTime12h(row.start)}  ${item.target.name} (${item.minutes} min)`)
    }
    const text = lines.join('\n')
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // ignore
    }
  }

  if (authLoading || !ready) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '1.25rem', color: '#94a3b8' }} aria-busy="true">
        {t('planner.loading')}
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!profile?.location_lat) return <Navigate to="/onboarding" replace />

  const bortleZone = profile?.bortle_zone != null ? Number(profile.bortle_zone) : null
  const apertureMm = primaryEquipment?.aperture_mm != null ? Number(primaryEquipment.aperture_mm) : null

  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '1.25rem', minHeight: '100dvh' }}>
      <header style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Telescope aria-hidden size={28} />
        <h1 style={{ fontSize: '1.35rem', margin: 0 }}>{t('planner.title')}</h1>
      </header>

      {loadError ? (
        <div style={{ marginTop: '0.75rem' }}>
          <p role="alert" style={{ margin: '0 0 0.5rem', color: '#fca5a5', fontSize: '0.9rem' }}>
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => {
              setReady(false)
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
            Try again
          </button>
        </div>
      ) : null}

      {conditionsError ? (
        <p role="alert" style={{ marginTop: '0.5rem', color: '#fca5a5', fontSize: '0.9rem' }}>
          {conditionsError}
        </p>
      ) : null}

      <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.6rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
          <label style={{ display: 'grid', gap: 6, color: '#cbd5e1', fontSize: '0.85rem' }}>
            Session start
            <input
              type="time"
              value={startHm}
              onChange={(e) => setStartHm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.65rem',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(2,6,23,0.6)',
                color: '#e8eef7',
                font: 'inherit',
              }}
            />
          </label>
          <label style={{ display: 'grid', gap: 6, color: '#cbd5e1', fontSize: '0.85rem' }}>
            Session end
            <input
              type="time"
              value={endHm}
              onChange={(e) => setEndHm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.65rem',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(2,6,23,0.6)',
                color: '#e8eef7',
                font: 'inherit',
              }}
            />
          </label>
        </div>

        <ConditionsBar
          moonPhase={moonPhase}
          weather={weather}
          conditions={conditions}
          bortleZone={bortleZone}
          nightDate={nightDate}
        />

        {condLoading && !moonPhase ? (
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>Updating night conditions…</p>
        ) : null}
        {!sessionOk ? (
          <p style={{ color: '#fca5a5', fontSize: '0.9rem', margin: 0 }}>
            Session end must be after session start.
          </p>
        ) : null}
      </div>

      <section style={{ marginTop: '0.85rem' }}>
        <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem', color: '#e8eef7' }}>Plan</h2>
        <p style={{ margin: '0 0 0.65rem', fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.45 }}>
          {isCurated ? (
            <>
              Your custom list from <strong style={{ color: '#cbd5e1' }}>Tonight</strong>. Drag to reorder, set time
              per target, or trash to skip. Add more from Tonight with <strong style={{ color: '#cbd5e1' }}>Add to plan</strong>.
            </>
          ) : (
            <>
              Suggested targets for your session window, with <strong style={{ color: '#cbd5e1' }}>earlier best times first</strong>.
              Use <strong style={{ color: '#cbd5e1' }}>Add to plan</strong> on Tonight to build a custom list, or trash rows you want to skip.
            </>
          )}
        </p>
        {hiddenIds.length > 0 || isCurated ? (
          <div style={{ marginBottom: '0.65rem', display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
            {hiddenIds.length > 0 ? (
              <button
                type="button"
                onClick={() => restoreAllHidden(nightDate)}
                style={{
                  padding: '0.4rem 0.65rem',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.16)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#e8eef7',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Restore removed ({hiddenIds.length})
              </button>
            ) : null}
            {isCurated ? (
              <button
                type="button"
                onClick={() => clearCuratedPlan(nightDate)}
                style={{
                  padding: '0.4rem 0.65rem',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.16)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#94a3b8',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Use suggested targets
              </button>
            ) : null}
          </div>
        ) : null}

        {skippedSessionTargets.length > 0 ? (
          <p style={{ margin: '0 0 0.65rem', color: '#fcd34d', fontSize: '0.85rem', lineHeight: 1.45 }}>
            {skippedSessionTargets.map((t) => t.name).join(', ')}{' '}
            {skippedSessionTargets.length === 1 ? 'is' : 'are'} pinned but not high enough during{' '}
            {formatTime12h(sessionStart)}–{formatTime12h(sessionEnd)}.
            {skippedSessionTargets[0]?.visibility?.bestTime &&
            skippedSessionTargets[0].visibility.bestTime !== '—'
              ? ` Best around ${formatHm12h(skippedSessionTargets[0].visibility.bestTime)} — try ending your session later.`
              : ' Try ending your session later.'}
          </p>
        ) : null}

        {sessionOk && !loadError && plan.length === 0 ? (
          <p style={{ margin: 0.25, color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.55 }}>
            {isCurated
              ? 'No targets in your plan yet. Open Tonight and tap Add to plan on any object you want to observe.'
              : recommended.length === 0
                ? 'No recommended targets in this window. Try widening the session or adjusting your sky profile.'
                : hiddenIds.length > 0
                  ? 'Every target is hidden for this session. Use “Restore removed” above, or widen the session for more options.'
                  : 'Nothing to show in the plan list.'}
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={plan.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {plan.map((item, i) => {
                  const sched = schedule.find((s) => s.id === item.id)
                  const warn = warnings.get(item.id) || ''
                  return (
                    <SortablePlanRow
                      key={item.id}
                      item={item}
                      index={i}
                      nightDate={nightDate}
                      sessionStart={sessionStart}
                      sessionEnd={sessionEnd}
                      horizonData={activeHorizon}
                      bortleZone={bortleZone}
                      apertureMm={apertureMm}
                      equipmentName={primaryEquipment?.name}
                      focalLengthMm={
                        primaryEquipment?.focal_length_mm != null
                          ? Number(primaryEquipment.focal_length_mm)
                          : undefined
                      }
                      scheduledStart={sched?.start ?? null}
                      scheduledEnd={sched?.end ?? null}
                      warning={warn}
                      onSetMinutes={onSetMinutes}
                      onRemove={onRemoveFromPlan}
                    />
                  )
                })}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </section>

      <section style={{ marginTop: '1rem' }}>
        <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem', color: '#e8eef7' }}>Timeline</h2>
        <p style={{ margin: '0 0 0.55rem', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
          Strip below is your session from start to end; each color is the time you assigned to that target in the
          list above.
        </p>
        <div
          style={{
            height: 16,
            borderRadius: 999,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(30,41,59,0.7)',
            position: 'relative',
          }}
          aria-label="Session timeline"
        >
          {timeline.map((seg) => (
            <div
              key={seg.id}
              title={seg.label}
              style={{
                position: 'absolute',
                left: `${seg.startPct}%`,
                width: `${Math.max(0, seg.endPct - seg.startPct)}%`,
                top: 0,
                bottom: 0,
                background: seg.color,
                opacity: 0.85,
              }}
            />
          ))}
        </div>
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.78rem' }}>
          <span>{formatTime12h(sessionStart)}</span>
          <span>{formatTime12h(sessionEnd)}</span>
        </div>
      </section>

      <button
        type="button"
        onClick={exportPlan}
        style={{
          marginTop: '1.15rem',
          width: '100%',
          padding: '0.65rem 0.85rem',
          borderRadius: 12,
          border: 'none',
          background: 'linear-gradient(135deg, #5b7cfa, #8a4dff)',
          color: '#fff',
          fontSize: '0.95rem',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Export plan (copy)
      </button>
    </main>
  )
}

