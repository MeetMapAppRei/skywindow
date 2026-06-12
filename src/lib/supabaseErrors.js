/**
 * PostgREST returns "Could not find the table … in the schema cache" when the
 * table does not exist on the linked Postgres (migrations not applied).
 * @param {string | undefined | null} message
 * @returns {string | undefined}
 */
export function formatSupabaseClientMessage(message) {
  if (message == null) return ''
  if (typeof message !== 'string') return String(message)
  if (message.includes('violates row-level security') && message.includes('sky_profiles')) {
    return (
      'Could not save this sky profile because the database rejected the write (row security). ' +
      'Apply migration supabase/migrations/005_sky_profiles_rls_repair.sql to your Supabase project (SQL Editor or supabase db push), then try again.'
    )
  }
  if (!message.includes('schema cache')) return message
  const m = message.match(/table '([^']+)'/i)
  const name = m ? m[1] : 'a required table'
  return `Missing database table (${name}). In the Supabase project used by this deployment, open SQL Editor and run the migration SQL under supabase/migrations (001 through 005 as needed), then reload the app.`
}
