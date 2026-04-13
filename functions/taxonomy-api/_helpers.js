// ─── Shared helpers for taxonomy-api Pages Functions ─────────────────────────

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

export function uuid() {
  return crypto.randomUUID()
}

export function now() {
  return new Date().toISOString()
}

// ─── Circular reference check ─────────────────────────────────────────────────
// Returns true if nodeId appears anywhere in the ancestor chain of proposedParentId
export async function hasCircularRef(db, nodeId, proposedParentId) {
  if (!proposedParentId) return false
  if (proposedParentId === nodeId) return true
  let currentId = proposedParentId
  const visited = new Set()
  while (currentId) {
    if (visited.has(currentId)) return true // existing cycle
    visited.add(currentId)
    const row = await db.prepare(
      'SELECT parent_id FROM taxonomy_nodes WHERE id = ? AND is_deleted = 0'
    ).bind(currentId).first()
    if (!row) break
    if (row.parent_id === nodeId) return true
    currentId = row.parent_id
  }
  return false
}

// ─── Compute level by counting ancestors ─────────────────────────────────────
export async function computeLevel(db, parentId) {
  if (!parentId) return 0
  let level = 0
  let currentId = parentId
  const visited = new Set()
  while (currentId) {
    if (visited.has(currentId)) break
    visited.add(currentId)
    level++
    const row = await db.prepare(
      'SELECT parent_id FROM taxonomy_nodes WHERE id = ? AND is_deleted = 0'
    ).bind(currentId).first()
    if (!row) break
    currentId = row.parent_id
  }
  return level
}

// ─── Build full_path by walking ancestors ────────────────────────────────────
export async function computeFullPath(db, parentId, nodeName) {
  if (!parentId) return nodeName
  const parts = [nodeName]
  let currentId = parentId
  const visited = new Set()
  while (currentId) {
    if (visited.has(currentId)) break
    visited.add(currentId)
    const row = await db.prepare(
      'SELECT name, parent_id FROM taxonomy_nodes WHERE id = ? AND is_deleted = 0'
    ).bind(currentId).first()
    if (!row) break
    parts.unshift(row.name)
    currentId = row.parent_id
  }
  return parts.join(' > ')
}

// ─── Update all descendants' level and full_path after a reparent ─────────────
export async function updateDescendantPaths(db, nodeId) {
  const children = await db.prepare(
    'SELECT id, name FROM taxonomy_nodes WHERE parent_id = ? AND is_deleted = 0'
  ).bind(nodeId).all()
  if (!children.results.length) return
  const stmts = []
  for (const child of children.results) {
    const newPath = await computeFullPath(db, nodeId, child.name)
    const newLevel = await computeLevel(db, nodeId) + 1
    stmts.push(
      db.prepare(
        'UPDATE taxonomy_nodes SET full_path = ?, level = ?, updated_at = ? WHERE id = ?'
      ).bind(newPath, newLevel, now(), child.id)
    )
  }
  if (stmts.length) await db.batch(stmts)
  // Recurse
  for (const child of children.results) {
    await updateDescendantPaths(db, child.id)
  }
}

// ─── Write to change_log ──────────────────────────────────────────────────────
export async function logChange(db, opts) {
  const { frameworkId, nodeId, actionType, fieldChanged, oldValue, newValue, changeNote, changedBy } = opts
  await db.prepare(`
    INSERT INTO change_log (id, framework_id, node_id, action_type, field_changed, old_value, new_value, change_note, changed_by, changed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    uuid(), frameworkId, nodeId ?? null, actionType,
    fieldChanged ?? null, oldValue ? String(oldValue) : null,
    newValue ? String(newValue) : null,
    changeNote ?? null, changedBy ?? 'system', now()
  ).run()
}

// ─── Parse path segments from URL ────────────────────────────────────────────
export function parseRoute(url) {
  const path = new URL(url).pathname.replace(/^\/taxonomy-api\/?/, '')
  const segments = path.split('/').filter(Boolean)
  const qs = Object.fromEntries(new URL(url).searchParams)
  return { segments, qs }
}
