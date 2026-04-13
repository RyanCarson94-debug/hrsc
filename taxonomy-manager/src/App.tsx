import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import Dashboard from '@/pages/Dashboard'
import FrameworkExplorer from '@/pages/FrameworkExplorer'
import ValidationCenter from '@/pages/ValidationCenter'
import ImportCenter from '@/pages/ImportCenter'
import ExportCenter from '@/pages/ExportCenter'
import VersionManager from '@/pages/VersionManager'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="frameworks" element={<FrameworkExplorer />} />
          <Route path="validation" element={<ValidationCenter />} />
          <Route path="import" element={<ImportCenter />} />
          <Route path="export" element={<ExportCenter />} />
          <Route path="versions" element={<VersionManager />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
