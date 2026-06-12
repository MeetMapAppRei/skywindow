import { Telescope } from 'lucide-react'

function Home() {
  return (
    <main
      style={{
        maxWidth: 520,
        margin: '0 auto',
        padding: '1.25rem',
        minHeight: '100dvh',
      }}
    >
      <header style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <Telescope aria-hidden size={28} />
        <h1 style={{ fontSize: '1.35rem', margin: 0 }}>SkyWindow</h1>
      </header>
      <p style={{ marginTop: '1rem', color: '#b7c0d4' }}>
        Amateur astronomy planning starts here. Configure Supabase and API keys in{' '}
        <code style={{ color: '#dbe6ff' }}>.env.local</code>, then build features in{' '}
        <code style={{ color: '#dbe6ff' }}>src/</code>.
      </p>
    </main>
  )
}

export default Home
