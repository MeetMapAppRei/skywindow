import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('SkyWindow render error:', error, info?.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      const msg =
        this.state.error && typeof this.state.error.message === 'string'
          ? this.state.error.message
          : ''
      return (
        <div
          style={{
            minHeight: '100dvh',
            display: 'grid',
            placeItems: 'center',
            padding: '1.5rem',
            background: 'linear-gradient(165deg, #0a0e1a 0%, #121a2e 100%)',
            color: '#e8eef7',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: 400 }}>
            <h1 style={{ fontSize: '1.35rem', margin: '0 0 0.75rem', fontWeight: 700 }}>
              Something went wrong
            </h1>
            <p style={{ margin: '0 0 1.25rem', color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.55 }}>
              SkyWindow hit an unexpected error. You can try continuing below; a full reload clears
              deeper issues. If problems persist, clear site data for this origin or sign in again.
            </p>
            {msg ? (
              <pre
                style={{
                  margin: '0 0 1.25rem',
                  padding: '0.65rem 0.75rem',
                  borderRadius: 10,
                  border: '1px solid rgba(248,113,113,0.35)',
                  background: 'rgba(0,0,0,0.35)',
                  color: '#fca5a5',
                  fontSize: '0.78rem',
                  lineHeight: 1.45,
                  textAlign: 'left',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '30vh',
                  overflow: 'auto',
                }}
              >
                {msg}
              </pre>
            ) : null}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  padding: '0.75rem 1.25rem',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.22)',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#e8eef7',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  padding: '0.75rem 1.25rem',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #5b7cfa, #8a4dff)',
                  color: '#fff',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Reload app
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
