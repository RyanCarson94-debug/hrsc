import { useState, useEffect, useCallback, useRef } from "react";
import { B, SH, CARD, BP, TAG, TypeBadge, StatusBadge, typeMeta, Skeleton } from "./shared.jsx";
import * as api from "../api.js";

const TYPE_TABS = [
  { key: "", label: "All" },
  { key: "kcs", label: "KCS Articles" },
  { key: "qrg", label: "QRGs" },
  { key: "sop", label: "SOPs" },
];

export default function HomeView({ user, categories, countries = [], favourites, onOpenArticle, onNewArticle, isFavourited, toggleFavourite }) {
  const [search, setSearch]       = useState("");
  const [typeTab, setTypeTab]     = useState("");
  const [country, setCountry]     = useState("");
  const [results, setResults]     = useState(null);
  const [recent, setRecent]       = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    api.listArticles({ status: "published", limit: 6 })
      .then(r => setRecent(r.articles || []))
      .catch(() => {})
      .finally(() => setRecentLoading(false));
  }, []);

  const doSearch = useCallback(async (q, type, ctry) => {
    if (!q.trim() && !type && !ctry) { setResults(null); return; }
    setSearching(true);
    try {
      const r = await api.listArticles({
        search: q, type, country: ctry, status: "published",
        role: user.role, userName: user.name, limit: 40,
      });
      setResults(r.articles || []);
      if (q.trim() && (!r.articles || r.articles.length === 0)) {
        api.logSearchMiss(q.trim(), user.name).catch(() => {});
      }
    } catch {}
    setSearching(false);
  }, [user]);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    if (!e.target.value.trim() && !typeTab && !country) setResults(null);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    doSearch(search, typeTab, country);
  };

  const handleTypeTab = (t) => {
    setTypeTab(t);
    doSearch(search, t, country);
  };

  const handleCountry = (c) => {
    const next = country === c ? "" : c;
    setCountry(next);
    doSearch(search, typeTab, next);
  };

  const clearSearch = () => {
    setSearch(""); setTypeTab(""); setCountry(""); setResults(null);
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px 48px" }}>

      {/* ── Hero ── */}
      <div style={{
        background: `linear-gradient(135deg, ${B.black} 0%, #2d2829 55%, #1a2e28 100%)`,
        borderRadius: 16, padding: "40px 44px 36px", marginBottom: 32,
        position: "relative", overflow: "hidden",
      }}>
        {/* Decorative teal glow */}
        <div style={{
          position: "absolute", top: -60, right: -60, width: 240, height: 240,
          borderRadius: "50%", background: B.teal, opacity: 0.06, pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: -40, left: "30%", width: 160, height: 160,
          borderRadius: "50%", background: B.teal, opacity: 0.04, pointerEvents: "none",
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{
            display: "inline-block", padding: "4px 12px",
            background: "rgba(0,162,138,0.2)", border: "1px solid rgba(0,162,138,0.35)",
            borderRadius: 20, fontSize: 10, fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            color: "#6ECFBF", marginBottom: 14,
          }}>
            HRSC · EMEA Knowledge Base
          </div>
          <h1 style={{
            fontSize: 28, fontWeight: 800, color: B.white,
            margin: "0 0 8px", lineHeight: 1.2,
          }}>
            How can we help you today?
          </h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "0 0 24px", maxWidth: 480, lineHeight: 1.6 }}>
            Search KCS articles, Quick Reference Guides and SOPs covering HR processes across EMEA.
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 8, maxWidth: 640, marginBottom: 16 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <span style={{
                position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                fontSize: 14, color: "rgba(255,255,255,0.35)", pointerEvents: "none",
              }}>⌕</span>
              <input
                ref={searchRef}
                type="search"
                value={search}
                onChange={handleSearchChange}
                onKeyDown={e => e.key === "Enter" && handleSearchSubmit(e)}
                placeholder="Search articles, processes, guides…"
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "13px 16px 13px 38px",
                  background: "rgba(255,255,255,0.1)",
                  border: "1.5px solid rgba(255,255,255,0.18)",
                  borderRadius: 10, fontSize: 13, fontFamily: "'Montserrat',sans-serif",
                  color: B.white, outline: "none",
                  transition: "border-color 0.15s, background 0.15s",
                  backdropFilter: "blur(8px)",
                }}
                onFocus={e => {
                  e.target.style.borderColor = "rgba(0,162,138,0.6)";
                  e.target.style.background = "rgba(255,255,255,0.13)";
                }}
                onBlur={e => {
                  e.target.style.borderColor = "rgba(255,255,255,0.18)";
                  e.target.style.background = "rgba(255,255,255,0.1)";
                }}
              />
            </div>
            <button type="submit" style={{
              padding: "13px 22px", background: B.teal, color: B.white,
              border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700,
              fontFamily: "'Montserrat',sans-serif", cursor: "pointer",
              transition: "background 0.15s", whiteSpace: "nowrap",
              flexShrink: 0,
            }}>
              {searching ? "…" : "Search"}
            </button>
          </form>

          {/* Type filter tabs */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TYPE_TABS.map(t => (
              <button key={t.key} onClick={() => handleTypeTab(t.key)} style={{
                padding: "5px 14px", borderRadius: 20, cursor: "pointer",
                border: `1.5px solid ${typeTab === t.key ? "rgba(0,162,138,0.6)" : "rgba(255,255,255,0.2)"}`,
                background: typeTab === t.key ? "rgba(0,162,138,0.2)" : "transparent",
                color: typeTab === t.key ? "#6ECFBF" : "rgba(255,255,255,0.55)",
                fontSize: 11, fontWeight: 700, fontFamily: "'Montserrat',sans-serif",
                letterSpacing: "0.04em", transition: "all 0.15s",
              }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Country chips ── */}
      <div style={{
        display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 28,
        padding: "12px 16px", background: B.white, borderRadius: 10,
        border: `1px solid ${B.g2}`, boxShadow: SH.xs,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: B.g3, textTransform: "uppercase", letterSpacing: "0.07em", alignSelf: "center", marginRight: 4, flexShrink: 0 }}>
          Country:
        </span>
        {["", ...countries].map(c => {
          const active = country === c || (c === "" && !country);
          return (
            <button key={c || "all"} onClick={() => handleCountry(c)} style={{
              padding: "4px 11px", borderRadius: 14,
              border: `1.5px solid ${active ? B.teal : B.g2}`,
              background: active ? B.teal : "transparent",
              color: active ? B.white : B.g4,
              fontSize: 10, fontWeight: active ? 700 : 500,
              fontFamily: "'Montserrat',sans-serif", cursor: "pointer",
              transition: "all 0.12s",
            }}>
              {c || "All EMEA"}
            </button>
          );
        })}
      </div>

      {/* ── Search results ── */}
      {results !== null && (
        <section style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <SectionLabel>Search Results</SectionLabel>
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: results.length > 0 ? B.tealLight : B.g1,
                color: results.length > 0 ? B.tealDark : B.g3,
                fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "2px 10px",
              }}>
                {results.length} {results.length === 1 ? "result" : "results"}
                {search ? ` for "${search}"` : ""}
              </span>
            </div>
            <button onClick={clearSearch} style={{
              background: "none", border: "none", cursor: "pointer",
              color: B.g3, fontSize: 11, fontWeight: 600,
              fontFamily: "'Montserrat',sans-serif",
            }}>
              Clear ×
            </button>
          </div>

          {results.length === 0 ? (
            <div style={{
              ...CARD({ padding: "40px 32px" }),
              textAlign: "center",
            }}>
              <div style={{ fontSize: 36, marginBottom: 14, opacity: 0.6 }}>🔍</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: B.black, marginBottom: 8 }}>No results found</div>
              <div style={{ fontSize: 13, color: B.g3, maxWidth: 340, margin: "0 auto 20px", lineHeight: 1.6 }}>
                Your search has been logged. Try different keywords or browse by category.
              </div>
              <button onClick={() => onNewArticle({ prefillTitle: search })} style={{
                padding: "8px 18px", background: B.tealLight, color: B.tealDark,
                border: `1px solid ${B.teal}30`, borderRadius: 8,
                fontSize: 12, fontWeight: 700, fontFamily: "'Montserrat',sans-serif", cursor: "pointer",
              }}>
                Create article for this topic
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {results.map(a => (
                <ArticleCard key={a.id} article={a} categories={categories}
                  onOpen={onOpenArticle} isFav={isFavourited(a.id)}
                  onToggleFav={() => toggleFavourite(a.id)} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── My Bookmarks ── */}
      {results === null && favourites.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <SectionLabel icon="★" color={B.yellow}>My Bookmarks</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 10, marginTop: 14 }}>
            {favourites.map(f => (
              <ArticleCard key={f.article_id} article={{ ...f, id: f.article_id }}
                categories={categories} onOpen={onOpenArticle}
                isFav={true} onToggleFav={() => toggleFavourite(f.article_id)} compact />
            ))}
          </div>
        </section>
      )}

      {/* ── Categories ── */}
      {results === null && (
        <section style={{ marginBottom: 36 }}>
          <SectionLabel icon="⊞">Browse by Category</SectionLabel>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
            gap: 10, marginTop: 14,
          }}>
            {categories.map(cat => (
              <CategoryCard key={cat.id} cat={cat}
                onClick={() => onOpenArticle({ _browseCat: cat.id })} />
            ))}
          </div>
        </section>
      )}

      {/* ── Recently Updated ── */}
      {results === null && (
        <section>
          <SectionLabel icon="↻">Recently Updated</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
            {recentLoading
              ? [0, 1, 2].map(i => (
                <div key={i} style={{ ...CARD({ padding: "16px 18px" }) }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <Skeleton w={56} h={18} r={10} /><Skeleton w={80} h={18} r={10} />
                  </div>
                  <Skeleton h={16} mb={6} /><Skeleton w="60%" h={13} />
                </div>
              ))
              : recent.length > 0
                ? recent.map(a => (
                  <ArticleCard key={a.id} article={a} categories={categories}
                    onOpen={onOpenArticle} isFav={isFavourited(a.id)}
                    onToggleFav={() => toggleFavourite(a.id)} />
                ))
                : (
                  <div style={{ ...CARD({ padding: "28px" }), textAlign: "center", color: B.g3, fontSize: 13 }}>
                    No published articles yet.
                  </div>
                )
            }
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children, icon, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      {icon && (
        <span style={{ fontSize: 13, color: color || B.g3 }}>{icon}</span>
      )}
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: "0.09em",
        textTransform: "uppercase", color: B.g3,
      }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: B.g2 }} />
    </div>
  );
}

