import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import { ToastStack } from '@/components/ui/Toast';
import { useTaxonomyStore } from '@/store';
import { api } from '@/lib/api';
import { Button, Select } from '@/components/ui';

interface LayoutProps {
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Breadcrumb helper
// ---------------------------------------------------------------------------

const ROUTE_NAMES: Record<string, string> = {
  '':            'Dashboard',
  'frameworks':  'Frameworks',
  'validation':  'Validation',
  'import':      'Import',
  'export':      'Export',
  'versions':    'Versions',
  'settings':    'Settings',
};

const Breadcrumb: React.FC = () => {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return (
      <nav className="text-xs text-slate-400 flex items-center gap-1.5">
        <span className="text-slate-200">Dashboard</span>
      </nav>
    );
  }

  return (
    <nav className="text-xs text-slate-400 flex items-center gap-1.5">
      <span className="text-slate-500">Dashboard</span>
      {segments.map((seg, idx) => {
        const label = ROUTE_NAMES[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
        const isLast = idx === segments.length - 1;
        return (
          <React.Fragment key={idx}>
            <span className="text-slate-600">/</span>
            <span className={isLast ? 'text-slate-200 font-medium' : 'text-slate-500'}>
              {label}
            </span>
          </React.Fragment>
        );
      })}
    </nav>
  );
};

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const {
    sidebarCollapsed,
    toggleSidebar,
    frameworks,
    selectedFrameworkId,
    selectFramework,
    loadFrameworks,
    toasts,
    removeToast,
    addToast,
  } = useTaxonomyStore();

  useEffect(() => {
    loadFrameworks();
  }, [loadFrameworks]);

  const frameworkOptions = frameworks.map((fw) => ({
    value: fw.id,
    label: fw.name,
  }));

  const handleSeedDemo = async () => {
    try {
      const result = await api.seed();
      addToast('success', `Demo data seeded — ${result.node_count} nodes in framework ${result.framework_id}`);
      await loadFrameworks();
    } catch (err) {
      addToast('error', `Seed failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Sidebar */}
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-slate-900/80 backdrop-blur border-b border-slate-800 h-14 flex items-center px-4 gap-4 flex-shrink-0">
          {/* Hamburger */}
          <button
            onClick={toggleSidebar}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Toggle sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Breadcrumb */}
          <div className="flex-1 min-w-0">
            <Breadcrumb />
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {frameworkOptions.length > 0 && (
              <div className="w-48">
                <Select
                  options={frameworkOptions}
                  value={selectedFrameworkId ?? ''}
                  placeholder="Select framework…"
                  onChange={(e) => {
                    if (e.target.value) selectFramework(e.target.value);
                  }}
                  className="py-1 text-xs"
                />
              </div>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSeedDemo}
            >
              Seed Demo Data
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6 bg-slate-950 scrollbar-thin">
          {children}
        </main>
      </div>

      {/* Toast notifications */}
      <ToastStack toasts={toasts} removeToast={removeToast} />
    </div>
  );
};

export default Layout;
