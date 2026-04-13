import React, { useState } from 'react'
import {
  Palette, Building2, LayoutDashboard, Database, ShieldCheck,
  Upload, Download, GitBranch, Settings as SettingsIcon,
  AlertTriangle, Info, Eye, Type, ChevronDown, ChevronRight,
  CheckCircle, RotateCcw,
} from 'lucide-react'
import { useTaxonomyStore } from '@/store'
import { api } from '@/lib/api'

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND_SWATCHES = [
  { name: 'Indigo',  color: '#4d52e7' },
  { name: 'Blue',    color: '#2563eb' },
  { name: 'Violet',  color: '#7c3aed' },
  { name: 'Teal',    color: '#0d9488' },
  { name: 'Green',   color: '#16a34a' },
  { name: 'Rose',    color: '#e11d48' },
  { name: 'Orange',  color: '#ea580c' },
  { name: 'Slate',   color: '#475569' },
]

const MODULE_DOCS = [
  {
    icon: <LayoutDashboard className="w-4 h-4" />,
    name: 'Dashboard',
    path: '/',
    when: 'Your starting point every session.',
    why: 'Gives a health overview of all frameworks at a glance — node counts, validation error totals, and recent activity.',
    how: 'Use the metric cards to spot issues quickly. Click a card to navigate to the relevant module.',
  },
  {
    icon: <Database className="w-4 h-4" />,
    name: 'Frameworks',
    path: '/frameworks',
    when: 'When building or editing your taxonomy structure.',
    why: 'This is the core editor. Every taxonomy node lives here — create, rename, move, reorder, and retire nodes from this screen.',
    how: 'Select a framework from the header dropdown. Use the tree panel on the left to navigate. Click any node to open its editor on the right. Use "+ Add Node" to grow the hierarchy.',
  },
  {
    icon: <ShieldCheck className="w-4 h-4" />,
    name: 'Validation',
    path: '/validation',
    when: 'Before publishing a framework, or after any bulk import.',
    why: 'Catches structural problems — duplicate codes, missing owners, retired parents with active children, circular references — before they cause issues downstream.',
    how: 'Click "Run Validation". Fix errors first (blocking), then warnings. Click "Resolve" on each issue after correcting the underlying node. Re-run to confirm clean.',
  },
  {
    icon: <Upload className="w-4 h-4" />,
    name: 'Import',
    path: '/import',
    when: 'When migrating from an existing taxonomy (Excel, CSV) or doing bulk updates.',
    why: 'Saves manual data entry for large taxonomies. Supports upsert mode (update existing + add new) or full replace.',
    how: 'Download the template first, fill it in following the Instructions sheet, then upload. Review the preview table before confirming. Fix any row errors shown in the preview.',
  },
  {
    icon: <Download className="w-4 h-4" />,
    name: 'Export',
    path: '/export',
    when: 'When sharing the taxonomy with stakeholders or archiving a snapshot for governance review.',
    why: 'Produces a structured 6-sheet Excel workbook — full node data, hierarchy view, validation issues, and change history.',
    how: 'Select a framework, choose your options, and click Export. The file downloads immediately with no server processing required.',
  },
  {
    icon: <GitBranch className="w-4 h-4" />,
    name: 'Versions',
    path: '/versions',
    when: 'Before making significant structural changes, or at the end of a governance cycle.',
    why: 'Snapshots let you roll back to a known-good state if a bulk edit goes wrong, and provide an audit trail for compliance.',
    how: 'Click "Create Snapshot" to capture the current state. Name it meaningfully (e.g. "Q1 2025 Approved"). Use "Compare" to diff two snapshots. Use "Restore" to roll back.',
  },
  {
    icon: <SettingsIcon className="w-4 h-4" />,
    name: 'Settings',
    path: '/settings',
    when: 'When first deploying for your team, or when your brand or workflow changes.',
    why: 'Personalises the tool to your organisation — company name, brand colour, and default behaviours reduce friction for daily users.',
    how: 'Change any field and it saves immediately. Brand colour and app name update live across the sidebar.',
  },
]

// ─── Helper ───────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
    <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-800">
      <span className="text-slate-400">{icon}</span>
      <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
    </div>
    <div className="px-6 py-5 space-y-6">{children}</div>
  </div>
)

const InfoBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex gap-3 bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-3">
    <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
    <p className="text-xs text-slate-400 leading-relaxed">{children}</p>
  </div>
)

