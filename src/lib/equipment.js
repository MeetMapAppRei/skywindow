import { supabase } from './supabase.js'

/** Fetch all equipment rows for a user (by `user_id`), ordered by name. */
export async function getUserEquipment(userId) {
  return supabase
    .from('equipment')
    .select(
      'id, user_id, name, aperture_mm, focal_length_mm, type, is_seestar, fov_degrees',
    )
    .eq('user_id', userId)
    .order('name', { ascending: true })
}

/**
 * Insert or update one equipment row for the signed-in user.
 * `user_id` always comes from the active Supabase session so RLS `auth.uid() = user_id` matches the JWT.
 * @param {object} data
 * @param {string} [data.id] — when set, updates this row
 * @param {string} data.name
 * @param {'visual'|'camera'|'smart'} data.type
 * @param {number} data.aperture_mm
 * @param {number} data.focal_length_mm
 * @param {number} data.fov_degrees
 * @param {boolean} data.is_seestar
 */
export async function saveEquipment(data) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()
  if (sessionError) return { data: null, error: sessionError }
  if (!session?.user?.id) {
    return {
      data: null,
      error: new Error('You must be signed in to save equipment.'),
    }
  }

  const user_id = session.user.id
  const {
    id,
    name,
    type,
    aperture_mm,
    focal_length_mm,
    fov_degrees,
    is_seestar,
  } = data

  const row = {
    user_id,
    name: name.trim(),
    type,
    aperture_mm: Number(aperture_mm),
    focal_length_mm: Number(focal_length_mm),
    fov_degrees: Number(fov_degrees),
    is_seestar: Boolean(is_seestar),
  }

  if (id) {
    return supabase
      .from('equipment')
      .update(row)
      .eq('id', id)
      .eq('user_id', user_id)
      .select()
      .single()
  }

  return supabase.from('equipment').insert(row).select().single()
}

/**
 * @param {string} id — equipment row id
 */
export async function deleteEquipment(id) {
  return supabase.from('equipment').delete().eq('id', id)
}
