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
      background: '#202124',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 380,
        background: '#fff',
        borderRadius: 16,
        padding: 32,
        boxShadow: '0 8px 40px rgba(0,0,0,.2)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg, #D35400, #E67E22)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16, fontSize: 22, fontWeight: 800, color: '#fff',
            boxShadow: '0 4px 16px rgba(211,84,0,.25)',
          }}>RL</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 2px', color: '#202124' }}>
            R. L. Addlesberger
          </h1>
          <p style={{ fontSize: 13, color: '#9AA0A6', margin: 0, fontWeight: 500 }}>
            Whiteboard Sync
          </p>
        </div>

        <form onSubmit={handleSubmit} className="stack stack-md">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" placeholder="you@company.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              required autoComplete="email" />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)}
              required minLength={6} autoComplete="current-password" />
          </div>
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: '#FCE8E6', color: '#D93025',
              fontSize: 13, fontWeight: 500,
            }}>{error}</div>
          )}
          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
