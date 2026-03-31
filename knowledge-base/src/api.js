const BASE = "/api/kb";

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

const get  = (path)        => req("GET",    path);
const post = (path, body)  => req("POST",   path, body);
const put  = (path, body)  => req("PUT",    path, body);
const del  = (path)        => req("DELETE", path);

// ── Articles ──────────────────────────────────────────────────────────────────
export const listArticles = (params={}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k,v]) => { if (v !== undefined && v !== "") q.set(k, v); });
  const qs = q.toString();
  return get(`/articles${qs ? "?" + qs : ""}`);
};
export const getArticle      = (id)         => get(`/articles/${id}`);
export const createArticle   = (body)       => post("/articles", body);
export const updateArticle   = (id, body)   => put(`/articles/${id}`, body);
export const deleteArticle   = (id)         => del(`/articles/${id}`);
export const changeStatus    = (id, status, extra={}) => post(`/articles/${id}/status`, { status, ...extra });
export const submitFeedback  = (id, body)   => post(`/articles/${id}/feedback`, body);

// ── Related ───────────────────────────────────────────────────────────────────
export const getRelated      = (id)         => get(`/articles/${id}/related`);
export const addRelated      = (id, relId)  => post(`/articles/${id}/related`, { relatedId: relId });
export const removeRelated   = (id, relId)  => del(`/articles/${id}/related/${relId}`);

// ── Versions ──────────────────────────────────────────────────────────────────
export const getVersions     = (id)         => get(`/articles/${id}/versions`);

// ── Comments ──────────────────────────────────────────────────────────────────
export const getComments     = (id)         => get(`/articles/${id}/comments`);
export const addComment      = (id, body)   => post(`/articles/${id}/comments`, body);
export const resolveComment  = (commentId, resolved) => put(`/comments/${commentId}`, { resolved });

// ── Favourites ────────────────────────────────────────────────────────────────
export const getFavourites   = (userName)   => get(`/favourites?userName=${encodeURIComponent(userName)}`);
export const addFavourite    = (articleId, userName) => post("/favourites", { articleId, userName });
export const removeFavourite = (articleId, userName) => del(`/favourites/${articleId}?userName=${encodeURIComponent(userName)}`);

// ── Categories ────────────────────────────────────────────────────────────────
export const listCategories  = ()           => get("/categories");
export const createCategory  = (body)       => post("/categories", body);
export const updateCategory  = (id, body)   => put(`/categories/${id}`, body);
export const deleteCategory  = (id)         => del(`/categories/${id}`);

// ── Countries ─────────────────────────────────────────────────────────────────
export const listCountries   = ()           => get("/countries");
export const createCountry   = (body)       => post("/countries", body);
export const updateCountry   = (id, body)   => put(`/countries/${id}`, body);
export const deleteCountry   = (id)         => del(`/countries/${id}`);

// ── Misc ──────────────────────────────────────────────────────────────────────
export const getStats        = ()           => get("/stats");
export const getNextNum      = ()           => get("/next-num");
export const logSearchMiss   = (query, userName) => post("/search-miss", { query, userName }).catch(()=>{});
export const getMe           = ()           => fetch("/api/me").then(r => r.ok ? r.json() : { email:"", name:"" });
export const getUsers        = ()           => fetch("/api/users").then(r => r.ok ? r.json() : []);