// ─── Category card ─────────────────────────────────────────────────────────────
function CategoryCard({ cat, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", flexDirection: "column", textAlign: "left",
        background: B.white, border: `1.5px solid ${hov ? cat.color : B.g2}`,
        borderRadius: 12, padding: "18px 16px",
        boxShadow: hov ? `0 4px 16px ${cat.color}22` : SH.xs,
        cursor: "pointer", fontFamily: "'Montserrat',sans-serif",
        transform: hov ? "translateY(-2px)" : "none",
        transition: "all 0.16s", width: "100%",
      }}>
      {/* Color accent bar */}
      <div style={{ height: 3, background: cat.color, borderRadius: 2, marginBottom: 14, width: hov ? "100%" : "40%", transition: "width 0.2s" }} />
      <div style={{ fontSize: 12, fontWeight: 700, color: B.black, marginBottom: 5, lineHeight: 1.35 }}>
        {cat.name}
      </div>
      <div style={{ fontSize: 11, color: B.g3, marginBottom: 12, lineHeight: 1.5, flex: 1 }}>
        {cat.description}
      </div>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "3px 10px", borderRadius: 10,
        background: cat.color + "15", color: cat.color,
        fontSize: 10, fontWeight: 700,
      }}>
        {cat.article_count || 0} article{cat.article_count !== 1 ? "s" : ""}
      </div>
    </button>
  );
}

