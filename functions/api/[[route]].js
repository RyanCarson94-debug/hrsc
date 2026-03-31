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

    // ── KNOWLEDGE BASE ────────────────────────────────────────────────────────
    if (resource === "kb") {
      // sub = "articles" | "categories" | "stats" | "next-num" | "search-miss" | "favourites" | "comments"
      const kbSub    = parts[1]; // e.g. "articles"
      const kbId     = parts[2]; // e.g. article id or category id
      const kbAction = parts[3]; // e.g. "status" | "feedback" | "related" | "versions" | "comments"
      const kbExtra  = parts[4]; // e.g. relatedId for DELETE

      // ── next article number ──
      if (kbSub === "next-num" && request.method === "GET") {
        const row = await DB.prepare("SELECT article_num FROM kb_articles ORDER BY rowid DESC LIMIT 1").first();
        let next = 1;
        if (row) {
          const m = row.article_num.match(/KB-(\d+)/);
          if (m) next = parseInt(m[1], 10) + 1;
        }
        return json({ num: `KB-${String(next).padStart(4, "0")}` });
      }

      // ── search miss logging ──
      if (kbSub === "search-miss" && request.method === "POST") {
        const body = await request.json();
        await DB.prepare("INSERT INTO kb_search_misses (query, user_name, searched_at) VALUES (?, ?, datetime('now'))")
          .bind(body.query || "", body.userName || "Unknown").run();
        return json({ ok: true }, 201);
      }

      // ── export (AI / RAG friendly bulk dump) ──
      if (kbSub === "export" && request.method === "GET") {
        // Returns all published articles as clean, semantically-labelled JSON.
        // Sections are renamed to their article-type label (e.g. "Resolution" not "section3").
        // HTML tags are stripped so content is plain readable text.
        // Optional ?type= filter; optional ?updated_since=ISO8601 for incremental sync.
        const exportUrl     = new URL(request.url);
        const typeFilter    = exportUrl.searchParams.get("type")          || "";
        const updatedSince  = exportUrl.searchParams.get("updated_since") || "";
        const baseOrigin    = exportUrl.origin; // e.g. https://hrsc.pages.dev

        const SECTION_LABELS = {
          kcs: ["Issue", "Environment", "Resolution", "Cause"],
          qrg: ["Purpose", "Prerequisites", "Steps", "Notes"],
          sop: ["Purpose & Scope", "Roles & Responsibilities", "Procedure", "Related Documents"],
        };
        const TYPE_LABELS = {
          kcs: "KCS Article",
          qrg: "Quick Reference Guide",
          sop: "Standard Operating Procedure",
        };

        function stripHtml(html) {
          if (!html) return "";
          return html
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/p>/gi, "\n")
            .replace(/<\/li>/gi, "\n")
            .replace(/<\/h[1-6]>/gi, "\n")
            .replace(/<[^>]+>/g, "")
            .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
            .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
        }

        let q = "SELECT a.*, c.name as category_name FROM kb_articles a LEFT JOIN kb_categories c ON a.category_id = c.id WHERE a.status = 'published'";
        const binds = [];
        if (typeFilter)   { q += " AND a.article_type = ?"; binds.push(typeFilter); }
        if (updatedSince) { q += " AND a.updated_at >= ?"; binds.push(updatedSince); }
        q += " ORDER BY a.article_num ASC";

        const rows = await DB.prepare(q).bind(...binds).all();
        const exportedArticles = (rows.results || []).map(a => {
          const labels = SECTION_LABELS[a.article_type] || SECTION_LABELS.kcs;
          const sections = {};
          [a.section1, a.section2, a.section3, a.section4].forEach((raw, i) => {
            const text = stripHtml(raw);
            if (text) sections[labels[i]] = text;
          });

          let countries; try { countries = JSON.parse(a.countries || '["All EMEA"]'); } catch { countries = ["All EMEA"]; }
          let tags;      try { tags      = JSON.parse(a.tags      || "[]");            } catch { tags      = []; }

          const out = {
            id:            a.id,
            article_num:   a.article_num,
            url:           `${baseOrigin}/knowledge?article=${a.id}`,
            article_type:  a.article_type,
            type_label:    TYPE_LABELS[a.article_type] || a.article_type,
            title:         a.title,
            category:      a.category_name || "",
            countries,
            tags,
            author:        a.author_name,
            reviewed_by:   a.reviewed_by || "",
            last_reviewed: a.last_reviewed_at || "",
            updated_at:    a.updated_at,
            view_count:    a.view_count || 0,
            sections,
          };
          if (a.article_type === "qrg" && a.workday_path) out.workday_path = a.workday_path;
          return out;
        });

        return new Response(JSON.stringify({
          source:      "HRSC Knowledge Base",
          description: "HRSC internal knowledge base covering EMEA HR processes, Workday guides and standard operating procedures.",
          exported_at: new Date().toISOString(),
          total:       exportedArticles.length,
          articles:    exportedArticles,
        }, null, 2), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=300",
          },
        });
      }

      // ── stats ──
      if (kbSub === "stats" && request.method === "GET") {
        const counts = await DB.prepare(
          "SELECT status, COUNT(*) as n FROM kb_articles GROUP BY status"
        ).all();
        const topViewed = await DB.prepare(
          "SELECT id, article_num, title, article_type, view_count FROM kb_articles WHERE status='published' ORDER BY view_count DESC LIMIT 5"
        ).all();
        const recent = await DB.prepare(
          "SELECT id, article_num, title, article_type, created_at FROM kb_articles WHERE status='published' ORDER BY created_at DESC LIMIT 5"
        ).all();
        const searchMisses = await DB.prepare(
          "SELECT query, COUNT(*) as n FROM kb_search_misses GROUP BY query ORDER BY n DESC LIMIT 10"
        ).all();
        const statusMap = {};
        for (const r of counts.results) statusMap[r.status] = r.n;
        return json({ counts: statusMap, topViewed: topViewed.results, recent: recent.results, searchMisses: searchMisses.results });
      }

      // ── favourites ──
      if (kbSub === "favourites") {
        if (request.method === "GET") {
          const uName = url.searchParams.get("userName") || "";
          const rows = await DB.prepare(
            "SELECT f.article_id, a.article_num, a.title, a.article_type, a.status, a.category_id, a.updated_at FROM kb_favourites f JOIN kb_articles a ON a.id = f.article_id WHERE f.user_name = ? ORDER BY f.created_at DESC"
          ).bind(uName).all();
          return json(rows.results);
        }
        if (request.method === "POST") {
          const body = await request.json();
          await DB.prepare("INSERT OR IGNORE INTO kb_favourites (article_id, user_name) VALUES (?, ?)")
            .bind(body.articleId, body.userName || "Unknown").run();
          return json({ ok: true }, 201);
        }
        // DELETE /api/kb/favourites/:articleId?userName=
        if (request.method === "DELETE" && kbId) {
          const uName = url.searchParams.get("userName") || "";
          await DB.prepare("DELETE FROM kb_favourites WHERE article_id = ? AND user_name = ?")
            .bind(kbId, uName).run();
          return json({ ok: true });
        }
      }

      // ── categories ──
      if (kbSub === "categories") {
        if (request.method === "GET") {
          // Include article counts
          const rows = await DB.prepare(
            "SELECT c.*, (SELECT COUNT(*) FROM kb_articles a WHERE a.category_id = c.id AND a.status = 'published') AS article_count FROM kb_categories c ORDER BY c.sort_order"
          ).all();
          return json(rows.results);
        }
        if (request.method === "POST") {
          const body = await request.json();
          const newId = body.id || crypto.randomUUID();
          await DB.prepare("INSERT INTO kb_categories (id, name, description, color, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(newId, body.name || "", body.description || "", body.color || "#00A28A", body.icon || "", body.sortOrder || 0).run();
          return json({ id: newId, ...body }, 201);
        }
        if (request.method === "PUT" && kbId) {
          const body = await request.json();
          await DB.prepare("UPDATE kb_categories SET name = ?, description = ?, color = ?, icon = ?, sort_order = ? WHERE id = ?")
            .bind(body.name || "", body.description || "", body.color || "#00A28A", body.icon || "", body.sortOrder || 0, kbId).run();
          return json({ ok: true });
        }
        if (request.method === "DELETE" && kbId) {
          await DB.prepare("DELETE FROM kb_categories WHERE id = ?").bind(kbId).run();
          return json({ ok: true });
        }
      }

      // ── resolve/unresolve a comment ──
      if (kbSub === "comments" && kbId && request.method === "PUT") {
        const body = await request.json();
        await DB.prepare("UPDATE kb_comments SET resolved = ? WHERE id = ?")
          .bind(body.resolved ? 1 : 0, kbId).run();
        return json({ ok: true });
      }

      // ── articles ──
      if (kbSub === "articles") {

        // ── sub-actions on a specific article ──
        if (kbId && kbAction) {
          // GET /api/kb/articles/:id/related
          if (kbAction === "related" && request.method === "GET") {
            const rows = await DB.prepare(
              "SELECT a.id, a.article_num, a.title, a.article_type, a.status, a.category_id FROM kb_articles a JOIN kb_related r ON a.id = r.related_id WHERE r.article_id = ?"
            ).bind(kbId).all();
            return json(rows.results);
          }
          // POST /api/kb/articles/:id/related
          if (kbAction === "related" && request.method === "POST") {
            const body = await request.json();
            const relId = body.relatedId;
            if (!relId || relId === kbId) return err("Invalid relatedId");
            await DB.prepare("INSERT OR IGNORE INTO kb_related (article_id, related_id) VALUES (?, ?)")
              .bind(kbId, relId).run();
            await DB.prepare("INSERT OR IGNORE INTO kb_related (article_id, related_id) VALUES (?, ?)")
              .bind(relId, kbId).run();
            return json({ ok: true }, 201);
          }
          // DELETE /api/kb/articles/:id/related/:relatedId
          if (kbAction === "related" && request.method === "DELETE" && kbExtra) {
            await DB.prepare("DELETE FROM kb_related WHERE (article_id = ? AND related_id = ?) OR (article_id = ? AND related_id = ?)")
              .bind(kbId, kbExtra, kbExtra, kbId).run();
            return json({ ok: true });
          }
          // GET /api/kb/articles/:id/versions
          if (kbAction === "versions" && request.method === "GET") {
            const rows = await DB.prepare(
              "SELECT id, article_id, saved_by, saved_at, substr(snapshot,1,300) AS preview FROM kb_versions WHERE article_id = ? ORDER BY saved_at DESC LIMIT 20"
            ).bind(kbId).all();
            return json(rows.results);
          }
          // GET /api/kb/articles/:id/comments
          if (kbAction === "comments" && request.method === "GET") {
            const rows = await DB.prepare(
              "SELECT * FROM kb_comments WHERE article_id = ? ORDER BY created_at ASC"
            ).bind(kbId).all();
            return json(rows.results);
          }
          // POST /api/kb/articles/:id/comments
          if (kbAction === "comments" && request.method === "POST") {
            const body = await request.json();
            await DB.prepare("INSERT INTO kb_comments (article_id, author_name, comment) VALUES (?, ?, ?)")
              .bind(kbId, body.authorName || "Unknown", body.comment || "").run();
            return json({ ok: true }, 201);
          }
          // POST /api/kb/articles/:id/feedback
          if (kbAction === "feedback" && request.method === "POST") {
            const body = await request.json();
            await DB.prepare("INSERT INTO kb_feedback (article_id, helpful, comment, user_name) VALUES (?, ?, ?, ?)")
              .bind(kbId, body.helpful ? 1 : 0, body.comment || "", body.userName || "Unknown").run();
            if (body.helpful) {
              await DB.prepare("UPDATE kb_articles SET helpful_yes = helpful_yes + 1 WHERE id = ?").bind(kbId).run();
            } else {
              await DB.prepare("UPDATE kb_articles SET helpful_no = helpful_no + 1 WHERE id = ?").bind(kbId).run();
            }
            return json({ ok: true }, 201);
          }
          // POST /api/kb/articles/:id/status
          if (kbAction === "status" && request.method === "POST") {
            const body = await request.json();
            const newStatus = body.status;
            const allowed = ["draft", "review", "published", "archived"];
            if (!allowed.includes(newStatus)) return err("Invalid status");
            const updates = { status: newStatus };
            if (newStatus === "published") {
              updates.reviewedBy = body.reviewedBy || "";
              updates.lastReviewedAt = new Date().toISOString();
              await DB.prepare("UPDATE kb_articles SET status = ?, reviewed_by = ?, last_reviewed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
                .bind(newStatus, updates.reviewedBy, kbId).run();
            } else {
              await DB.prepare("UPDATE kb_articles SET status = ?, updated_at = datetime('now') WHERE id = ?")
                .bind(newStatus, kbId).run();
            }
            return json({ ok: true });
          }
        }

        // ── GET /api/kb/articles/:id (single article) ──
        if (request.method === "GET" && kbId && !kbAction) {
          const row = await DB.prepare("SELECT * FROM kb_articles WHERE id = ?").bind(kbId).first();
          if (!row) return err("Not found", 404);
          await DB.prepare("UPDATE kb_articles SET view_count = view_count + 1 WHERE id = ?").bind(kbId).run();
          return json(row);
        }

        // ── GET /api/kb/articles (list) ──
        if (request.method === "GET" && !kbId) {
          const limit    = parseInt(url.searchParams.get("limit")  || "20", 10);
          const offset   = parseInt(url.searchParams.get("offset") || "0",  10);
          const search   = url.searchParams.get("search")   || "";
          const status   = url.searchParams.get("status")   || "";
          const category = url.searchParams.get("category") || "";
          const country  = url.searchParams.get("country")  || "";
          const type     = url.searchParams.get("type")     || "";
          const role     = url.searchParams.get("role")     || "";
          const userName = url.searchParams.get("userName") || "";

          const conds = [], args = [];
          // Non-admins only see published (or their own drafts)
          if (role !== "Admin") {
            conds.push("(status = 'published' OR author_name = ?)");
            args.push(userName || "__nobody__");
          }
          if (status)   { conds.push("status = ?");         args.push(status); }
          if (category) { conds.push("category_id = ?");    args.push(category); }
          if (type)     { conds.push("article_type = ?");   args.push(type); }
          if (country)  { conds.push("countries LIKE ?");   args.push(`%${country}%`); }
          if (search) {
            conds.push("(title LIKE ? OR section1 LIKE ? OR section2 LIKE ? OR section3 LIKE ? OR section4 LIKE ? OR tags LIKE ?)");
            const s = `%${search}%`;
            args.push(s, s, s, s, s, s);
          }
          const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
          const rows = await DB.prepare(
            `SELECT id, article_num, article_type, title, section1, category_id, countries, tags, status, author_name, view_count, helpful_yes, helpful_no, workday_path, created_at, updated_at FROM kb_articles ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`
          ).bind(...args, limit, offset).all();
          const total = await DB.prepare(`SELECT COUNT(*) AS n FROM kb_articles ${where}`).bind(...args).first();
          return json({ articles: rows.results, total: total.n });
        }

        // ── POST /api/kb/articles ──
        if (request.method === "POST" && !kbId) {
          const body = await request.json();
          const newId = body.id || crypto.randomUUID();
          await DB.prepare(
            "INSERT INTO kb_articles (id, article_num, article_type, title, section1, section2, section3, section4, workday_path, category_id, countries, tags, status, author_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ).bind(
            newId,
            body.articleNum || "KB-0001",
            body.articleType || "kcs",
            body.title || "",
            body.section1 || "",
            body.section2 || "",
            body.section3 || "",
            body.section4 || "",
            body.workdayPath || "",
            body.categoryId || "",
            JSON.stringify(body.countries || ["All EMEA"]),
            JSON.stringify(body.tags || []),
            body.status || "draft",
            body.authorName || "Unknown"
          ).run();
          return json({ id: newId, ...body }, 201);
        }

        // ── PUT /api/kb/articles/:id ──
        if (request.method === "PUT" && kbId && !kbAction) {
          const body = await request.json();
          const savedBy = body._savedBy || "Unknown";
          const { _savedBy: _, ...clean } = body;

          // Snapshot previous version if content changed
          const old = await DB.prepare("SELECT * FROM kb_articles WHERE id = ?").bind(kbId).first();
          if (old) {
            const contentChanged =
              old.section1 !== (clean.section1 || "") ||
              old.section2 !== (clean.section2 || "") ||
              old.section3 !== (clean.section3 || "") ||
              old.section4 !== (clean.section4 || "");
            if (contentChanged) {
              await DB.prepare("INSERT INTO kb_versions (id, article_id, snapshot, saved_by) VALUES (?, ?, ?, ?)")
                .bind(crypto.randomUUID(), kbId, JSON.stringify(old), savedBy).run();
            }
          }

          await DB.prepare(
            "UPDATE kb_articles SET article_type=?, title=?, section1=?, section2=?, section3=?, section4=?, workday_path=?, category_id=?, countries=?, tags=?, updated_at=datetime('now') WHERE id=?"
          ).bind(
            clean.articleType || "kcs",
            clean.title || "",
            clean.section1 || "",
            clean.section2 || "",
            clean.section3 || "",
            clean.section4 || "",
            clean.workdayPath || "",
            clean.categoryId || "",
            JSON.stringify(clean.countries || ["All EMEA"]),
            JSON.stringify(clean.tags || []),
            kbId
          ).run();
          return json({ ok: true });
        }

        // ── DELETE /api/kb/articles/:id ──
        if (request.method === "DELETE" && kbId && !kbAction) {
          await DB.prepare("DELETE FROM kb_articles WHERE id = ?").bind(kbId).run();
          await DB.prepare("DELETE FROM kb_related WHERE article_id = ? OR related_id = ?").bind(kbId, kbId).run();
          await DB.prepare("DELETE FROM kb_versions WHERE article_id = ?").bind(kbId).run();
          await DB.prepare("DELETE FROM kb_comments WHERE article_id = ?").bind(kbId).run();
          await DB.prepare("DELETE FROM kb_favourites WHERE article_id = ?").bind(kbId).run();
          await DB.prepare("DELETE FROM kb_feedback WHERE article_id = ?").bind(kbId).run();
          return json({ ok: true });
        }
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
