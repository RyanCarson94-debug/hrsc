import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { apiFetch } from './api'

interface AuthUser {
  id: string
  email: string
  name: string | null
  preferredSessionMins: number
}

interface AuthCtx {
  user: AuthUser | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string) => Promise<void>
  logout: () => void
}

const Context = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('ff_token'))
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem('ff_user')
    try { return raw ? JSON.parse(raw) : null } catch { return null }
  })
  const [loading, setLoading] = useState(false)

  async function login(email: string, password: string) {
    setLoading(true)
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Sign in failed')
      persist(data.token, data.user)
    } finally {
      setLoading(false)
    }
  }

  async function register(email: string, password: string, name?: string) {
    setLoading(true)
    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Registration failed')
      // Auto sign in
      await login(email, password)
    } finally {
      setLoading(false)
    }
  }

  function persist(tok: string, u: AuthUser) {
    localStorage.setItem('ff_token', tok)
    localStorage.setItem('ff_user', JSON.stringify(u))
    setToken(tok)
    setUser(u)
  }

  function logout() {
    apiFetch('/auth/logout', { method: 'POST' }).catch(() => {})
    localStorage.removeItem('ff_token')
    localStorage.removeItem('ff_user')
    setToken(null)
    setUser(null)
  }

  return (
    <Context.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </Context.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(Context)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
