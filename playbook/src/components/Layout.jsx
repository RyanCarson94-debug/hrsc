import { Link, NavLink, useLocation } from 'react-router-dom'

export function Layout({ children, user }) {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-gray-900">
            <span className="text-blue-600 text-lg">▶</span>
            <span>HRSC Playbook</span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `text-sm px-3 py-1.5 rounded ${isActive && !isAdmin ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`
              }
            >
              Adviser
            </NavLink>
            {user?.isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `text-sm px-3 py-1.5 rounded ${isActive || isAdmin ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`
                }
              >
                Admin
              </NavLink>
            )}
            {user && (
              <span className="ml-3 text-xs text-gray-400 border-l pl-3 border-gray-200">
                {user.name}
              </span>
            )}
          </nav>
        </div>
      </header>

      {isAdmin && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-6xl mx-auto px-4 h-10 flex items-center gap-4 text-sm">
            <span className="font-medium text-amber-800">Admin</span>
            <span className="text-amber-300">|</span>
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
        `text-amber-700 hover:text-amber-900 ${isActive ? 'font-semibold underline' : ''}`
      }
    >
      {children}
    </NavLink>
  )
}
