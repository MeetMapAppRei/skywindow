import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { deleteSignedInAccount } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.js'
import Splash from '../components/Splash.jsx'

const CONTACT_EMAIL = 'skywindowadmin@gmail.com'

const pStyle = { margin: '0 0 0.75rem', lineHeight: 1.6, color: '#b7c0d4', fontSize: '0.95rem' }
const listStyle = { margin: '0 0 1rem', paddingLeft: '1.2rem', lineHeight: 1.6, color: '#b7c0d4', fontSize: '0.95rem' }

export default function DeleteAccount() {
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (loading) return <Splash />

  async function handleDelete() {
    if (!user || busy) return
    setError('')
    setBusy(true)
    try {
      await deleteSignedInAccount()
      await signOut()
      navigate('/login', { replace: true, state: { accountDeleted: true } })
    } catch (err) {
      setError(err?.message ?? 'Could not delete your account. Try signing in again or email us.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '1.25rem 1.25rem 2.5rem', minHeight: '100dvh' }}>
      <p style={{ margin: '0 0 0.35rem', fontSize: '0.85rem', color: '#7d8aa8' }}>
        <Link to="/privacy" style={{ color: '#8aa4ff' }}>
          ← Privacy policy
        </Link>
      </p>
      <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.5rem', fontWeight: 700 }}>Delete your account</h1>
      <p style={{ ...pStyle, marginBottom: '1.25rem' }}>
        Request permanent removal of your SkyWindow account and the data stored with it.
      </p>

      <h2 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 0.45rem', color: '#e8eef7' }}>
        What is deleted
      </h2>
      <ul style={listStyle}>
        <li>Your account (email and sign-in credentials)</li>
        <li>Profile, observing location, and Bortle zone</li>
        <li>Equipment, sky profiles, and session logs</li>
      </ul>
      <p style={pStyle}>This cannot be undone.</p>

      {user ? (
        <section style={{ marginTop: '1.5rem' }}>
          <p style={pStyle}>
            Signed in as <strong style={{ color: '#e8eef7' }}>{user.email}</strong>
          </p>
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
              marginBottom: '1rem',
              color: '#b7c0d4',
              fontSize: '0.95rem',
              lineHeight: 1.5,
            }}
          >
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
              style={{ marginTop: 3, width: 18, height: 18 }}
            />
            <span>I understand this permanently deletes my account and all associated data.</span>
          </label>
          {error ? (
            <p role="alert" style={{ margin: '0 0 0.75rem', color: '#ff9b9b', fontSize: '0.9rem' }}>
              {error}
            </p>
          ) : null}
          <button
            type="button"
            disabled={!confirm || busy}
            onClick={handleDelete}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 10,
              border: 'none',
              background: confirm ? '#b91c1c' : 'rgba(185,28,28,0.45)',
              color: '#fff',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: !confirm || busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.8 : 1,
            }}
          >
            {busy ? 'Deleting…' : 'Delete my account'}
          </button>
        </section>
      ) : (
        <section style={{ marginTop: '1.5rem' }}>
          <p style={pStyle}>
            <Link to="/login" state={{ from: '/delete-account' }} style={{ color: '#8aa4ff' }}>
              Sign in
            </Link>{' '}
            to delete your account in the app, or email{' '}
            <a href={`mailto:${CONTACT_EMAIL}?subject=SkyWindow%20account%20deletion`} style={{ color: '#8aa4ff' }}>
              {CONTACT_EMAIL}
            </a>{' '}
            from the address on your account with the subject &quot;Account deletion&quot;.
          </p>
        </section>
      )}
    </main>
  )
}
