/**
 * Cloudflare Pages Function — /functions/api/[[route]].js
 *
 * Routes:
 *   GET    /api/settings                → fetch settings blob
 *   PUT    /api/settings                → save settings blob
 *
 *   GET    /api/templates               → list all templates
 *   POST   /api/templates               → create template
 *   PUT    /api/templates/:id           → update template
 *   DELETE /api/templates/:id           → delete template
 *
 *   GET    /api/clauses                 → list all clauses
 *   POST   /api/clauses                 → create clause
 *   PUT    /api/clauses/:id             → update clause (snapshots old content)
 *   DELETE /api/clauses/:id             → delete clause
 *   GET    /api/clauses/:id/usage       → list templates referencing this clause
 *   GET    /api/clauses/:id/versions    → list saved content versions
 *
 *   GET    /api/rules                   → list all rules
 *   POST   /api/rules                   → create rule
 *   PUT    /api/rules/:id               → update rule
 *   DELETE /api/rules/:id               → delete rule
 *
 *   GET    /api/audit                   → list audit log entries (?action=&recordType=&userName=&from=&to=&limit=&offset=)
 *   POST   /api/audit                   → write audit log entry
 *
 *   GET    /api/generations             → list generation snapshots (?search=&from=&to=&limit=&offset=)
 *   POST   /api/generations             → save generation snapshot
 *   GET    /api/generations/:id         → fetch single generation snapshot
 *
 *   GET    /api/users                   → list all users
 *   POST   /api/users                   → create user
 *   PUT    /api/users/:id               → update user
 *   DELETE /api/users/:id               → delete user
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

  // Guard: D1 binding must be present
  if (!DB) {
    return json({
      error: "Database not available. The D1 binding 'DB' is not configured. " +
             "Go to Cloudflare Dashboard → Pages project → Settings → Functions → " +
             "D1 database bindings and add: Variable name = DB, Database = hrsc-contract-builder. " +
             "Then redeploy. If the database does not exist yet, run: " +
             "npx wrangler d1 create hrsc-contract-builder && npx wrangler d1 execute hrsc-contract-builder --remote --file=schema.sql"
    }, 503);
  }

  const url = new URL(request.url);
  // Strip /api/ prefix, split into parts
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const resource = parts[0]; // templates | clauses | rules | settings | audit | generations | users
  const id       = parts[1]; // optional record id
  const sub      = parts[2]; // optional sub-resource (usage, versions)

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
      // Sub-resource: usage
      if (request.method === "GET" && id && sub === "usage") {
        const rows = await DB.prepare("SELECT id, data FROM templates").all();
        const using = rows.results
          .filter(r => r.data.includes(`"clauseId":"${id}"`))
          .map(r => { const t = JSON.parse(r.data); return { id: t.id, name: t.name }; });
        return json({ templates: using, count: using.length });
      }

      // Sub-resource: versions
      if (request.method === "GET" && id && sub === "versions") {
        const rows = await DB.prepare(
          "SELECT id, clause_id, name, saved_by, saved_at, substr(content,1,200) AS preview FROM clause_versions WHERE clause_id = ? ORDER BY saved_at DESC LIMIT 30"
        ).bind(id).all();
        return json(rows.results);
      }

      if (request.method === "GET" && !id) {
        const rows = await DB.prepare("SELECT data FROM clauses ORDER BY rowid").all();
        return json(rows.results.map(r => JSON.parse(r.data)));
      }
      if (request.method === "POST") {
        const body = await request.json();
        const { _savedBy: _, ...cleanBody } = body;
        await DB.prepare("INSERT INTO clauses (id, data, is_global) VALUES (?, ?, ?)")
          .bind(cleanBody.id, JSON.stringify(cleanBody), cleanBody.global ? 1 : 0).run();
        return json(cleanBody, 201);
      }
      if (request.method === "PUT" && id && !sub) {
        const body = await request.json();
        const savedBy = body._savedBy || "Unknown";
        const { _savedBy: _, ...cleanBody } = body;

        // Snapshot old content if it changed
        const old = await DB.prepare("SELECT data FROM clauses WHERE id = ?").bind(id).first();
        if (old) {
          const oldData = JSON.parse(old.data);
          if (oldData.content !== cleanBody.content) {
            await DB.prepare(
              "INSERT INTO clause_versions (id, clause_id, content, name, saved_by, saved_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
            ).bind(crypto.randomUUID(), id, oldData.content || "", oldData.name || "", savedBy).run();
          }
        }

        await DB.prepare("UPDATE clauses SET data = ?, is_global = ?, updated_at = datetime('now') WHERE id = ?")
          .bind(JSON.stringify(cleanBody), cleanBody.global ? 1 : 0, id).run();
        return json(cleanBody);
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
        const limit      = parseInt(url.searchParams.get("limit")  || "25", 10);
        const offset     = parseInt(url.searchParams.get("offset") || "0",  10);
        const action     = url.searchParams.get("action")     || "";
        const recordType = url.searchParams.get("recordType") || "";
        const userName   = url.searchParams.get("userName")   || "";
        const fromDate   = url.searchParams.get("from")       || "";
        const toDate     = url.searchParams.get("to")         || "";

        const conds = [], filterArgs = [];
        if (action)     { conds.push("action = ?");             filterArgs.push(action); }
        if (recordType) { conds.push("record_type = ?");        filterArgs.push(recordType); }
        if (userName)   { conds.push("user_name LIKE ?");       filterArgs.push(`%${userName}%`); }
        if (fromDate)   { conds.push("timestamp >= ?");         filterArgs.push(fromDate); }
        if (toDate)     { conds.push("timestamp <= ?");         filterArgs.push(toDate + "T23:59:59"); }
        const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

        const rows = await DB.prepare(
          `SELECT id, action, record_type, record_name, user_name, detail, timestamp FROM audit_log ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
        ).bind(...filterArgs, limit, offset).all();
        const total = await DB.prepare(`SELECT COUNT(*) AS n FROM audit_log ${where}`).bind(...filterArgs).first();
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
        const limit    = parseInt(url.searchParams.get("limit")  || "20", 10);
        const offset   = parseInt(url.searchParams.get("offset") || "0",  10);
        const search   = url.searchParams.get("search")   || "";
        const fromDate = url.searchParams.get("from")     || "";
        const toDate   = url.searchParams.get("to")       || "";

        const conds = [], filterArgs = [];
        if (search) {
          conds.push("(employee_name LIKE ? OR template_name LIKE ? OR user_name LIKE ?)");
          filterArgs.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (fromDate) { conds.push("generated_at >= ?"); filterArgs.push(fromDate); }
        if (toDate)   { conds.push("generated_at <= ?"); filterArgs.push(toDate + "T23:59:59"); }
        const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

        const rows = await DB.prepare(
          `SELECT id, template_name, employee_name, country, user_name, generated_at FROM document_generations ${where} ORDER BY generated_at DESC LIMIT ? OFFSET ?`
        ).bind(...filterArgs, limit, offset).all();
        const total = await DB.prepare(`SELECT COUNT(*) AS n FROM document_generations ${where}`).bind(...filterArgs).first();
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

    // ── USERS ─────────────────────────────────────────────────────────────────
    if (resource === "users") {
      if (request.method === "GET") {
        const rows = await DB.prepare("SELECT id, name, email, role, created_at FROM users ORDER BY name").all();
        return json(rows.results);
      }
      if (request.method === "POST") {
        const body = await request.json();
        const newId = body.id || crypto.randomUUID();
        await DB.prepare("INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, ?)")
          .bind(newId, body.name || "", body.email || "", body.role || "Adviser").run();
        return json({ id: newId, name: body.name, email: body.email || "", role: body.role || "Adviser" }, 201);
      }
      if (request.method === "PUT" && id) {
        const body = await request.json();
        await DB.prepare("UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?")
          .bind(body.name || "", body.email || "", body.role || "Adviser", id).run();
        return json({ ok: true });
      }
      if (request.method === "DELETE" && id) {
        await DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
        return json({ ok: true });
      }
    }

    // ── IDENTITY (Cloudflare Access) ──────────────────────────────────────────
    if (resource === "me") {
      if (request.method === "GET") {
        const email = request.headers.get("Cf-Access-Authenticated-User-Email") || "";
        const name  = email
          ? email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
          : "";
        return json({ email, name });
      }
    }

    return err("Not found", 404);
  } catch (e) {
    console.error(e);
    return err("Internal server error: " + e.message, 500);
  }
}
