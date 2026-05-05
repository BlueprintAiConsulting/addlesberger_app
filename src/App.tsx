import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ALLOWED_EMAILS } from '@/firebase'
import { Shell } from '@/components/Shell'
import { Login } from '@/pages/Login'
import { Today } from '@/pages/Today'
import { Board } from '@/pages/Board'
import { Jobs } from '@/pages/Jobs'
import { JobDetail } from '@/pages/JobDetail'
import { Estimates } from '@/pages/Estimates'
import { Photos } from '@/pages/Photos'
import { Settings } from '@/pages/Settings'

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  // Check if user's email is in the allowed list
  const email = user.email?.toLowerCase() || ''
  if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(email)) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 24,
        background: 'var(--bg)', textAlign: 'center',
      }}>
        <div style={{
          width: '100%', maxWidth: 400, background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)', padding: 32,
          boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: 'var(--danger)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 28 }}>🚫</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>Access Denied</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 24px' }}>
            {user.email} is not authorized to use this app.
          </p>
          <button className="btn btn-outline btn-full" onClick={logout}>
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter basename="/addlesberger_app">
      <AuthGate>
        <Shell>
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/board" element={<Board />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:jobId" element={<JobDetail />} />
            <Route path="/estimates" element={<Estimates />} />
            <Route path="/photos" element={<Photos />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Shell>
      </AuthGate>
    </BrowserRouter>
  )
}
