import { createClient } from '@supabase/supabase-js'
import { apiUrl } from './apiOrigin.js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn(
    '[SkyWindow] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Supabase calls will fail until .env.local is configured.',
  )
}

/**
 * Single Supabase client for the app. All DB/auth calls should import from here.
 */
export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

/**
 * Email/password sign-up. A blank public.profiles row is created by the
 * on_auth_user_created trigger in the database (see migration 006).
 */
export async function signUpWithProfile(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

/** Permanently delete the signed-in user and cascaded app data (profiles, equipment, etc.). */
export async function deleteSignedInAccount() {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (!session?.access_token) {
    throw new Error('You must be signed in to delete your account.')
  }

  const res = await fetch(apiUrl('/api/delete-account'), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  let body = null
  try {
    body = await res.json()
  } catch {
    /* ignore non-JSON error bodies */
  }

  if (!res.ok) {
    throw new Error(body?.error || `Account deletion failed (HTTP ${res.status}).`)
  }
}
