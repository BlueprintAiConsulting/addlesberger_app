import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
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
  const { user, loading } = useAuth()

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

  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
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
