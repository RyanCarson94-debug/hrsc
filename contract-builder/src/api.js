/**
 * API client — wraps all fetch calls to /api/*
 * All methods return parsed JSON or throw an Error.
 */

const BASE = "/api";

async function request(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Settings ──────────────────────────────────────────────────────────────────
export const getSettings  = ()       => request("GET",  "/settings");
export const saveSettings = (data)   => request("PUT",  "/settings", data);

// ── Templates ─────────────────────────────────────────────────────────────────
export const getTemplates    = ()       => request("GET",    "/templates");
export const createTemplate  = (data)   => request("POST",   "/templates",       data);
export const updateTemplate  = (id, d)  => request("PUT",    `/templates/${id}`, d);
export const deleteTemplate  = (id)     => request("DELETE", `/templates/${id}`);

// ── Clauses ───────────────────────────────────────────────────────────────────
export const getClauses    = ()       => request("GET",    "/clauses");
export const createClause  = (data)   => request("POST",   "/clauses",       data);
export const updateClause  = (id, d)  => request("PUT",    `/clauses/${id}`, d);
export const deleteClause  = (id)     => request("DELETE", `/clauses/${id}`);

// ── Audit log ─────────────────────────────────────────────────────────────────
export const logAudit      = (entry)  => request("POST",  "/audit", entry);
export const getAuditLog   = (params) => request("GET",   `/audit${params||""}`);

// ── Document generations ──────────────────────────────────────────────────────
export const saveGeneration   = (data) => request("POST", "/generations", data);
export const getGenerations   = (params) => request("GET", `/generations${params||""}`);
export const getGeneration    = (id)   => request("GET",  `/generations/${id}`);