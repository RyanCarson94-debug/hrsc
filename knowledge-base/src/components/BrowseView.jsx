import { useState, useEffect, useCallback } from "react";
import { B, SH, CARD, BS, TAG, LBL, TypeBadge, StatusBadge, typeMeta, EMEA_COUNTRIES, Skeleton, EmptyState } from "./shared.jsx";
import * as api from "../api.js";
import { ArticleCard } from "./HomeView.jsx";

const TYPE_OPTIONS = [
  { key: "", label: "All Types" },
  { key: "kcs", label: "KCS Articles" },
  { key: "qrg", label: "Quick Reference Guides" },
  { key: "sop", label: "SOPs" },
];

const LIMIT = 20;

export default function BrowseView({ user, categories, initialCategoryId, onOpenArticle, onNewArticle, isFavourited, toggleFavourite }) {
  const [articles, setArticles]   = useState([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(0);

  const [categoryFilter, setCategoryFilter] = useState(initialCategoryId || "");
  const [typeFilter, setTypeFilter]         = useState("");
  const [statusFilter, setStatusFilter]     = useState(user.role === "Admin" ? "" : "published");
  const [countryFilter, setCountryFilter]   = useState("");
  const [searchFilter, setSearchFilter]     = useState("");
  const [searchInput, setSearchInput]       = useState("");

  const load = useCallback(async (pg = 0) => {
    setLoading(true);
    try {
      const r = await api.listArticles({
        category: categoryFilter, type: typeFilter,
        status: statusFilter, country: countryFilter,
        search: searchFilter, role: user.role, userName: user.name,
        limit: LIMIT, offset: pg * LIMIT,
      });
      setArticles(r.articles || []);
      setTotal(r.total || 0);
      setPage(pg);
    } catch {}
    setLoading(false);
  }, [categoryFilter, typeFilter, statusFilter, countryFilter, searchFilter, user]);

  useEffect(() => { load(0); }, [load]);

  useEffect(() => {
    if (initialCategoryId) setCategoryFilter(initialCategoryId);
  }, [initialCategoryId]);

  const totalPages = Math.ceil(total / LIMIT);
  const isAdmin = user.role === "Admin";

  const hasFilters = !!(categoryFilter || typeFilter || countryFilter || searchFilter ||
    (isAdmin && statusFilter !== "") || (!isAdmin && statusFilter !== "published"));

  const clearFilters = () => {
    setCategoryFilter(""); setTypeFilter(""); setCountryFilter("");
    setSearchFilter(""); setSearchInput("");
    setStatusFilter(isAdmin ? "" : "published");
  };

  const selectedCat = categories.find(c => c.id === categoryFilter);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px 48px" }}>

      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: B.black, margin: 0 }}>
            {selectedCat ? selectedCat.name : "Browse Articles"}
          </h2>
          <div style={{ fontSize: 11, color: B.g3, marginTop: 3 }}>
            {loading ? "Loading…" : `${total} article${total !== 1 ? "s" : ""}${hasFilters ? " · filtered" : ""}`}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "228px 1fr", gap: 20, alignItems: "start" }}>

        {/* ── Sidebar ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Search */}
          <div style={{ background: B.white, borderRadius: 12, border: `1px solid ${B.g2}`, padding: "12px 14px", boxShadow: SH.xs }}>
            <label style={LBL}>Search</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { setSearchFilter(searchInput); } }}
                placeholder="Keywords…"
                style={{
                  flex: 1, padding: "8px 10px", borderRadius: 6,
                  border: `1.5px solid ${B.g2}`, fontSize: 12,
                  fontFamily: "'Montserrat',sans-serif", outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={e => e.target.style.borderColor = B.teal}
                onBlur={e => e.target.style.borderColor = B.g2}
              />
              <button onClick={() => setSearchFilter(searchInput)} style={{
                padding: "8px 10px", background: B.teal, color: B.white,
                border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13,
              }}>⌕</button>
            </div>
          </div>

          {/* Category */}
          <div style={{ background: B.white, borderRadius: 12, border: `1px solid ${B.g2}`, padding: "12px 14px", boxShadow: SH.xs }}>
            <label style={LBL}>Category</label>
            <FilterItem label="All Categories" active={!categoryFilter} onClick={() => setCategoryFilter("")} />
            {categories.map(c => (
              <FilterItem key={c.id} label={c.name} count={c.article_count}
                active={categoryFilter === c.id} color={c.color}
                onClick={() => setCategoryFilter(categoryFilter === c.id ? "" : c.id)} />
            ))}
          </div>

          {/* Type */}
          <div style={{ background: B.white, borderRadius: 12, border: `1px solid ${B.g2}`, padding: "12px 14px", boxShadow: SH.xs }}>
            <label style={LBL}>Article Type</label>
            {TYPE_OPTIONS.map(t => (
              <FilterItem key={t.key} label={t.label} active={typeFilter === t.key} onClick={() => setTypeFilter(t.key)} />
            ))}
          </div>

          {/* Status (admin only) */}
          {isAdmin && (
            <div style={{ background: B.white, borderRadius: 12, border: `1px solid ${B.g2}`, padding: "12px 14px", boxShadow: SH.xs }}>
              <label style={LBL}>Status</label>
              {[
                { key: "", label: "All Statuses" },
                { key: "draft", label: "Draft" },
                { key: "review", label: "In Review" },
                { key: "published", label: "Published" },
                { key: "archived", label: "Archived" },
              ].map(s => (
                <FilterItem key={s.key} label={s.label} active={statusFilter === s.key} onClick={() => setStatusFilter(s.key)} />
              ))}
            </div>
          )}

          {/* Country */}
          <div style={{ background: B.white, borderRadius: 12, border: `1px solid ${B.g2}`, padding: "12px 14px", boxShadow: SH.xs }}>
            <label style={LBL}>Country</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
              {["", ...EMEA_COUNTRIES.slice(1)].map(c => {
                const active = countryFilter === c;
                return (
                  <button key={c || "all"} onClick={() => setCountryFilter(c)} style={{
                    padding: "3px 8px", borderRadius: 10,
                    border: `1px solid ${active ? B.blue : B.g2}`,
                    background: active ? B.blue : "transparent",
                    color: active ? B.white : B.g4,
                    fontSize: 9, fontWeight: active ? 700 : 400,
                    fontFamily: "'Montserrat',sans-serif", cursor: "pointer",
                    transition: "all 0.1s",
                  }}>
                    {c || "All"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clear filters */}
          {hasFilters && (
            <button onClick={clearFilters} style={{
              padding: "8px 12px", background: "transparent",
              border: `1px solid ${B.g2}`, borderRadius: 8,
              cursor: "pointer", fontSize: 11, fontWeight: 600,
              fontFamily: "'Montserrat',sans-serif", color: B.g3,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <span>×</span> Clear all filters
            </button>
          )}
        </div>

        {/* ── Article list ── */}
        <div>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} style={{ background: B.white, borderRadius: 12, border: `1px solid ${B.g2}`, padding: "16px 18px" }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <Skeleton w={70} h={18} r={6} /><Skeleton w={90} h={18} r={10} /><Skeleton w={80} h={18} r={10} />
                  </div>
                  <Skeleton h={16} mb={8} /><Skeleton w="65%" h={13} />
                </div>
              ))}
            </div>
          ) : articles.length === 0 ? (
            <EmptyState
              icon="📭"
              title="No articles found"
              body="Try adjusting your filters or search terms. Admins can create new articles to fill gaps."
              action={isAdmin ? "Create New Article" : undefined}
              onAction={onNewArticle}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {articles.map(a => (
                <ArticleCard key={a.id} article={a} categories={categories}
                  onOpen={onOpenArticle} isFav={isFavourited(a.id)}
                  onToggleFav={() => toggleFavourite(a.id)} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, marginTop: 24,
            }}>
              <button
                style={{ ...BS, padding: "7px 16px", fontSize: 12 }}
                disabled={page === 0}
                onClick={() => load(page - 1)}
              >
                ← Previous
              </button>
              <span style={{ fontSize: 12, color: B.g3, padding: "0 8px" }}>
                Page {page + 1} of {totalPages}
              </span>
              <button
                style={{ ...BS, padding: "7px 16px", fontSize: 12 }}
                disabled={page >= totalPages - 1}
                onClick={() => load(page + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Filter item ───────────────────────────────────────────────────────────────
function FilterItem({ label, active, onClick, count, color }) {
  const [hov, setHov] = useState(false);
  const ac = color || B.teal;
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        width: "100%", textAlign: "left", padding: "6px 8px", borderRadius: 6, border: "none",
        background: active ? ac + "15" : hov ? B.g0 : "transparent",
        color: active ? ac : B.black,
        fontSize: 12, fontWeight: active ? 700 : 400,
        fontFamily: "'Montserrat',sans-serif", cursor: "pointer",
        transition: "all 0.1s",
      }}>
      <span>{label}</span>
      {count !== undefined && (
        <span style={{
          fontSize: 10, color: active ? ac : B.g3,
          background: active ? ac + "20" : B.g1,
          padding: "1px 6px", borderRadius: 8,
        }}>
          {count}
        </span>
      )}
    </button>
  );
}
