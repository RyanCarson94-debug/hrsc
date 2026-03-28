/**
 * Cloudflare Pages Function — /functions/api/[[route]].js
 *
 * Routes:
 *   GET    /api/settings          → fetch settings blob
 *   PUT    /api/settings          → save settings blob
 *
 *   GET    /api/templates         → list all templates
 *   POST   /api/templates         → create template
 *   PUT    /api/templates/:id     → update template
 *   DELETE /api/templates/:id     → delete template
 *
 *   GET    /api/clauses           → list all clauses
 *   POST   /api/clauses           → create clause
 *   PUT    /api/clauses/:id       → update clause
 *   DELETE /api/clauses/:id       → delete clause
 *
 *   GET    /api/rules             → list all rules
 *   POST   /api/rules             → create rule
 *   PUT    /api/rules/:id         → update rule
 *   DELETE /api/rules/:id         → delete rule
 *
 *   GET    /api/audit             → list audit log entries (?limit=&offset=)
 *   POST   /api/audit             → write audit log entry
 *
 *   GET    /api/generations       → list generation snapshots (?limit=&offset=)
 *   POST   /api/generations       → save generation snapshot
 *   GET    /api/generations/:id   → fetch single generation snapshot
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function err(msg, status = 400) {
  return json({ error: msg }, status);
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const DB = env.DB;

  // Preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  const url = new URL(request.url);
  // Strip /api/ prefix, split into parts
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const resource = parts[0]; // templates | clauses | rules | settings
  const id = parts[1];       // optional record id

  try {
    // ── SETTINGS ──────────────────────────────────────────────────────────────
    if (resource === "settings") {
      if (request.method === "GET") {
        const row = await DB.prepare("SELECT value FROM settings WHERE key = 'main'").first();
        return json(row ? JSON.parse(row.value) : null);
      }
      if (request.method === "PUT") {
        const body = await request.json();
        await DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('main', ?)")
          .bind(JSON.stringify(body)).run();
        return json({ ok: true });
      }
    }

    // ── TEMPLATES ─────────────────────────────────────────────────────────────
    if (resource === "templates") {
      if (request.method === "GET") {
        const rows = await DB.prepare("SELECT data FROM templates ORDER BY rowid").all();
        return json(rows.results.map(r => JSON.parse(r.data)));
      }
      if (request.method === "POST") {
        const body = await request.json();
        await DB.prepare("INSERT INTO templates (id, data, country, entity_id) VALUES (?, ?, ?, ?)")
          .bind(body.id, JSON.stringify(body), body.country || null, body.entityId || null).run();
        return json(body, 201);
      }
      if (request.method === "PUT" && id) {
        const body = await request.json();
        await DB.prepare("UPDATE templates SET data = ?, country = ?, entity_id = ?, updated_at = datetime('now') WHERE id = ?")
          .bind(JSON.stringify(body), body.country || null, body.entityId || null, id).run();
        return json(body);
      }
      if (request.method === "DELETE" && id) {
        await DB.prepare("DELETE FROM templates WHERE id = ?").bind(id).run();
        return json({ ok: true });
      }
    }

    // ── CLAUSES ───────────────────────────────────────────────────────────────
    if (resource === "clauses") {
      if (request.method === "GET") {
        const rows = await DB.prepare("SELECT data FROM clauses ORDER BY rowid").all();
        return json(rows.results.map(r => JSON.parse(r.data)));
      }
      if (request.method === "POST") {
        const body = await request.json();
        await DB.prepare("INSERT INTO clauses (id, data, is_global) VALUES (?, ?, ?)")
          .bind(body.id, JSON.stringify(body), body.global ? 1 : 0).run();
        return json(body, 201);
      }
      if (request.method === "PUT" && id) {
        const body = await request.json();
        await DB.prepare("UPDATE clauses SET data = ?, is_global = ?, updated_at = datetime('now') WHERE id = ?")
          .bind(JSON.stringify(body), body.global ? 1 : 0, id).run();
        return json(body);
      }
      if (request.method === "DELETE" && id) {
        await DB.prepare("DELETE FROM clauses WHERE id = ?").bind(id).run();
        return json({ ok: true });
      }
    }

    // ── RULES ─────────────────────────────────────────────────────────────────
    if (resource === "rules") {
      if (request.method === "GET") {
        const rows = await DB.prepare("SELECT data FROM rules ORDER BY priority").all();
        return json(rows.results.map(r => JSON.parse(r.data)));
      }
      if (request.method === "POST") {
        const body = await request.json();
        await DB.prepare("INSERT INTO rules (id, data, country, entity_id, priority, active) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(body.id, JSON.stringify(body), body.country || null, body.entityId || null, body.priority || 1, body.active ? 1 : 0).run();
        return json(body, 201);
      }
      if (request.method === "PUT" && id) {
        const body = await request.json();
        await DB.prepare("UPDATE rules SET data = ?, country = ?, entity_id = ?, priority = ?, active = ?, updated_at = datetime('now') WHERE id = ?")
          .bind(JSON.stringify(body), body.country || null, body.entityId || null, body.priority || 1, body.active ? 1 : 0, id).run();
        return json(body);
      }
      if (request.method === "DELETE" && id) {
        await DB.prepare("DELETE FROM rules WHERE id = ?").bind(id).run();
        return json({ ok: true });
      }
    }

    // ── AUDIT LOG ─────────────────────────────────────────────────────────────
    if (resource === "audit") {
      if (request.method === "GET") {
        const limit      = parseInt(url.searchParams.get("limit")      || "25", 10);
        const offset     = parseInt(url.searchParams.get("offset")     || "0",  10);
        const action     = url.searchParams.get("action")     || "";
        const recordType = url.searchParams.get("recordType") || "";
        const userName   = url.searchParams.get("userName")   || "";

        const conds = [], filterArgs = [];
        if (action)     { conds.push("action = ?");       filterArgs.push(action); }
        if (recordType) { conds.push("record_type = ?");  filterArgs.push(recordType); }
        if (userName)   { conds.push("user_name LIKE ?"); filterArgs.push(`%${userName}%`); }
        const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

        const rows = await DB.prepare(
          `SELECT id, action, record_type, record_name, user_name, detail, timestamp FROM audit_log ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
        ).bind(...filterArgs, limit, offset).all();
        const total = await DB.prepare(`SELECT COUNT(*) AS n FROM audit_log ${where}`)
          .bind(...filterArgs).first();
        return json({ entries: rows.results, total: total.n });
      }
      if (request.method === "POST") {
        const body = await request.json();
        await DB.prepare(
          "INSERT INTO audit_log (action, record_type, record_name, user_name, detail, timestamp) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(
          body.action      || "",
          body.recordType  || "",
          body.recordName  || "",
          body.userName    || "Unknown",
          body.detail      ? JSON.stringify(body.detail) : null,
          body.timestamp   || new Date().toISOString()
        ).run();
        return json({ ok: true }, 201);
      }
    }

    // ── DOCUMENT GENERATIONS ──────────────────────────────────────────────────
    if (resource === "generations") {
      if (request.method === "GET" && id) {
        const row = await DB.prepare("SELECT * FROM document_generations WHERE id = ?").bind(id).first();
        if (!row) return err("Not found", 404);
        return json({ ...row, snapshot: JSON.parse(row.snapshot) });
      }
      if (request.method === "GET") {
        const limit  = parseInt(url.searchParams.get("limit")  || "20", 10);
        const offset = parseInt(url.searchParams.get("offset") || "0",  10);
        const search = url.searchParams.get("search") || "";

        const where = search
          ? "WHERE (template_name LIKE ? OR employee_name LIKE ? OR user_name LIKE ?)"
          : "";
        const searchArgs = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];

        const rows = await DB.prepare(
          `SELECT id, template_name, employee_name, country, user_name, generated_at FROM document_generations ${where} ORDER BY generated_at DESC LIMIT ? OFFSET ?`
        ).bind(...searchArgs, limit, offset).all();
        const total = await DB.prepare(`SELECT COUNT(*) AS n FROM document_generations ${where}`)
          .bind(...searchArgs).first();
        return json({ entries: rows.results, total: total.n });
      }
      if (request.method === "POST") {
        const body = await request.json();
        await DB.prepare(
          "INSERT INTO document_generations (id, template_name, employee_name, country, user_name, generated_at, snapshot) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          body.id            || crypto.randomUUID(),
          body.templateName  || "",
          body.employeeName  || "",
          body.country       || null,
          body.userName      || "Unknown",
          body.generatedAt   || new Date().toISOString(),
          JSON.stringify(body.snapshot || {})
        ).run();
        return json({ ok: true }, 201);
      }
    }

    return err("Not found", 404);
  } catch (e) {
    console.error(e);
    return err("Internal server error: " + e.message, 500);
  }
}
