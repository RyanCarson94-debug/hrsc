const BASE = "/api/law-monitor";

async function req(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || `HTTP ${res.status}`);
  }
  return res.json();
}

const get  = (path)       => req("GET",  path);
const post = (path, body) => req("POST", path, body);
const put  = (path, body) => req("PUT",  path, body);
const del  = (path)       => req("DELETE", path);

// ── Changes ───────────────────────────────────────────────────────────────────
export const listChanges = (params = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") q.set(k, v); });
  const qs = q.toString();
  return get(`/changes${qs ? "?" + qs : ""}`);
};

export const markRead    = (id)  => put(`/changes/${id}/read`, {});
export const markUnread  = (id)  => put(`/changes/${id}/unread`, {});
export const starChange  = (id)  => put(`/changes/${id}/star`, {});
export const unstarChange = (id) => put(`/changes/${id}/unstar`, {});
export const dismissChange = (id) => del(`/changes/${id}`);
export const markAllRead = ()    => post("/changes/mark-all-read", {});

// ── Sources ───────────────────────────────────────────────────────────────────
export const listSources   = ()              => get("/sources");
export const toggleSource  = (id, active)    => put(`/sources/${id}`, { active });

// ── Scan ──────────────────────────────────────────────────────────────────────
export const triggerScan = () => post("/scan", {});
export const getScanStatus = () => get("/scan/status");
