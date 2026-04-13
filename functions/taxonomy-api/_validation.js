import { uuid, now } from './_helpers.js'

const VAGUE_LABELS = /^(other|misc|miscellaneous|general|tbd|todo|n\/a|na|unknown|various|placeholder|temp|temporary|new|test)$/i
const TOO_MANY_CHILDREN = 15

export async function runValidation(db, frameworkId) {
  // Load all active nodes
  const { results: nodes } = await db.prepare(
    'SELECT * FROM taxonomy_nodes WHERE framework_id = ? AND is_deleted = 0'
  ).bind(frameworkId).all()

  const issues = []
  const ts = now()

  // Build helper maps
  const byId = new Map(nodes.map(n => [n.id, n]))
  const byCode = new Map()
  const childrenOf = new Map()

  for (const n of nodes) {
    // code map (may collide — that's an issue)
    if (!byCode.has(n.code)) byCode.set(n.code, [])
    byCode.get(n.code).push(n)
    // children map
    const pid = n.parent_id ?? '__root__'
    if (!childrenOf.has(pid)) childrenOf.set(pid, [])
    childrenOf.get(pid).push(n)
  }

  for (const n of nodes) {
    // 1. duplicate_code (error)
    const sameCode = byCode.get(n.code)
    if (sameCode && sameCode.length > 1 && sameCode[0].id === n.id) {
      issues.push({ node_id: n.id, severity: 'error', issue_type: 'duplicate_code',
        description: `Code "${n.code}" is used by ${sameCode.length} nodes in this framework.`,
        suggested_fix: 'Assign a unique code to each node.' })
    }

    // 2. duplicate_name_sibling (warning)
    const parentKey = n.parent_id ?? '__root__'
    const siblings = (childrenOf.get(parentKey) ?? []).filter(s => s.id !== n.id)
    const nameDupe = siblings.find(s => s.name.trim().toLowerCase() === n.name.trim().toLowerCase())
    if (nameDupe) {
      issues.push({ node_id: n.id, severity: 'warning', issue_type: 'duplicate_name_sibling',
        description: `Node "${n.name}" has the same name as sibling "${nameDupe.code}".`,
        suggested_fix: 'Use a more specific name to differentiate siblings.' })
    }

    // 3. missing_description (warning) — active nodes only
    if (n.status === 'active' && !n.description) {
      issues.push({ node_id: n.id, severity: 'warning', issue_type: 'missing_description',
        description: `Active node "${n.name}" (${n.code}) has no description.`,
        suggested_fix: 'Add a description explaining the purpose of this node.' })
    }

    // 4. missing_owner (warning) — active nodes only
    if (n.status === 'active' && !n.owner) {
      issues.push({ node_id: n.id, severity: 'warning', issue_type: 'missing_owner',
        description: `Active node "${n.name}" (${n.code}) has no owner assigned.`,
        suggested_fix: 'Assign an owner responsible for this node.' })
    }

    // 5. retired_parent_active_child (error)
    if (n.parent_id && n.status === 'active') {
      const parent = byId.get(n.parent_id)
      if (parent && parent.status === 'retired') {
        issues.push({ node_id: n.id, severity: 'error', issue_type: 'retired_parent_active_child',
          description: `Node "${n.name}" is active but its parent "${parent.name}" is retired.`,
          suggested_fix: 'Either retire this node or reactivate the parent.' })
      }
    }

    // 6. invalid_effective_dates (error)
    if (n.effective_from && n.effective_to) {
      if (new Date(n.effective_to) < new Date(n.effective_from)) {
        issues.push({ node_id: n.id, severity: 'error', issue_type: 'invalid_effective_dates',
          description: `Node "${n.name}" has effective_to (${n.effective_to}) before effective_from (${n.effective_from}).`,
          suggested_fix: 'Correct the effective date range.' })
      }
    }

    // 7. orphan_node (error)
    if (n.parent_id && !byId.has(n.parent_id)) {
      issues.push({ node_id: n.id, severity: 'error', issue_type: 'orphan_node',
        description: `Node "${n.name}" references parent ID "${n.parent_id}" which does not exist or is deleted.`,
        suggested_fix: 'Reassign the parent or clear the parent reference.' })
    }

    // 8. level_mismatch (warning)
    if (n.parent_id && byId.has(n.parent_id)) {
      const expectedLevel = (byId.get(n.parent_id)?.level ?? -1) + 1
      if (n.level !== expectedLevel) {
        issues.push({ node_id: n.id, severity: 'warning', issue_type: 'level_mismatch',
          description: `Node "${n.name}" has level ${n.level} but expected ${expectedLevel} based on parent.`,
          suggested_fix: 'Re-save the node to recompute its level, or use the move operation.' })
      }
    }

    // 9. vague_label (info)
    if (VAGUE_LABELS.test(n.name.trim())) {
      issues.push({ node_id: n.id, severity: 'info', issue_type: 'vague_label',
        description: `Node name "${n.name}" is vague or a placeholder.`,
        suggested_fix: 'Replace with a specific, descriptive name.' })
    }

    // 10. too_many_children (info)
    const directChildren = (childrenOf.get(n.id) ?? [])
    if (directChildren.length > TOO_MANY_CHILDREN) {
      issues.push({ node_id: n.id, severity: 'info', issue_type: 'too_many_children',
        description: `Node "${n.name}" has ${directChildren.length} direct children (>${TOO_MANY_CHILDREN}).`,
        suggested_fix: 'Consider introducing an intermediate grouping level.' })
    }

    // 11. no_children_domain (info)
    if (['domain', 'process_group'].includes(n.node_type)) {
      if (!childrenOf.has(n.id) || childrenOf.get(n.id).length === 0) {
        issues.push({ node_id: n.id, severity: 'info', issue_type: 'no_children_domain',
          description: `"${n.node_type}" node "${n.name}" has no children.`,
          suggested_fix: 'Add child nodes, or change the node type if this is a leaf.' })
      }
    }

    // 12. missing_keywords (info) — active nodes only
    if (n.status === 'active') {
      let kw = []
      try { kw = JSON.parse(n.keywords ?? '[]') } catch { /* */ }
      if (!Array.isArray(kw) || kw.length === 0) {
        issues.push({ node_id: n.id, severity: 'info', issue_type: 'missing_keywords',
          description: `Active node "${n.name}" (${n.code}) has no keywords.`,
          suggested_fix: 'Add keywords to improve search and discoverability.' })
      }
    }
  }

  // Delete existing unresolved issues for this framework, then insert new ones
  await db.prepare(
    'DELETE FROM validation_issues WHERE framework_id = ? AND is_resolved = 0'
  ).bind(frameworkId).run()

  if (issues.length > 0) {
    const stmts = issues.map(i =>
      db.prepare(`
        INSERT INTO validation_issues (id, framework_id, node_id, severity, issue_type, description, suggested_fix, is_resolved, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
      `).bind(uuid(), frameworkId, i.node_id, i.severity, i.issue_type, i.description, i.suggested_fix ?? null, ts)
    )
    await db.batch(stmts)
  }

  // Return with node info joined
  const { results: inserted } = await db.prepare(`
    SELECT vi.*, n.code as node_code, n.name as node_name
    FROM validation_issues vi
    LEFT JOIN taxonomy_nodes n ON vi.node_id = n.id
    WHERE vi.framework_id = ? AND vi.is_resolved = 0
    ORDER BY CASE vi.severity WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, vi.created_at
  `).bind(frameworkId).all()

  return inserted
}
