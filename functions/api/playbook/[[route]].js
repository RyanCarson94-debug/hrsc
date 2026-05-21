/**
 * HRSC Playbook — Cloudflare Pages Function
 * Serves all routes under /api/playbook/*
 *
 * Auth: Cloudflare Access provides CF-Access-Authenticated-User-Email header.
 * Admin: PLAYBOOK_ADMIN_EMAILS env var (comma-separated). If unset, admin routes
 * are open (useful for initial setup — set the var in the dashboard after first deploy).
 *
 * Routes:
 *   GET  /api/playbook/me
 *
 *   GET  /api/playbook/playbooks               → list playbooks
 *   POST /api/playbook/playbooks               → create playbook (admin)
 *   GET  /api/playbook/playbooks/:id           → get playbook (with fields + steps)
 *   PUT  /api/playbook/playbooks/:id           → update playbook (admin)
 *   DELETE /api/playbook/playbooks/:id         → delete playbook (admin)
 *
 *   GET  /api/playbook/playbooks/:id/fields    → list fields
 *   POST /api/playbook/playbooks/:id/fields    → create field (admin)
 *   PUT  /api/playbook/fields/:id              → update field (admin)
 *   DELETE /api/playbook/fields/:id            → delete field (admin)
 *   POST /api/playbook/playbooks/:id/fields/reorder → reorder fields (admin)
 *
 *   GET  /api/playbook/playbooks/:id/steps     → list steps
 *   POST /api/playbook/playbooks/:id/steps     → create step (admin)
 *   PUT  /api/playbook/steps/:id               → update step (admin)
 *   DELETE /api/playbook/steps/:id             → delete step (admin)
 *   POST /api/playbook/playbooks/:id/steps/reorder → reorder steps (admin)
 *
 *   GET  /api/playbook/components              → list components
 *   POST /api/playbook/components              → create component (admin)
 *   GET  /api/playbook/components/:id          → get component
 *   PUT  /api/playbook/components/:id          → update component (admin)
 *   DELETE /api/playbook/components/:id        → delete component (admin)
 *
 *   GET  /api/playbook/cases                   → list cases
 *   POST /api/playbook/cases                   → create case
 *   GET  /api/playbook/cases/:id               → get case
 *   PUT  /api/playbook/cases/:id               → update case (mark steps complete)
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

function getUser(request, env) {
  const email = (request.headers.get('CF-Access-Authenticated-User-Email') || '').trim();
  const rawAdmins = env.PLAYBOOK_ADMIN_EMAILS || '';
  const adminList = rawAdmins
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = adminList.length === 0 || adminList.includes(email.toLowerCase());
  const name = email
    ? email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'Anonymous';
  return { email: email || 'anonymous', name, isAdmin };
}

function requireAdmin(user) {
  if (!user.isAdmin) return err('Forbidden — admin access required', 403);
  return null;
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const DB = env.HRSC_PLAYBOOK_DB;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  if (!DB) {
    return json({
      error:
        "Database not available. Add a D1 binding named 'HRSC_PLAYBOOK_DB' in " +
        'Cloudflare Pages → Settings → Functions → D1 database bindings, ' +
        'then run the migration: wrangler d1 execute hrsc-playbook-db --remote --file=migrations/0006_playbook.sql',
    }, 503);
  }

  const user = getUser(request, env);
  const parts = Array.isArray(params.route) ? params.route : (params.route ? [params.route] : []);
  const [resource, id, sub] = parts;

  try {
    // ── ME ────────────────────────────────────────────────────────────────────
    if (resource === 'me' && request.method === 'GET') {
      return json({ email: user.email, name: user.name, isAdmin: user.isAdmin });
    }

    // ── PLAYBOOKS ─────────────────────────────────────────────────────────────
    if (resource === 'playbooks') {

      // /api/playbook/playbooks/:id/fields
      if (id && sub === 'fields') {
        if (request.method === 'GET') {
          const rows = await DB.prepare(
            'SELECT * FROM intake_fields WHERE playbook_id = ? ORDER BY sort_order'
          ).bind(id).all();
          return json(rows.results || []);
        }
        if (request.method === 'POST') {
          const deny = requireAdmin(user);
          if (deny) return deny;
          const body = await request.json();
          const newId = body.id || crypto.randomUUID();
          const maxRow = await DB.prepare(
            'SELECT MAX(sort_order) AS m FROM intake_fields WHERE playbook_id = ?'
          ).bind(id).first();
          const sortOrder = body.sort_order ?? ((maxRow?.m ?? 0) + 1);
          await DB.prepare(
            'INSERT INTO intake_fields (id, playbook_id, field_key, label, type, options, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            newId, id,
            body.field_key || '', body.label || '',
            body.type || 'text',
            JSON.stringify(body.options || []),
            sortOrder
          ).run();
          return json({ id: newId, playbook_id: id, ...body, sort_order: sortOrder }, 201);
        }
        // POST /api/playbook/playbooks/:id/fields/reorder — id here is the sub, not field id
      }

      // /api/playbook/playbooks/:id/fields/reorder
      if (id && sub === 'fields' && parts[3] === 'reorder') {
        const deny = requireAdmin(user);
        if (deny) return deny;
        const { order } = await request.json(); // array of field IDs in new order
        for (let i = 0; i < order.length; i++) {
          await DB.prepare('UPDATE intake_fields SET sort_order = ? WHERE id = ? AND playbook_id = ?')
            .bind(i + 1, order[i], id).run();
        }
        return json({ ok: true });
      }

      // /api/playbook/playbooks/:id/steps
      if (id && sub === 'steps') {
        if (request.method === 'GET') {
          const rows = await DB.prepare(
            'SELECT * FROM steps WHERE playbook_id = ? ORDER BY sort_order'
          ).bind(id).all();
          return json(rows.results || []);
        }
        if (request.method === 'POST') {
          const deny = requireAdmin(user);
          if (deny) return deny;
          const body = await request.json();
          const newId = body.id || crypto.randomUUID();
          const maxRow = await DB.prepare(
            'SELECT MAX(sort_order) AS m FROM steps WHERE playbook_id = ?'
          ).bind(id).first();
          const sortOrder = body.sort_order ?? ((maxRow?.m ?? 0) + 1);
          await DB.prepare(
            'INSERT INTO steps (id, playbook_id, sort_order, title, body, system, conditions, required) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            newId, id, sortOrder,
            body.title || 'New Step',
            body.body || '',
            body.system || 'manual',
            typeof body.conditions === 'string' ? body.conditions : JSON.stringify(body.conditions || { always: true }),
            body.required === false ? 0 : 1
          ).run();
          return json({ id: newId, playbook_id: id, sort_order: sortOrder, ...body }, 201);
        }
      }

      // /api/playbook/playbooks/:id/steps/reorder
      if (id && sub === 'steps' && parts[3] === 'reorder') {
        const deny = requireAdmin(user);
        if (deny) return deny;
        const { order } = await request.json();
        for (let i = 0; i < order.length; i++) {
          await DB.prepare('UPDATE steps SET sort_order = ? WHERE id = ? AND playbook_id = ?')
            .bind(i + 1, order[i], id).run();
        }
        return json({ ok: true });
      }

      // /api/playbook/playbooks (collection)
      if (!id) {
        if (request.method === 'GET') {
          const showAll = user.isAdmin && request.url.includes('all=true');
          const rows = await DB.prepare(
            showAll
              ? 'SELECT * FROM playbooks ORDER BY created_at DESC'
              : 'SELECT * FROM playbooks WHERE active = 1 ORDER BY name'
          ).all();
          return json(rows.results || []);
        }
        if (request.method === 'POST') {
          const deny = requireAdmin(user);
          if (deny) return deny;
          const body = await request.json();
          const newId = body.id || crypto.randomUUID();
          await DB.prepare(
            'INSERT INTO playbooks (id, slug, name, description, active) VALUES (?, ?, ?, ?, ?)'
          ).bind(newId, body.slug || newId, body.name || 'Untitled', body.description || '', body.active === false ? 0 : 1).run();
          return json({ id: newId, ...body }, 201);
        }
      }

      // /api/playbook/playbooks/:id (single)
      if (id && !sub) {
        if (request.method === 'GET') {
          const pb = await DB.prepare('SELECT * FROM playbooks WHERE id = ?').bind(id).first();
          if (!pb) return err('Not found', 404);
          const [fields, steps] = await Promise.all([
            DB.prepare('SELECT * FROM intake_fields WHERE playbook_id = ? ORDER BY sort_order').bind(id).all(),
            DB.prepare('SELECT * FROM steps WHERE playbook_id = ? ORDER BY sort_order').bind(id).all(),
          ]);
          return json({
            ...pb,
            fields: fields.results || [],
            steps: steps.results || [],
          });
        }
        if (request.method === 'PUT') {
          const deny = requireAdmin(user);
          if (deny) return deny;
          const body = await request.json();
          await DB.prepare(
            'UPDATE playbooks SET slug = ?, name = ?, description = ?, active = ? WHERE id = ?'
          ).bind(body.slug, body.name, body.description || '', body.active === false ? 0 : 1, id).run();
          return json({ ok: true });
        }
        if (request.method === 'DELETE') {
          const deny = requireAdmin(user);
          if (deny) return deny;
          await DB.prepare('DELETE FROM playbooks WHERE id = ?').bind(id).run();
          return json({ ok: true });
        }
      }
    }

    // ── INTAKE FIELDS (standalone update/delete) ──────────────────────────────
    if (resource === 'fields') {
      if (request.method === 'PUT' && id) {
        const deny = requireAdmin(user);
        if (deny) return deny;
        const body = await request.json();
        await DB.prepare(
          'UPDATE intake_fields SET field_key = ?, label = ?, type = ?, options = ?, sort_order = ? WHERE id = ?'
        ).bind(
          body.field_key, body.label, body.type,
          JSON.stringify(body.options || []),
          body.sort_order ?? 0,
          id
        ).run();
        return json({ ok: true });
      }
      if (request.method === 'DELETE' && id) {
        const deny = requireAdmin(user);
        if (deny) return deny;
        await DB.prepare('DELETE FROM intake_fields WHERE id = ?').bind(id).run();
        return json({ ok: true });
      }
    }

    // ── STEPS (standalone update/delete) ─────────────────────────────────────
    if (resource === 'steps') {
      if (request.method === 'PUT' && id) {
        const deny = requireAdmin(user);
        if (deny) return deny;
        const body = await request.json();
        await DB.prepare(
          'UPDATE steps SET title = ?, body = ?, system = ?, conditions = ?, required = ?, sort_order = ? WHERE id = ?'
        ).bind(
          body.title, body.body || '', body.system || 'manual',
          typeof body.conditions === 'string' ? body.conditions : JSON.stringify(body.conditions || { always: true }),
          body.required === false ? 0 : 1,
          body.sort_order ?? 0,
          id
        ).run();
        return json({ ok: true });
      }
      if (request.method === 'DELETE' && id) {
        const deny = requireAdmin(user);
        if (deny) return deny;
        await DB.prepare('DELETE FROM steps WHERE id = ?').bind(id).run();
        return json({ ok: true });
      }
    }

    // ── COMPONENTS ────────────────────────────────────────────────────────────
    if (resource === 'components') {
      if (request.method === 'GET' && !id) {
        const search = new URL(request.url).searchParams.get('search') || '';
        const system = new URL(request.url).searchParams.get('system') || '';
        const tag    = new URL(request.url).searchParams.get('tag')    || '';
        let q = 'SELECT * FROM components WHERE 1=1';
        const binds = [];
        if (search) { q += ' AND (name LIKE ? OR body LIKE ?)'; binds.push(`%${search}%`, `%${search}%`); }
        if (system) { q += ' AND system = ?'; binds.push(system); }
        if (tag)    { q += ' AND tags LIKE ?'; binds.push(`%${tag}%`); }
        q += ' ORDER BY name';
        const rows = await DB.prepare(q).bind(...binds).all();
        return json(rows.results || []);
      }
      if (request.method === 'POST') {
        const deny = requireAdmin(user);
        if (deny) return deny;
        const body = await request.json();
        const newId = body.id || crypto.randomUUID();
        await DB.prepare(
          'INSERT INTO components (id, name, body, system, tags) VALUES (?, ?, ?, ?, ?)'
        ).bind(newId, body.name || '', body.body || '', body.system || 'manual', JSON.stringify(body.tags || [])).run();
        return json({ id: newId, ...body }, 201);
      }
      if (request.method === 'GET' && id) {
        const row = await DB.prepare('SELECT * FROM components WHERE id = ?').bind(id).first();
        if (!row) return err('Not found', 404);
        return json(row);
      }
      if (request.method === 'PUT' && id) {
        const deny = requireAdmin(user);
        if (deny) return deny;
        const body = await request.json();
        await DB.prepare(
          'UPDATE components SET name = ?, body = ?, system = ?, tags = ? WHERE id = ?'
        ).bind(body.name || '', body.body || '', body.system || 'manual', JSON.stringify(body.tags || []), id).run();
        return json({ ok: true });
      }
      if (request.method === 'DELETE' && id) {
        const deny = requireAdmin(user);
        if (deny) return deny;
        await DB.prepare('DELETE FROM components WHERE id = ?').bind(id).run();
        return json({ ok: true });
      }
    }

    // ── CASES ─────────────────────────────────────────────────────────────────
    if (resource === 'cases') {
      if (request.method === 'GET' && !id) {
        const qp = new URL(request.url).searchParams;
        const mine  = qp.get('mine') === 'true';
        const limit = Math.min(parseInt(qp.get('limit') || '50', 10), 200);
        const offset = parseInt(qp.get('offset') || '0', 10);

        let q = `
          SELECT c.*, p.name AS playbook_name, p.slug AS playbook_slug
          FROM cases c
          LEFT JOIN playbooks p ON c.playbook_id = p.id
          WHERE 1=1`;
        const binds = [];
        if (mine || !user.isAdmin) {
          q += ' AND c.created_by = ?';
          binds.push(user.email);
        }
        q += ' ORDER BY c.updated_at DESC LIMIT ? OFFSET ?';
        binds.push(limit, offset);

        const rows = await DB.prepare(q).bind(...binds).all();
        const total = await DB.prepare(
          mine || !user.isAdmin
            ? 'SELECT COUNT(*) AS n FROM cases WHERE created_by = ?'
            : 'SELECT COUNT(*) AS n FROM cases'
        ).bind(...(mine || !user.isAdmin ? [user.email] : [])).first();

        return json({ cases: rows.results || [], total: total?.n || 0 });
      }

      if (request.method === 'POST') {
        const body = await request.json();
        const newId = crypto.randomUUID();
        await DB.prepare(
          'INSERT INTO cases (id, playbook_id, intake_data, completed_steps, created_by) VALUES (?, ?, ?, ?, ?)'
        ).bind(
          newId,
          body.playbook_id,
          JSON.stringify(body.intake_data || {}),
          JSON.stringify([]),
          user.email
        ).run();
        return json({ id: newId }, 201);
      }

      if (request.method === 'GET' && id) {
        const row = await DB.prepare(
          `SELECT c.*, p.name AS playbook_name, p.slug AS playbook_slug
           FROM cases c LEFT JOIN playbooks p ON c.playbook_id = p.id
           WHERE c.id = ?`
        ).bind(id).first();
        if (!row) return err('Not found', 404);
        if (!user.isAdmin && row.created_by !== user.email) return err('Forbidden', 403);
        return json(row);
      }

      if (request.method === 'PUT' && id) {
        const row = await DB.prepare('SELECT created_by FROM cases WHERE id = ?').bind(id).first();
        if (!row) return err('Not found', 404);
        if (!user.isAdmin && row.created_by !== user.email) return err('Forbidden', 403);
        const body = await request.json();
        await DB.prepare(
          "UPDATE cases SET completed_steps = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(JSON.stringify(body.completed_steps || []), id).run();
        return json({ ok: true });
      }
    }

    return err('Not found', 404);
  } catch (e) {
    console.error('Playbook API error:', e);
    return err('Internal server error: ' + e.message, 500);
  }
}
