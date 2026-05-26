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
  const [caseRef, setCaseRef] = useState('')
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
      const { id } = await api.createCase({ playbook_id: playbook.id, case_ref: caseRef, intake_data: values })
      navigate(`/play/${slug}/run?case=${id}`)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-csl-gray3 text-sm">Loading…</div>
  if (error) return <div className="p-8 text-red-600 text-sm">{error}</div>

  const fields = playbook.fields || []
  const allFilled = caseRef.trim() !== '' && fields.every(f => {
    if (f.type === 'boolean') return true
    return (values[f.field_key] || '').trim() !== ''
  })

  const inputCls = 'w-full rounded border border-csl-gray2 bg-white px-3 py-2 text-sm focus:border-csl-red focus:outline-none focus:ring-1 focus:ring-csl-red'

  return (
    <div className="max-w-xl mx-auto px-5 py-10">
      <div className="mb-6">
        <div className="text-xs font-semibold text-csl-gray3 uppercase tracking-widest mb-2">New Case</div>
        <h1 className="text-2xl font-bold text-csl-black">{playbook.name}</h1>
        {playbook.description && (
          <p className="text-csl-gray3 text-sm mt-1 font-light">{playbook.description}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded border border-csl-gray2 p-6 space-y-5">
        {/* Case reference — always first */}
        <div>
          <label className="block text-sm font-semibold text-csl-black mb-1">
            Case Reference Number
          </label>
          <input
            type="text"
            value={caseRef}
            onChange={e => setCaseRef(e.target.value)}
            placeholder="e.g. INC0012345"
            className={inputCls}
            required
            autoFocus
          />
          <p className="text-xs text-csl-gray3 mt-1 font-light">The ServiceNow or AskHR case number for this case.</p>
        </div>

        {fields.length > 0 && <hr className="border-csl-gray2" />}

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
            className="px-4 py-2 text-sm font-semibold text-csl-black hover:text-csl-red rounded border border-csl-gray2 hover:border-csl-red transition-colors"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={saving || !allFilled}
            className="flex-1 px-4 py-2 text-sm font-bold rounded bg-csl-red text-white hover:bg-csl-red-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Starting…' : 'Start Case →'}
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
    <label className="block text-sm font-semibold text-csl-black mb-1">
      {field.label}
    </label>
  )

  const inputCls = 'w-full rounded border border-csl-gray2 bg-white px-3 py-2 text-sm focus:border-csl-red focus:outline-none focus:ring-1 focus:ring-csl-red'

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
          className="h-4 w-4 rounded border-csl-gray2 text-csl-red focus:ring-csl-red accent-csl-red"
        />
        <label htmlFor={field.field_key} className="text-sm font-semibold text-csl-black cursor-pointer">
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
