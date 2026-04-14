import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(email, password, name || undefined)
      navigate('/focusflow/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-light rounded-xl mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#5B6CF8"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-text">FocusFlow</h1>
          <p className="text-text-muted text-sm mt-1">Create your account</p>
        </div>
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="label">
                Name <span className="text-text-subtle font-normal">(optional)</span>
              </label>
              <input id="name" type="text" autoComplete="name" className="input" placeholder="Alex"
                value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input id="email" type="email" autoComplete="email" className="input" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="password" className="label">Password</label>
              <input id="password" type="password" autoComplete="new-password" className="input" placeholder="At least 8 characters"
                value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
            </div>
            {error && <p className="text-sm text-danger bg-red-50 px-3 py-2 rounded">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>
        <p className="text-center text-sm text-text-muted mt-4">
          Already have an account?{' '}
          <Link to="/focusflow/login" className="text-primary hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
