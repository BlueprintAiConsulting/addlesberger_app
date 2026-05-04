import { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, Briefcase, FileText, Camera, Settings, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Today' },
  { to: '/board', icon: ClipboardList, label: 'Board' },
  { to: '/jobs', icon: Briefcase, label: 'Jobs' },
  { to: '/estimates', icon: FileText, label: 'Estimates' },
  { to: '/photos', icon: Camera, label: 'Photos' },
]

export function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const location = useLocation()

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <h1>Charlene's Job Board</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, opacity: 0.8 }}>
            {user?.displayName || user?.email?.split('@')[0]}
          </span>
          <NavLink to="/settings" style={{ color: 'white', padding: 8, display: 'flex' }}>
            <Settings size={20} />
          </NavLink>
        </div>
      </header>

      {/* Desktop layout with sidebar */}
      <div className="app-layout">
        <nav className="sidebar">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `sidebar-item ${isActive ? 'active' : ''}`
              }
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
          <NavLink to="/settings" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <Settings size={20} />
            Settings
          </NavLink>
          <div style={{ flex: 1 }} />
          <button onClick={logout} className="sidebar-item" style={{ border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit' }}>
            <LogOut size={20} />
            Sign Out
          </button>
        </nav>

        <main className="app-content">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `bottom-nav-item ${isActive ? 'active' : ''}`
            }
          >
            <item.icon />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
