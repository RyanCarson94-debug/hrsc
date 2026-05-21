import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { SystemBadge } from '../components/SystemBadge.jsx'
import { MarkdownContent } from '../components/MarkdownContent.jsx'

const SYSTEMS = ['workday', 'servicenow', 'email', 'manual']

export function ComponentLibrary() {
  const [components, setComponents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [systemFilter, setSystemFilter] = useState('')
  const [editing, setEditing] = useState(null) // null | 'new' | component.id
  const [form, setForm] = useState({ name: '', body: '', system: 'manual', tags: '' })
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(null) // component.id to preview

  function load(params = {}) {
    api.listComponents(params).then(setComponents).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const params = {}
    if (search) params.search = search
    if (systemFilter) params.system = systemFilter
    load(params)
  }, [search, systemFilter])

  function openNew() {
    setForm({ name: '', body: '', system: 'manual', tags: '' })
    setEditing('new')
    setPreview(null)
  }

  function openEdit(c) {
    setForm({
      name: c.name, body: c.body, system: c.system,
      tags: (() => { try { return JSON.parse(c.tags || '[]').join(', ') } catch { return '' } })(),
    })
    setEditing(c.id)
    setPreview(null)
  }

  function cancelEdit() { setEditing(null) }

  async function save() {
    setSaving(true)
    const body = {
      name: form.name, body: form.body, system: form.system,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    }
    try {
      if (editing === 'new') {
        await api.createComponent(body)
      } else {
        await api.updateComponent(editing, body)
      }
      setEditing(null)
      load()
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function remove(id) {
    if (!window.confirm('Delete this component?')) return
    await api.deleteComponent(id)
    load()
  }

  if (loading) return <div className="p-8 text-gray-500 text-sm">Loading…</div>

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Component library</h1>
        <button onClick={openNew} className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
          + New component
        </button>
      </div>

      {/* Search & filter */}
      <div className="flex gap-3 mb-5">
        <input
          type="search"
          placeholder="Search components…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={systemFilter}
          onChange={e => setSystemFilter(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm bg-white focus:border-blue-500 focus:outline-none"
        >
          <option value="">All systems</option>
          {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* New component form */}
      {editing === 'new' && (
        <ComponentForm form={form} setForm={setForm} onSave={save} onCancel={cancelEdit} saving={saving} isNew />
      )}

      {/* Component list */}
      {components.length === 0 && editing !== 'new' ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-400 text-sm">
          {search || systemFilter ? 'No components match your filters.' : 'No components yet. Create reusable instruction blocks here.'}
        </div>
      ) : (
        <div className="space-y-3">
          {components.map(c => {
            const tags = (() => { try { return JSON.parse(c.tags || '[]') } catch { return [] } })()
            return (
              <div key={c.id}>
                <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm">{c.name}</span>
                        <SystemBadge system={c.system} size="xs" />
                        {tags.map(t => (
                          <span key={t} className="text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded px-1.5 py-0.5">{t}</span>
                        ))}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 truncate">{c.body.slice(0, 80)}{c.body.length > 80 ? '…' : ''}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setPreview(preview === c.id ? null : c.id)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        {preview === c.id ? 'Hide' : 'Preview'}
                      </button>
                      <button onClick={() => openEdit(c)} className="text-xs text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => remove(c.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                    </div>
                  </div>

                  {preview === c.id && (
                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                      <MarkdownContent>{c.body}</MarkdownContent>
                    </div>
                  )}

                  {editing === c.id && (
                    <div className="border-t border-blue-200 bg-blue-50 p-4">
                      <ComponentForm form={form} setForm={setForm} onSave={save} onCancel={cancelEdit} saving={saving} isNew={false} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ComponentForm({ form, setForm, onSave, onCancel, saving, isNew }) {
  return (
    <div className="rounded-lg border border-blue-300 bg-blue-50 p-4 mb-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            className={inputCls}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Workday: Terminate Employee"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">System</label>
          <div className="flex gap-1.5 flex-wrap pt-0.5">
            {['workday', 'servicenow', 'email', 'manual'].map(sys => (
              <button
                key={sys}
                type="button"
                onClick={() => setForm(f => ({ ...f, system: sys }))}
                className={`px-2.5 py-1 rounded border text-xs font-medium ${
                  form.system === sys ? 'border-blue-500 bg-blue-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                {sys}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tags <span className="font-normal text-gray-400">(comma-separated)</span></label>
        <input
          className={inputCls}
          value={form.tags}
          onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
          placeholder="e.g. termination, offboarding"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Body (Markdown)</label>
        <textarea
          className={`${inputCls} font-mono text-xs`}
          rows={8}
          value={form.body}
          onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
          placeholder="## Component title&#10;&#10;Instructions..."
        />
      </div>

      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving || !form.name} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving…' : isNew ? 'Create component' : 'Save changes'}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded border border-gray-200 text-gray-600 text-sm hover:border-gray-300">Cancel</button>
      </div>
    </div>
  )
}

const inputCls = 'w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
