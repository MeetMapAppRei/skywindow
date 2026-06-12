import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import Splash from '../components/Splash.jsx'

const CONTACT_EMAIL = 'skywindowadmin@gmail.com'

const pStyle = { margin: '0 0 0.75rem', lineHeight: 1.6, color: '#b7c0d4', fontSize: '0.95rem' }
const listStyle = { margin: '0 0 1rem', paddingLeft: '1.2rem', lineHeight: 1.65, color: '#b7c0d4', fontSize: '0.95rem' }

const inAppRows = [
  { label: 'Equipment', path: '/equipment', hint: 'Trash icon on each row' },
  { label: 'Sky profiles', path: '/sky-profiles', hint: 'Trash icon on each saved profile' },
  { label: 'Session logs', path: '/sessions', hint: 'Trash icon inside each expanded session' },
  { label: 'Profile & location', path: '/profile', hint: 'Edit or clear fields, then Save' },
]

export default function DeleteData() {
  const { user, loading } = useAuth()

  if (loading) return <Splash />

  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '1.25rem 1.25rem 2.5rem', minHeight: '100dvh' }}>
      <p style={{ margin: '0 0 0.35rem', fontSize: '0.85rem', color: '#7d8aa8' }}>
        <Link to="/privacy" style={{ color: '#8aa4ff' }}>
          ← Privacy policy
        </Link>
      </p>
      <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.5rem', fontWeight: 700 }}>Delete your data</h1>
      <p style={{ ...pStyle, marginBottom: '1.25rem' }}>
        Remove some or all of your SkyWindow data without deleting your account.
      </p>

      <h2 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 0.45rem', color: '#e8eef7' }}>
        Delete in the app
      </h2>
      {user ? (
        <ul style={listStyle}>
          {inAppRows.map((row) => (
            <li key={row.path}>
              <Link to={row.path} style={{ color: '#8aa4ff' }}>
                {row.label}
              </Link>
              {' — '}
              {row.hint}
            </li>
          ))}
        </ul>
      ) : (
        <p style={pStyle}>
          <Link to="/login" state={{ from: '/delete-data' }} style={{ color: '#8aa4ff' }}>
            Sign in
          </Link>{' '}
          to delete data from these screens: Equipment, Sky profiles, Sessions, and Profile.
        </p>
      )}

      <h2 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 0.45rem', color: '#e8eef7' }}>
        Request by email
      </h2>
      <p style={pStyle}>
        Email{' '}
        <a href={`mailto:${CONTACT_EMAIL}?subject=SkyWindow%20data%20deletion`} style={{ color: '#8aa4ff' }}>
          {CONTACT_EMAIL}
        </a>{' '}
        from the address on your account. Say which data to remove (for example, all session logs or a
        specific sky profile). We respond within a few business days.
      </p>

      <h2 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 0.45rem', color: '#e8eef7' }}>
        Delete your whole account
      </h2>
      <p style={pStyle}>
        To remove your account and all data at once, use the{' '}
        <Link to="/delete-account" style={{ color: '#8aa4ff' }}>
          account deletion page
        </Link>
        .
      </p>
    </main>
  )
}
