import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { ALLOWED_EMAILS } from '@/firebase'
import { Shell } from '@/components/Shell'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Login } from '@/pages/Login'


// Lazy-load all route pages — only downloads when navigated to
const Today = lazy(() => import('@/pages/Today').then(m => ({ default: m.Today })))
const Board = lazy(() => import('@/pages/Board').then(m => ({ default: m.Board })))
const Jobs = lazy(() => import('@/pages/Jobs').then(m => ({ default: m.Jobs })))
const JobDetail = lazy(() => import('@/pages/JobDetail').then(m => ({ default: m.JobDetail })))
const Estimates = lazy(() => import('@/pages/Estimates').then(m => ({ default: m.Estimates })))
const Invoices = lazy(() => import('@/pages/Invoices').then(m => ({ default: m.Invoices })))
const Photos = lazy(() => import('@/pages/Photos').then(m => ({ default: m.Photos })))
const Settings = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })))

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
    <div className="spinner" />
  </div>
)

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

function AppContent() {
  return (
    <Shell>
      <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/board" element={<Board />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/:jobId" element={<JobDetail />} />
        <Route path="/estimates" element={<Estimates />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/photos" element={<Photos />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      </ErrorBoundary>
    </Shell>
  )
}

export default function App() {
  return (
    <BrowserRouter basename="/addlesberger_app">
      <AuthGate>
        <AppContent />
      </AuthGate>
    </BrowserRouter>
  )
}

