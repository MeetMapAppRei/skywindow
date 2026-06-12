import { useEffect, useMemo, useState } from 'react'

const LS_KEY = 'skywindow:observationPlan'
const PLAN_EVENT = 'skywindow:plan-updated'

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** Local calendar date key for tonight's plan (resets at midnight). */
export function planNightKey(nightDate) {
  const d = nightDate instanceof Date ? nightDate : new Date(nightDate)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function readRaw() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function defaultState(night) {
  return { night, pinnedIds: [], hiddenIds: [], minutesById: {}, customOrderIds: null }
}

export function loadPlanState(nightDate) {
  const night = planNightKey(nightDate)
  const raw = readRaw()
  if (!raw || raw.night !== night) return defaultState(night)
  return {
    night: raw.night,
    pinnedIds: Array.isArray(raw.pinnedIds) ? [...raw.pinnedIds] : [],
    hiddenIds: Array.isArray(raw.hiddenIds) ? [...raw.hiddenIds] : [],
    minutesById:
      raw.minutesById && typeof raw.minutesById === 'object' ? { ...raw.minutesById } : {},
    customOrderIds: Array.isArray(raw.customOrderIds) ? [...raw.customOrderIds] : null,
  }
}

function savePlanState(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state))
    window.dispatchEvent(new Event(PLAN_EVENT))
  } catch {
    /* ignore */
  }
}

export function hasCuratedPlan(nightDate) {
  return loadPlanState(nightDate).pinnedIds.length > 0
}

/** True when target is in the active plan (curated pins, or auto-suggest minus hidden). */
export function isTargetInPlan(targetId, nightDate) {
  const s = loadPlanState(nightDate)
  if (s.hiddenIds.includes(targetId)) return false
  if (s.pinnedIds.length > 0) return s.pinnedIds.includes(targetId)
  return false
}

export function addTargetToPlan(targetId, nightDate) {
  const s = loadPlanState(nightDate)
  if (!s.pinnedIds.includes(targetId)) s.pinnedIds = [...s.pinnedIds, targetId]
  s.hiddenIds = s.hiddenIds.filter((id) => id !== targetId)
  savePlanState(s)
  return s
}

export function removeTargetFromPlan(targetId, nightDate) {
  const s = loadPlanState(nightDate)
  if (!s.hiddenIds.includes(targetId)) s.hiddenIds = [...s.hiddenIds, targetId]
  s.pinnedIds = s.pinnedIds.filter((id) => id !== targetId)
  if (s.customOrderIds) s.customOrderIds = s.customOrderIds.filter((id) => id !== targetId)
  savePlanState(s)
  return s
}

export function restoreAllHidden(nightDate) {
  const s = loadPlanState(nightDate)
  s.hiddenIds = []
  savePlanState(s)
  return s
}

/** Drop curated pins and return to auto-suggested plan for tonight. */
export function clearCuratedPlan(nightDate) {
  const s = loadPlanState(nightDate)
  s.pinnedIds = []
  s.customOrderIds = null
  savePlanState(s)
  return s
}

export function setTargetMinutes(targetId, minutes, nightDate) {
  const s = loadPlanState(nightDate)
  s.minutesById = { ...s.minutesById, [targetId]: minutes }
  savePlanState(s)
  return s
}

export function setCustomPlanOrder(ids, nightDate) {
  const s = loadPlanState(nightDate)
  s.customOrderIds = Array.isArray(ids) ? [...ids] : null
  savePlanState(s)
  return s
}

export function prunePlanIds(validIds, nightDate) {
  const valid = new Set(validIds)
  const s = loadPlanState(nightDate)
  const pinnedIds = s.pinnedIds.filter((id) => valid.has(id))
  const hiddenIds = s.hiddenIds.filter((id) => valid.has(id))
  const minutesById = Object.fromEntries(
    Object.entries(s.minutesById).filter(([id]) => valid.has(id)),
  )
  const customOrderIds = s.customOrderIds
    ? s.customOrderIds.filter((id) => valid.has(id))
    : null
  const changed =
    pinnedIds.length !== s.pinnedIds.length ||
    hiddenIds.length !== s.hiddenIds.length ||
    (s.customOrderIds?.length ?? 0) !== (customOrderIds?.length ?? 0)
  if (!changed) return s
  const next = { ...s, pinnedIds, hiddenIds, minutesById, customOrderIds }
  savePlanState(next)
  return next
}

/** Re-read plan state when another tab or page updates localStorage. */
export function useObservationPlan(nightDate) {
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const bump = () => setRevision((r) => r + 1)
    window.addEventListener(PLAN_EVENT, bump)
    return () => window.removeEventListener(PLAN_EVENT, bump)
  }, [])
  return useMemo(() => loadPlanState(nightDate), [nightDate, revision])
}
