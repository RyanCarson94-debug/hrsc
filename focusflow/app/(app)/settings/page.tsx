'use client'

import { useState, useEffect } from 'react'
import { signOut } from 'next-auth/react'

interface UserSettings {
  id: string
  email: string
  name: string | null
  notificationsEnabled: boolean
  preferredSessionMins: number
}

const SESSION_OPTIONS = [5, 10, 15, 20, 25, 30, 45, 60]

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission>('default')

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then(setSettings)
      .finally(() => setLoading(false))

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationStatus(Notification.permission)
    }
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!settings) return
    setSaving(true)
    setSaved(false)

    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: settings.name,
        notificationsEnabled: settings.notificationsEnabled,
        preferredSessionMins: settings.preferredSessionMins,
      }),
    })

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function requestNotifications() {
    if (typeof window === 'undefined' || !('Notification' in window)) return

    const perm = await Notification.requestPermission()
    setNotificationStatus(perm)

    if (perm === 'granted' && settings) {
      setSettings({ ...settings, notificationsEnabled: true })
    }
  }

  if (loading) {
    return (
      <div className="page-container animate-pulse">
        <div className="h-6 bg-gray-100 rounded w-24 mb-8" />
        <div className="card p-6 space-y-4">
          <div className="h-4 bg-gray-100 rounded w-20" />
          <div className="h-10 bg-gray-100 rounded" />
        </div>
      </div>
    )
  }

  if (!settings) return null

  return (
    <div className="page-container">
      <h1 className="text-2xl font-semibold text-text mb-8">Settings</h1>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Profile */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-text">Profile</h2>

          <div>
            <label className="label">Name</label>
            <input
              type="text"
              className="input"
              placeholder="Your name"
              value={settings.name ?? ''}
              onChange={(e) => setSettings({ ...settings, name: e.target.value || null })}
            />
          </div>

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input bg-gray-50"
              value={settings.email}
              disabled
              readOnly
            />
            <p className="text-xs text-text-subtle mt-1">Email cannot be changed.</p>
          </div>
        </div>

        {/* Focus sessions */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-4">Focus sessions</h2>

          <div>
            <label className="label">Default session length</label>
            <div className="flex flex-wrap gap-2">
              {SESSION_OPTIONS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setSettings({ ...settings, preferredSessionMins: mins })}
                  className={`px-3 py-1.5 rounded border text-sm font-medium transition-all ${
                    settings.preferredSessionMins === mins
                      ? 'bg-primary border-primary text-white'
                      : 'bg-white border-border text-text-muted hover:border-primary/40 hover:text-text'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
            <p className="text-xs text-text-subtle mt-2">
              Used as the default when starting a session.
            </p>
          </div>
        </div>

        {/* Notifications */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-4">Notifications</h2>

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-text font-medium">Browser notifications</p>
              <p className="text-sm text-text-muted mt-0.5">
                Get nudged when a session ends or when you planned to start.
              </p>

              {notificationStatus === 'denied' && (
                <p className="text-xs text-text-muted mt-2 bg-gray-50 px-3 py-2 rounded">
                  Notifications are blocked by your browser. Check your browser settings to enable them.
                </p>
              )}
            </div>

            {notificationStatus === 'granted' ? (
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-sm text-success font-medium">Enabled</span>
              </div>
            ) : notificationStatus === 'denied' ? (
              <span className="text-sm text-text-muted flex-shrink-0">Blocked</span>
            ) : (
              <button
                type="button"
                onClick={requestNotifications}
                className="btn-secondary text-sm flex-shrink-0"
              >
                Enable
              </button>
            )}
          </div>

          {notificationStatus === 'granted' && (
            <div className="mt-4 flex items-center justify-between">
              <label className="text-sm text-text" htmlFor="notif-toggle">
                Enable nudges
              </label>
              <button
                id="notif-toggle"
                type="button"
                role="switch"
                aria-checked={settings.notificationsEnabled}
                onClick={() => setSettings({ ...settings, notificationsEnabled: !settings.notificationsEnabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.notificationsEnabled ? 'bg-primary' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  settings.notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          )}
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
          {saved && (
            <span className="text-success text-sm flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Saved
            </span>
          )}
        </div>
      </form>

      {/* Sign out */}
      <div className="mt-8 pt-6 border-t border-border">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-sm text-text-muted hover:text-danger transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
