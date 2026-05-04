import { useState, FormEvent } from 'react'
import { useAuth } from '@/hooks/useAuth'

export function Login() {
  const { login, register } = useAuth()
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isRegister) {
        await register(email, password, displayName)
      } else {
        await login(email, password)
      }
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
      background: 'var(--bg)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        padding: 32,
        boxShadow: 'var(--shadow-md)',
        border: '1px solid var(--border)',
      }}>
        {/* Logo area */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'var(--brand)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 28 }}>🏠</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', color: 'var(--text)' }}>
            Charlene's Job Board
          </h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>
            {isRegister ? 'Create your account' : 'Sign in to get started'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="stack stack-md">
          {isRegister && (
            <div>
              <label className="label">Your Name</label>
              <input
                className="input"
                type="text"
                placeholder="e.g. Charlene"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
          )}

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
              autoComplete={isRegister ? 'new-password' : 'current-password'}
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
            {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setIsRegister(!isRegister); setError('') }}
            type="button"
          >
            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    </div>
  )
}
