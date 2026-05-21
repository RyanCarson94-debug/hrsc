import { Link, NavLink, useLocation } from 'react-router-dom'

export function Layout({ children, user }) {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-csl-red">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 font-bold text-white">
            <span className="w-7 h-7 rounded bg-white/20 flex items-center justify-center text-xs font-bold border border-white/30">▶</span>
            <span className="text-base tracking-tight">
              HRSC <span className="font-light opacity-80">Playbook</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `text-sm px-4 py-1.5 rounded font-semibold transition-all ${
                  isActive && !isAdmin
                    ? 'bg-white text-csl-red'
                    : 'text-white/80 hover:text-white hover:bg-white/15'
                }`
              }
            >
              Adviser
            </NavLink>
            {user?.isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `text-sm px-4 py-1.5 rounded font-semibold transition-all ${
                    isActive || isAdmin
                      ? 'bg-white text-csl-red'
                      : 'text-white/80 hover:text-white hover:bg-white/15'
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
        <div className="bg-csl-black border-b border-white/10">
          <div className="max-w-6xl mx-auto px-5 h-10 flex items-center gap-5">
            <span className="text-xs font-bold text-csl-gray3 uppercase tracking-widest">Admin</span>
            <span className="text-white/20">|</span>
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
        `text-sm font-semibold transition-colors ${
          isActive ? 'text-white underline underline-offset-2' : 'text-csl-gray3 hover:text-white'
        }`
      }
    >
      {children}
    </NavLink>
  )
}
