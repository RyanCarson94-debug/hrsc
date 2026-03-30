import { useState, useEffect, useCallback } from "react";
import { B, CARD, BP, BPR, BS, BG, TAG, LBL, FI, TypeBadge, StatusBadge, typeMeta, gid } from "./shared.jsx";
import * as api from "../api.js";

const TABS = ["Review Queue", "Categories", "Article Health", "Search Gaps"];

export default function AdminView({ user, categories, onOpenArticle, onNewArticle, refreshCategories, refreshStats }) {
  const [tab, setTab] = useState(0);

  if (user.role !== "Admin") {
    return (
      <div style={{maxWidth:700, margin:"80px auto", textAlign:"center", color:B.g3, fontFamily:"'Montserrat',sans-serif"}}>
        <div style={{fontSize:32, marginBottom:12}}>🔒</div>
        <div style={{fontWeight:700, fontSize:16}}>Admin access required</div>
      </div>
    );
  }

  return (
    <div style={{maxWidth:1050, margin:"0 auto", padding:"28px 24px"}}>
      <h2 style={{fontSize:18, fontWeight:700, color:B.black, marginBottom:20}}>Admin Panel</h2>

      {/* Tab bar */}
      <div style={{display:"flex", gap:0, marginBottom:24, borderBottom:`2px solid ${B.g2}`}}>
        {TABS.map((t,i) => (
          <button key={t} onClick={()=>setTab(i)} style={{
            padding:"10px 20px", background:"transparent", border:"none",
            borderBottom: tab===i ? `2px solid ${B.teal}` : "2px solid transparent",
            marginBottom:-2, cursor:"pointer", fontSize:12, fontWeight: tab===i ? 700 : 500,
            fontFamily:"'Montserrat',sans-serif", color: tab===i ? B.teal : B.g3,
            transition:"color 0.15s",
          }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 0 && <ReviewQueue user={user} onOpenArticle={onOpenArticle} />}
      {tab === 1 && <CategoriesAdmin categories={categories} refreshCategories={refreshCategories} />}
      {tab === 2 && <ArticleHealth onOpenArticle={onOpenArticle} onNewArticle={onNewArticle} />}
      {tab === 3 && <SearchGaps onNewArticle={onNewArticle} />}
    </div>
  );
}

// ── Review Queue ───────────────────────────────────────────────────────────────
function ReviewQueue({ user, onOpenArticle }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [comments, setComments] = useState({}); // articleId → comment text
  const [toast, setToast]       = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.listArticles({ status:"review", role:"Admin", limit:50 });
      setArticles(r.articles || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (id, status) => {
    const comment = comments[id]?.trim();
    if (comment) {
      await api.addComment(id, { comment, authorName: user.name });
    }
    await api.changeStatus(id, status, { reviewedBy: user.name });
    setArticles(prev => prev.filter(a => a.id !== id));
    setComments(prev => { const n={...prev}; delete n[id]; return n; });
    setToast(`Article ${status === "published" ? "published" : "returned to draft"}`);
    setTimeout(() => setToast(""), 3000);
  };

  if (loading) return <div style={{color:B.g3}}>Loading…</div>;

  return (
    <div>
      {articles.length === 0 ? (
        <div style={{...CARD(), textAlign:"center", padding:"48px", color:B.g3}}>
          <div style={{fontSize:32, marginBottom:12}}>✅</div>
          <div style={{fontWeight:700}}>Review queue is empty</div>
        </div>
      ) : (
        <div style={{display:"flex", flexDirection:"column", gap:14}}>
          {articles.map(a => (
            <div key={a.id} style={CARD()}>
              <div style={{display:"flex", gap:8, alignItems:"center", marginBottom:8, flexWrap:"wrap"}}>
                <span style={{fontWeight:700, color:typeMeta(a.article_type).color, fontSize:12}}>{a.article_num}</span>
                <TypeBadge type={a.article_type} />
                <span style={{...TAG("#FFF3CD","#8B6914")}}>Awaiting Review</span>
              </div>
              <div style={{fontSize:15, fontWeight:600, color:B.black, marginBottom:6}}>{a.title}</div>
              <div style={{fontSize:11, color:B.g3, marginBottom:12}}>
                Author: {a.author_name} · Updated {new Date(a.updated_at).toLocaleDateString("en-GB")}
              </div>
              <textarea
                value={comments[a.id]||""}
                onChange={e=>setComments(prev=>({...prev,[a.id]:e.target.value}))}
                placeholder="Optional review comment (will be saved to article)…"
                rows={2}
                style={{
                  width:"100%", boxSizing:"border-box", padding:"8px 10px",
                  borderRadius:6, border:`1.5px solid ${B.g2}`, fontSize:12,
                  fontFamily:"'Montserrat',sans-serif", resize:"vertical", marginBottom:10, outline:"none",
                }}
              />
              <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
                <button style={BP} onClick={() => handleAction(a.id, "published")}>✓ Publish</button>
                <button style={BS} onClick={() => handleAction(a.id, "draft")}>✕ Return to Draft</button>
                <button style={{...BG(), fontSize:12}} onClick={() => onOpenArticle({ _openId: a.id })}>View Article →</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {toast && (
        <div style={{position:"fixed",bottom:28,right:28,zIndex:9999,background:B.teal,color:B.white,padding:"12px 22px",borderRadius:8,fontSize:13,fontWeight:600,fontFamily:"'Montserrat',sans-serif"}}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Categories ─────────────────────────────────────────────────────────────────
function CategoriesAdmin({ categories, refreshCategories }) {
  const [editing, setEditing]   = useState(null); // null | "new" | id
  const [form, setForm]         = useState({ name:"", description:"", color:"#00A28A", icon:"", sortOrder:0 });
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState("");

  const openNew = () => {
    setForm({ name:"", description:"", color:"#00A28A", icon:"", sortOrder:categories.length+1 });
    setEditing("new");
  };

  const openEdit = (cat) => {
    setForm({ name:cat.name, description:cat.description||"", color:cat.color||"#00A28A", icon:cat.icon||"", sortOrder:cat.sort_order||0 });
    setEditing(cat.id);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing === "new") {
        await api.createCategory({ ...form, id: gid(), sortOrder: form.sortOrder });
      } else {
        await api.updateCategory(editing, form);
      }
      await refreshCategories();
      setEditing(null);
      setToast("Saved");
      setTimeout(()=>setToast(""),3000);
    } catch (e) { setToast("Error: "+e.message); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this category? Articles in it will become uncategorised.")) return;
    await api.deleteCategory(id);
    await refreshCategories();
  };

  const sf = (k,v) => setForm(prev=>({...prev,[k]:v}));

  return (
    <div>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16}}>
        <span style={{fontSize:12, color:B.g3}}>{categories.length} categories</span>
        <button style={BP} onClick={openNew}>+ New Category</button>
      </div>

      {editing && (
        <div style={{...CARD(), marginBottom:20, padding:"20px 22px", border:`1.5px solid ${B.teal}`}}>
          <h3 style={{fontSize:14, fontWeight:700, marginBottom:16}}>{editing==="new"?"New Category":"Edit Category"}</h3>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12}}>
            <FI label="Name" value={form.name} onChange={e=>sf("name",e.target.value)} />
            <FI label="Icon (emoji)" value={form.icon} onChange={e=>sf("icon",e.target.value)} placeholder="📋" />
          </div>
          <div style={{marginBottom:12}}>
            <FI label="Description" value={form.description} onChange={e=>sf("description",e.target.value)} />
          </div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16}}>
            <div>
              <label style={LBL}>Colour</label>
              <div style={{display:"flex", gap:8, alignItems:"center"}}>
                <input type="color" value={form.color} onChange={e=>sf("color",e.target.value)}
                  style={{width:40, height:36, padding:0, border:`1.5px solid ${B.g2}`, borderRadius:6, cursor:"pointer"}} />
                <span style={{fontSize:12, color:B.g3}}>{form.color}</span>
              </div>
            </div>
            <FI label="Sort Order" type="number" value={form.sortOrder} onChange={e=>sf("sortOrder",parseInt(e.target.value)||0)} />
          </div>
          <div style={{display:"flex", gap:8}}>
            <button style={BP} onClick={handleSave} disabled={saving}>{saving?"Saving…":"Save"}</button>
            <button style={BS} onClick={()=>setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{display:"flex", flexDirection:"column", gap:8}}>
        {categories.map(cat => (
          <div key={cat.id} style={{...CARD({ padding:"14px 16px" }), display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <div style={{display:"flex", gap:12, alignItems:"center"}}>
              <span style={{fontSize:22}}>{cat.icon||"📄"}</span>
              <div>
                <div style={{fontWeight:700, fontSize:13, color:B.black}}>{cat.name}</div>
                <div style={{fontSize:11, color:B.g3}}>{cat.description}</div>
              </div>
              <div style={{width:12, height:12, borderRadius:"50%", background:cat.color, flexShrink:0}}/>
              <span style={{...TAG(cat.color+"18",cat.color), fontSize:9}}>{cat.article_count||0} articles</span>
            </div>
            <div style={{display:"flex", gap:6}}>
              <button style={{...BS, padding:"5px 12px", fontSize:11}} onClick={() => openEdit(cat)}>Edit</button>
              <button style={{...BG(B.g3), fontSize:11}} onClick={() => handleDelete(cat.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {toast && (
        <div style={{position:"fixed",bottom:28,right:28,zIndex:9999,background:toast.startsWith("Error")?B.red:B.teal,color:B.white,padding:"12px 22px",borderRadius:8,fontSize:13,fontWeight:600,fontFamily:"'Montserrat',sans-serif"}}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Article Health ─────────────────────────────────────────────────────────────
function ArticleHealth({ onOpenArticle }) {
  const [stale, setStale]   = useState([]);
  const [noViews, setNoViews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Stale: published articles not reviewed in 180 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 180);

    Promise.all([
      api.listArticles({ status:"published", role:"Admin", limit:100 }),
    ]).then(([all]) => {
      const arts = all.articles || [];
      const staleArts = arts.filter(a => {
        const reviewed = a.last_reviewed_at ? new Date(a.last_reviewed_at) : new Date(a.created_at);
        return reviewed < cutoff;
      });
      const noViewArts = arts.filter(a => (a.view_count||0) === 0);
      setStale(staleArts);
      setNoViews(noViewArts);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{color:B.g3}}>Analysing…</div>;

  return (
    <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:20}}>
      <div>
        <div style={{fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:B.g3, marginBottom:12}}>
          🕐 Not Reviewed in 180+ Days ({stale.length})
        </div>
        {stale.length === 0 ? (
          <div style={{...CARD(), color:B.g3, textAlign:"center", padding:"24px"}}>All articles are current ✓</div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {stale.map(a => (
              <HealthCard key={a.id} a={a} badge="Stale" badgeColor="#8B6914" badgeBg="#FFF3CD" onOpen={onOpenArticle} />
            ))}
          </div>
        )}
      </div>
      <div>
        <div style={{fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:B.g3, marginBottom:12}}>
          👁 Published but Never Viewed ({noViews.length})
        </div>
        {noViews.length === 0 ? (
          <div style={{...CARD(), color:B.g3, textAlign:"center", padding:"24px"}}>All articles have views ✓</div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {noViews.map(a => (
              <HealthCard key={a.id} a={a} badge="No views" badgeColor={B.g3} badgeBg={B.g1} onOpen={onOpenArticle} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HealthCard({ a, badge, badgeColor, badgeBg, onOpen }) {
  return (
    <div style={{...CARD({ padding:"12px 14px", cursor:"pointer" })}} onClick={() => onOpen({ _openId: a.id })}>
      <div style={{display:"flex", gap:6, alignItems:"center", marginBottom:4}}>
        <span style={{fontWeight:700, color:typeMeta(a.article_type).color, fontSize:11}}>{a.article_num}</span>
        <span style={{...TAG(badgeBg,badgeColor)}}>{badge}</span>
      </div>
      <div style={{fontSize:12, fontWeight:600, color:B.black, lineHeight:1.3}}>{a.title}</div>
      <div style={{fontSize:10, color:B.g3, marginTop:4}}>
        Last updated {new Date(a.updated_at).toLocaleDateString("en-GB")}
      </div>
    </div>
  );
}

// ── Search Gaps ────────────────────────────────────────────────────────────────
function SearchGaps({ onNewArticle }) {
  const [misses, setMisses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStats().then(s => {
      setMisses(s.searchMisses || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{color:B.g3}}>Loading…</div>;

  return (
    <div>
      <div style={{fontSize:12, color:B.g3, marginBottom:16}}>
        These searches returned zero results — consider creating articles to fill these gaps.
      </div>
      {misses.length === 0 ? (
        <div style={{...CARD(), textAlign:"center", padding:"48px", color:B.g3}}>
          <div style={{fontSize:32, marginBottom:12}}>🎉</div>
          <div style={{fontWeight:700}}>No failed searches recorded yet</div>
        </div>
      ) : (
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          {misses.map((m,i) => (
            <div key={i} style={{...CARD({ padding:"12px 16px" }), display:"flex", justifyContent:"space-between", alignItems:"center"}}>
              <div>
                <span style={{fontWeight:700, fontSize:14, color:B.black}}>"{m.query}"</span>
                <span style={{fontSize:11, color:B.g3, marginLeft:10}}>{m.n} failed search{m.n>1?"es":""}</span>
              </div>
              <button style={{...BS, padding:"6px 14px", fontSize:11, borderColor:B.teal, color:B.teal}}
                onClick={() => onNewArticle({ prefillTitle: m.query })}>
                + Create Article
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
