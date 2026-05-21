import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout.jsx'
import { AdviserHome } from './pages/AdviserHome.jsx'
import { IntakeForm } from './pages/IntakeForm.jsx'
import { StepRunner } from './pages/StepRunner.jsx'
import { AdminHome } from './pages/AdminHome.jsx'
import { PlaybookList } from './pages/PlaybookList.jsx'
import { PlaybookEditor } from './pages/PlaybookEditor.jsx'
import { ComponentLibrary } from './pages/ComponentLibrary.jsx'
import { CaseHistory } from './pages/CaseHistory.jsx'
import { api } from './api.js'
import { initDovetail } from './lib/dovetail.js'

function AdminGuard({ user, children }) {
  if (!user) return <div className="p-8 text-gray-500 text-sm">Loading…</div>
  if (!user.isAdmin) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    api.me()
      .then(setUser)
      .catch(() => setUser({ email: 'anonymous', name: 'Anonymous', isAdmin: false }))
  }, [])

  useEffect(() => { initDovetail() }, [])

  return (
    <BrowserRouter basename="/playbook">
      <Layout user={user}>
        <Routes>
          {/* Adviser routes */}
          <Route path="/"                 element={<AdviserHome user={user} />} />
          <Route path="/play/:slug"       element={<IntakeForm />} />
          <Route path="/play/:slug/run"   element={<StepRunner />} />

          {/* Admin routes */}
          <Route path="/admin" element={
            <AdminGuard user={user}><AdminHome /></AdminGuard>
          } />
          <Route path="/admin/playbooks" element={
            <AdminGuard user={user}><PlaybookList /></AdminGuard>
          } />
          <Route path="/admin/playbooks/:id" element={
            <AdminGuard user={user}><PlaybookEditor /></AdminGuard>
          } />
          <Route path="/admin/components" element={
            <AdminGuard user={user}><ComponentLibrary /></AdminGuard>
          } />
          <Route path="/admin/cases" element={
            <AdminGuard user={user}><CaseHistory /></AdminGuard>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
