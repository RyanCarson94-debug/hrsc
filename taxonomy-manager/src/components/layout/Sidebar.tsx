import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Database,
  ShieldCheck,
  Upload,
  Download,
  GitBranch,
  Settings,
  Layers,
} from 'lucide-react';
import { useTaxonomyStore } from '@/store';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  end?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Dashboard',  to: '/',           icon: <LayoutDashboard className="w-4 h-4 flex-shrink-0" />, end: true },
  { label: 'Frameworks', to: '/frameworks', icon: <Database        className="w-4 h-4 flex-shrink-0" /> },
  { label: 'Validation', to: '/validation', icon: <ShieldCheck     className="w-4 h-4 flex-shrink-0" /> },
  { label: 'Import',     to: '/import',     icon: <Upload          className="w-4 h-4 flex-shrink-0" /> },
  { label: 'Export',     to: '/export',     icon: <Download        className="w-4 h-4 flex-shrink-0" /> },
  { label: 'Versions',   to: '/versions',   icon: <GitBranch       className="w-4 h-4 flex-shrink-0" /> },
];

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed }) => {
  const { settings } = useTaxonomyStore();
  const { brandColor, companyName, logoUrl } = settings;

  const activeStyle = {
    backgroundColor: hexToRgba(brandColor, 0.15),
    color: brandColor,
    borderLeftColor: brandColor,
  };

  return (
    <aside
      className={[
        'bg-slate-900 border-r border-slate-800 h-full flex flex-col transition-all duration-200',
        collapsed ? 'w-16' : 'w-56',
      ].join(' ')}
    >
      {/* Logo */}
      <div
        className={[
          'flex items-center gap-2.5 px-3 h-14 border-b border-slate-800 flex-shrink-0',
          collapsed ? 'justify-center' : '',
        ].join(' ')}
      >
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{ backgroundColor: brandColor }}
        >
          {logoUrl
            ? <img src={logoUrl} alt="" className="w-5 h-5 object-contain" />
            : <Layers className="w-4 h-4 text-white" />
          }
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold text-slate-100 truncate">
            {companyName || 'HR Taxonomy'}
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              [
                'flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2',
                'border-l-2',
                isActive ? '' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-transparent',
              ].join(' ')
            }
            style={({ isActive }) => isActive ? activeStyle : undefined}
          >
            {item.icon}
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: Settings */}
      <div className="px-2 py-3 border-t border-slate-800 flex-shrink-0">
        <NavLink
          to="/settings"
          title={collapsed ? 'Settings' : undefined}
          className={({ isActive }) =>
            [
              'w-full flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              'border-l-2',
              collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2',
              isActive ? '' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-transparent',
            ].join(' ')
          }
          style={({ isActive }) => isActive ? activeStyle : undefined}
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="truncate">Settings</span>}
        </NavLink>
      </div>
    </aside>
  );
};

export default Sidebar;
