import { supabase } from './supabase.js'

export const LS_ACTIVE_SKY_PROFILE = 'skywindow:activeSkyProfileId'

/** @param {string} id */
export function rememberActiveSkyProfile(id) {
  try {
    if (id) localStorage.setItem(LS_ACTIVE_SKY_PROFILE, id)
  } catch {
    /* ignore */
  }
}

/**
 * @param {{ userId: string; label: string; horizonData: { points: object[] } }} params
 */
/** @param {string} id */
export async function deleteSkyProfile(id) {
  return supabase.from('sky_profiles').delete().eq('id', id)
}

export async function insertSkyProfile({ userId, label, horizonData }) {
  const { data, error } = await supabase
    .from('sky_profiles')
    .insert({
      user_id: userId,
      label: label.trim() || 'Home site',
      horizon_data: horizonData,
    })
    .select('id, label, horizon_data, created_at')
    .single()
  return { data, error }
}
