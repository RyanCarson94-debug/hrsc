import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

const items = [
  { to: '/focusflow/', label: 'Start', icon: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/> },
  { to: '/focusflow/tasks', label: 'Tasks', icon: <><path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></> },
  { to: '/focusflow/capacity', label: 'Plan', icon: <><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/></> },
  { to: '/focusflow/insights', label: 'Insights', icon: <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> },
]

export function Nav() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/focusflow/login')
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border z-40 md:static md:border-t-0 md:border-r md:h-screen md:w-56 md:flex-col md:flex">
      <div className="flex md:flex-col md:flex-1 md:pt-6">
        {/* Logo — desktop */}
        <div className="hidden md:flex items-center gap-2.5 px-5 mb-8">
          <div className="w-7 h-7 bg-primary-light rounded-lg flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#FC1921"/>
            </svg>
          </div>
          <span className="font-semibold text-text text-base">FocusFlow</span>
        </div>

        <div className="flex md:flex-col w-full md:gap-0.5 md:px-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/focusflow/'}
              className={({ isActive }) =>
                `flex flex-col md:flex-row items-center md:gap-2.5 justify-center md:justify-start
                 flex-1 md:flex-none py-3 md:py-2.5 px-2 md:px-3 rounded-md
                 text-xs md:text-sm font-medium transition-colors duration-150
                 ${isActive ? 'text-primary md:bg-primary-light' : 'text-text-muted hover:text-text md:hover:bg-gray-50'}`
              }
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">{item.icon}</svg>
              <span className="mt-0.5 md:mt-0">{item.label}</span>
            </NavLink>
          ))}
        </div>

        {/* Desktop bottom */}
        <div className="hidden md:flex flex-col gap-0.5 px-3 mt-auto pb-6">
          <NavLink
            to="/focusflow/settings"
            className={({ isActive }) =>
              `flex items-center gap-2.5 py-2.5 px-3 rounded-md text-sm font-medium transition-colors
               ${isActive ? 'text-primary bg-primary-light' : 'text-text-muted hover:text-text hover:bg-gray-50'}`
            }
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Settings
          </NavLink>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 py-2.5 px-3 rounded-md text-sm font-medium text-text-muted hover:text-text hover:bg-gray-50 transition-colors w-full text-left"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </nav>
  )
}
