import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', padding: 32, textAlign: 'center', gap: 16,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #FEE2E2, #FECACA)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24,
          }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0, maxWidth: 400, lineHeight: 1.6 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
            style={{
              padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--brand)', color: '#fff', fontWeight: 600, fontSize: 14,
            }}
          >
            Reload App
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
