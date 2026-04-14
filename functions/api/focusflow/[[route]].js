/**
 * FocusFlow — Cloudflare Pages Function
 * Handles all routes under /api/focusflow/*
 *
 * Auth: session tokens in D1 (no external deps)
 * Passwords: PBKDF2 via Web Crypto API
 * Database: D1 (env.FOCUSFLOW_DB)
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

function uuid() {
  return crypto.randomUUID()
}

function nowISO() {
  return new Date().toISOString()
}

function expiresISO(days = 30) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

// ─── Password hashing (PBKDF2, Web Crypto) ───────────────────────────────────

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  const hex = (arr) => [...arr].map(b => b.toString(16).padStart(2, '0')).join('')
  return `pbkdf2:${hex(salt)}:${hex(new Uint8Array(bits))}`
}

async function verifyPassword(password, stored) {
  const [, saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)))
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  const newHash = [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('')
  return newHash === hashHex
}

function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── Session validation ───────────────────────────────────────────────────────

async function validateSession(request, env) {
  const auth = request.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  const token = auth.slice(7).trim()
  if (!token) return null

  const row = await env.FOCUSFLOW_DB.prepare(`
    SELECT s.user_id, u.email, u.name, u.preferred_session_mins, u.notifications_enabled
    FROM focusflow_sessions s
    JOIN focusflow_users u ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > datetime('now')
  `).bind(token).first()

  if (!row) return null
  return { id: row.user_id, email: row.email, name: row.name, preferredSessionMins: row.preferred_session_mins }
}

// ─── Task helper — fetch with steps ──────────────────────────────────────────

async function fetchTaskWithSteps(env, taskId, userId) {
  const task = await env.FOCUSFLOW_DB.prepare(
    'SELECT * FROM focusflow_tasks WHERE id = ? AND user_id = ?'
  ).bind(taskId, userId).first()
  if (!task) return null
  const { results: steps } = await env.FOCUSFLOW_DB.prepare(
    'SELECT * FROM focusflow_task_steps WHERE task_id = ? ORDER BY sort_order ASC'
  ).bind(taskId).all()
  return { ...task, steps }
}

// ─── ICS generation ───────────────────────────────────────────────────────────

function toICSDate(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-')
  const [h, min] = timeStr.split(':')
  return `${y}${m}${d}T${h}${min}00`
}

function escICS(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function buildICS(blocks) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const events = blocks.map(b => [
    'BEGIN:VEVENT',
    `UID:focusflow-${b.id}@focusflow`,
    `DTSTAMP:${stamp}Z`,
    `DTSTART:${toICSDate(b.date, b.start_time)}`,
    `DTEND:${toICSDate(b.date, b.end_time)}`,
    `SUMMARY:${escICS(b.title)}`,
    'END:VEVENT',
  ].join('\r\n')).join('\r\n')

  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FocusFlow//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', events, 'END:VCALENDAR'].join('\r\n')
}

// ─── Insights ─────────────────────────────────────────────────────────────────

function computeInsights(sessions) {
  const completed = sessions.filter(s => s.status === 'COMPLETED')
  if (completed.length === 0) return []

  const insights = []

  // Best time of day
  const hourCounts = {}
  for (const s of completed) {
    const h = new Date(s.started_at).getHours()
    hourCounts[h] = (hourCounts[h] || 0) + 1
  }
  const bestEntry = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]
  if (bestEntry) {
    const h = Number(bestEntry[0])
    const label = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
    const timeStr = new Date(0, 0, 0, h).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
    insights.push({ id: 'best-time', text: `You complete most sessions in the ${label}`, detail: `Around ${timeStr} is when you tend to get things done.` })
  }

  // Optimal session length
  const durations = completed.filter(s => s.duration_mins).map(s => s.duration_mins)
  if (durations.length >= 3) {
    const sorted = [...durations].sort((a, b) => a - b)
    const med = Math.round(sorted[Math.floor(sorted.length / 2)])
    insights.push({ id: 'session-length', text: `Your sweet spot is around ${med}-minute sessions`, detail: `Sessions in this range have the highest completion rate for you.` })
  }

  // Most completed effort level
  const effortCounts = {}
  for (const s of completed) {
    effortCounts[s.effort] = (effortCounts[s.effort] || 0) + 1
  }
  const topEffort = Object.entries(effortCounts).sort((a, b) => b[1] - a[1])[0]
  if (topEffort) {
    const label = topEffort[0].charAt(0) + topEffort[0].slice(1).toLowerCase()
    insights.push({ id: 'effort-level', text: `You complete ${label}-effort tasks most often`, detail: `Starting your day with one of these helps build momentum.` })
  }

  // Resistance
  const resisted = sessions.filter(s => s.resistance_count >= 2)
  if (resisted.length > 0) {
    const count = new Set(resisted.map(s => s.task_id)).size
    insights.push({ id: 'resistance', text: `${count} task${count > 1 ? 's are' : ' is'} showing signs of avoidance`, detail: `Try a 5-minute start to break through the resistance.` })
  }

  // Completion rate
  if (sessions.length >= 5) {
    const rate = Math.round((completed.length / sessions.length) * 100)
    insights.push({ id: 'completion-rate', text: `You complete ${rate}% of sessions you start`, detail: rate >= 70 ? `That's strong — keep sessions comfortable to maintain it.` : `Shorter sessions may help you build momentum.` })
  }

  return insights.slice(0, 5)
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleRegister(request, env) {
  const { email, password, name } = await request.json()
  if (!email || !password) return json({ error: 'Email and password are required' }, 400)
  if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400)

  const lower = email.toLowerCase().trim()
  const existing = await env.FOCUSFLOW_DB.prepare('SELECT id FROM focusflow_users WHERE email = ?').bind(lower).first()
  if (existing) return json({ error: 'An account with this email already exists' }, 409)

  const passwordHash = await hashPassword(password)
  const id = uuid()
  await env.FOCUSFLOW_DB.prepare(
    'INSERT INTO focusflow_users (id, email, password_hash, name) VALUES (?, ?, ?, ?)'
  ).bind(id, lower, passwordHash, name?.trim() || null).run()

  return json({ id, email: lower }, 201)
}

async function handleLogin(request, env) {
  const { email, password } = await request.json()
  if (!email || !password) return json({ error: 'Email and password are required' }, 400)

  const user = await env.FOCUSFLOW_DB.prepare('SELECT * FROM focusflow_users WHERE email = ?').bind(email.toLowerCase().trim()).first()
  if (!user) return json({ error: 'Invalid email or password' }, 401)

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) return json({ error: 'Invalid email or password' }, 401)

  const token = generateToken()
  const expiresAt = expiresISO(30)
  await env.FOCUSFLOW_DB.prepare(
    'INSERT INTO focusflow_sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(token, user.id, expiresAt).run()

  return json({ token, user: { id: user.id, email: user.email, name: user.name, preferredSessionMins: user.preferred_session_mins } })
}

async function handleLogout(request, env) {
  const auth = request.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (token) await env.FOCUSFLOW_DB.prepare('DELETE FROM focusflow_sessions WHERE id = ?').bind(token).run()
  return json({ ok: true })
}

async function getTasks(request, env, user) {
  const url = new URL(request.url)
  const bucket = url.searchParams.get('bucket')
  const status = url.searchParams.get('status') || 'ACTIVE'

  let query = 'SELECT * FROM focusflow_tasks WHERE user_id = ? AND status = ?'
  const binds = [user.id, status]
  if (bucket) { query += ' AND bucket = ?'; binds.push(bucket) }
  query += ' ORDER BY CASE bucket WHEN "NOW" THEN 0 WHEN "SOON" THEN 1 ELSE 2 END, created_at ASC'

  const { results: tasks } = await env.FOCUSFLOW_DB.prepare(query).bind(...binds).all()

  const taskIds = tasks.map(t => t.id)
  if (taskIds.length === 0) return json([])

  const placeholders = taskIds.map(() => '?').join(',')
  const { results: steps } = await env.FOCUSFLOW_DB.prepare(
    `SELECT * FROM focusflow_task_steps WHERE task_id IN (${placeholders}) ORDER BY sort_order ASC`
  ).bind(...taskIds).all()

  const stepsByTask = {}
  for (const s of steps) {
    if (!stepsByTask[s.task_id]) stepsByTask[s.task_id] = []
    stepsByTask[s.task_id].push(s)
  }

  return json(tasks.map(t => ({ ...t, steps: stepsByTask[t.id] || [] })))
}

async function createTask(request, env, user) {
  const body = await request.json()
  const { title, description, bucket = 'SOON', effort = 'MEDIUM', duration_mins = 25, steps = [] } = body
  if (!title?.trim()) return json({ error: 'Title is required' }, 400)

  if (bucket === 'NOW') {
    const { results } = await env.FOCUSFLOW_DB.prepare(
      "SELECT COUNT(*) as cnt FROM focusflow_tasks WHERE user_id = ? AND bucket = 'NOW' AND status = 'ACTIVE'"
    ).bind(user.id).all()
    if (results[0]?.cnt >= 3) return json({ error: 'You already have 3 tasks in Now. Move one to Soon or Later first.' }, 422)
  }

  const id = uuid()
  const now = nowISO()
  await env.FOCUSFLOW_DB.prepare(`
    INSERT INTO focusflow_tasks (id, user_id, title, description, bucket, effort, duration_mins, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, user.id, title.trim(), description?.trim() || null, bucket, effort, duration_mins, now, now).run()

  if (steps.length > 0) {
    const stmts = steps.filter(s => s.title?.trim()).map((s, i) =>
      env.FOCUSFLOW_DB.prepare('INSERT INTO focusflow_task_steps (id, task_id, title, sort_order) VALUES (?, ?, ?, ?)')
        .bind(uuid(), id, s.title.trim(), i)
    )
    if (stmts.length) await env.FOCUSFLOW_DB.batch(stmts)
  }

  const task = await fetchTaskWithSteps(env, id, user.id)
  return json(task, 201)
}

async function getTask(request, env, user, taskId) {
  const task = await fetchTaskWithSteps(env, taskId, user.id)
  if (!task) return json({ error: 'Not found' }, 404)
  return json(task)
}

async function updateTask(request, env, user, taskId) {
  const existing = await env.FOCUSFLOW_DB.prepare(
    'SELECT * FROM focusflow_tasks WHERE id = ? AND user_id = ?'
  ).bind(taskId, user.id).first()
  if (!existing) return json({ error: 'Not found' }, 404)

  const body = await request.json()
  const { title, description, bucket, effort, duration_mins, status } = body

  if (bucket === 'NOW' && existing.bucket !== 'NOW') {
    const { results } = await env.FOCUSFLOW_DB.prepare(
      "SELECT COUNT(*) as cnt FROM focusflow_tasks WHERE user_id = ? AND bucket = 'NOW' AND status = 'ACTIVE'"
    ).bind(user.id).all()
    if (results[0]?.cnt >= 3) return json({ error: 'You already have 3 tasks in Now.' }, 422)
  }

  const movingFromNow = existing.bucket === 'NOW' && bucket && bucket !== 'NOW'
  const fields = []
  const vals = []

  if (title !== undefined) { fields.push('title = ?'); vals.push(title.trim()) }
  if (description !== undefined) { fields.push('description = ?'); vals.push(description?.trim() || null) }
  if (bucket !== undefined) { fields.push('bucket = ?'); vals.push(bucket) }
  if (effort !== undefined) { fields.push('effort = ?'); vals.push(effort) }
  if (duration_mins !== undefined) { fields.push('duration_mins = ?'); vals.push(duration_mins) }
  if (status !== undefined) { fields.push('status = ?'); vals.push(status) }
  if (movingFromNow) { fields.push('resistance_count = resistance_count + 1') }
  fields.push('updated_at = ?'); vals.push(nowISO())

  await env.FOCUSFLOW_DB.prepare(
    `UPDATE focusflow_tasks SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`
  ).bind(...vals, taskId, user.id).run()

  const task = await fetchTaskWithSteps(env, taskId, user.id)
  return json(task)
}

async function deleteTask(request, env, user, taskId) {
  const existing = await env.FOCUSFLOW_DB.prepare('SELECT id FROM focusflow_tasks WHERE id = ? AND user_id = ?').bind(taskId, user.id).first()
  if (!existing) return json({ error: 'Not found' }, 404)
  await env.FOCUSFLOW_DB.prepare('DELETE FROM focusflow_tasks WHERE id = ?').bind(taskId).run()
  return json({ ok: true })
}

async function replaceSteps(request, env, user, taskId) {
  const task = await env.FOCUSFLOW_DB.prepare('SELECT id FROM focusflow_tasks WHERE id = ? AND user_id = ?').bind(taskId, user.id).first()
  if (!task) return json({ error: 'Not found' }, 404)

  const { steps = [] } = await request.json()
  await env.FOCUSFLOW_DB.prepare('DELETE FROM focusflow_task_steps WHERE task_id = ?').bind(taskId).run()

  const valid = steps.filter(s => s.title?.trim())
  if (valid.length > 0) {
    const stmts = valid.map((s, i) =>
      env.FOCUSFLOW_DB.prepare('INSERT INTO focusflow_task_steps (id, task_id, title, sort_order, completed) VALUES (?, ?, ?, ?, ?)')
        .bind(uuid(), taskId, s.title.trim(), i, s.completed ? 1 : 0)
    )
    await env.FOCUSFLOW_DB.batch(stmts)
  }

  const updated = await fetchTaskWithSteps(env, taskId, user.id)
  return json(updated)
}

async function toggleStep(request, env, user, taskId) {
  const task = await env.FOCUSFLOW_DB.prepare('SELECT id FROM focusflow_tasks WHERE id = ? AND user_id = ?').bind(taskId, user.id).first()
  if (!task) return json({ error: 'Not found' }, 404)

  const { stepId, completed } = await request.json()
  await env.FOCUSFLOW_DB.prepare('UPDATE focusflow_task_steps SET completed = ? WHERE id = ? AND task_id = ?')
    .bind(completed ? 1 : 0, stepId, taskId).run()

  const step = await env.FOCUSFLOW_DB.prepare('SELECT * FROM focusflow_task_steps WHERE id = ?').bind(stepId).first()
  return json(step)
}

async function getActiveSession(request, env, user) {
  const session = await env.FOCUSFLOW_DB.prepare(
    "SELECT * FROM focusflow_focus_sessions WHERE user_id = ? AND status = 'ACTIVE' ORDER BY started_at DESC LIMIT 1"
  ).bind(user.id).first()
  if (!session) return json(null)

  const task = await fetchTaskWithSteps(env, session.task_id, user.id)
  return json({ ...session, task })
}

async function startSession(request, env, user) {
  const { taskId } = await request.json()
  if (!taskId) return json({ error: 'taskId required' }, 400)

  const task = await env.FOCUSFLOW_DB.prepare('SELECT id FROM focusflow_tasks WHERE id = ? AND user_id = ?').bind(taskId, user.id).first()
  if (!task) return json({ error: 'Task not found' }, 404)

  // Abandon existing active sessions
  await env.FOCUSFLOW_DB.prepare(
    "UPDATE focusflow_focus_sessions SET status = 'ABANDONED', ended_at = ? WHERE user_id = ? AND status = 'ACTIVE'"
  ).bind(nowISO(), user.id).run()

  const id = uuid()
  await env.FOCUSFLOW_DB.prepare(
    'INSERT INTO focusflow_focus_sessions (id, user_id, task_id) VALUES (?, ?, ?)'
  ).bind(id, user.id, taskId).run()

  const created = await env.FOCUSFLOW_DB.prepare('SELECT * FROM focusflow_focus_sessions WHERE id = ?').bind(id).first()
  const fullTask = await fetchTaskWithSteps(env, taskId, user.id)
  return json({ ...created, task: fullTask }, 201)
}

async function updateSession(request, env, user, sessionId) {
  const session = await env.FOCUSFLOW_DB.prepare('SELECT * FROM focusflow_focus_sessions WHERE id = ? AND user_id = ?').bind(sessionId, user.id).first()
  if (!session) return json({ error: 'Not found' }, 404)

  const { status, duration_mins, steps_completed } = await request.json()
  const isEnding = status === 'COMPLETED' || status === 'ABANDONED'

  const fields = ['status = ?']
  const vals = [status]
  if (isEnding) { fields.push('ended_at = ?'); vals.push(nowISO()) }
  if (duration_mins !== undefined) { fields.push('duration_mins = ?'); vals.push(duration_mins) }
  if (steps_completed !== undefined) { fields.push('steps_completed = ?'); vals.push(steps_completed) }

  await env.FOCUSFLOW_DB.prepare(
    `UPDATE focusflow_focus_sessions SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...vals, sessionId).run()

  // Auto-complete task if all steps are done
  if (status === 'COMPLETED') {
    const { results: steps } = await env.FOCUSFLOW_DB.prepare(
      'SELECT completed FROM focusflow_task_steps WHERE task_id = ?'
    ).bind(session.task_id).all()
    if (steps.length === 0 || steps.every(s => s.completed)) {
      await env.FOCUSFLOW_DB.prepare("UPDATE focusflow_tasks SET status = 'COMPLETED', updated_at = ? WHERE id = ?")
        .bind(nowISO(), session.task_id).run()
    }
  }

  const updated = await env.FOCUSFLOW_DB.prepare('SELECT * FROM focusflow_focus_sessions WHERE id = ?').bind(sessionId).first()
  return json(updated)
}

async function captureDistraction(request, env, user) {
  const { sessionId, content } = await request.json()
  if (!sessionId || !content?.trim()) return json({ error: 'sessionId and content are required' }, 400)

  const session = await env.FOCUSFLOW_DB.prepare('SELECT id FROM focusflow_focus_sessions WHERE id = ? AND user_id = ?').bind(sessionId, user.id).first()
  if (!session) return json({ error: 'Session not found' }, 404)

  const id = uuid()
  await env.FOCUSFLOW_DB.prepare('INSERT INTO focusflow_distractions (id, session_id, user_id, content) VALUES (?, ?, ?, ?)')
    .bind(id, sessionId, user.id, content.trim()).run()

  return json({ id, sessionId, content: content.trim(), capturedAt: nowISO() }, 201)
}

async function getDistractions(request, env, user) {
  const url = new URL(request.url)
  const sessionId = url.searchParams.get('sessionId')
  if (!sessionId) return json({ error: 'sessionId required' }, 400)

  const session = await env.FOCUSFLOW_DB.prepare(
    'SELECT id FROM focusflow_focus_sessions WHERE id = ? AND user_id = ?'
  ).bind(sessionId, user.id).first()
  if (!session) return json({ error: 'Not found' }, 404)

  const { results } = await env.FOCUSFLOW_DB.prepare(
    'SELECT * FROM focusflow_distractions WHERE session_id = ? ORDER BY captured_at ASC'
  ).bind(sessionId).all()
  return json(results)
}

async function getInsights(request, env, user) {
  const { results: sessions } = await env.FOCUSFLOW_DB.prepare(`
    SELECT fs.*, ft.effort, ft.resistance_count, ft.id as task_id
    FROM focusflow_focus_sessions fs
    JOIN focusflow_tasks ft ON fs.task_id = ft.id
    WHERE fs.user_id = ?
    ORDER BY fs.started_at DESC
    LIMIT 100
  `).bind(user.id).all()

  return json(computeInsights(sessions))
}

async function getBlocks(request, env, user) {
  const url = new URL(request.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  let query = `
    SELECT b.*, t.title as task_title, t.duration_mins as task_duration_mins
    FROM focusflow_scheduled_blocks b
    LEFT JOIN focusflow_tasks t ON b.task_id = t.id
    WHERE b.user_id = ?
  `
  const binds = [user.id]
  if (from) { query += ' AND b.date >= ?'; binds.push(from) }
  if (to) { query += ' AND b.date <= ?'; binds.push(to) }
  query += ' ORDER BY b.date ASC, b.start_time ASC'

  const { results } = await env.FOCUSFLOW_DB.prepare(query).bind(...binds).all()
  return json(results.map(b => ({
    ...b,
    task: b.task_id ? { id: b.task_id, title: b.task_title, duration_mins: b.task_duration_mins } : null
  })))
}

async function createBlock(request, env, user) {
  const { title, date, start_time, end_time, task_id } = await request.json()
  if (!title?.trim() || !date || !start_time || !end_time) return json({ error: 'title, date, start_time, end_time are required' }, 400)

  const id = uuid()
  await env.FOCUSFLOW_DB.prepare(
    'INSERT INTO focusflow_scheduled_blocks (id, user_id, task_id, title, date, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, user.id, task_id || null, title.trim(), date, start_time, end_time).run()

  const block = await env.FOCUSFLOW_DB.prepare('SELECT * FROM focusflow_scheduled_blocks WHERE id = ?').bind(id).first()
  return json({ ...block, task: null }, 201)
}

async function deleteBlock(request, env, user) {
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id) return json({ error: 'id required' }, 400)
  const block = await env.FOCUSFLOW_DB.prepare('SELECT id FROM focusflow_scheduled_blocks WHERE id = ? AND user_id = ?').bind(id, user.id).first()
  if (!block) return json({ error: 'Not found' }, 404)
  await env.FOCUSFLOW_DB.prepare('DELETE FROM focusflow_scheduled_blocks WHERE id = ?').bind(id).run()
  return json({ ok: true })
}

async function exportICS(request, env, user) {
  const url = new URL(request.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  let query = 'SELECT * FROM focusflow_scheduled_blocks WHERE user_id = ?'
  const binds = [user.id]
  if (from) { query += ' AND date >= ?'; binds.push(from) }
  if (to) { query += ' AND date <= ?'; binds.push(to) }
  query += ' ORDER BY date ASC, start_time ASC'

  const { results } = await env.FOCUSFLOW_DB.prepare(query).bind(...binds).all()
  const ics = buildICS(results)

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="focusflow-schedule.ics"',
      ...corsHeaders(),
    },
  })
}

async function getSettings(request, env, user) {
  const row = await env.FOCUSFLOW_DB.prepare(
    'SELECT id, email, name, notifications_enabled, preferred_session_mins FROM focusflow_users WHERE id = ?'
  ).bind(user.id).first()
  return json(row)
}

async function updateSettings(request, env, user) {
  const { name, notifications_enabled, preferred_session_mins } = await request.json()
  const fields = []
  const vals = []
  if (name !== undefined) { fields.push('name = ?'); vals.push(name?.trim() || null) }
  if (notifications_enabled !== undefined) { fields.push('notifications_enabled = ?'); vals.push(notifications_enabled ? 1 : 0) }
  if (preferred_session_mins !== undefined) { fields.push('preferred_session_mins = ?'); vals.push(Number(preferred_session_mins)) }
  if (fields.length === 0) return json({ error: 'Nothing to update' }, 400)

  await env.FOCUSFLOW_DB.prepare(`UPDATE focusflow_users SET ${fields.join(', ')} WHERE id = ?`).bind(...vals, user.id).run()
  const row = await env.FOCUSFLOW_DB.prepare('SELECT id, email, name, notifications_enabled, preferred_session_mins FROM focusflow_users WHERE id = ?').bind(user.id).first()
  return json(row)
}

// ─── Router ───────────────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { params, env, request } = context
  const route = params.route
  const segments = Array.isArray(route) ? route : (route ? [route] : [])
  const path = '/' + segments.join('/')
  const method = request.method.toUpperCase()

  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() })

  try {
    // Public auth routes
    if (path === '/auth/register' && method === 'POST') return handleRegister(request, env)
    if (path === '/auth/login' && method === 'POST') return handleLogin(request, env)

    // All other routes require a valid session
    const user = await validateSession(request, env)
    if (!user) return json({ error: 'Unauthorized' }, 401)

    if (path === '/auth/logout' && method === 'POST') return handleLogout(request, env)

    // Tasks
    if (path === '/tasks') {
      if (method === 'GET') return getTasks(request, env, user)
      if (method === 'POST') return createTask(request, env, user)
    }
    if (segments[0] === 'tasks' && segments.length === 2) {
      const id = segments[1]
      if (method === 'GET') return getTask(request, env, user, id)
      if (method === 'PUT') return updateTask(request, env, user, id)
      if (method === 'DELETE') return deleteTask(request, env, user, id)
    }
    if (segments[0] === 'tasks' && segments[2] === 'steps') {
      const id = segments[1]
      if (method === 'PUT') return replaceSteps(request, env, user, id)
      if (method === 'PATCH') return toggleStep(request, env, user, id)
    }

    // Focus sessions
    if (path === '/focus') {
      if (method === 'GET') return getActiveSession(request, env, user)
      if (method === 'POST') return startSession(request, env, user)
    }
    if (segments[0] === 'focus' && segments.length === 2) {
      if (method === 'PUT') return updateSession(request, env, user, segments[1])
    }

    // Distractions
    if (path === '/distractions') {
      if (method === 'POST') return captureDistraction(request, env, user)
      if (method === 'GET') return getDistractions(request, env, user)
    }

    // Insights
    if (path === '/insights' && method === 'GET') return getInsights(request, env, user)

    // Capacity / scheduled blocks
    if (path === '/capacity') {
      if (method === 'GET') return getBlocks(request, env, user)
      if (method === 'POST') return createBlock(request, env, user)
      if (method === 'DELETE') return deleteBlock(request, env, user)
    }

    // ICS export
    if (path === '/export/ics' && method === 'GET') return exportICS(request, env, user)

    // Settings
    if (path === '/settings') {
      if (method === 'GET') return getSettings(request, env, user)
      if (method === 'PUT') return updateSettings(request, env, user)
    }

    return json({ error: 'Not found' }, 404)
  } catch (err) {
    console.error('[FocusFlow API]', err)
    return json({ error: 'Internal server error' }, 500)
  }
}