const FieldRow: React.FC<{ label: string; help: string; children: React.ReactNode }> = ({ label, help, children }) => (
  <div className="grid grid-cols-[200px_1fr] gap-6 items-start">
    <div className="pt-1">
      <label className="text-sm font-medium text-slate-200 block">{label}</label>
      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{help}</p>
    </div>
    <div>{children}</div>
  </div>
)

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={[
      'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent',
      'transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
      checked ? 'bg-brand-600' : 'bg-slate-700',
    ].join(' ')}
  >
    <span
      className={[
        'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg',
        'transition duration-200',
        checked ? 'translate-x-4' : 'translate-x-0',
      ].join(' ')}
    />
  </button>
)

// ─── Live Preview ─────────────────────────────────────────────────────────────

const BrandPreview: React.FC<{ companyName: string; brandColor: string; logoUrl: string }> = ({
  companyName, brandColor, logoUrl,
}) => {
  const activeBg = hexToRgba(brandColor, 0.15)
  const navItems = ['Dashboard', 'Frameworks', 'Validation', 'Import']

  return (
    <div className="rounded-lg overflow-hidden border border-slate-700 flex" style={{ height: 180 }}>
      {/* Mini sidebar */}
      <div className="w-36 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="flex items-center gap-2 px-2.5 py-2.5 border-b border-slate-800">
          <div
            className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-white text-2xs font-bold"
            style={{ backgroundColor: brandColor }}
          >
            {logoUrl
              ? <img src={logoUrl} alt="" className="w-4 h-4 object-contain rounded" />
              : companyName.charAt(0).toUpperCase()
            }
          </div>
          <span className="text-2xs font-semibold text-slate-100 truncate">{companyName || 'HR Taxonomy'}</span>
        </div>
        <div className="flex flex-col gap-0.5 p-1.5">
          {navItems.map((item, i) => (
            <div
              key={item}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-2xs font-medium"
              style={i === 0 ? {
                backgroundColor: activeBg,
                color: brandColor,
                borderLeft: `2px solid ${brandColor}`,
              } : { color: '#94a3b8' }}
            >
              <div className="w-2 h-2 rounded-sm bg-current opacity-60" />
              {item}
            </div>
          ))}
        </div>
      </div>
      {/* Mini content */}
      <div className="flex-1 bg-slate-950 p-3">
        <div className="text-2xs text-slate-500 mb-2">Dashboard</div>
        <div className="grid grid-cols-2 gap-1.5">
          {['Frameworks', 'Nodes', 'Issues', 'Drafts'].map(label => (
            <div key={label} className="bg-slate-900 rounded p-1.5">
              <div className="text-2xs text-slate-500">{label}</div>
              <div
                className="text-xs font-bold mt-0.5"
                style={{ color: brandColor }}
              >
                {label === 'Frameworks' ? '3' : label === 'Nodes' ? '82' : label === 'Issues' ? '2' : '12'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Module Doc Card ──────────────────────────────────────────────────────────

const ModuleCard: React.FC<{
  icon: React.ReactNode; name: string; when: string; why: string; how: string
}> = ({ icon, name, when, why, how }) => {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/40 transition-colors"
      >
        <span className="text-slate-400 flex-shrink-0">{icon}</span>
        <span className="text-sm font-medium text-slate-200 flex-1">{name}</span>
        {open
          ? <ChevronDown className="w-4 h-4 text-slate-500" />
          : <ChevronRight className="w-4 h-4 text-slate-500" />
        }
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-800 pt-3">
          <div>
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">When to use</span>
            <p className="text-xs text-slate-300 mt-1">{when}</p>
          </div>
          <div>
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">Why it matters</span>
            <p className="text-xs text-slate-300 mt-1">{why}</p>
          </div>
          <div>
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">How to use it</span>
            <p className="text-xs text-slate-300 mt-1">{how}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const Settings: React.FC = () => {
  const { settings, updateSettings, addToast, loadFrameworks, selectedFrameworkId } = useTaxonomyStore()
  const [saved, setSaved] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const handleChange = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    updateSettings({ [key]: value })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSeedDemo = async () => {
    setSeeding(true)
    try {
      const result = await api.seed()
      await loadFrameworks()
      addToast('success', `Demo data seeded — ${result.node_count} nodes in framework ${result.framework_id}`)
    } catch (err) {
      addToast('error', `Seed failed: ${(err as Error).message}`)
    } finally {
      setSeeding(false)
    }
  }

  const handleClearAll = async () => {
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    try {
      const { frameworks } = useTaxonomyStore.getState()
      for (const fw of frameworks) {
        await api.frameworks.delete(fw.id)
      }
      await loadFrameworks()
      addToast('success', 'All frameworks and nodes deleted')
    } catch (err) {
      addToast('error', `Clear failed: ${(err as Error).message}`)
    } finally {
      setConfirmClear(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Settings</h1>
          <p className="text-sm text-slate-400 mt-0.5">Customise the app for your organisation</p>
        </div>
        {saved && (
          <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-400/10 border border-green-500/20 rounded-lg px-3 py-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            Saved
          </div>
        )}
      </div>

      {/* ── Company Branding ─────────────────────────────────────────────────── */}
      <SectionCard title="Company Branding" icon={<Palette className="w-4 h-4" />}>
        <InfoBox>
          Set this up once when you first deploy. These settings personalise the tool to match your
          organisation's identity — they're stored in your browser and apply immediately.
        </InfoBox>

        <FieldRow
          label="App Name"
          help="Shown in the sidebar header. Use your team or organisation name."
        >
          <input
            type="text"
            value={settings.companyName}
            onChange={e => handleChange('companyName', e.target.value)}
            placeholder="HR Taxonomy"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
          <p className="text-2xs text-slate-500 mt-1.5">
            Examples: "Acme Corp HR", "People Ops", "Global HR COE"
          </p>
        </FieldRow>

        <FieldRow
          label="Brand Colour"
          help="Primary accent colour for navigation highlights, active states, and key UI elements. Pick your company's brand colour."
        >
          <div className="space-y-3">
            {/* Preset swatches */}
            <div className="flex gap-2 flex-wrap">
              {BRAND_SWATCHES.map(swatch => (
                <button
                  key={swatch.color}
                  title={swatch.name}
                  onClick={() => handleChange('brandColor', swatch.color)}
                  className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                  style={{
                    backgroundColor: swatch.color,
                    borderColor: settings.brandColor === swatch.color ? 'white' : 'transparent',
                  }}
                />
              ))}
              {/* Custom colour input */}
              <label
                title="Custom colour"
                className="w-7 h-7 rounded-full border-2 border-slate-600 bg-slate-800 flex items-center justify-center cursor-pointer hover:border-slate-400 transition-colors overflow-hidden"
              >
                <span className="text-2xs text-slate-400">+</span>
                <input
                  type="color"
                  value={settings.brandColor}
                  onChange={e => handleChange('brandColor', e.target.value)}
                  className="sr-only"
                />
              </label>
            </div>
            {/* Current value display */}
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-sm border border-slate-600"
                style={{ backgroundColor: settings.brandColor }}
              />
              <code className="text-xs text-slate-400 font-mono">{settings.brandColor}</code>
            </div>
          </div>
        </FieldRow>

        <FieldRow
          label="Logo URL"
          help="Optional. Paste a direct link to your company logo image. Square PNG or SVG works best. Leave blank to use the default icon."
        >
          <input
            type="url"
            value={settings.logoUrl}
            onChange={e => handleChange('logoUrl', e.target.value)}
            placeholder="https://your-company.com/logo.png"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono"
          />
          <p className="text-2xs text-slate-500 mt-1.5">
            The image must be publicly accessible. Recommended size: 64×64 px or larger.
          </p>
        </FieldRow>

        {/* Live preview */}
        <div>
          <p className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" /> Live Preview
          </p>
          <BrandPreview
            companyName={settings.companyName}
            brandColor={settings.brandColor}
            logoUrl={settings.logoUrl}
          />
        </div>
      </SectionCard>

      {/* ── Application Defaults ─────────────────────────────────────────────── */}
      <SectionCard title="Application Defaults" icon={<Type className="w-4 h-4" />}>
        <InfoBox>
          Configure these before your team starts using the tool daily. Defaults reduce repetitive
          choices and set expectations for how nodes flow through your review process.
        </InfoBox>

        <FieldRow
          label="Default node status"
          help="The status pre-selected when creating a new taxonomy node. Use Draft to require review before nodes go live; use Active for teams with a streamlined publish process."
        >
          <div className="flex gap-3">
            {(['draft', 'active'] as const).map(status => (
              <button
                key={status}
                onClick={() => handleChange('defaultNodeStatus', status)}
                className={[
                  'px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors capitalize',
                  settings.defaultNodeStatus === status
                    ? 'bg-brand-600/20 border-brand-500 text-brand-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600',
                ].join(' ')}
              >
                {status}
              </button>
            ))}
          </div>
          <p className="text-2xs text-slate-500 mt-2">
            {settings.defaultNodeStatus === 'draft'
              ? 'Recommended: nodes require explicit activation. Reduces accidental publication.'
              : 'Nodes are immediately active when created. Best for mature, low-governance workflows.'
            }
          </p>
        </FieldRow>

        <FieldRow
          label="Show codes in tree"
          help="When enabled, node codes (e.g. WFA, WFA.01) appear next to names in the hierarchy tree. Useful for teams that reference nodes by code in other systems."
        >
          <div className="flex items-center gap-3">
            <Toggle
              checked={settings.showNodeCodes}
              onChange={v => handleChange('showNodeCodes', v)}
            />
            <span className="text-sm text-slate-400">
              {settings.showNodeCodes ? 'Codes visible' : 'Codes hidden'}
            </span>
          </div>
        </FieldRow>

        <FieldRow
          label="Auto-expand tree"
          help="When enabled, the first level of the taxonomy tree expands automatically when you open a framework. Disable this if your frameworks have many top-level domains that clutter the view."
        >
          <div className="flex items-center gap-3">
            <Toggle
              checked={settings.autoExpandTree}
              onChange={v => handleChange('autoExpandTree', v)}
            />
            <span className="text-sm text-slate-400">
              {settings.autoExpandTree ? 'First level auto-expands' : 'Tree starts collapsed'}
            </span>
          </div>
        </FieldRow>
      </SectionCard>

      {/* ── Module Guide ─────────────────────────────────────────────────────── */}
      <SectionCard title="Module Guide" icon={<Info className="w-4 h-4" />}>
        <InfoBox>
          Expand any module below to see when to use it, why it matters, and how to get the most
          out of it. Share this with new team members during onboarding.
        </InfoBox>
        <div className="space-y-1.5">
          {MODULE_DOCS.map(doc => (
            <ModuleCard key={doc.name} {...doc} />
          ))}
        </div>
      </SectionCard>

      {/* ── Danger Zone ──────────────────────────────────────────────────────── */}
      <SectionCard title="Data Management" icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}>
        <InfoBox>
          These actions affect your live data. Use Re-seed to restore the demo taxonomy. Use Delete
          All to start completely fresh. Both actions are permanent.
        </InfoBox>

        <div className="space-y-4">
          {/* Re-seed */}
          <div className="flex items-start gap-4 p-4 bg-slate-800/40 rounded-lg border border-slate-700/50">
            <RotateCcw className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200">Re-seed Demo Data</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Loads the built-in HRSC taxonomy — ~80 nodes across 13 domains including Workforce
                Administration, Benefits, Payroll, Onboarding, and more. Use this to explore the
                tool or restore a clean starting point. Existing frameworks are preserved.
              </p>
            </div>
            <button
              onClick={handleSeedDemo}
              disabled={seeding}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {seeding ? 'Seeding…' : 'Seed Demo'}
            </button>
          </div>

          {/* Delete all */}
          <div className="flex items-start gap-4 p-4 bg-red-950/20 rounded-lg border border-red-900/40">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-300">Delete All Frameworks</p>
              <p className="text-xs text-red-400/70 mt-0.5">
                Permanently deletes all frameworks and their nodes, validation issues, change logs,
                and snapshots. This cannot be undone. Export your data first if you need a backup.
              </p>
              {confirmClear && (
                <p className="text-xs text-amber-400 mt-2 font-medium">
                  Click again to confirm — this will delete everything permanently.
                </p>
              )}
            </div>
            <button
              onClick={handleClearAll}
              className={[
                'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                confirmClear
                  ? 'bg-red-600 text-white hover:bg-red-500'
                  : 'bg-red-900/40 text-red-400 hover:bg-red-900/70',
              ].join(' ')}
            >
              {confirmClear ? 'Confirm Delete' : 'Delete All'}
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ── About ────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-1 pb-6 text-2xs text-slate-600">
        <span>HR Taxonomy Manager · v1.0.0</span>
        <span>Settings are stored locally in your browser</span>
      </div>

    </div>
  )
}

export default Settings
