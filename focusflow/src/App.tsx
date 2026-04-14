import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { Nav } from './components/shared/Nav'

import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { HomePage } from './pages/HomePage'
import { TasksPage } from './pages/TasksPage'
import { TaskFormPage } from './pages/TaskFormPage'
import { FocusPage } from './pages/FocusPage'
import { CapacityPage } from './pages/CapacityPage'
import { InsightsPage } from './pages/InsightsPage'
import { SettingsPage } from './pages/SettingsPage'

function RequireAuth() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/focusflow/login" replace />
  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:block w-56 border-r border-border bg-white flex-shrink-0 fixed inset-y-0 left-0 z-30">
        <Nav />
      </aside>
      <main className="flex-1 md:ml-56 pb-20 md:pb-0 min-h-screen bg-bg">
        <Outlet />
      </main>
      <div className="md:hidden"><Nav /></div>
    </div>
  )
}

function RedirectIfAuth() {
  const { user } = useAuth()
  if (user) return <Navigate to="/focusflow/" replace />
  return <Outlet />
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<RedirectIfAuth />}>
            <Route path="/focusflow/login" element={<LoginPage />} />
            <Route path="/focusflow/register" element={<RegisterPage />} />
          </Route>

          <Route element={<RequireAuth />}>
            <Route path="/focusflow/" element={<HomePage />} />
            <Route path="/focusflow/tasks" element={<TasksPage />} />
            <Route path="/focusflow/tasks/new" element={<TaskFormPage />} />
            <Route path="/focusflow/tasks/:id" element={<TaskFormPage />} />
            <Route path="/focusflow/focus/:taskId" element={<FocusPage />} />
            <Route path="/focusflow/capacity" element={<CapacityPage />} />
            <Route path="/focusflow/insights" element={<InsightsPage />} />
            <Route path="/focusflow/settings" element={<SettingsPage />} />
          </Route>

          <Route path="/focusflow/*" element={<Navigate to="/focusflow/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
