import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { SystemBadge } from '../components/SystemBadge.jsx'
import { MarkdownContent } from '../components/MarkdownContent.jsx'
import { RichTextEditor } from '../components/RichTextEditor.jsx'

const SYSTEMS = ['workday', 'servicenow', 'email', 'manual']

function stripHTML(str) {
  return str ? str.replace(/<[^>]+>/g, '') : ''
}

export function ComponentLibrary() {
  const [components, setComponents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [systemFilter, setSystemFilter] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', body: '', system: 'manual', tags: '' })
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(null)

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

  function openNew() { setForm({ name: '', body: '', system: 'manual', tags: '' }); setEditing('new'); setPreview(null) }
  function openEdit(c) {
    setForm({ name: c.name, body: c.body, system: c.system, tags: (() => { try { return JSON.parse(c.tags || '[]').join(', ') } catch { return '' } })() })
    setEditing(c.id); setPreview(null)
  }
  function cancelEdit() { setEditing(null) }

  async function save() {
    setSaving(true)
    const body = { name: form.name, body: form.body, system: form.system, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) }
    try {
      if (editing === 'new') await api.createComponent(body)
      else await api.updateComponent(editing, body)
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

  if (loading) return <div className="p-8 text-csl-gray3 text-sm">Loading…</div>

  return (
    <div className="max-w-5xl mx-auto px-5 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-csl-black">Component Library</h1>
        <button onClick={openNew} className="px-4 py-2 rounded bg-csl-red text-white text-sm font-bold hover:bg-csl-red-dark transition-colors">
          + New Component
        </button>
      </div>

      <div className="flex gap-3 mb-5">
        <input
          type="search"
          placeholder="Search components…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded border border-csl-gray2 px-3 py-2 text-sm focus:border-csl-red focus:outline-none focus:ring-1 focus:ring-csl-red"
        />
        <select
          value={systemFilter}
          onChange={e => setSystemFilter(e.target.value)}
          className="rounded border border-csl-gray2 px-3 py-2 text-sm bg-white focus:border-csl-red focus:outline-none"
        >
          <option value="">All systems</option>
          {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {editing === 'new' && (
        <div className="rounded border border-csl-red/30 bg-red-50 p-4 mb-4">
          <ComponentForm form={form} setForm={setForm} onSave={save} onCancel={cancelEdit} saving={saving} isNew />
        </div>
      )}

      {components.length === 0 && editing !== 'new' ? (
        <div className="rounded border border-dashed border-csl-gray2 p-10 text-center text-csl-gray3 text-sm font-light">
          {search || systemFilter ? 'No components match your filters.' : 'No components yet. Create reusable instruction blocks here.'}
        </div>
      ) : (
        <div className="space-y-3">
          {components.map(c => {
            const tags = (() => { try { return JSON.parse(c.tags || '[]') } catch { return [] } })()
            const bodyPreview = stripHTML(c.body).slice(0, 80)
            return (
              <div key={c.id}>
                <div className="rounded border border-csl-gray2 bg-white overflow-hidden">
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-csl-black text-sm">{c.name}</span>
                        <SystemBadge system={c.system} size="xs" />
                        {tags.map(t => (
                          <span key={t} className="text-xs bg-csl-gray1 text-csl-gray3 border border-csl-gray2 rounded px-2 py-0.5 font-semibold">{t}</span>
                        ))}
                      </div>
                      <div className="text-xs text-csl-gray3 mt-0.5 truncate font-light">{bodyPreview}{stripHTML(c.body).length > 80 ? '…' : ''}</div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button onClick={() => setPreview(preview === c.id ? null : c.id)} className="text-xs text-csl-gray3 hover:text-csl-black font-semibold">
                        {preview === c.id ? 'Hide' : 'Preview'}
                      </button>
                      <button onClick={() => openEdit(c)} className="text-xs text-csl-red hover:underline font-semibold">Edit</button>
                      <button onClick={() => remove(c.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                    </div>
                  </div>

                  {preview === c.id && (
                    <div className="border-t border-csl-gray2 bg-csl-gray1 px-4 py-4">
                      <MarkdownContent>{c.body}</MarkdownContent>
                    </div>
                  )}

                  {editing === c.id && (
                    <div className="border-t border-csl-red/20 bg-red-50 p-4">
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
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-bold text-csl-black mb-1">Name</label>
          <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Workday: Terminate Employee" />
        </div>
        <div>
          <label className="block text-sm font-bold text-csl-black mb-1">System</label>
          <div className="flex gap-1.5 flex-wrap pt-0.5">
            {['workday', 'servicenow', 'email', 'manual'].map(sys => (
              <button
                key={sys}
                type="button"
                onClick={() => setForm(f => ({ ...f, system: sys }))}
                className={`px-2.5 py-1 rounded border text-xs font-bold transition-colors ${
                  form.system === sys
                    ? 'border-csl-red bg-csl-red text-white'
                    : 'border-csl-gray2 bg-white text-csl-gray3 hover:border-csl-red hover:text-csl-red'
                }`}
              >
                {sys}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-csl-black mb-1">Tags <span className="font-normal text-csl-gray3">(comma-separated)</span></label>
        <input className={inputCls} value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="e.g. termination, offboarding" />
      </div>

      <div>
        <label className="block text-sm font-bold text-csl-black mb-1">Body</label>
        <RichTextEditor value={form.body} onChange={body => setForm(f => ({ ...f, body }))} placeholder="Write component instructions…" />
      </div>

      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving || !form.name} className="px-3 py-1.5 rounded bg-csl-red text-white text-sm font-bold hover:bg-csl-red-dark disabled:opacity-50 transition-colors">
          {saving ? 'Saving…' : isNew ? 'Create Component' : 'Save Changes'}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded border border-csl-gray2 text-csl-gray3 text-sm hover:border-csl-black font-semibold">Cancel</button>
      </div>
    </div>
  )
}

const inputCls = 'w-full rounded border border-csl-gray2 bg-white px-3 py-2 text-sm focus:border-csl-red focus:outline-none focus:ring-1 focus:ring-csl-red'
