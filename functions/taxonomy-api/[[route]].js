/**
 * Cloudflare Pages Function — /functions/taxonomy-api/[[route]].js
 *
 * All HR Taxonomy Manager API routes at /taxonomy-api/*
 *
 * Requires D1 binding: TAXONOMY_DB
 * Run migration first: wrangler d1 execute taxonomy-db --file migrations/0001_taxonomy.sql
 */

import {
  CORS, json, uuid, now, hasCircularRef, computeLevel,
  computeFullPath, updateDescendantPaths, logChange, parseRoute,
} from './_helpers.js'
import { runValidation } from './_validation.js'
import { seedFramework } from './_seed.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const db = env.TAXONOMY_DB
  if (!db) return json({ error: 'TAXONOMY_DB D1 binding not configured. See wrangler.toml.' }, 503)

  const { segments, qs } = parseRoute(request.url)
  const method = request.method

  let body = null
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    try { body = await request.json() } catch { body = {} }
  }

  try {
    return await route(method, segments, qs, body, db)
  } catch (err) {
    console.error('[taxonomy-api]', err)
    return json({ error: err.message ?? 'Internal error' }, 500)
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

async function route(method, seg, qs, body, db) {
  const [s0, s1, s2, s3] = seg

  // GET /health
  if (method === 'GET' && s0 === 'health') {
    return json({ ok: true, timestamp: now() })
  }

  // POST /seed
  if (method === 'POST' && s0 === 'seed') {
    const result = await seedFramework(db)
    return json(result, 201)
  }

  // GET /dashboard
  if (method === 'GET' && s0 === 'dashboard') {
    return handleDashboard(db, qs.framework_id)
  }

  // ─── Frameworks ──────────────────────────────────────────────────────────
  if (s0 === 'frameworks') {
    if (!s1) {
      if (method === 'GET')  return listFrameworks(db)
      if (method === 'POST') return createFramework(db, body)
    }
    if (s1 && !s2) {
      if (method === 'GET')    return getFramework(db, s1)
      if (method === 'PUT')    return updateFramework(db, s1, body)
      if (method === 'DELETE') return deleteFramework(db, s1)
    }
    // /frameworks/:id/nodes
    if (s1 && s2 === 'nodes') {
      if (method === 'GET')  return listNodes(db, s1, qs)
      if (method === 'POST') return createNode(db, s1, body)
    }
    // /frameworks/:id/search
    if (s1 && s2 === 'search') return searchNodes(db, s1, qs)
    // /frameworks/:id/validate
    if (s1 && s2 === 'validate' && method === 'POST') {
      const issues = await runValidation(db, s1)
      return json(issues)
    }
    // /frameworks/:id/issues
    if (s1 && s2 === 'issues' && method === 'GET') return listIssues(db, s1, qs)
    // /frameworks/:id/changelog
    if (s1 && s2 === 'changelog' && method === 'GET') return getChangelog(db, s1, qs)
    // /frameworks/:id/snapshot  (create)
    if (s1 && s2 === 'snapshot' && method === 'POST') return createSnapshot(db, s1, body)
    // /frameworks/:id/snapshots (list)
    if (s1 && s2 === 'snapshots' && method === 'GET') return listSnapshots(db, s1)
    // /frameworks/:id/import
    if (s1 && s2 === 'import' && method === 'POST') return importNodes(db, s1, body)
    // /frameworks/:id/export
    if (s1 && s2 === 'export' && method === 'POST') return exportFramework(db, s1)
  }

  // ─── Nodes ───────────────────────────────────────────────────────────────
  if (s0 === 'nodes' && s1) {
    if (!s2) {
      if (method === 'GET')    return getNode(db, s1)
      if (method === 'PUT')    return updateNode(db, s1, body)
      if (method === 'DELETE') return deleteNode(db, s1)
    }
    if (s2 === 'move' && method === 'POST') return moveNode(db, s1, body)
  }

  // ─── Issues ──────────────────────────────────────────────────────────────
  if (s0 === 'issues' && s1 && s2 === 'resolve' && method === 'PUT') {
    return resolveIssue(db, s1)
  }

  // ─── Snapshots ───────────────────────────────────────────────────────────
  if (s0 === 'snapshots') {
    if (s1 === 'compare' && method === 'POST') return compareSnapshots(db, body)
    if (s1 && !s2) {
      if (method === 'GET') return getSnapshot(db, s1)
    }
    if (s1 && s2 === 'restore' && method === 'POST') return restoreSnapshot(db, s1, body)
  }

  // ─── Import / Export jobs ─────────────────────────────────────────────────
  if (s0 === 'import' && s1 === 'jobs') return listImportJobs(db, qs)
  if (s0 === 'export' && s1 === 'jobs') return listExportJobs(db, qs)

  return json({ error: `No route: ${method} /${seg.join('/')}` }, 404)
}

// ─── Framework handlers ───────────────────────────────────────────────────────

async function listFrameworks(db) {
  const { results } = await db.prepare(`
    SELECT f.*, COUNT(n.id) as node_count
    FROM frameworks f
    LEFT JOIN taxonomy_nodes n ON n.framework_id = f.id AND n.is_deleted = 0
    WHERE f.is_deleted = 0
    GROUP BY f.id
    ORDER BY f.updated_at DESC
  `).all()
  return json(results)
}

async function getFramework(db, id) {
  const fw = await db.prepare(
    'SELECT * FROM frameworks WHERE id = ? AND is_deleted = 0'
  ).bind(id).first()
  if (!fw) return json({ error: 'Framework not found' }, 404)
  const nc = await db.prepare(
    'SELECT COUNT(*) as c FROM taxonomy_nodes WHERE framework_id = ? AND is_deleted = 0'
  ).bind(id).first()
  const ic = await db.prepare(
    'SELECT COUNT(*) as c FROM validation_issues WHERE framework_id = ? AND is_resolved = 0'
  ).bind(id).first()
  return json({ ...fw, node_count: nc?.c ?? 0, issue_count: ic?.c ?? 0 })
}

async function createFramework(db, body) {
  const { name, description, framework_type, source_basis, version_label, status } = body
  if (!name) return json({ error: 'name is required' }, 400)
  const id = uuid(), ts = now()
  await db.prepare(`
    INSERT INTO frameworks (id, name, description, framework_type, source_basis, version_label, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, name, description ?? null, framework_type ?? 'hrsc_taxonomy',
    source_basis ?? 'APQC-style HRSC', version_label ?? '1.0',
    status ?? 'draft', ts, ts).run()
  await logChange(db, { frameworkId: id, nodeId: null, actionType: 'created', newValue: name, changedBy: body.changed_by ?? 'system' })
  return json(await db.prepare('SELECT * FROM frameworks WHERE id = ?').bind(id).first(), 201)
}

async function updateFramework(db, id, body) {
  const fw = await db.prepare('SELECT * FROM frameworks WHERE id = ? AND is_deleted = 0').bind(id).first()
  if (!fw) return json({ error: 'Framework not found' }, 404)
  const { name, description, framework_type, source_basis, version_label, status } = body
  await db.prepare(`
    UPDATE frameworks SET name=?, description=?, framework_type=?, source_basis=?, version_label=?, status=?, updated_at=? WHERE id=?
  `).bind(name ?? fw.name, description ?? fw.description, framework_type ?? fw.framework_type,
    source_basis ?? fw.source_basis, version_label ?? fw.version_label,
    status ?? fw.status, now(), id).run()
  await logChange(db, { frameworkId: id, nodeId: null, actionType: 'updated', changedBy: body.changed_by ?? 'system' })
  return json(await db.prepare('SELECT * FROM frameworks WHERE id = ?').bind(id).first())
}

async function deleteFramework(db, id) {
  const fw = await db.prepare('SELECT id, name FROM frameworks WHERE id = ? AND is_deleted = 0').bind(id).first()
  if (!fw) return json({ error: 'Framework not found' }, 404)
  await db.prepare('UPDATE frameworks SET is_deleted=1, updated_at=? WHERE id=?').bind(now(), id).run()
  await logChange(db, { frameworkId: id, nodeId: null, actionType: 'deleted', oldValue: fw.name, changedBy: 'system' })
  return json({ ok: true })
}

// ─── Node handlers ────────────────────────────────────────────────────────────

async function listNodes(db, frameworkId, qs) {
  const fw = await db.prepare('SELECT id FROM frameworks WHERE id = ? AND is_deleted = 0').bind(frameworkId).first()
  if (!fw) return json({ error: 'Framework not found' }, 404)
  const { results } = await db.prepare(`
    SELECT * FROM taxonomy_nodes
    WHERE framework_id = ? AND is_deleted = 0
    ORDER BY level, sort_order, name
  `).bind(frameworkId).all()
  return json(results)
}

async function getNode(db, id) {
  const node = await db.prepare('SELECT * FROM taxonomy_nodes WHERE id = ? AND is_deleted = 0').bind(id).first()
  if (!node) return json({ error: 'Node not found' }, 404)
  return json(node)
}

async function createNode(db, frameworkId, body) {
  const { code, name, parent_id, node_type, description, status, owner, steward, approver,
    effective_from, effective_to, version_label, synonyms, keywords,
    region_applicability, country_applicability, business_unit_applicability,
    notes, source_reference, sort_order, change_note } = body

  if (!code) return json({ error: 'code is required' }, 400)
  if (!name) return json({ error: 'name is required' }, 400)
  if (!node_type) return json({ error: 'node_type is required' }, 400)

  // Validate no duplicate code in framework
  const dup = await db.prepare(
    'SELECT id FROM taxonomy_nodes WHERE framework_id = ? AND code = ? AND is_deleted = 0'
  ).bind(frameworkId, code).first()
  if (dup) return json({ error: `Code "${code}" already exists in this framework` }, 400)

  // Validate parent exists and not circular
  if (parent_id) {
    const parent = await db.prepare('SELECT id, status FROM taxonomy_nodes WHERE id = ? AND is_deleted = 0').bind(parent_id).first()
    if (!parent) return json({ error: 'Parent node not found' }, 400)
    if (parent.status === 'retired') return json({ error: 'Cannot add children to a retired node' }, 400)
  }

  const id = uuid(), ts = now()
  const level = await computeLevel(db, parent_id ?? null)
  const fullPath = await computeFullPath(db, parent_id ?? null, name)

  await db.prepare(`
    INSERT INTO taxonomy_nodes
      (id, framework_id, parent_id, code, name, description, node_type, level, sort_order,
       full_path, status, owner, steward, approver, effective_from, effective_to, version_label,
       synonyms, keywords, region_applicability, country_applicability, business_unit_applicability,
       notes, source_reference, is_deleted, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)
  `).bind(
    id, frameworkId, parent_id ?? null, code, name, description ?? null, node_type,
    level, sort_order ? parseInt(sort_order) : 0, fullPath,
    status ?? 'draft', owner ?? null, steward ?? null, approver ?? null,
    effective_from ?? null, effective_to ?? null, version_label ?? null,
    typeof synonyms === 'string' ? synonyms : JSON.stringify(synonyms ?? []),
    typeof keywords === 'string' ? keywords : JSON.stringify(keywords ?? []),
    region_applicability ?? null, country_applicability ?? null,
    business_unit_applicability ?? null, notes ?? null, source_reference ?? null,
    ts, ts
  ).run()

  await logChange(db, { frameworkId, nodeId: id, actionType: 'created', newValue: `${code} — ${name}`, changeNote: change_note, changedBy: body.changed_by ?? 'system' })
  return json(await db.prepare('SELECT * FROM taxonomy_nodes WHERE id = ?').bind(id).first(), 201)
}

async function updateNode(db, id, body) {
  const node = await db.prepare('SELECT * FROM taxonomy_nodes WHERE id = ? AND is_deleted = 0').bind(id).first()
  if (!node) return json({ error: 'Node not found' }, 404)

  const { code, name, parent_id, node_type, description, status, owner, steward, approver,
    effective_from, effective_to, version_label, synonyms, keywords,
    region_applicability, country_applicability, business_unit_applicability,
    notes, source_reference, sort_order, change_note } = body

  // Validate code uniqueness if changing
  const newCode = code ?? node.code
  if (code && code !== node.code) {
    const dup = await db.prepare(
      'SELECT id FROM taxonomy_nodes WHERE framework_id = ? AND code = ? AND is_deleted = 0 AND id != ?'
    ).bind(node.framework_id, code, id).first()
    if (dup) return json({ error: `Code "${code}" already exists in this framework` }, 400)
  }

  // Recompute path/level if parent or name changed
  const newParentId = parent_id !== undefined ? (parent_id || null) : node.parent_id
  const newName = name ?? node.name
  const fullPath = (newParentId !== node.parent_id || newName !== node.name)
    ? await computeFullPath(db, newParentId, newName)
    : node.full_path
  const level = newParentId !== node.parent_id
    ? await computeLevel(db, newParentId)
    : node.level

  const ts = now()
  await db.prepare(`
    UPDATE taxonomy_nodes SET
      code=?, name=?, description=?, parent_id=?, node_type=?, level=?, sort_order=?,
      full_path=?, status=?, owner=?, steward=?, approver=?, effective_from=?, effective_to=?,
      version_label=?, synonyms=?, keywords=?, region_applicability=?, country_applicability=?,
      business_unit_applicability=?, notes=?, source_reference=?, updated_at=?
    WHERE id=?
  `).bind(
    newCode, newName, description ?? node.description,
    newParentId, node_type ?? node.node_type, level,
    sort_order != null ? parseInt(sort_order) : node.sort_order,
    fullPath, status ?? node.status,
    owner ?? node.owner, steward ?? node.steward, approver ?? node.approver,
    effective_from ?? node.effective_from, effective_to ?? node.effective_to,
    version_label ?? node.version_label,
    synonyms !== undefined ? (typeof synonyms === 'string' ? synonyms : JSON.stringify(synonyms)) : node.synonyms,
    keywords !== undefined ? (typeof keywords === 'string' ? keywords : JSON.stringify(keywords)) : node.keywords,
    region_applicability ?? node.region_applicability,
    country_applicability ?? node.country_applicability,
    business_unit_applicability ?? node.business_unit_applicability,
    notes ?? node.notes, source_reference ?? node.source_reference,
    ts, id
  ).run()

  if (newParentId !== node.parent_id) await updateDescendantPaths(db, id)

  await logChange(db, { frameworkId: node.framework_id, nodeId: id, actionType: 'updated', changeNote: change_note, changedBy: body.changed_by ?? 'system' })
  return json(await db.prepare('SELECT * FROM taxonomy_nodes WHERE id = ?').bind(id).first())
}

async function deleteNode(db, id) {
  const node = await db.prepare('SELECT id, code, name, framework_id FROM taxonomy_nodes WHERE id = ? AND is_deleted = 0').bind(id).first()
  if (!node) return json({ error: 'Node not found' }, 404)
  await db.prepare('UPDATE taxonomy_nodes SET is_deleted=1, updated_at=? WHERE id=?').bind(now(), id).run()
  await logChange(db, { frameworkId: node.framework_id, nodeId: id, actionType: 'deleted', oldValue: `${node.code} — ${node.name}`, changedBy: 'system' })
  return json({ ok: true })
}

async function moveNode(db, id, body) {
  const { new_parent_id, change_note } = body
  const node = await db.prepare('SELECT * FROM taxonomy_nodes WHERE id = ? AND is_deleted = 0').bind(id).first()
  if (!node) return json({ error: 'Node not found' }, 404)

  const newParentId = new_parent_id || null
  if (newParentId === node.parent_id) return json(node) // no-op

  // Circular check
  if (await hasCircularRef(db, id, newParentId)) {
    return json({ error: 'Cannot move: would create a circular parent reference' }, 400)
  }

  if (newParentId) {
    const parent = await db.prepare('SELECT status FROM taxonomy_nodes WHERE id = ? AND is_deleted = 0').bind(newParentId).first()
    if (!parent) return json({ error: 'Target parent not found' }, 400)
    if (parent.status === 'retired') return json({ error: 'Cannot move to a retired parent' }, 400)
  }

  const newLevel = await computeLevel(db, newParentId)
  const newPath = await computeFullPath(db, newParentId, node.name)

  await db.prepare(
    'UPDATE taxonomy_nodes SET parent_id=?, level=?, full_path=?, updated_at=? WHERE id=?'
  ).bind(newParentId, newLevel, newPath, now(), id).run()

  await updateDescendantPaths(db, id)
  await logChange(db, {
    frameworkId: node.framework_id, nodeId: id, actionType: 'moved',
    oldValue: node.full_path, newValue: newPath, changeNote: change_note, changedBy: body.changed_by ?? 'system',
  })
  return json(await db.prepare('SELECT * FROM taxonomy_nodes WHERE id = ?').bind(id).first())
}

// ─── Search ───────────────────────────────────────────────────────────────────

async function searchNodes(db, frameworkId, qs) {
  const { q = '', type, status, owner } = qs
  const term = `%${q.toLowerCase()}%`
  let sql = `SELECT * FROM taxonomy_nodes WHERE framework_id = ? AND is_deleted = 0`
  const params = [frameworkId]
  if (q) {
    sql += ` AND (LOWER(code) LIKE ? OR LOWER(name) LIKE ? OR LOWER(keywords) LIKE ? OR LOWER(synonyms) LIKE ?)`
    params.push(term, term, term, term)
  }
  if (type) { sql += ` AND node_type = ?`; params.push(type) }
  if (status) { sql += ` AND status = ?`; params.push(status) }
  if (owner) { sql += ` AND LOWER(owner) LIKE ?`; params.push(`%${owner.toLowerCase()}%`) }
  sql += ` ORDER BY level, sort_order, name LIMIT 200`
  const { results } = await db.prepare(sql).bind(...params).all()
  return json(results)
}

// ─── Validation issues ────────────────────────────────────────────────────────

async function listIssues(db, frameworkId, qs) {
  const { severity, is_resolved, node_id } = qs
  let sql = `SELECT vi.*, n.code as node_code, n.name as node_name
    FROM validation_issues vi LEFT JOIN taxonomy_nodes n ON vi.node_id = n.id
    WHERE vi.framework_id = ?`
  const params = [frameworkId]
  if (severity) { sql += ` AND vi.severity = ?`; params.push(severity) }
  if (is_resolved != null) { sql += ` AND vi.is_resolved = ?`; params.push(is_resolved === 'true' || is_resolved === '1' ? 1 : 0) }
  if (node_id) { sql += ` AND vi.node_id = ?`; params.push(node_id) }
  sql += ` ORDER BY CASE vi.severity WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, vi.created_at DESC`
  const { results } = await db.prepare(sql).bind(...params).all()
  return json(results)
}

async function resolveIssue(db, issueId) {
  const issue = await db.prepare('SELECT * FROM validation_issues WHERE id = ?').bind(issueId).first()
  if (!issue) return json({ error: 'Issue not found' }, 404)
  await db.prepare('UPDATE validation_issues SET is_resolved=1, resolved_at=? WHERE id=?').bind(now(), issueId).run()
  return json({ ok: true })
}

// ─── Change log ───────────────────────────────────────────────────────────────

async function getChangelog(db, frameworkId, qs) {
  const limit = Math.min(parseInt(qs.limit ?? '50'), 200)
  const offset = parseInt(qs.offset ?? '0')
  let sql = `SELECT cl.*, n.code as node_code, n.name as node_name
    FROM change_log cl LEFT JOIN taxonomy_nodes n ON cl.node_id = n.id
    WHERE cl.framework_id = ?`
  const params = [frameworkId]
  if (qs.node_id) { sql += ` AND cl.node_id = ?`; params.push(qs.node_id) }
  sql += ` ORDER BY cl.changed_at DESC LIMIT ? OFFSET ?`
  params.push(limit, offset)
  const { results } = await db.prepare(sql).bind(...params).all()
  return json(results)
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

async function handleDashboard(db, frameworkId) {
  const fwFilter = frameworkId ? 'AND framework_id = ?' : ''
  const fwParams = frameworkId ? [frameworkId] : []

  const [fwCount, nodeRow, statusRows, typeRows, issueRows, missingOwner, missingDesc, recentChanges, recentImports, recentExports] = await db.batch([
    db.prepare('SELECT COUNT(*) as c FROM frameworks WHERE is_deleted = 0'),
    db.prepare(`SELECT COUNT(*) as c FROM taxonomy_nodes WHERE is_deleted = 0 ${fwFilter}`).bind(...fwParams),
    db.prepare(`SELECT status, COUNT(*) as c FROM taxonomy_nodes WHERE is_deleted = 0 ${fwFilter} GROUP BY status`).bind(...fwParams),
    db.prepare(`SELECT node_type, COUNT(*) as c FROM taxonomy_nodes WHERE is_deleted = 0 ${fwFilter} GROUP BY node_type ORDER BY c DESC`).bind(...fwParams),
    db.prepare(`SELECT severity, COUNT(*) as c FROM validation_issues WHERE is_resolved = 0 ${fwFilter} GROUP BY severity`).bind(...fwParams),
    db.prepare(`SELECT COUNT(*) as c FROM taxonomy_nodes WHERE is_deleted = 0 AND status='active' AND (owner IS NULL OR owner='') ${fwFilter}`).bind(...fwParams),
    db.prepare(`SELECT COUNT(*) as c FROM taxonomy_nodes WHERE is_deleted = 0 AND status='active' AND (description IS NULL OR description='') ${fwFilter}`).bind(...fwParams),
    db.prepare(`SELECT cl.*, n.code as node_code, n.name as node_name FROM change_log cl LEFT JOIN taxonomy_nodes n ON cl.node_id = n.id ${frameworkId ? 'WHERE cl.framework_id = ?' : ''} ORDER BY cl.changed_at DESC LIMIT 10`).bind(...fwParams),
    db.prepare(`SELECT * FROM import_jobs ${frameworkId ? 'WHERE framework_id = ?' : ''} ORDER BY created_at DESC LIMIT 5`).bind(...fwParams),
    db.prepare(`SELECT * FROM export_jobs ${frameworkId ? 'WHERE framework_id = ?' : ''} ORDER BY created_at DESC LIMIT 5`).bind(...fwParams),
  ])

  const byStatus = { draft: 0, active: 0, retired: 0 }
  for (const r of (statusRows.results ?? [])) byStatus[r.status] = r.c

  const bySeverity = { error: 0, warning: 0, info: 0 }
  for (const r of (issueRows.results ?? [])) bySeverity[r.severity] = r.c

  const byType = {}
  for (const r of (typeRows.results ?? [])) byType[r.node_type] = r.c

  return json({
    total_frameworks: fwCount.results?.[0]?.c ?? 0,
    total_nodes: nodeRow.results?.[0]?.c ?? 0,
    nodes_by_status: byStatus,
    nodes_by_type: byType,
    unresolved_issues_by_severity: bySeverity,
    nodes_missing_owner: missingOwner.results?.[0]?.c ?? 0,
    nodes_missing_description: missingDesc.results?.[0]?.c ?? 0,
    recent_changes: recentChanges.results ?? [],
    recent_imports: recentImports.results ?? [],
    recent_exports: recentExports.results ?? [],
  })
}

// ─── Snapshots ────────────────────────────────────────────────────────────────

async function createSnapshot(db, frameworkId, body) {
  const { version_label, snapshot_notes, created_by } = body
  if (!version_label) return json({ error: 'version_label is required' }, 400)

  const { results: nodes } = await db.prepare(
    'SELECT * FROM taxonomy_nodes WHERE framework_id = ? AND is_deleted = 0'
  ).bind(frameworkId).all()

  const id = uuid(), ts = now()
  await db.prepare(`
    INSERT INTO snapshots (id, framework_id, version_label, node_count, snapshot_data, snapshot_notes, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, frameworkId, version_label, nodes.length, JSON.stringify(nodes),
    snapshot_notes ?? null, created_by ?? 'system', ts).run()

  await logChange(db, { frameworkId, nodeId: null, actionType: 'snapshot_created',
    newValue: version_label, changeNote: snapshot_notes, changedBy: created_by ?? 'system' })

  return json(await db.prepare('SELECT id, framework_id, version_label, node_count, snapshot_notes, created_by, created_at FROM snapshots WHERE id = ?').bind(id).first(), 201)
}

async function listSnapshots(db, frameworkId) {
  const { results } = await db.prepare(
    'SELECT id, framework_id, version_label, node_count, snapshot_notes, created_by, created_at FROM snapshots WHERE framework_id = ? ORDER BY created_at DESC'
  ).bind(frameworkId).all()
  return json(results)
}

async function getSnapshot(db, id) {
  const snap = await db.prepare('SELECT * FROM snapshots WHERE id = ?').bind(id).first()
  if (!snap) return json({ error: 'Snapshot not found' }, 404)
  return json(snap)
}

async function restoreSnapshot(db, snapId, body) {
  const snap = await db.prepare('SELECT * FROM snapshots WHERE id = ?').bind(snapId).first()
  if (!snap) return json({ error: 'Snapshot not found' }, 404)

  let snapshotNodes
  try { snapshotNodes = JSON.parse(snap.snapshot_data) } catch {
    return json({ error: 'Snapshot data is corrupted' }, 500)
  }

  const ts = now()
  const frameworkId = snap.framework_id

  // Soft-delete all current nodes
  await db.prepare('UPDATE taxonomy_nodes SET is_deleted=1, updated_at=? WHERE framework_id=? AND is_deleted=0').bind(ts, frameworkId).run()

  // Re-insert snapshot nodes in chunks
  const CHUNK = 50
  for (let i = 0; i < snapshotNodes.length; i += CHUNK) {
    await db.batch(snapshotNodes.slice(i, i + CHUNK).map(n =>
      db.prepare(`
        INSERT OR REPLACE INTO taxonomy_nodes
          (id, framework_id, parent_id, code, name, description, node_type, level, sort_order,
           full_path, status, owner, steward, approver, effective_from, effective_to, version_label,
           synonyms, keywords, region_applicability, country_applicability, business_unit_applicability,
           notes, source_reference, is_deleted, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)
      `).bind(
        n.id, frameworkId, n.parent_id, n.code, n.name, n.description, n.node_type,
        n.level, n.sort_order, n.full_path, n.status, n.owner, n.steward, n.approver,
        n.effective_from, n.effective_to, n.version_label, n.synonyms, n.keywords,
        n.region_applicability, n.country_applicability, n.business_unit_applicability,
        n.notes, n.source_reference, n.created_at, ts
      )
    ))
  }

  await logChange(db, { frameworkId, nodeId: null, actionType: 'restored',
    newValue: snap.version_label, changeNote: body.change_note ?? `Restored from snapshot ${snap.version_label}`,
    changedBy: body.restored_by ?? 'system' })

  return json({ ok: true, node_count: snapshotNodes.length })
}

async function compareSnapshots(db, body) {
  const { snapshot_id_a, snapshot_id_b } = body
  if (!snapshot_id_a || !snapshot_id_b) return json({ error: 'snapshot_id_a and snapshot_id_b required' }, 400)

  const [snapA, snapB] = await Promise.all([
    db.prepare('SELECT snapshot_data FROM snapshots WHERE id = ?').bind(snapshot_id_a).first(),
    db.prepare('SELECT snapshot_data FROM snapshots WHERE id = ?').bind(snapshot_id_b).first(),
  ])
  if (!snapA || !snapB) return json({ error: 'One or both snapshots not found' }, 404)

  const nodesA = JSON.parse(snapA.snapshot_data)
  const nodesB = JSON.parse(snapB.snapshot_data)

  const mapA = new Map(nodesA.map(n => [n.code, n]))
  const mapB = new Map(nodesB.map(n => [n.code, n]))

  const added = [], removed = [], modified = [], moved = []
  const COMPARE_FIELDS = ['name','description','node_type','status','owner','steward','approver']

  for (const [code, nodeB] of mapB) {
    if (!mapA.has(code)) { added.push(nodeB); continue }
    const nodeA = mapA.get(code)
    const changes = {}
    for (const f of COMPARE_FIELDS) {
      if (nodeA[f] !== nodeB[f]) changes[f] = { from: nodeA[f], to: nodeB[f] }
    }
    if (nodeA.parent_id !== nodeB.parent_id) {
      moved.push({ code, name: nodeB.name, old_parent: nodeA.parent_id, new_parent: nodeB.parent_id })
    }
    if (Object.keys(changes).length) modified.push({ code, name: nodeB.name, changes })
  }
  for (const [code, nodeA] of mapA) {
    if (!mapB.has(code)) removed.push(nodeA)
  }

  return json({ added, removed, modified, moved })
}

// ─── Import ───────────────────────────────────────────────────────────────────

async function importNodes(db, frameworkId, body) {
  const { nodes: rows = [], mode = 'create', filename = 'import', on_duplicate = 'skip' } = body
  if (!Array.isArray(rows) || rows.length === 0) return json({ error: 'No nodes provided' }, 400)

  const fw = await db.prepare('SELECT id FROM frameworks WHERE id = ? AND is_deleted = 0').bind(frameworkId).first()
  if (!fw) return json({ error: 'Framework not found' }, 404)

  const jobId = uuid(), ts = now()
  await db.prepare(`INSERT INTO import_jobs (id, framework_id, filename, status, row_count, created_at) VALUES (?,?,?,?,?,?)`)
    .bind(jobId, frameworkId, filename, 'processing', rows.length, ts).run()

  let imported = 0, skipped = 0
  const errors = []

  // Build a code→id map for resolving parent_code references
  const { results: existing } = await db.prepare(
    'SELECT id, code FROM taxonomy_nodes WHERE framework_id = ? AND is_deleted = 0'
  ).bind(frameworkId).all()
  const codeToId = new Map(existing.map(n => [n.code, n.id]))

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const rowNum = i + 1
    if (!r.code || !r.name) { errors.push({ row: rowNum, code: r.code, message: 'Missing required fields: code, name' }); skipped++; continue }

    // Resolve parent
    let parentId = null
    if (r.parent_id) parentId = r.parent_id
    else if (r.parent_code) parentId = codeToId.get(r.parent_code) ?? null

    const existingNode = codeToId.has(r.code)
      ? await db.prepare('SELECT * FROM taxonomy_nodes WHERE framework_id = ? AND code = ? AND is_deleted = 0').bind(frameworkId, r.code).first()
      : null

    try {
      if (existingNode) {
        if (mode === 'create') {
          if (on_duplicate === 'error') { errors.push({ row: rowNum, code: r.code, message: `Duplicate code: ${r.code}` }); skipped++; continue }
          if (on_duplicate === 'skip') { skipped++; continue }
        }
        // overwrite / upsert
        const level = parentId ? await computeLevel(db, parentId) : existingNode.level
        const fullPath = await computeFullPath(db, parentId, r.name ?? existingNode.name)
        await db.prepare(`UPDATE taxonomy_nodes SET name=?,description=?,parent_id=?,node_type=?,level=?,full_path=?,status=?,owner=?,steward=?,approver=?,effective_from=?,effective_to=?,synonyms=?,keywords=?,updated_at=? WHERE id=?`)
          .bind(r.name ?? existingNode.name, r.description ?? existingNode.description, parentId, r.node_type ?? existingNode.node_type, level, fullPath, r.status ?? existingNode.status, r.owner ?? existingNode.owner, r.steward ?? existingNode.steward, r.approver ?? existingNode.approver, r.effective_from ?? existingNode.effective_from, r.effective_to ?? existingNode.effective_to, JSON.stringify((r.synonyms ?? '').split(';').map(s=>s.trim()).filter(Boolean)), JSON.stringify((r.keywords ?? '').split(';').map(s=>s.trim()).filter(Boolean)), now(), existingNode.id).run()
        imported++
      } else {
        const id = uuid()
        const level = parentId ? await computeLevel(db, parentId) : 0
        const fullPath = await computeFullPath(db, parentId, r.name)
        await db.prepare(`INSERT INTO taxonomy_nodes (id,framework_id,parent_id,code,name,description,node_type,level,sort_order,full_path,status,owner,steward,approver,effective_from,effective_to,synonyms,keywords,is_deleted,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,0,?,?,?,?,?,?,?,?,?,0,?,?)`)
          .bind(id, frameworkId, parentId, r.code, r.name, r.description ?? null, r.node_type ?? 'process', level, fullPath, r.status ?? 'draft', r.owner ?? null, r.steward ?? null, r.approver ?? null, r.effective_from ?? null, r.effective_to ?? null, JSON.stringify((r.synonyms ?? '').split(';').map(s=>s.trim()).filter(Boolean)), JSON.stringify((r.keywords ?? '').split(';').map(s=>s.trim()).filter(Boolean)), ts, ts).run()
        codeToId.set(r.code, id)
        imported++
      }
    } catch (e) {
      errors.push({ row: rowNum, code: r.code, message: e.message })
      skipped++
    }
  }

  const completedAt = now()
  await db.prepare(`UPDATE import_jobs SET status=?,imported_count=?,skipped_count=?,error_count=?,errors=?,completed_at=? WHERE id=?`)
    .bind('completed', imported, skipped, errors.length, JSON.stringify(errors), completedAt, jobId).run()

  await logChange(db, { frameworkId, nodeId: null, actionType: 'bulk_import', newValue: `${imported} nodes imported`, changeNote: `File: ${filename}`, changedBy: 'system' })

  return json({ job_id: jobId, imported, skipped, errors })
}

async function listImportJobs(db, qs) {
  const { framework_id } = qs
  const sql = framework_id
    ? 'SELECT * FROM import_jobs WHERE framework_id = ? ORDER BY created_at DESC LIMIT 50'
    : 'SELECT * FROM import_jobs ORDER BY created_at DESC LIMIT 50'
  const { results } = framework_id
    ? await db.prepare(sql).bind(framework_id).all()
    : await db.prepare(sql).all()
  return json(results)
}

// ─── Export ───────────────────────────────────────────────────────────────────

async function exportFramework(db, frameworkId) {
  const fw = await db.prepare('SELECT * FROM frameworks WHERE id = ? AND is_deleted = 0').bind(frameworkId).first()
  if (!fw) return json({ error: 'Framework not found' }, 404)

  const [nodes, issues, changelog] = await db.batch([
    db.prepare('SELECT * FROM taxonomy_nodes WHERE framework_id = ? AND is_deleted = 0 ORDER BY level, sort_order').bind(frameworkId),
    db.prepare(`SELECT vi.*, n.code as node_code, n.name as node_name FROM validation_issues vi LEFT JOIN taxonomy_nodes n ON vi.node_id = n.id WHERE vi.framework_id = ? ORDER BY vi.severity, vi.created_at`).bind(frameworkId),
    db.prepare(`SELECT cl.*, n.code as node_code, n.name as node_name FROM change_log cl LEFT JOIN taxonomy_nodes n ON cl.node_id = n.id WHERE cl.framework_id = ? ORDER BY cl.changed_at DESC LIMIT 1000`).bind(frameworkId),
  ])

  const jobId = uuid(), ts = now()
  const filename = `taxonomy_export_${fw.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${ts.slice(0,10)}.xlsx`
  await db.prepare('INSERT INTO export_jobs (id, framework_id, export_type, filename, status, node_count, created_at, completed_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(jobId, frameworkId, 'xlsx', filename, 'completed', nodes.results?.length ?? 0, ts, ts).run()

  return json({
    framework: fw,
    nodes: nodes.results ?? [],
    issues: issues.results ?? [],
    changelog: changelog.results ?? [],
  })
}

async function listExportJobs(db, qs) {
  const { framework_id } = qs
  const sql = framework_id
    ? 'SELECT * FROM export_jobs WHERE framework_id = ? ORDER BY created_at DESC LIMIT 50'
    : 'SELECT * FROM export_jobs ORDER BY created_at DESC LIMIT 50'
  const { results } = framework_id
    ? await db.prepare(sql).bind(framework_id).all()
    : await db.prepare(sql).all()
  return json(results)
}
