/**
 * Work HQ — Cloudflare Pages Function
 * Routes under /api/workhq/*
 *
 * GET    /api/workhq/tasks              → list tasks
 * POST   /api/workhq/tasks              → create task
 * PUT    /api/workhq/tasks/:id          → update task
 * DELETE /api/workhq/tasks/:id          → delete task
 *
 * GET    /api/workhq/projects           → list projects
 * POST   /api/workhq/projects           → create project
 * PUT    /api/workhq/projects/:id       → update project
 * DELETE /api/workhq/projects/:id       → delete project
 *
 * GET    /api/workhq/focus              → get all 3 focus slots
 * PUT    /api/workhq/focus/:slot        → update a focus slot (0,1,2)
 *
 * POST   /api/workhq/seed               → seed sample data if DB is empty
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function err(msg, status = 400) {
  return json({ error: msg }, status);
}

function uuid() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_TASKS = [
  { name: 'Review HRSC SOP library drafts (29 topics)', area: 'Projects',  priority: 'High',   status: 'Active',     due_date: '2025-06-30', notes: 'KCS-aligned, SharePoint hosted' },
  { name: 'NowAssist spec — share with KPMG for scoping', area: 'Projects', priority: 'High',  status: 'To Do',      due_date: '2025-05-20', notes: 'Position & Requisition use case' },
  { name: 'Spain DNI/NIE onboarding guidance — finalise', area: 'HRSC Ops', priority: 'High',  status: 'Active',     due_date: '2025-05-15', notes: 'Share with Tier 1 team' },
  { name: 'Greece ERGANI II digital resignation note',    area: 'HRSC Ops', priority: 'Medium', status: 'Active',     due_date: '2025-05-22', notes: 'Confirm process with legal' },
  { name: 'HRSC team culture session — schedule',         area: 'People',   priority: 'Medium', status: 'To Do',      due_date: '2025-05-31', notes: 'Accurate, Expert, Human identity' },
  { name: 'KCS knowledge base pilot — review progress',   area: 'Projects', priority: 'Medium', status: 'Active',     due_date: '2025-05-28', notes: 'SharePoint pilot, check adoption' },
  { name: 'Tier 1 capacity review — H2 planning',         area: 'Strategy', priority: 'High',   status: 'To Do',      due_date: '2025-05-30', notes: 'Headcount model for Mark' },
  { name: 'Monthly 1:1s — prep talking points',           area: 'People',   priority: 'Low',    status: 'To Do',      due_date: '2025-05-16', notes: '' },
  { name: 'ServiceNow dashboard metrics — May report',    area: 'HRSC Ops', priority: 'Medium', status: 'To Do',      due_date: '2025-05-23', notes: '' },
  { name: 'German Arbeitszeugnis QES guidance',           area: 'HRSC Ops', priority: 'Low',    status: 'Done',       due_date: null,         notes: 'DocuSign BEG IV confirmed' },
];

const SEED_PROJECTS = [
  { name: 'HRSC SOP Library (29 topics)',   owner: 'Ryan', priority: 'High',   status: 'Active',    deadline: '2025-06-30', next_action: 'Review AI-drafted SOPs with team' },
  { name: 'NowAssist / ServiceNow Build',   owner: 'Ryan', priority: 'High',   status: 'Planning',  deadline: 'TBC',        next_action: 'Share spec with KPMG for scoping' },
  { name: 'HRSC Culture & Capability',      owner: 'Ryan', priority: 'Medium', status: 'Active',    deadline: 'Ongoing',    next_action: 'Next team session — schedule now' },
  { name: 'Spain/Greece Law Advisory',      owner: 'Ryan', priority: 'Medium', status: 'Active',    deadline: 'Ongoing',    next_action: 'Finalise ERGANI II guidance' },
  { name: 'Tier 1 H2 Capacity Planning',   owner: 'Ryan', priority: 'High',   status: 'Planning',  deadline: '2025-05-30', next_action: 'Headcount model for Mark' },
  { name: 'KCS Knowledge Base Pilot',       owner: 'Ryan', priority: 'Medium', status: 'Active',    deadline: 'Ongoing',    next_action: 'Check SharePoint adoption rate' },
];

async function seedIfEmpty(db) {
  const { count } = await db.prepare('SELECT COUNT(*) as count FROM workhq_tasks').first();
  if (count > 0) return { seeded: false };

  const taskStmt = db.prepare(
    `INSERT INTO workhq_tasks (id, name, area, priority, status, due_date, notes, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const projStmt = db.prepare(
    `INSERT INTO workhq_projects (id, name, owner, priority, status, deadline, next_action, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const taskBatch = SEED_TASKS.map((t, i) =>
    taskStmt.bind(uuid(), t.name, t.area, t.priority, t.status, t.due_date ?? null, t.notes ?? '', i)
  );
  const projBatch = SEED_PROJECTS.map((p, i) =>
    projStmt.bind(uuid(), p.name, p.owner, p.priority, p.status, p.deadline ?? null, p.next_action ?? '', i)
  );

  await db.batch([...taskBatch, ...projBatch]);
  return { seeded: true };
}

// ─── Route handlers ───────────────────────────────────────────────────────────

async function handleTasks(request, db, id) {
  const method = request.method;

  // GET /tasks
  if (!id && method === 'GET') {
    const { results } = await db.prepare(
      'SELECT * FROM workhq_tasks ORDER BY sort_order ASC, created_at ASC'
    ).all();
    return json(results);
  }

  // POST /tasks
  if (!id && method === 'POST') {
    const body = await request.json();
    const taskId = uuid();
    const { count } = await db.prepare('SELECT COUNT(*) as count FROM workhq_tasks').first();
    await db.prepare(
      `INSERT INTO workhq_tasks (id, name, area, priority, status, due_date, notes, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      taskId,
      body.name ?? 'New Task',
      body.area ?? 'Other',
      body.priority ?? 'Medium',
      body.status ?? 'To Do',
      body.due_date ?? null,
      body.notes ?? '',
      count
    ).run();
    const row = await db.prepare('SELECT * FROM workhq_tasks WHERE id = ?').bind(taskId).first();
    return json(row, 201);
  }

  if (!id) return err('Not found', 404);

  // PUT /tasks/:id
  if (method === 'PUT') {
    const body = await request.json();
    const fields = [];
    const vals = [];
    const allowed = ['name','area','priority','status','due_date','notes','sort_order'];
    for (const key of allowed) {
      if (key in body) { fields.push(`${key} = ?`); vals.push(body[key]); }
    }
    if (!fields.length) return err('No valid fields');
    fields.push('updated_at = ?');
    vals.push(now(), id);
    await db.prepare(`UPDATE workhq_tasks SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
    const row = await db.prepare('SELECT * FROM workhq_tasks WHERE id = ?').bind(id).first();
    return row ? json(row) : err('Not found', 404);
  }

  // DELETE /tasks/:id
  if (method === 'DELETE') {
    await db.prepare('DELETE FROM workhq_tasks WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  return err('Method not allowed', 405);
}

async function handleProjects(request, db, id) {
  const method = request.method;

  if (!id && method === 'GET') {
    const { results } = await db.prepare(
      'SELECT * FROM workhq_projects ORDER BY sort_order ASC, created_at ASC'
    ).all();
    return json(results);
  }

  if (!id && method === 'POST') {
    const body = await request.json();
    const projId = uuid();
    const { count } = await db.prepare('SELECT COUNT(*) as count FROM workhq_projects').first();
    await db.prepare(
      `INSERT INTO workhq_projects (id, name, owner, priority, status, deadline, next_action, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      projId,
      body.name ?? 'New Project',
      body.owner ?? 'Ryan',
      body.priority ?? 'Medium',
      body.status ?? 'Planning',
      body.deadline ?? null,
      body.next_action ?? '',
      count
    ).run();
    const row = await db.prepare('SELECT * FROM workhq_projects WHERE id = ?').bind(projId).first();
    return json(row, 201);
  }

  if (!id) return err('Not found', 404);

  if (method === 'PUT') {
    const body = await request.json();
    const fields = [];
    const vals = [];
    const allowed = ['name','owner','priority','status','deadline','next_action','sort_order'];
    for (const key of allowed) {
      if (key in body) { fields.push(`${key} = ?`); vals.push(body[key]); }
    }
    if (!fields.length) return err('No valid fields');
    fields.push('updated_at = ?');
    vals.push(now(), id);
    await db.prepare(`UPDATE workhq_projects SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
    const row = await db.prepare('SELECT * FROM workhq_projects WHERE id = ?').bind(id).first();
    return row ? json(row) : err('Not found', 404);
  }

  if (method === 'DELETE') {
    await db.prepare('DELETE FROM workhq_projects WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  return err('Method not allowed', 405);
}

async function handleFocus(request, db, slotParam) {
  const method = request.method;

  if (!slotParam && method === 'GET') {
    // Return slots joined with task name
    const { results } = await db.prepare(`
      SELECT f.slot_index, f.task_id, f.done, t.name as task_name
      FROM workhq_focus_slots f
      LEFT JOIN workhq_tasks t ON f.task_id = t.id
      ORDER BY f.slot_index ASC
    `).all();
    return json(results);
  }

  if (slotParam !== undefined && method === 'PUT') {
    const slot = parseInt(slotParam, 10);
    if (isNaN(slot) || slot < 0 || slot > 2) return err('Slot must be 0, 1, or 2');
    const body = await request.json();

    // If setting done=true, also update the task status to Done
    if (body.done && body.task_id) {
      await db.prepare(
        `UPDATE workhq_tasks SET status = 'Done', updated_at = ? WHERE id = ?`
      ).bind(now(), body.task_id).run();
    }

    // Fetch current state so we can merge with partial updates
    const current = await db.prepare(
      'SELECT task_id, done FROM workhq_focus_slots WHERE slot_index = ?'
    ).bind(slot).first();

    const newTaskId = 'task_id' in body ? (body.task_id ?? null) : (current?.task_id ?? null);
    const newDone   = 'done' in body ? (body.done ? 1 : 0) : (current?.done ?? 0);

    await db.prepare(
      `UPDATE workhq_focus_slots SET task_id = ?, done = ? WHERE slot_index = ?`
    ).bind(newTaskId, newDone, slot).run();

    // Re-fetch to return current state
    const row = await db.prepare(`
      SELECT f.slot_index, f.task_id, f.done, t.name as task_name
      FROM workhq_focus_slots f
      LEFT JOIN workhq_tasks t ON f.task_id = t.id
      WHERE f.slot_index = ?
    `).bind(slot).first();
    return json(row);
  }

  return err('Method not allowed', 405);
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const db = env.WORKHQ_DB;
  if (!db) return err('WORKHQ_DB binding not configured', 500);

  const url = new URL(request.url);
  // Strip /api/workhq prefix, then split
  const path = url.pathname.replace(/^\/api\/workhq\/?/, '');
  const parts = path.split('/').filter(Boolean);

  try {
    const resource = parts[0];
    const id = parts[1];

    if (resource === 'tasks')    return await handleTasks(request, db, id);
    if (resource === 'projects') return await handleProjects(request, db, id);
    if (resource === 'focus')    return await handleFocus(request, db, id);

    if (resource === 'seed' && request.method === 'POST') {
      const result = await seedIfEmpty(db);
      return json(result);
    }

    return err('Not found', 404);
  } catch (e) {
    console.error('workhq error:', e);
    return err(e.message ?? 'Internal error', 500);
  }
}
