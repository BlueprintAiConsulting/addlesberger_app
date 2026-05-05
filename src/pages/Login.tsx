import { useState, FormEvent } from 'react'
import { useAuth } from '@/hooks/useAuth'

export function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch (err: any) {
      setError(err.message?.replace('Firebase: ', '') || 'Something went wrong')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: '#222222',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        padding: 32,
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Logo area */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: '#C7330A',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            fontSize: 26,
            fontWeight: 800,
            color: 'white',
          }}>RL</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 2px', color: 'var(--text)' }}>
            R. L. Addlesberger
          </h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 0', fontWeight: 500 }}>
            Roofing — Job Board
          </p>
        </div>

        <form onSubmit={handleSubmit} className="stack stack-md">
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: '#FEF2F2',
              color: 'var(--danger)',
              fontSize: 13,
              fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          <button
            className="btn btn-primary btn-full"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Please wait...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
