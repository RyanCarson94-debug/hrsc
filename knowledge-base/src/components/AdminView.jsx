import { useState, useEffect, useCallback } from "react";
import { B, SH, CARD, BP, BPR, BS, BG, TAG, LBL, FI, TypeBadge, StatusBadge, StatCard, typeMeta, gid, EmptyState } from "./shared.jsx";
import * as api from "../api.js";

const TABS = [
  { key: "queue",   label: "Review Queue",   icon: "⏳" },
  { key: "cats",    label: "Categories",     icon: "⊞" },
  { key: "health",  label: "Article Health", icon: "◎" },
  { key: "gaps",    label: "Search Gaps",    icon: "🔍" },
];

export default function AdminView({ user, categories, onOpenArticle, onNewArticle, refreshCategories, refreshStats }) {
  const [tab, setTab]   = useState("queue");
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.getStats().then(setStats).catch(() => {});
  }, []);

  if (user.role !== "Admin") {
    return (
      <div style={{
        maxWidth: 480, margin: "80px auto", textAlign: "center",
        color: B.g3, fontFamily: "'Montserrat',sans-serif",
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: B.black }}>Admin access required</div>
        <div style={{ fontSize: 12, color: B.g3, marginTop: 8 }}>Contact your system administrator.</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1050, margin: "0 auto", padding: "20px 24px 48px" }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: B.black, margin: 0 }}>Admin Panel</h2>
        <div style={{ fontSize: 11, color: B.g3, marginTop: 3 }}>Manage articles, categories and review workflow</div>
      </div>

      {/* Stats strip */}
      {stats && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 24,
        }}>
          <StatCard value={stats.published || 0} label="Published" color={B.teal} />
          <StatCard value={stats.review || 0}    label="In Review"  color={B.yellow} />
          <StatCard value={stats.draft || 0}     label="Drafts"     color={B.g3} />
          <StatCard value={stats.archived || 0}  label="Archived"   color={B.g4} />
        </div>
      )}

      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 0, borderBottom: `1px solid ${B.g2}`,
        marginBottom: 24, background: B.white, borderRadius: "10px 10px 0 0",
        border: `1px solid ${B.g2}`, overflow: "hidden",
      }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: "12px 8px",
            background: tab === t.key ? B.tealLight : "transparent",
            border: "none", borderBottom: tab === t.key ? `2px solid ${B.teal}` : "2px solid transparent",
            cursor: "pointer", fontSize: 12, fontWeight: tab === t.key ? 700 : 500,
            fontFamily: "'Montserrat',sans-serif",
            color: tab === t.key ? B.teal : B.g3,
            transition: "all 0.15s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <span style={{ fontSize: 13 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "queue"  && <ReviewQueue user={user} onOpenArticle={onOpenArticle} />}
      {tab === "cats"   && <CategoriesAdmin categories={categories} refreshCategories={refreshCategories} />}
      {tab === "health" && <ArticleHealth onOpenArticle={onOpenArticle} />}
      {tab === "gaps"   && <SearchGaps onNewArticle={onNewArticle} />}
    </div>
  );
}