// ─── Article card ──────────────────────────────────────────────────────────────
export function ArticleCard({ article, categories, onOpen, isFav, onToggleFav, compact = false }) {
  const cat     = categories.find(c => c.id === article.category_id);
  const snippet = article.section1 ? article.section1.replace(/<[^>]+>/g, "").slice(0, 130) : "";
  const tags    = (() => { try { return JSON.parse(article.tags || "[]"); } catch { return []; } })();
  const tm      = typeMeta(article.article_type || "kcs");
  const [hov, setHov] = useState(false);

  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: B.white, borderRadius: 12, display: "flex", overflow: "hidden",
        border: `1.5px solid ${hov ? B.g2 : B.g2}`,
        boxShadow: hov ? SH.md : SH.xs,
        transition: "box-shadow 0.15s, border-color 0.15s",
        cursor: "pointer",
      }}
    >
      {/* Type color accent stripe */}
      <div style={{ width: 3, background: tm.color, flexShrink: 0 }} />

      <div style={{ flex: 1, padding: "14px 16px", minWidth: 0, display: "flex", gap: 12 }}
        onClick={() => onOpen({ _openId: article.id })}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Meta row */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: tm.color, letterSpacing: "0.05em" }}>
              {article.article_num}
            </span>
            <TypeBadge type={article.article_type} size="sm" />
            {article.status !== "published" && <StatusBadge status={article.status} />}
            {cat && (
              <span style={{
                ...TAG(cat.color + "15", cat.color),
                fontSize: 9, padding: "2px 8px",
              }}>
                {cat.name}
              </span>
            )}
          </div>
          {/* Title */}
          <div style={{ fontSize: 13, fontWeight: 700, color: B.black, lineHeight: 1.4, marginBottom: compact ? 0 : 5 }}>
            {article.title}
          </div>
          {/* Snippet */}
          {!compact && snippet && (
            <div style={{ fontSize: 12, color: B.g3, lineHeight: 1.55, marginBottom: tags.length > 0 ? 8 : 0 }}>
              {snippet}{snippet.length === 130 ? "…" : ""}
            </div>
          )}
          {/* Tags */}
          {!compact && tags.length > 0 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {tags.slice(0, 5).map(t => (
                <span key={t} style={{ ...TAG(), fontSize: 9, padding: "2px 8px" }}>{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* Right meta */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "space-between", flexShrink: 0, gap: 4 }}>
          <button
            title={isFav ? "Remove bookmark" : "Bookmark this article"}
            onClick={e => { e.stopPropagation(); onToggleFav(); }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 16, lineHeight: 1, padding: 2,
              color: isFav ? B.yellow : B.g2,
              transition: "color 0.15s, transform 0.1s",
              transform: isFav ? "scale(1.1)" : "scale(1)",
            }}
          >
            {isFav ? "★" : "☆"}
          </button>
          {!compact && (
            <span style={{ fontSize: 10, color: B.g3, whiteSpace: "nowrap" }}>
              {article.view_count || 0} views
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
