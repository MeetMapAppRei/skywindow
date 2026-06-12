import { supabase } from './supabase.js'
import { TARGETS } from '../data/targets.js'

const targetById = new Map(TARGETS.map((t) => [t.id, t]))

function humanizeType(type) {
  if (!type || type === 'unknown') return '—'
  return String(type)
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Normalize DB jsonb `targets_observed` to `{ id, notes }[]`.
 * @param {unknown} raw
 * @returns {{ id: string; notes: string }[]}
 */
export function normalizeTargetsObserved(raw) {
  if (!raw) return []
  const arr = Array.isArray(raw) ? raw : []
  const out = []
  for (const row of arr) {
    if (!row || typeof row !== 'object') continue
    const id = row.id ?? row.target_id ?? row.targetId
    if (typeof id !== 'string' || !id.trim()) continue
    const notes =
      typeof row.notes === 'string'
        ? row.notes
        : row.notes != null
          ? String(row.notes)
          : ''
    out.push({ id: id.trim(), notes })
  }
  return out
}

/**
 * Fetch sessions for a user with equipment name and sky profile label.
 * @param {string} userId
 */
export async function getUserSessions(userId) {
  return supabase
    .from('sessions')
    .select(
      `
      id,
      user_id,
      date,
      equipment_id,
      sky_profile_id,
      location_lat,
      location_lng,
      notes,
      targets_observed,
      created_at,
      equipment ( name ),
      sky_profiles ( label )
    `,
    )
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
}

/**
 * Insert a session row.
 * @param {object} data
 * @param {string} data.user_id
 * @param {string} data.date — ISO date `YYYY-MM-DD`
 * @param {string | null} [data.equipment_id]
 * @param {string | null} [data.sky_profile_id]
 * @param {number} data.location_lat
 * @param {number} data.location_lng
 * @param {string | null} [data.notes]
 * @param {{ id: string; notes?: string }[]} [data.targets_observed]
 */
export async function saveSession(data) {
  const {
    user_id,
    date,
    equipment_id,
    sky_profile_id,
    location_lat,
    location_lng,
    notes,
    targets_observed,
  } = data

  const row = {
    user_id,
    date,
    equipment_id: equipment_id || null,
    sky_profile_id: sky_profile_id || null,
    location_lat: Number(location_lat),
    location_lng: Number(location_lng),
    notes: notes?.trim() ? notes.trim() : null,
    targets_observed: Array.isArray(targets_observed) ? targets_observed : [],
  }

  return supabase.from('sessions').insert(row).select().single()
}

/**
 * @param {string} id — session row id
 */
export async function deleteSession(id) {
  return supabase.from('sessions').delete().eq('id', id)
}

/**
 * Stats for life list / session history header.
 * @param {object[] | null | undefined} sessions — rows from `getUserSessions` (data array)
 * @returns {{ uniqueObjects: number; sessionCount: number; topTypeLabel: string }}
 */
export function computeLifeListStats(sessions) {
  const list = sessions ?? []
  const uniqueIds = new Set()
  const typeCounts = new Map()

  for (const s of list) {
    const obs = normalizeTargetsObserved(s.targets_observed)
    for (const { id } of obs) {
      uniqueIds.add(id)
      const t = targetById.get(id)
      const typ = t?.type ?? 'unknown'
      typeCounts.set(typ, (typeCounts.get(typ) ?? 0) + 1)
    }
  }

  let topType = null
  const types = [...typeCounts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return a[0].localeCompare(b[0])
  })
  if (types.length && types[0][1] > 0) {
    topType = types[0][0]
  }

  return {
    uniqueObjects: uniqueIds.size,
    sessionCount: list.length,
    topTypeLabel: topType ? humanizeType(topType) : '—',
  }
}