// ─── Review Queue ──────────────────────────────────────────────────────────────
function ReviewQueue({ user, onOpenArticle }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [commentMap, setCommentMap] = useState({});
  const [toast, setToast]       = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.listArticles({ status: "review", role: "Admin", limit: 50 });
      setArticles(r.articles || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAction = async (id, status) => {
    const comment = commentMap[id]?.trim();
    if (comment) {
      await api.addComment(id, { comment, authorName: user.name });
    }
    await api.changeStatus(id, status, { reviewedBy: user.name });
    setArticles(prev => prev.filter(a => a.id !== id));
    setCommentMap(prev => { const n = { ...prev }; delete n[id]; return n; });
    showToast(status === "published" ? "Article published" : "Returned to draft");
  };

  if (loading) return <LoadingText />;

  return (
    <div>
      {articles.length === 0 ? (
        <EmptyState
          icon="✅"
          title="Review queue is empty"
          body="All submitted articles have been reviewed. Check back later."
        />
      ) : (
        <>
          <div style={{ fontSize: 11, color: B.g3, marginBottom: 14 }}>
            {articles.length} article{articles.length !== 1 ? "s" : ""} awaiting review
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {articles.map(a => {
              const tm = typeMeta(a.article_type);
              return (
                <div key={a.id} style={{
                  background: B.white, borderRadius: 12,
                  border: `1px solid ${B.g2}`, overflow: "hidden",
                  boxShadow: SH.sm,
                }}>
                  <div style={{ height: 3, background: `linear-gradient(90deg, ${B.yellow}, ${B.yellow}60)` }} />
                  <div style={{ padding: "18px 20px" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: tm.color }}>{a.article_num}</span>
                      <TypeBadge type={a.article_type} />
                      <span style={{ ...TAG("#FEF9EC", "#7A5C00") }}>Awaiting Review</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: B.black, marginBottom: 6 }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: B.g3, marginBottom: 14, display: "flex", gap: 14 }}>
                      <span>Author: {a.author_name}</span>
                      <span>Updated: {new Date(a.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                    </div>
                    <textarea
                      value={commentMap[a.id] || ""}
                      onChange={e => setCommentMap(prev => ({ ...prev, [a.id]: e.target.value }))}
                      placeholder="Optional review comment (saved to article)…"
                      rows={2}
                      style={{
                        width: "100%", boxSizing: "border-box",
                        padding: "9px 12px", borderRadius: 7,
                        border: `1.5px solid ${B.g2}`, fontSize: 12,
                        fontFamily: "'Montserrat',sans-serif",
                        resize: "vertical", marginBottom: 12, outline: "none",
                      }}
                      onFocus={e => e.target.style.borderColor = B.teal}
                      onBlur={e => e.target.style.borderColor = B.g2}
                    />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button style={{ ...BP, padding: "8px 18px", fontSize: 12 }} onClick={() => handleAction(a.id, "published")}>
                        ✓ Publish
                      </button>
                      <button style={{ ...BS, padding: "8px 18px", fontSize: 12 }} onClick={() => handleAction(a.id, "draft")}>
                        Return to Draft
                      </button>
                      <button
                        onClick={() => onOpenArticle({ _openId: a.id })}
                        style={{ ...BG(), fontSize: 12, padding: "8px 14px" }}>
                        View Article →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      <ToastNotif toast={toast} onDone={() => setToast(null)} />
    </div>
  );
}

// ─── Categories Admin ──────────────────────────────────────────────────────────
function CategoriesAdmin({ categories, refreshCategories }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm]       = useState({ name: "", description: "", color: "#00A28A", icon: "", sortOrder: 0 });
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openNew = () => {
    setForm({ name: "", description: "", color: "#00A28A", icon: "", sortOrder: categories.length + 1 });
    setEditing("new");
  };

  const openEdit = (cat) => {
    setForm({ name: cat.name, description: cat.description || "", color: cat.color || "#00A28A", icon: cat.icon || "", sortOrder: cat.sort_order || 0 });
    setEditing(cat.id);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast("Name is required", "error"); return; }
    setSaving(true);
    try {
      if (editing === "new") {
        await api.createCategory({ ...form, id: gid() });
      } else {
        await api.updateCategory(editing, form);
      }
      await refreshCategories();
      setEditing(null);
      showToast("Category saved");
    } catch (e) { showToast("Error: " + e.message, "error"); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this category? Articles in it will become uncategorised.")) return;
    await api.deleteCategory(id);
    await refreshCategories();
    showToast("Category deleted");
  };

  const sf = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: B.g3 }}>{categories.length} categories</span>
        <button style={{ ...BP, padding: "8px 16px", fontSize: 12 }} onClick={openNew}>+ New Category</button>
      </div>

      {/* Edit form */}
      {editing && (
        <div style={{
          background: B.white, borderRadius: 12, border: `1.5px solid ${B.teal}`,
          padding: "20px 22px", marginBottom: 20, boxShadow: `0 0 0 3px ${B.teal}18`,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: B.black, marginBottom: 16 }}>
            {editing === "new" ? "New Category" : "Edit Category"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <FI label="Name *" value={form.name} onChange={e => sf("name", e.target.value)} placeholder="e.g. Leave & Absence" />
            <FI label="Emoji Icon" value={form.icon} onChange={e => sf("icon", e.target.value)} placeholder="📋" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <FI label="Description" value={form.description} onChange={e => sf("description", e.target.value)} placeholder="Brief description of what this category covers" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={LBL}>Accent Colour</label>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input type="color" value={form.color} onChange={e => sf("color", e.target.value)}
                  style={{ width: 44, height: 38, padding: 2, border: `1.5px solid ${B.g2}`, borderRadius: 7, cursor: "pointer", background: "transparent" }} />
                <div style={{
                  flex: 1, height: 38, borderRadius: 7, background: form.color + "20",
                  border: `1.5px solid ${form.color}40`, display: "flex", alignItems: "center",
                  paddingLeft: 10, fontSize: 12, color: form.color, fontWeight: 600,
                }}>
                  {form.color}
                </div>
              </div>
            </div>
            <FI label="Sort Order" type="number" value={form.sortOrder}
              onChange={e => sf("sortOrder", parseInt(e.target.value) || 0)} />
          </div>
          {/* Preview */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
            background: form.color + "10", border: `1px solid ${form.color}30`,
            borderRadius: 8, marginBottom: 16,
          }}>
            <span style={{ fontSize: 20 }}>{form.icon || "📄"}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: B.black }}>{form.name || "Category name"}</div>
              <div style={{ fontSize: 10, color: B.g3 }}>{form.description || "Description"}</div>
            </div>
            <div style={{ height: 3, background: form.color, borderRadius: 2, width: 40, marginLeft: "auto" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...BP, padding: "8px 18px", fontSize: 12 }} onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Category"}
            </button>
            <button style={{ ...BS, padding: "8px 16px", fontSize: 12 }} onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Category list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {categories.map(cat => (
          <div key={cat.id} style={{
            background: B.white, borderRadius: 10, border: `1px solid ${B.g2}`,
            padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
            boxShadow: SH.xs,
          }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1, minWidth: 0 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: cat.color + "18", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, border: `1px solid ${cat.color}25`,
              }}>
                {cat.icon || "📄"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: B.black }}>{cat.name}</div>
                <div style={{ fontSize: 11, color: B.g3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {cat.description}
                </div>
              </div>
              <span style={{ ...TAG(cat.color + "15", cat.color), fontSize: 9, flexShrink: 0 }}>
                {cat.article_count || 0} articles
              </span>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 12 }}>
              <button style={{ ...BS, padding: "5px 12px", fontSize: 11 }} onClick={() => openEdit(cat)}>Edit</button>
              <button style={{ ...BG(B.g3), padding: "5px 10px", fontSize: 11 }} onClick={() => handleDelete(cat.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      <ToastNotif toast={toast} onDone={() => setToast(null)} />
    </div>
  );
}

// ─── Article Health ────────────────────────────────────────────────────────────
function ArticleHealth({ onOpenArticle }) {
  const [stale, setStale]     = useState([]);
  const [noViews, setNoViews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 180);
    api.listArticles({ status: "published", role: "Admin", limit: 100 }).then(all => {
      const arts = all.articles || [];
      setStale(arts.filter(a => {
        const reviewed = a.last_reviewed_at ? new Date(a.last_reviewed_at) : new Date(a.created_at);
        return reviewed < cutoff;
      }));
      setNoViews(arts.filter(a => (a.view_count || 0) === 0));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingText />;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
      <HealthSection
        icon="⏰" title="Not Reviewed in 180+ Days" count={stale.length}
        badgeLabel="Stale" badgeColor="#8B6914" badgeBg="#FEF9EC"
        articles={stale} emptyMsg="All articles are current"
        onOpen={onOpenArticle}
      />
      <HealthSection
        icon="👁" title="Published but Never Viewed" count={noViews.length}
        badgeLabel="0 views" badgeColor={B.g3} badgeBg={B.g1}
        articles={noViews} emptyMsg="All articles have been viewed"
        onOpen={onOpenArticle}
      />
    </div>
  );
}

function HealthSection({ icon, title, count, badgeLabel, badgeColor, badgeBg, articles, emptyMsg, onOpen }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: B.g3, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {title}
        </span>
        <span style={{
          background: count > 0 ? badgeBg : B.g1,
          color: count > 0 ? badgeColor : B.g3,
          fontSize: 10, fontWeight: 700, padding: "1px 8px", borderRadius: 10,
        }}>
          {count}
        </span>
      </div>
      {articles.length === 0 ? (
        <div style={{
          background: B.white, borderRadius: 10, border: `1px solid ${B.g2}`,
          padding: "20px", textAlign: "center", color: B.g3, fontSize: 12,
        }}>
          {emptyMsg} ✓
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {articles.map(a => {
            const tm = typeMeta(a.article_type);
            return (
              <div key={a.id} onClick={() => onOpen({ _openId: a.id })} style={{
                background: B.white, borderRadius: 9, border: `1px solid ${B.g2}`,
                padding: "11px 14px", cursor: "pointer", boxShadow: SH.xs,
                transition: "box-shadow 0.15s",
              }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = SH.sm}
                onMouseLeave={e => e.currentTarget.style.boxShadow = SH.xs}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: tm.color, fontSize: 10 }}>{a.article_num}</span>
                  <span style={{ ...TAG(badgeBg, badgeColor), fontSize: 9 }}>{badgeLabel}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: B.black, lineHeight: 1.3 }}>{a.title}</div>
                <div style={{ fontSize: 10, color: B.g3, marginTop: 4 }}>
                  Updated {new Date(a.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Search Gaps ───────────────────────────────────────────────────────────────
function SearchGaps({ onNewArticle }) {
  const [misses, setMisses]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStats().then(s => {
      setMisses(s.searchMisses || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingText />;

  return (
    <div>
      <div style={{ fontSize: 12, color: B.g3, marginBottom: 16, lineHeight: 1.6 }}>
        These searches returned zero results. Consider creating articles to fill these knowledge gaps.
      </div>
      {misses.length === 0 ? (
        <EmptyState
          icon="🎉"
          title="No failed searches recorded"
          body="All user searches are finding relevant content."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {misses.map((m, i) => (
            <div key={i} style={{
              background: B.white, borderRadius: 10, border: `1px solid ${B.g2}`,
              padding: "12px 16px", display: "flex", justifyContent: "space-between",
              alignItems: "center", boxShadow: SH.xs, gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: B.black, marginBottom: 2 }}>
                  "{m.query}"
                </div>
                <div style={{ fontSize: 11, color: B.g3 }}>
                  {m.n} failed search{m.n > 1 ? "es" : ""}
                </div>
              </div>
              <div style={{
                width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                background: B.red + "10", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 18, fontWeight: 700, color: B.red,
              }}>
                {m.n}
              </div>
              <button style={{
                ...BS, padding: "7px 14px", fontSize: 11,
                borderColor: B.teal, color: B.teal, flexShrink: 0,
              }} onClick={() => onNewArticle({ prefillTitle: m.query })}>
                + Create Article
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function LoadingText() {
  return <div style={{ color: B.g3, fontFamily: "'Montserrat',sans-serif", fontSize: 13 }}>Loading…</div>;
}

function ToastNotif({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [toast, onDone]);

  if (!toast) return null;
  return (
    <div style={{
      position: "fixed", bottom: 28, right: 28, zIndex: 9999,
      background: toast.type === "error" ? B.red : B.teal,
      color: B.white, padding: "12px 20px", borderRadius: 10,
      fontSize: 13, fontWeight: 600, fontFamily: "'Montserrat',sans-serif",
      boxShadow: SH.lg, display: "flex", alignItems: "center", gap: 10,
      animation: "kbToastIn 0.25s cubic-bezier(0.34,1.56,0.64,1)",
    }}>
      <span>{toast.type === "error" ? "✕" : "✓"}</span>
      <span>{toast.msg}</span>
    </div>
  );
}
