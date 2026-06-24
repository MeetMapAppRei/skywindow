import { createClient } from '@supabase/supabase-js'

function resolveSupabaseUrl() {
  return (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim().replace(/\/$/, '')
}

function resolveServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || ''
}

/**
 * Delete the authenticated Supabase user. Requires a server-only service-role key.
 * @param {{ authorization?: string }} params
 * @returns {Promise<{ status: number; json: object }>}
 */
export async function runDeleteAccount({ authorization }) {
  const supabaseUrl = resolveSupabaseUrl()
  const serviceRoleKey = resolveServiceRoleKey()
  const token = authorization?.replace(/^Bearer\s+/i, '')?.trim()

  if (!token) {
    return { status: 401, json: { error: 'Missing or invalid authorization.' } }
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      status: 500,
      json: {
        error:
          'Server missing Supabase account deletion config. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      },
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error: userError } = await supabase.auth.getUser(token)
  if (userError || !data?.user?.id) {
    return { status: 401, json: { error: 'Invalid or expired session.' } }
  }

  const { error: deleteError } = await supabase.auth.admin.deleteUser(data.user.id)
  if (deleteError) {
    return { status: 500, json: { error: deleteError.message || 'Could not delete account.' } }
  }

  return { status: 200, json: { ok: true } }
}
