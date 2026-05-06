import { useState, useEffect, FormEvent } from 'react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/firebase'
import { useAuth } from '@/hooks/useAuth'

// Username → email shortcuts so Charlene doesn't need to type her email
const USERNAME_MAP: Record<string, string> = {
  charleen: 'rladdlesbergerroofing@gmail.com',
  drew: 'drewhufnagle@gmail.com',
}

function resolveEmail(input: string): string {
  const lower = input.trim().toLowerCase()
  return USERNAME_MAP[lower] || lower
}

export function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)

  // Apply dark theme on login page too
  useEffect(() => {
    const stored = localStorage.getItem('rl-theme') || 'dark'
    document.documentElement.setAttribute('data-theme', stored)
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(''); setSuccess('')
    setLoading(true)
    try {
      await login(resolveEmail(email), password)
    } catch (err: any) {
      setError(err.message?.replace('Firebase: ', '') || 'Something went wrong')
    }
    setLoading(false)
  }

  const handleReset = async () => {
    const resolved = resolveEmail(email)
    if (!resolved || !resolved.includes('@')) {
      setError('Enter your username or email first')
      return
    }
    setResetting(true); setError(''); setSuccess('')
    try {
      await sendPasswordResetEmail(auth, resolved)
      setSuccess(`Password reset sent to ${resolved}`)
    } catch (err: any) {
      setError(err.message?.replace('Firebase: ', '') || 'Could not send reset email')
    }
    setResetting(false)
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
        maxWidth: 380,
        background: 'var(--surface)',
        borderRadius: 16,
        padding: 32,
        boxShadow: '0 8px 40px rgba(0,0,0,.2)',
        border: '1px solid var(--border-light)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg, #C7330A, #D94420)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16, fontSize: 22, fontWeight: 800, color: '#fff',
            boxShadow: '0 4px 16px rgba(199,51,10,.25)',
          }}>RL</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 2px', color: 'var(--text)' }}>
            R. L. Addlesberger
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, fontWeight: 500 }}>
            Whiteboard Sync
          </p>
        </div>

        <form onSubmit={handleSubmit} className="stack stack-md">
          <div>
            <label className="label">Username or Email</label>
            <input className="input" type="text" placeholder="charleen"
              value={email} onChange={(e) => setEmail(e.target.value)}
              required autoComplete="username" autoCapitalize="none" />
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
              background: 'var(--danger-bg)', color: 'var(--danger)',
              fontSize: 13, fontWeight: 500,
            }}>{error}</div>
          )}
          {success && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'var(--success-bg)', color: 'var(--success)',
              fontSize: 13, fontWeight: 500,
            }}>{success}</div>
          )}
          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, color: 'var(--muted)',
              padding: '8px 0', fontFamily: 'inherit', textAlign: 'center',
            }}
          >
            {resetting ? 'Sending...' : 'Forgot Password?'}
          </button>
        </form>
      </div>
    </div>
  )
}
