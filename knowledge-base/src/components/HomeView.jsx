import { useState, useEffect, useCallback } from "react";
import { B, CARD, BP, BG, TAG, LBL, TypeBadge, StatusBadge, EMEA_COUNTRIES, typeMeta } from "./shared.jsx";
import * as api from "../api.js";

const TYPE_TABS = [
  { key: "", label: "All" },
  { key: "kcs", label: "KCS Articles" },
  { key: "qrg", label: "QRGs" },
  { key: "sop", label: "SOPs" },
];

export default function HomeView({ user, categories, favourites, onOpenArticle, onNewArticle, isFavourited, toggleFavourite }) {
  const [search, setSearch]   = useState("");
  const [typeTab, setTypeTab] = useState("");
  const [country, setCountry] = useState("");
  const [results, setResults] = useState(null); // null = no search yet
  const [recent, setRecent]   = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    // Load recent articles on mount
    api.listArticles({ status: "published", limit: 6 })
      .then(r => setRecent(r.articles || []))
      .catch(() => {});
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
      if (q.trim() && r.articles.length === 0) {
        api.logSearchMiss(q.trim(), user.name);
      }
    } catch {}
    setSearching(false);
  }, [user]);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    if (!e.target.value.trim()) setResults(null);
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
    setCountry(c);
    doSearch(search, typeTab, c);
  };

  const catById = (id) => categories.find(c => c.id === id);

  return (
    <div style={{maxWidth:1100, margin:"0 auto", padding:"28px 24px"}}>

      {/* ── Hero search ── */}
      <div style={{background:`linear-gradient(135deg, ${B.teal} 0%, #007a68 100%)`, borderRadius:14, padding:"36px 40px", marginBottom:28, color:B.white}}>
        <div style={{fontSize:11, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", opacity:0.8, marginBottom:8}}>
          HRSC Knowledge Base
        </div>
        <h1 style={{fontSize:26, fontWeight:700, marginBottom:6, lineHeight:1.2}}>
          How can we help you today?
        </h1>
        <p style={{fontSize:13, opacity:0.85, marginBottom:22}}>
          Search KCS articles, quick reference guides and SOPs for EMEA HR
        </p>
        <form onSubmit={handleSearchSubmit} style={{display:"flex", gap:10}}>
          <input
            type="search"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search articles, guides, procedures…"
            style={{
              flex:1, padding:"12px 16px", borderRadius:8, border:"none",
              fontSize:14, fontFamily:"'Montserrat',sans-serif",
              color:B.black, outline:"none",
              boxShadow:"0 2px 12px rgba(0,0,0,0.12)",
            }}
          />
          <button type="submit" style={{...BP, padding:"12px 22px", fontSize:13, background:"rgba(255,255,255,0.2)", border:"1.5px solid rgba(255,255,255,0.5)"}}>
            {searching ? "…" : "Search"}
          </button>
          {user.role === "Admin" || true ? (
            <button type="button" onClick={onNewArticle} style={{...BP, padding:"12px 22px", fontSize:13, background:"rgba(255,255,255,0.15)", border:"1.5px solid rgba(255,255,255,0.5)"}}>
              + New Article
            </button>
          ) : null}
        </form>

        {/* Type tabs */}
        <div style={{display:"flex", gap:6, marginTop:14, flexWrap:"wrap"}}>
          {TYPE_TABS.map(t => (
            <button key={t.key} onClick={() => handleTypeTab(t.key)} style={{
              padding:"5px 14px", borderRadius:20, border:"1.5px solid rgba(255,255,255,0.4)",
              background: typeTab === t.key ? "rgba(255,255,255,0.25)" : "transparent",
              color:B.white, fontSize:11, fontWeight:700, fontFamily:"'Montserrat',sans-serif", cursor:"pointer",
              letterSpacing:"0.04em",
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Country filter chips ── */}
      <div style={{display:"flex", gap:6, flexWrap:"wrap", marginBottom:24}}>
        {["", ...EMEA_COUNTRIES.slice(1)].map(c => (
          <button key={c||"all"} onClick={() => handleCountry(c)} style={{
            padding:"4px 12px", borderRadius:16, border:`1.5px solid ${country===c ? B.teal : B.g2}`,
            background: country===c ? B.teal : B.white,
            color: country===c ? B.white : B.g3,
            fontSize:10, fontWeight:600, fontFamily:"'Montserrat',sans-serif", cursor:"pointer",
            transition:"all 0.12s",
          }}>
            {c || "All EMEA"}
          </button>
        ))}
      </div>

      {/* ── Search results ── */}
      {results !== null && (
        <div style={{marginBottom:32}}>
          <div style={{fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:B.g3, marginBottom:14}}>
            {results.length} result{results.length !== 1 ? "s" : ""}{search ? ` for "${search}"` : ""}
          </div>
          {results.length === 0 ? (
            <div style={{...CARD(), textAlign:"center", padding:"32px", color:B.g3}}>
              <div style={{fontSize:32, marginBottom:12}}>🔍</div>
              <div style={{fontWeight:700, marginBottom:6}}>No results found</div>
              <div style={{fontSize:12}}>Try different keywords or browse by category below.</div>
            </div>
          ) : (
            <div style={{display:"flex", flexDirection:"column", gap:10}}>
              {results.map(a => (
                <ArticleCard key={a.id} article={a} categories={categories} onOpen={onOpenArticle}
                  isFav={isFavourited(a.id)} onToggleFav={() => toggleFavourite(a.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── My Bookmarks (if any) ── */}
      {results === null && favourites.length > 0 && (
        <section style={{marginBottom:32}}>
          <SectionHeader icon="★" label="My Bookmarks" />
          <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12}}>
            {favourites.map(a => (
              <ArticleCard key={a.article_id} article={{...a, id:a.article_id}} categories={categories}
                onOpen={onOpenArticle} isFav={true} onToggleFav={() => toggleFavourite(a.article_id)} compact />
            ))}
          </div>
        </section>
      )}

      {/* ── Categories grid ── */}
      {results === null && (
        <section style={{marginBottom:32}}>
          <SectionHeader icon="📂" label="Browse by Category" />
          <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:12}}>
            {categories.map(cat => (
              <CategoryCard key={cat.id} cat={cat} onClick={() => {
                setSearch(""); setTypeTab(""); setCountry("");
                doSearch("", typeTab, country);
                // open browse with category filter via parent
                onOpenArticle({ _browseCat: cat.id });
              }} />
            ))}
          </div>
        </section>
      )}

      {/* ── Recently updated ── */}
      {results === null && recent.length > 0 && (
        <section>
          <SectionHeader icon="🕐" label="Recently Updated" />
          <div style={{display:"flex", flexDirection:"column", gap:10}}>
            {recent.map(a => (
              <ArticleCard key={a.id} article={a} categories={categories} onOpen={onOpenArticle}
                isFav={isFavourited(a.id)} onToggleFav={() => toggleFavourite(a.id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHeader({ icon, label }) {
  return (
    <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:14}}>
      <span style={{fontSize:16}}>{icon}</span>
      <span style={{fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:B.g3}}>{label}</span>
    </div>
  );
}

function CategoryCard({ cat, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{
      ...CARD({ padding:"18px 16px", textAlign:"left", cursor:"pointer",
        border:`1.5px solid ${hov ? cat.color : B.g2}`,
        transform: hov ? "translateY(-2px)" : "none",
        transition:"all 0.15s",
      }),
      background:B.white, display:"block", width:"100%", fontFamily:"'Montserrat',sans-serif",
    }}>
      <div style={{fontSize:22, marginBottom:8}}>{cat.icon || "📄"}</div>
      <div style={{fontSize:13, fontWeight:700, color:B.black, marginBottom:4}}>{cat.name}</div>
      <div style={{fontSize:11, color:B.g3, marginBottom:8, lineHeight:1.4}}>{cat.description}</div>
      <div style={{...TAG(cat.color+"18", cat.color)}}>{cat.article_count || 0} article{cat.article_count !== 1 ? "s" : ""}</div>
    </button>
  );
}

export function ArticleCard({ article, categories, onOpen, isFav, onToggleFav, compact=false }) {
  const cat = categories.find(c => c.id === article.category_id);
  const snippet = article.section1 ? article.section1.replace(/<[^>]+>/g, "").slice(0, 120) : "";
  const tags = (() => { try { return JSON.parse(article.tags || "[]"); } catch { return []; } })();
  const [hov, setHov] = useState(false);

  return (
    <div style={{...CARD({ padding:"16px 18px", border:`1.5px solid ${hov ? B.teal : B.g2}`, transition:"all 0.15s" }), cursor:"pointer"}}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12}}>
        <div style={{flex:1, minWidth:0}} onClick={() => onOpen({ _openId: article.id })}>
          <div style={{display:"flex", gap:6, alignItems:"center", flexWrap:"wrap", marginBottom:7}}>
            <span style={{fontSize:11, fontWeight:700, color:typeMeta(article.article_type).color, letterSpacing:"0.04em"}}>
              {article.article_num}
            </span>
            <TypeBadge type={article.article_type} />
            {article.status !== "published" && <StatusBadge status={article.status} />}
            {cat && <span style={{...TAG(cat.color+"18", cat.color), fontSize:9}}>{cat.name}</span>}
          </div>
          <div style={{fontSize:14, fontWeight:600, color:B.black, marginBottom:compact?0:5, lineHeight:1.4}}>
            {article.title}
          </div>
          {!compact && snippet && (
            <div style={{fontSize:12, color:B.g3, lineHeight:1.5, marginBottom:6}}>{snippet}…</div>
          )}
          {!compact && tags.length > 0 && (
            <div style={{display:"flex", gap:4, flexWrap:"wrap"}}>
              {tags.map(t => <span key={t} style={TAG()}>{t}</span>)}
            </div>
          )}
        </div>
        <div style={{display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6, flexShrink:0}}>
          <button title={isFav ? "Remove bookmark" : "Bookmark"} onClick={e => { e.stopPropagation(); onToggleFav(); }} style={{
            background:"none", border:"none", cursor:"pointer", fontSize:16,
            color: isFav ? B.yellow : B.g2, padding:2,
          }}>
            {isFav ? "★" : "☆"}
          </button>
          {!compact && (
            <span style={{fontSize:10, color:B.g3}}>👁 {article.view_count||0}</span>
          )}
        </div>
      </div>
    </div>
  );
}
