import { Link } from 'react-router-dom'

const CONTACT_EMAIL = 'skywindowadmin@gmail.com'
const EFFECTIVE_DATE = 'June 9, 2026'

const sectionStyle = { marginBottom: '1.35rem' }
const h2Style = { fontSize: '1.05rem', fontWeight: 600, margin: '0 0 0.45rem', color: '#e8eef7' }
const pStyle = { margin: '0 0 0.65rem', lineHeight: 1.6, color: '#b7c0d4', fontSize: '0.95rem' }
const listStyle = { margin: '0 0 0.65rem', paddingLeft: '1.2rem', lineHeight: 1.6, color: '#b7c0d4', fontSize: '0.95rem' }

export default function Privacy() {
  return (
    <main
      style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: '1.25rem 1.25rem 2.5rem',
        minHeight: '100dvh',
      }}
    >
      <p style={{ margin: '0 0 0.35rem', fontSize: '0.85rem', color: '#7d8aa8' }}>
        <Link to="/login" style={{ color: '#8aa4ff' }}>
          ← Back
        </Link>
      </p>
      <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.5rem', fontWeight: 700 }}>Privacy Policy</h1>
      <p style={{ margin: '0 0 1.5rem', fontSize: '0.9rem', color: '#7d8aa8' }}>
        SkyWindow · Effective {EFFECTIVE_DATE}
      </p>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Overview</h2>
        <p style={pStyle}>
          SkyWindow helps amateur astronomers plan observing sessions from their location. This policy
          describes what information we collect, how we use it, and the third-party services involved.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Information we collect</h2>
        <ul style={listStyle}>
          <li>
            <strong>Account:</strong> email address and password (password is stored securely by our
            authentication provider; we do not store plain-text passwords).
          </li>
          <li>
            <strong>Profile &amp; observing data you enter:</strong> display name, observing-site
            coordinates, light-pollution (Bortle) zone, equipment details, sky/horizon profiles,
            session notes, and targets you log.
          </li>
          <li>
            <strong>Photos:</strong> horizon photos you capture in the app for skyline analysis.
          </li>
          <li>
            <strong>Device permissions:</strong> camera (horizon capture), location (site and local
            weather), and device orientation (compass alignment for multi-direction captures).
          </li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>How we use information</h2>
        <p style={pStyle}>
          We use your data to operate the app: authenticate you, save your profiles and sessions,
          compute tonight&apos;s targets for your site and equipment, fetch local weather, and analyze
          horizon photos to build obstruction maps. We do not sell your personal information.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Third-party services</h2>
        <ul style={listStyle}>
          <li>
            <strong>Supabase</strong> — account sign-in and database hosting (profiles, equipment,
            sky profiles, sessions).
          </li>
          <li>
            <strong>Anthropic</strong> — horizon photos are sent to Claude Vision for automated
            skyline tracing; only the image and analysis request are transmitted.
          </li>
          <li>
            <strong>Open-Meteo</strong> — weather forecasts using your observing coordinates (no
            account required).
          </li>
          <li>
            <strong>NASA SkyView</strong> — public sky preview images for astronomical targets
            (coordinates only, no personal data).
          </li>
          <li>
            <strong>Vercel</strong> — hosts the web app and API routes that connect the above
            services.
          </li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Data retention &amp; deletion</h2>
        <p style={pStyle}>
          Your account data is kept while your account is active. You may delete equipment, sky
          profiles, and sessions inside the app, or use{' '}
          <Link to="/delete-data" style={{ color: '#8aa4ff' }}>
            the data deletion page
          </Link>
          . To delete your entire account and associated data, use{' '}
          <Link to="/delete-account" style={{ color: '#8aa4ff' }}>
            the account deletion page
          </Link>{' '}
          or email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#8aa4ff' }}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Children</h2>
        <p style={pStyle}>
          SkyWindow is not directed at children under 13. We do not knowingly collect personal
          information from children.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Changes</h2>
        <p style={pStyle}>
          We may update this policy from time to time. The effective date at the top will change
          when we do.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Contact</h2>
        <p style={pStyle}>
          Questions about this policy:{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#8aa4ff' }}>
            {CONTACT_EMAIL}
          </a>
        </p>
      </section>
    </main>
  )
}
