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
      if (request.method === "POST") {
        const body = await request.json();
        await DB.prepare(
          "INSERT INTO audit_log (action, record_type, record_name, user_name, detail, timestamp) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(
          body.action || "",
          body.recordType || "",
          body.recordName || "",
          body.userName || "Unknown",
          body.detail || "{}",
          body.timestamp || new Date().toISOString()
        ).run();
        return json({ ok: true }, 201);
      }
      if (request.method === "GET") {
        const u = new URL(request.url);
        const action     = u.searchParams.get("action")     || "";
        const recordType = u.searchParams.get("recordType") || "";
        const userName   = u.searchParams.get("userName")   || "";
        const limit      = parseInt(u.searchParams.get("limit")  || "25");
        const offset     = parseInt(u.searchParams.get("offset") || "0");

        let q = "SELECT * FROM audit_log WHERE 1=1";
        const binds = [];
        if (action)     { q += " AND action = ?";      binds.push(action); }
        if (recordType) { q += " AND record_type = ?"; binds.push(recordType); }
        if (userName)   { q += " AND user_name LIKE ?"; binds.push(`%${userName}%`); }
        q += " ORDER BY timestamp DESC LIMIT ? OFFSET ?";
        binds.push(limit, offset);

        const rows = await DB.prepare(q).bind(...binds).all();
        return json(rows.results);
      }
    }

    // ── DOCUMENT GENERATIONS ──────────────────────────────────────────────────
    if (resource === "generations") {
      if (request.method === "POST") {
        const body = await request.json();
        await DB.prepare(
          "INSERT INTO document_generations (id, template_name, employee_name, country, user_name, generated_at, snapshot) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          body.id,
          body.templateName || "",
          body.employeeName || "",
          body.country || "",
          body.userName || "Unknown",
          body.generatedAt || new Date().toISOString(),
          body.snapshot || "{}"
        ).run();
        // Also write to audit log
        await DB.prepare(
          "INSERT INTO audit_log (action, record_type, record_name, user_name, detail, timestamp) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(
          "generate", "document",
          `${body.templateName} — ${body.employeeName}`,
          body.userName || "Unknown",
          JSON.stringify({ country: body.country }),
          body.generatedAt || new Date().toISOString()
        ).run();
        return json({ ok: true }, 201);
      }
      if (request.method === "GET" && !id) {
        const u      = new URL(request.url);
        const search = u.searchParams.get("search") || "";
        const limit  = parseInt(u.searchParams.get("limit")  || "20");
        const offset = parseInt(u.searchParams.get("offset") || "0");

        let q = "SELECT id, template_name, employee_name, country, user_name, generated_at FROM document_generations WHERE 1=1";
        const binds = [];
        if (search) {
          q += " AND (employee_name LIKE ? OR template_name LIKE ? OR user_name LIKE ?)";
          binds.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        q += " ORDER BY generated_at DESC LIMIT ? OFFSET ?";
        binds.push(limit, offset);

        const rows = await DB.prepare(q).bind(...binds).all();
        return json(rows.results);
      }
      if (request.method === "GET" && id) {
        const row = await DB.prepare("SELECT * FROM document_generations WHERE id = ?").bind(id).first();
        if (!row) return err("Not found", 404);
        return json(row);
      }
    }

    return err("Not found", 404);
  } catch (e) {
    console.error(e);
    return err("Internal server error: " + e.message, 500);
  }
}