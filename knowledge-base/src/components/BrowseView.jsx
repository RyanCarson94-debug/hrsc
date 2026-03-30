import { useState, useEffect, useCallback } from "react";
import { B, CARD, BS, BG, TAG, LBL, TypeBadge, StatusBadge, typeMeta, EMEA_COUNTRIES } from "./shared.jsx";
import * as api from "../api.js";

const TYPE_OPTIONS = [
  { key: "", label: "All Types" },
  { key: "kcs", label: "KCS Articles" },
  { key: "qrg", label: "QRGs" },
  { key: "sop", label: "SOPs" },
];

const STATUS_OPTIONS_ADMIN   = ["", "draft", "review", "published", "archived"];
const STATUS_OPTIONS_ADVISER = ["published"];

export default function BrowseView({ user, categories, initialCategoryId, onOpenArticle, onNewArticle, isFavourited, toggleFavourite }) {
  const [articles, setArticles] = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(0);

  const [categoryFilter, setCategoryFilter] = useState(initialCategoryId || "");
  const [typeFilter, setTypeFilter]         = useState("");
  const [statusFilter, setStatusFilter]     = useState(user.role === "Admin" ? "" : "published");
  const [countryFilter, setCountryFilter]   = useState("");
  const [searchFilter, setSearchFilter]     = useState("");

  const LIMIT = 20;

  const load = useCallback(async (pg=0) => {
    setLoading(true);
    try {
      const r = await api.listArticles({
        category: categoryFilter,
        type:     typeFilter,
        status:   statusFilter,
        country:  countryFilter,
        search:   searchFilter,
        role:     user.role,
        userName: user.name,
        limit:    LIMIT,
        offset:   pg * LIMIT,
      });
      setArticles(r.articles || []);
      setTotal(r.total || 0);
      setPage(pg);
    } catch {}
    setLoading(false);
  }, [categoryFilter, typeFilter, statusFilter, countryFilter, searchFilter, user]);

  useEffect(() => { load(0); }, [load]);

  // When initialCategoryId changes (from home category click)
  useEffect(() => {
    if (initialCategoryId) setCategoryFilter(initialCategoryId);
  }, [initialCategoryId]);

  const statusOptions = user.role === "Admin" ? STATUS_OPTIONS_ADMIN : STATUS_OPTIONS_ADVISER;
  const totalPages = Math.ceil(total / LIMIT);
  const catById = (id) => categories.find(c => c.id === id);

  return (
    <div style={{maxWidth:1100, margin:"0 auto", padding:"28px 24px"}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:12}}>
        <h2 style={{fontSize:18, fontWeight:700, color:B.black}}>Browse Articles</h2>
        <button style={{...BS, borderColor:B.teal, color:B.teal}} onClick={onNewArticle}>
          + New Article
        </button>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"220px 1fr", gap:20, alignItems:"start"}}>

        {/* ── Sidebar filters ── */}
        <div style={{display:"flex", flexDirection:"column", gap:12}}>

          {/* Search */}
          <div style={CARD({ padding:"12px 14px" })}>
            <label style={LBL}>Search</label>
            <input
              value={searchFilter} onChange={e=>setSearchFilter(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&load(0)}
              placeholder="Keywords…"
              style={{
                width:"100%",boxSizing:"border-box",padding:"8px 10px",
                borderRadius:6,border:`1.5px solid ${B.g2}`,fontSize:12,
                fontFamily:"'Montserrat',sans-serif",outline:"none",
              }}
            />
          </div>

          {/* Category */}
          <div style={CARD({ padding:"12px 14px" })}>
            <label style={LBL}>Category</label>
            <div style={{display:"flex", flexDirection:"column", gap:3}}>
              <FilterItem label="All Categories" active={!categoryFilter} onClick={()=>setCategoryFilter("")} />
              {categories.map(c => (
                <FilterItem key={c.id} label={c.name} count={c.article_count}
                  active={categoryFilter===c.id} color={c.color}
                  onClick={()=>setCategoryFilter(categoryFilter===c.id?"":c.id)} />
              ))}
            </div>
          </div>

          {/* Type */}
          <div style={CARD({ padding:"12px 14px" })}>
            <label style={LBL}>Type</label>
            <div style={{display:"flex", flexDirection:"column", gap:3}}>
              {TYPE_OPTIONS.map(t => (
                <FilterItem key={t.key} label={t.label} active={typeFilter===t.key} onClick={()=>setTypeFilter(t.key)} />
              ))}
            </div>
          </div>

          {/* Status */}
          {user.role === "Admin" && (
            <div style={CARD({ padding:"12px 14px" })}>
              <label style={LBL}>Status</label>
              <div style={{display:"flex", flexDirection:"column", gap:3}}>
                {statusOptions.map(s => (
                  <FilterItem key={s||"all"} label={s?s.charAt(0).toUpperCase()+s.slice(1):"All Statuses"} active={statusFilter===s} onClick={()=>setStatusFilter(s)} />
                ))}
              </div>
            </div>
          )}

          {/* Country */}
          <div style={CARD({ padding:"12px 14px" })}>
            <label style={LBL}>Country</label>
            <div style={{display:"flex", flexWrap:"wrap", gap:4}}>
              {["", ...EMEA_COUNTRIES.slice(1)].map(c => (
                <button key={c||"all"} onClick={() => setCountryFilter(c)} style={{
                  padding:"3px 8px", borderRadius:12,
                  border:`1px solid ${countryFilter===c ? B.blue : B.g2}`,
                  background: countryFilter===c ? B.blue : B.white,
                  color: countryFilter===c ? B.white : B.g3,
                  fontSize:9, fontWeight:600, cursor:"pointer", fontFamily:"'Montserrat',sans-serif",
                }}>
                  {c||"All"}
                </button>
              ))}
            </div>
          </div>

          {/* Clear */}
          {(categoryFilter||typeFilter||countryFilter||searchFilter||(statusFilter&&statusFilter!=="published")) && (
            <button style={{...BS, fontSize:11}} onClick={()=>{
              setCategoryFilter(""); setTypeFilter(""); setCountryFilter(""); setSearchFilter("");
              setStatusFilter(user.role==="Admin"?"":"published");
            }}>
              ✕ Clear Filters
            </button>
          )}
        </div>

        {/* ── Main article list ── */}
        <div>
          <div style={{fontSize:11, color:B.g3, marginBottom:14, fontWeight:600}}>
            {loading ? "Loading…" : `${total} article${total!==1?"s":""}`}
          </div>

          {!loading && articles.length === 0 && (
            <div style={{...CARD(), textAlign:"center", padding:"40px", color:B.g3}}>
              <div style={{fontSize:32, marginBottom:12}}>📭</div>
              <div style={{fontWeight:700, marginBottom:6}}>No articles found</div>
              <div style={{fontSize:12}}>Try adjusting your filters or create a new article.</div>
            </div>
          )}

          <div style={{display:"flex", flexDirection:"column", gap:10}}>
            {articles.map(a => {
              const cat = catById(a.category_id);
              const tags = (() => { try { return JSON.parse(a.tags||"[]"); } catch { return []; } })();
              const snippet = (a.section1||"").replace(/<[^>]+>/g,"").slice(0,140);
              const [hov, setHov] = useState(false);
              return (
                <div key={a.id}
                  style={{...CARD({ padding:"16px 18px", border:`1.5px solid ${hov?B.teal:B.g2}`, cursor:"pointer", transition:"all 0.15s" })}}
                  onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12}}>
                    <div style={{flex:1, minWidth:0}} onClick={() => onOpenArticle({ _openId: a.id })}>
                      <div style={{display:"flex", gap:6, alignItems:"center", flexWrap:"wrap", marginBottom:6}}>
                        <span style={{fontSize:11, fontWeight:700, color:typeMeta(a.article_type).color}}>
                          {a.article_num}
                        </span>
                        <TypeBadge type={a.article_type} />
                        <StatusBadge status={a.status} />
                        {cat && <span style={{...TAG(cat.color+"18", cat.color), fontSize:9}}>{cat.name}</span>}
                      </div>
                      <div style={{fontSize:14, fontWeight:600, color:B.black, marginBottom:6, lineHeight:1.4}}>
                        {a.title}
                      </div>
                      {snippet && (
                        <div style={{fontSize:12, color:B.g3, lineHeight:1.5, marginBottom:8}}>
                          {snippet}{snippet.length >= 140 ? "…" : ""}
                        </div>
                      )}
                      <div style={{display:"flex", gap:6, flexWrap:"wrap", alignItems:"center"}}>
                        {tags.map(t => <span key={t} style={TAG()}>{t}</span>)}
                        <span style={{fontSize:10, color:B.g3, marginLeft:4}}>
                          👁 {a.view_count||0} · {new Date(a.updated_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}
                        </span>
                      </div>
                    </div>
                    <button title={isFavourited(a.id) ? "Remove bookmark" : "Bookmark"}
                      onClick={e=>{e.stopPropagation();toggleFavourite(a.id);}} style={{
                      background:"none", border:"none", cursor:"pointer",
                      fontSize:18, color: isFavourited(a.id) ? B.yellow : B.g2,
                      flexShrink:0, padding:2,
                    }}>
                      {isFavourited(a.id) ? "★" : "☆"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{display:"flex", gap:6, justifyContent:"center", marginTop:20}}>
              <button style={{...BS, padding:"6px 14px", fontSize:12}} disabled={page===0} onClick={()=>load(page-1)}>← Prev</button>
              <span style={{padding:"8px 14px", fontSize:12, color:B.g3}}>
                Page {page+1} of {totalPages}
              </span>
              <button style={{...BS, padding:"6px 14px", fontSize:12}} disabled={page>=totalPages-1} onClick={()=>load(page+1)}>Next →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterItem({ label, active, onClick, count, color }) {
  return (
    <button onClick={onClick} style={{
      textAlign:"left", padding:"6px 8px", borderRadius:6,
      background: active ? (color ? color+"18" : B.teal+"18") : "transparent",
      border:"none", cursor:"pointer",
      color: active ? (color || B.teal) : B.black,
      fontSize:12, fontWeight: active ? 700 : 400,
      fontFamily:"'Montserrat',sans-serif",
      display:"flex", justifyContent:"space-between", alignItems:"center",
    }}>
      <span>{label}</span>
      {count !== undefined && <span style={{fontSize:10, color:active?(color||B.teal):B.g3}}>{count}</span>}
    </button>
  );
}
