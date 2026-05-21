import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { SystemBadge } from '../components/SystemBadge.jsx'
import { RichTextEditor } from '../components/RichTextEditor.jsx'

const SYSTEMS = ['workday', 'servicenow', 'email', 'manual']
const FIELD_TYPES = ['select', 'text', 'date', 'boolean']

export function PlaybookEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [pb, setPb] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('details')
  const [error, setError] = useState(null)

  const [details, setDetails] = useState({ name: '', slug: '', description: '', active: false })
  const [fields, setFields] = useState([])
  const [editingField, setEditingField] = useState(null)
  const [steps, setSteps] = useState([])
  const [editingStep, setEditingStep] = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await api.getPlaybook(id)
      setPb(data)
      setDetails({ name: data.name, slug: data.slug, description: data.description || '', active: !!data.active })
      setFields(data.fields || [])
      setSteps(data.steps || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function saveDetails() {
    setSaving(true)
    try {
      await api.updatePlaybook(id, details)
      setPb(p => ({ ...p, ...details }))
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function deletePlaybook() {
    if (!window.confirm(`Delete "${pb.name}"? This cannot be undone.`)) return
    await api.deletePlaybook(id)
    navigate('/admin/playbooks')
  }

  if (loading) return <div className="p-8 text-gray-500 text-sm">Loading…</div>
  if (error)   return <div className="p-8 text-red-600 text-sm">{error}</div>

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/playbooks')} className="text-sm text-gray-400 hover:text-violet-600">← Playbooks</button>
        <span className="text-gray-200">/</span>
        <h1 className="text-xl font-bold text-gray-900">{pb.name}</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${pb.active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
          {pb.active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-violet-100 mb-6">
        {['details', 'fields', 'steps'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px capitalize transition-colors ${
              tab === t ? 'border-violet-600 text-violet-700' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t}
            {t === 'fields' && fields.length > 0 && <span className="ml-1 text-gray-400 font-normal">({fields.length})</span>}
            {t === 'steps'  && steps.length  > 0 && <span className="ml-1 text-gray-400 font-normal">({steps.length})</span>}
          </button>
        ))}
      </div>

      {/* Details tab */}
      {tab === 'details' && (
        <div className="bg-white rounded-xl border border-violet-100 p-6 max-w-xl shadow-sm">
          <div className="space-y-4">
            <Field label="Name">
              <input className={inputCls} value={details.name} onChange={e => setDetails(d => ({ ...d, name: e.target.value }))} />
            </Field>
            <Field label="Slug" hint="Used in the URL, e.g. /play/termination">
              <input className={inputCls} value={details.slug} onChange={e => setDetails(d => ({ ...d, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} />
            </Field>
            <Field label="Description">
              <textarea className={inputCls} rows={2} value={details.description} onChange={e => setDetails(d => ({ ...d, description: e.target.value }))} />
            </Field>
            <div className="flex items-center gap-3">
              <input
                type="checkbox" id="active"
                checked={details.active}
                onChange={e => setDetails(d => ({ ...d, active: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-violet-600"
              />
              <label htmlFor="active" className="text-sm font-medium text-gray-700 cursor-pointer">
                Active — visible to advisers
              </label>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <button onClick={deletePlaybook} className="text-xs text-red-400 hover:text-red-600 hover:underline">
              Delete playbook
            </button>
            <button
              onClick={saveDetails}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}

      {/* Fields tab */}
      {tab === 'fields' && (
        <FieldsEditor
          fields={fields}
          playbookId={id}
          setFields={setFields}
          editingField={editingField}
          setEditingField={setEditingField}
          onRefresh={load}
        />
      )}

      {/* Steps tab */}
      {tab === 'steps' && (
        <StepsEditor
          steps={steps}
          fields={fields}
          playbookId={id}
          setSteps={setSteps}
          editingStep={editingStep}
          setEditingStep={setEditingStep}
          onRefresh={load}
        />
      )}
    </div>
  )
}

// ─── Fields Editor ────────────────────────────────────────────────────────────

function FieldsEditor({ fields, playbookId, setFields, editingField, setEditingField, onRefresh }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ field_key: '', label: '', type: 'text', options: '' })

  function openNew() {
    setForm({ field_key: '', label: '', type: 'text', options: '' })
    setEditingField('new')
  }

  function openEdit(f) {
    let opts = ''
    try { opts = JSON.parse(f.options || '[]').join('\n') } catch {}
    setForm({ field_key: f.field_key, label: f.label, type: f.type, options: opts })
    setEditingField(f.id)
  }

  function closeEdit() { setEditingField(null) }

  async function save() {
    setSaving(true)
    const body = {
      field_key: form.field_key,
      label: form.label,
      type: form.type,
      options: form.type === 'select' ? form.options.split('\n').map(s => s.trim()).filter(Boolean) : [],
    }
    try {
      if (editingField === 'new') {
        await api.createField(playbookId, body)
      } else {
        await api.updateField(editingField, body)
      }
      await onRefresh()
      setEditingField(null)
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function remove(fieldId) {
    if (!window.confirm('Delete this field?')) return
    await api.deleteField(fieldId)
    onRefresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Intake fields</h2>
        <button onClick={openNew} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors">
          + Add field
        </button>
      </div>

      {fields.length === 0 && editingField !== 'new' && (
        <div className="rounded-xl border border-dashed border-violet-200 p-8 text-center text-gray-400 text-sm">
          No intake fields yet. Add fields to capture information from the adviser before starting the steps.
        </div>
      )}

      <div className="space-y-2">
        {fields.map((f, idx) => (
          <div key={f.id}>
            <div className="rounded-xl border border-violet-100 bg-white px-4 py-3 flex items-center gap-3">
              <span className="text-xs text-gray-300 w-5 text-center font-mono">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-800">{f.label}</span>
                <span className="ml-2 text-xs text-gray-400 font-mono">{f.field_key}</span>
                <span className="ml-2 text-xs text-gray-400 bg-gray-100 rounded px-1">{f.type}</span>
                {f.type === 'select' && (() => {
                  try {
                    const opts = JSON.parse(f.options || '[]')
                    return <span className="ml-1 text-xs text-gray-400">[{opts.join(', ')}]</span>
                  } catch { return null }
                })()}
              </div>
              <button onClick={() => openEdit(f)} className="text-xs text-violet-600 hover:underline">Edit</button>
              <button onClick={() => remove(f.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
            </div>

            {editingField === f.id && (
              <FieldForm form={form} setForm={setForm} onSave={save} onCancel={closeEdit} saving={saving} isNew={false} />
            )}
          </div>
        ))}

        {editingField === 'new' && (
          <FieldForm form={form} setForm={setForm} onSave={save} onCancel={closeEdit} saving={saving} isNew={true} />
        )}
      </div>
    </div>
  )
}

function FieldForm({ form, setForm, onSave, onCancel, saving, isNew }) {
  return (
    <div className="rounded-xl border border-violet-300 bg-violet-50 p-4 mt-1 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Field key" hint="e.g. country">
          <input className={inputCls} value={form.field_key} onChange={e => setForm(f => ({ ...f, field_key: e.target.value.toLowerCase().replace(/\s+/g, '_') }))} />
        </Field>
        <Field label="Label" hint="Shown to adviser">
          <input className={inputCls} value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
        </Field>
      </div>
      <Field label="Type">
        <select className={inputCls} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
          {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      {form.type === 'select' && (
        <Field label="Options" hint="One per line">
          <textarea className={inputCls} rows={4} value={form.options} onChange={e => setForm(f => ({ ...f, options: e.target.value }))} />
        </Field>
      )}
      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving || !form.field_key || !form.label} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors">
          {saving ? 'Saving…' : isNew ? 'Add field' : 'Save'}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:border-gray-300">Cancel</button>
      </div>
    </div>
  )
}

// ─── Steps Editor ─────────────────────────────────────────────────────────────

function StepsEditor({ steps, fields, playbookId, setSteps, editingStep, setEditingStep, onRefresh }) {
  const [saving, setSaving] = useState(false)
  const blankStep = { title: '', body: '', system: 'manual', required: true, conditions: [] }
  const [form, setForm] = useState(blankStep)

  function conditionsToForm(conditions) {
    try {
      const c = typeof conditions === 'string' ? JSON.parse(conditions) : conditions
      if (!c || c.always === true) return []
      return Object.entries(c).map(([key, val]) => ({
        key,
        matchType: Array.isArray(val) ? 'oneOf' : 'equals',
        value: Array.isArray(val) ? val.join(', ') : val,
      }))
    } catch { return [] }
  }

  function formToConditions(condRows) {
    if (condRows.length === 0) return { always: true }
    const result = {}
    for (const row of condRows) {
      if (!row.key) continue
      if (row.matchType === 'oneOf') {
        result[row.key] = row.value.split(',').map(s => s.trim()).filter(Boolean)
      } else {
        result[row.key] = row.value
      }
    }
    return Object.keys(result).length === 0 ? { always: true } : result
  }

  function openNew() {
    setForm({ ...blankStep, conditions: [] })
    setEditingStep('new')
  }

  function openEdit(s) {
    setForm({
      title: s.title, body: s.body, system: s.system,
      required: !!s.required,
      conditions: conditionsToForm(s.conditions),
    })
    setEditingStep(s.id)
  }

  function closeEdit() { setEditingStep(null) }

  async function save() {
    setSaving(true)
    const body = {
      title: form.title,
      body: form.body,
      system: form.system,
      required: form.required,
      conditions: formToConditions(form.conditions),
    }
    try {
      if (editingStep === 'new') {
        await api.createStep(playbookId, body)
      } else {
        await api.updateStep(editingStep, body)
      }
      await onRefresh()
      setEditingStep(null)
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function remove(stepId) {
    if (!window.confirm('Delete this step?')) return
    await api.deleteStep(stepId)
    onRefresh()
  }

  function addCondRow() {
    setForm(f => ({ ...f, conditions: [...f.conditions, { key: '', matchType: 'equals', value: '' }] }))
  }

  function removeCondRow(idx) {
    setForm(f => ({ ...f, conditions: f.conditions.filter((_, i) => i !== idx) }))
  }

  function updateCondRow(idx, patch) {
    setForm(f => ({
      ...f,
      conditions: f.conditions.map((row, i) => i === idx ? { ...row, ...patch } : row)
    }))
  }

  const fieldKeys = fields.map(f => f.field_key)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Steps</h2>
        <button onClick={openNew} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors">
          + Add step
        </button>
      </div>

      {steps.length === 0 && editingStep !== 'new' && (
        <div className="rounded-xl border border-dashed border-violet-200 p-8 text-center text-gray-400 text-sm">
          No steps yet. Add steps to guide advisers through the case process.
        </div>
      )}

      <div className="space-y-2">
        {steps.map((s, idx) => (
          <div key={s.id}>
            <div className="rounded-xl border border-violet-100 bg-white px-4 py-3 flex items-center gap-3">
              <span className="text-xs text-gray-300 w-5 text-center font-mono">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-800">{s.title}</span>
                <span className="ml-2">
                  <SystemBadge system={s.system} size="xs" />
                </span>
                {!s.required && <span className="ml-2 text-xs text-gray-400">optional</span>}
                {(() => {
                  try {
                    const c = typeof s.conditions === 'string' ? JSON.parse(s.conditions) : s.conditions
                    if (c && c.always !== true) {
                      const entries = Object.entries(c)
                      return <span className="ml-2 text-xs text-violet-600">if {entries.map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('|') : v}`).join(', ')}</span>
                    }
                  } catch {}
                  return null
                })()}
              </div>
              <button onClick={() => openEdit(s)} className="text-xs text-violet-600 hover:underline">Edit</button>
              <button onClick={() => remove(s.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
            </div>

            {editingStep === s.id && (
              <StepForm
                form={form} setForm={setForm}
                fieldKeys={fieldKeys}
                onSave={save} onCancel={closeEdit}
                saving={saving} isNew={false}
                condRows={form.conditions}
                addCondRow={addCondRow}
                removeCondRow={removeCondRow}
                updateCondRow={updateCondRow}
              />
            )}
          </div>
        ))}

        {editingStep === 'new' && (
          <StepForm
            form={form} setForm={setForm}
            fieldKeys={fieldKeys}
            onSave={save} onCancel={closeEdit}
            saving={saving} isNew={true}
            condRows={form.conditions}
            addCondRow={addCondRow}
            removeCondRow={removeCondRow}
            updateCondRow={updateCondRow}
          />
        )}
      </div>
    </div>
  )
}

function StepForm({ form, setForm, fieldKeys, onSave, onCancel, saving, isNew, condRows, addCondRow, removeCondRow, updateCondRow }) {
  return (
    <div className="rounded-xl border border-violet-300 bg-violet-50 p-4 mt-1 space-y-4">
      <Field label="Title">
        <input className={inputCls} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
      </Field>

      <Field label="System">
        <div className="flex gap-2 flex-wrap">
          {SYSTEMS.map(sys => (
            <button
              key={sys}
              type="button"
              onClick={() => setForm(f => ({ ...f, system: sys }))}
              className={`px-3 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                form.system === sys
                  ? 'border-violet-600 bg-violet-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-violet-300'
              }`}
            >
              {sys}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Instructions">
        <RichTextEditor
          value={form.body}
          onChange={body => setForm(f => ({ ...f, body }))}
          placeholder="Write step instructions for the adviser…"
        />
      </Field>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Conditions</span>
          <span className="text-xs text-gray-400">Step shows if ALL conditions match (leave empty = always show)</span>
        </div>
        {condRows.length === 0 && (
          <p className="text-xs text-gray-400 mb-2">No conditions — step always shows.</p>
        )}
        <div className="space-y-2">
          {condRows.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs bg-white focus:border-violet-500 focus:outline-none"
                value={row.key}
                onChange={e => updateCondRow(idx, { key: e.target.value })}
              >
                <option value="">Field…</option>
                {fieldKeys.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <select
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs bg-white focus:border-violet-500 focus:outline-none"
                value={row.matchType}
                onChange={e => updateCondRow(idx, { matchType: e.target.value })}
              >
                <option value="equals">equals</option>
                <option value="oneOf">is one of</option>
              </select>
              <input
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs flex-1 focus:border-violet-500 focus:outline-none"
                placeholder={row.matchType === 'oneOf' ? 'Value1, Value2' : 'Value'}
                value={row.value}
                onChange={e => updateCondRow(idx, { value: e.target.value })}
              />
              <button onClick={() => removeCondRow(idx)} className="text-red-400 hover:text-red-600 text-sm font-bold">×</button>
            </div>
          ))}
        </div>
        <button onClick={addCondRow} className="mt-2 text-xs text-violet-600 hover:underline font-medium">+ Add condition</button>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox" id="required-check"
          checked={form.required}
          onChange={e => setForm(f => ({ ...f, required: e.target.checked }))}
          className="h-4 w-4 rounded border-gray-300 text-violet-600"
        />
        <label htmlFor="required-check" className="text-sm font-medium text-gray-700 cursor-pointer">
          Required step — adviser must complete before continuing
        </label>
      </div>

      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving || !form.title} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors">
          {saving ? 'Saving…' : isNew ? 'Add step' : 'Save step'}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:border-gray-300">Cancel</button>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {hint && <span className="ml-1 text-xs text-gray-400 font-normal">— {hint}</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500'
