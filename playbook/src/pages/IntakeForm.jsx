import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api.js'

export function IntakeForm() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [playbook, setPlaybook] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [values, setValues] = useState({})

  useEffect(() => {
    api.listPlaybooks().then(pbs => {
      const pb = pbs.find(p => p.slug === slug)
      if (!pb) { setError('Playbook not found'); setLoading(false); return }
      api.getPlaybook(pb.id).then(full => {
        setPlaybook(full)
        const defaults = {}
        for (const f of full.fields || []) {
          if (f.type === 'boolean') defaults[f.field_key] = 'false'
          else defaults[f.field_key] = ''
        }
        setValues(defaults)
        setLoading(false)
      })
    }).catch(() => { setError('Failed to load playbook'); setLoading(false) })
  }, [slug])

  function handleChange(key, value) {
    setValues(v => ({ ...v, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { id } = await api.createCase({ playbook_id: playbook.id, intake_data: values })
      navigate(`/play/${slug}/run?case=${id}`)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-gray-500 text-sm">Loading…</div>
  if (error) return <div className="p-8 text-red-600 text-sm">{error}</div>

  const fields = playbook.fields || []
  const allFilled = fields.every(f => {
    if (f.type === 'boolean') return true
    return (values[f.field_key] || '').trim() !== ''
  })

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="mb-6">
        <div className="text-sm text-gray-400 mb-1">New case</div>
        <h1 className="text-2xl font-bold text-gray-900">{playbook.name}</h1>
        {playbook.description && (
          <p className="text-gray-500 text-sm mt-1">{playbook.description}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-violet-100 p-6 space-y-5 shadow-sm">
        <p className="text-sm text-gray-600 mb-4">
          Answer the questions below. Your answers determine which steps apply.
        </p>

        {fields.length === 0 && (
          <p className="text-sm text-gray-500 italic">This playbook has no intake questions. Click start to proceed.</p>
        )}

        {fields.map(field => (
          <FieldInput
            key={field.id}
            field={field}
            value={values[field.field_key] ?? ''}
            onChange={v => handleChange(field.field_key, v)}
          />
        ))}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="pt-2 flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg border border-gray-200 hover:border-gray-300"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={saving || !allFilled}
            className="flex-1 px-4 py-2 text-sm font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Starting…' : 'Start case →'}
          </button>
        </div>
      </form>
    </div>
  )
}

function FieldInput({ field, value, onChange }) {
  const options = (() => {
    try { return JSON.parse(field.options || '[]') } catch { return [] }
  })()

  const labelEl = (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {field.label}
    </label>
  )

  const inputCls = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500'

  if (field.type === 'select') {
    return (
      <div>
        {labelEl}
        <select value={value} onChange={e => onChange(e.target.value)} className={inputCls} required>
          <option value="">Select…</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    )
  }

  if (field.type === 'boolean') {
    return (
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id={field.field_key}
          checked={value === 'true'}
          onChange={e => onChange(e.target.checked ? 'true' : 'false')}
          className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
        />
        <label htmlFor={field.field_key} className="text-sm font-medium text-gray-700 cursor-pointer">
          {field.label}
        </label>
      </div>
    )
  }

  if (field.type === 'date') {
    return (
      <div>
        {labelEl}
        <input type="date" value={value} onChange={e => onChange(e.target.value)} className={inputCls} required />
      </div>
    )
  }

  return (
    <div>
      {labelEl}
      <input type="text" value={value} onChange={e => onChange(e.target.value)} className={inputCls} required />
    </div>
  )
}
