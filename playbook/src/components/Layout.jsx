import { Link, NavLink, useLocation } from 'react-router-dom'

export function Layout({ children, user }) {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')

  return (
    <div className="min-h-screen flex flex-col">
      <header style={{ background: 'linear-gradient(135deg, #5B21B6 0%, #7C3AED 45%, #6D28D9 100%)', boxShadow: '0 4px 16px rgba(91,33,182,.35)' }}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 font-bold text-white text-base tracking-tight">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm border border-white/30" style={{ background: 'rgba(255,255,255,0.18)' }}>▶</span>
            <span>HRSC <span className="text-violet-200">Playbook</span></span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `text-sm px-3 py-1.5 rounded-full font-semibold transition-all ${
                  isActive && !isAdmin
                    ? 'bg-white/20 text-white shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`
              }
            >
              Adviser
            </NavLink>
            {user?.isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `text-sm px-3 py-1.5 rounded-full font-semibold transition-all ${
                    isActive || isAdmin
                      ? 'bg-white/20 text-white shadow-sm'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                Admin
              </NavLink>
            )}
            {user && (
              <span className="ml-3 text-xs text-white/50 border-l pl-3 border-white/20">
                {user.name}
              </span>
            )}
          </nav>
        </div>
      </header>

      {isAdmin && (
        <div className="bg-violet-50 border-b border-violet-200">
          <div className="max-w-6xl mx-auto px-4 h-10 flex items-center gap-4 text-sm">
            <span className="font-semibold text-violet-800 text-xs uppercase tracking-wide">Admin</span>
            <span className="text-violet-300">|</span>
            <AdminNavLink to="/admin/playbooks">Playbooks</AdminNavLink>
            <AdminNavLink to="/admin/components">Components</AdminNavLink>
            <AdminNavLink to="/admin/cases">Cases</AdminNavLink>
          </div>
        </div>
      )}

      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}

function AdminNavLink({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `text-sm font-medium transition-colors ${isActive ? 'text-violet-700 font-semibold underline underline-offset-2' : 'text-violet-600 hover:text-violet-900'}`
      }
    >
      {children}
    </NavLink>
  )
}
