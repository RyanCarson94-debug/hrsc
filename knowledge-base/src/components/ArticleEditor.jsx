import { useState, useEffect, useCallback } from "react";
import { B, SH, CARD, BP, BS, BG, LBL, TAG, FI, FS, RichTextEditor, typeMeta, ARTICLE_TYPES, StatusBadge } from "./shared.jsx";
import * as api from "../api.js";

const BLANK = {
  articleType: "kcs", title: "",
  section1: "", section2: "", section3: "", section4: "",
  workdayPath: "", categoryId: "", countries: ["All EMEA"], tags: [], status: "draft",
};

export default function ArticleEditor({ articleId, prefillTitle, user, categories, countries = [], onSaved, onCancel }) {
  const [form, setForm]           = useState({ ...BLANK, title: prefillTitle || "" });
  const [loading, setLoading]     = useState(!!articleId);
  const [saving, setSaving]       = useState(false);
  const [tagInput, setTagInput]   = useState("");
  const [related, setRelated]     = useState([]);
  const [relSearch, setRelSearch] = useState("");
  const [relResults, setRelResults] = useState([]);
  const [showSec4, setShowSec4]   = useState(false);
  const [toast, setToast]         = useState(null);
  const [activeSection, setActiveSection] = useState(0);

  useEffect(() => {
    if (!articleId) {
      api.getNextNum().then(r => setForm(prev => ({ ...prev, articleNum: r.num }))).catch(() => {});
      return;
    }
    Promise.all([api.getArticle(articleId), api.getRelated(articleId)]).then(([a, r]) => {
      setForm({
        articleNum:  a.article_num,
        articleType: a.article_type,
        title:       a.title,
        section1:    a.section1 || "",
        section2:    a.section2 || "",
        section3:    a.section3 || "",
        section4:    a.section4 || "",
        workdayPath: a.workday_path || "",
        categoryId:  a.category_id || "",
        countries:   (() => { try { return JSON.parse(a.countries || '["All EMEA"]'); } catch { return ["All EMEA"]; } })(),
        tags:        (() => { try { return JSON.parse(a.tags || "[]"); } catch { return []; } })(),
        status:      a.status,
      });
      setShowSec4(!!(a.section4));
      setRelated(r);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [articleId]);

  const setField = useCallback((key, val) => setForm(prev => ({ ...prev, [key]: val })), []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { showToast("Title is required", "error"); return; }
    setSaving(true);
    try {
      const payload = { ...form, authorName: user.name, _savedBy: user.name };
      if (articleId) {
        await api.updateArticle(articleId, payload);
        showToast("Changes saved");
        onSaved(articleId);
      } else {
        const res = await api.createArticle(payload);
        showToast("Article created");
        onSaved(res.id);
      }
    } catch (e) { showToast("Error: " + e.message, "error"); }
    setSaving(false);
  };

  const handleTagAdd = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t)) setField("tags", [...form.tags, t]);
    setTagInput("");
  };

  const handleCountryToggle = (c) => {
    if (c === "All EMEA") { setField("countries", ["All EMEA"]); return; }
    const withoutAll = form.countries.filter(x => x !== "All EMEA");
    if (withoutAll.includes(c)) {
      const next = withoutAll.filter(x => x !== c);
      setField("countries", next.length ? next : ["All EMEA"]);
    } else {
      setField("countries", [...withoutAll, c]);
    }
  };

  const searchRelated = async (q) => {
    if (!q.trim()) { setRelResults([]); return; }
    const r = await api.listArticles({ search: q, status: "published", limit: 8, role: user.role, userName: user.name });
    setRelResults((r.articles || []).filter(a => a.id !== articleId && !related.some(x => x.id === a.id)));
  };

  const addRelated = async (a) => {
    if (!articleId) { showToast("Save article first to add related links", "error"); return; }
    await api.addRelated(articleId, a.id);
    setRelated(prev => [...prev, a]);
    setRelResults(prev => prev.filter(x => x.id !== a.id));
  };

  const removeRelated = async (id) => {
    if (!articleId) return;
    await api.removeRelated(articleId, id);
    setRelated(prev => prev.filter(r => r.id !== id));
  };

  const meta = typeMeta(form.articleType);

  if (loading) return (
    <div style={{
      maxWidth: 980, margin: "80px auto", textAlign: "center",
      color: B.g3, fontFamily: "'Montserrat',sans-serif",
    }}>
      Loading article…
    </div>
  );

  const sectionTabs = meta.sections.slice(0, 3);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "20px 24px 48px" }}>

      {/* ── Editor header bar ── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 20, gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: B.black }}>
              {articleId
                ? <span>{form.articleNum && <span style={{ color: meta.color, marginRight: 6 }}>{form.articleNum}</span>}Edit Article</span>
                : "New Article"}
            </div>
            <div style={{ fontSize: 11, color: B.g3, marginTop: 2 }}>
              {articleId ? "Editing existing article" : "Creating draft — save to publish workflow"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...BS, padding: "8px 16px", fontSize: 12 }} onClick={onCancel}>
            Cancel
          </button>
          <button style={{ ...BP, padding: "8px 20px", fontSize: 12 }} onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : articleId ? "Save Changes" : "Create Article"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, alignItems: "start" }}>

        {/* ── Left column: content ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Type selector + Title */}
          <div style={{ background: B.white, borderRadius: 12, border: `1px solid ${B.g2}`, boxShadow: SH.xs, padding: "18px 20px" }}>
            {/* Type buttons */}
            <div style={{ marginBottom: 16 }}>
              <label style={LBL}>Article Type</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {Object.entries(ARTICLE_TYPES).map(([key, t]) => {
                  const active = form.articleType === key;
                  return (
                    <button key={key} onClick={() => { setField("articleType", key); setActiveSection(0); }}
                      style={{
                        padding: "7px 16px", borderRadius: 8, cursor: "pointer",
                        border: `1.5px solid ${active ? t.color : B.g2}`,
                        background: active ? t.lightBg : B.white,
                        color: active ? t.color : B.g3,
                        fontSize: 11, fontWeight: 700, fontFamily: "'Montserrat',sans-serif",
                        transition: "all 0.12s",
                      }}>
                      {t.shortLabel}
                      <span style={{ fontWeight: 400, marginLeft: 4, opacity: 0.7 }}>
                        {t.label !== t.shortLabel ? `— ${t.label}` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <FI
              label="Title"
              value={form.title}
              onChange={e => setField("title", e.target.value)}
              placeholder={
                form.articleType === "kcs" ? "Concise description of the issue or problem" :
                form.articleType === "qrg" ? "How to: [task name] in Workday" :
                "Standard Operating Procedure: [process name]"
              }
            />

            {/* Workday path (QRG only) */}
            {form.articleType === "qrg" && (
              <div style={{ marginTop: 12 }}>
                <FI
                  label="Workday Navigation Path"
                  value={form.workdayPath}
                  onChange={e => setField("workdayPath", e.target.value)}
                  placeholder="e.g. Menu > Payroll > Run Payroll > Submit"
                  hint="The click path to reach this function in Workday"
                />
              </div>
            )}
          </div>

          {/* Section tabs */}
          <div style={{ background: B.white, borderRadius: 12, border: `1px solid ${B.g2}`, boxShadow: SH.xs, overflow: "hidden" }}>
            {/* Tab nav */}
            <div style={{
              display: "flex", borderBottom: `1px solid ${B.g2}`,
              background: B.g0,
            }}>
              {sectionTabs.map((label, i) => {
                const active = activeSection === i;
                return (
                  <button key={i} onClick={() => setActiveSection(i)} style={{
                    flex: 1, padding: "11px 8px",
                    background: active ? B.white : "transparent",
                    border: "none", borderBottom: active ? `2px solid ${meta.color}` : "2px solid transparent",
                    color: active ? meta.color : B.g3,
                    fontWeight: active ? 700 : 500, fontSize: 11,
                    fontFamily: "'Montserrat',sans-serif", cursor: "pointer",
                    letterSpacing: "0.03em", transition: "all 0.12s",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  }}>
                    <span>{meta.sectionIcons[i]}</span>
                    <span>{label}</span>
                    {form[`section${i + 1}`] && (
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: meta.color, flexShrink: 0 }} />
                    )}
                  </button>
                );
              })}
            </div>
            {/* Active editor */}
            <div style={{ padding: "16px 18px" }}>
              <RichTextEditor
                key={`sec-${form.articleType}-${activeSection}`}
                value={form[`section${activeSection + 1}`]}
                onChange={e => setField(`section${activeSection + 1}`, e.target.value)}
                minHeight={activeSection === 2 ? 280 : 180}
                placeholder={getSectionPlaceholder(form.articleType, activeSection)}
              />
            </div>
          </div>

          {/* Section 4 (optional) */}
          <div style={{ background: B.white, borderRadius: 12, border: `1px solid ${B.g2}`, boxShadow: SH.xs }}>
            {!showSec4 ? (
              <button
                onClick={() => setShowSec4(true)}
                style={{
                  width: "100%", padding: "12px 18px",
                  background: "transparent", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  color: B.g3, fontSize: 12, fontFamily: "'Montserrat',sans-serif",
                  fontWeight: 600,
                }}>
                <span style={{
                  width: 20, height: 20, borderRadius: "50%",
                  border: `1.5px dashed ${B.g2}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, color: B.g3,
                }}>+</span>
                Add {meta.sections[3] || meta.s4label} (optional)
              </button>
            ) : (
              <div>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "11px 18px", borderBottom: `1px solid ${B.g2}`,
                  background: B.g0,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span>{meta.sectionIcons[3]}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: B.g3, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      {meta.sections[3]} (optional)
                    </span>
                  </div>
                  <button onClick={() => { setShowSec4(false); setField("section4", ""); }} style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: B.g3, fontSize: 11, fontFamily: "'Montserrat',sans-serif",
                  }}>
                    Remove
                  </button>
                </div>
                <div style={{ padding: "16px 18px" }}>
                  <RichTextEditor
                    key={`sec4-${form.articleType}`}
                    value={form.section4}
                    onChange={e => setField("section4", e.target.value)}
                    minHeight={140}
                    placeholder={getSectionPlaceholder(form.articleType, 3)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right column: metadata ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Status card */}
          <div style={{ background: B.white, borderRadius: 12, border: `1px solid ${B.g2}`, padding: "14px 16px", boxShadow: SH.xs }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={LBL}>Status</span>
              <StatusBadge status={form.status} />
            </div>
            {form.articleNum && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: meta.lightBg, padding: "4px 10px", borderRadius: 6,
                fontSize: 11, fontWeight: 700, color: meta.color,
              }}>
                {form.articleNum}
              </div>
            )}
            <div style={{ fontSize: 11, color: B.g3, marginTop: 8, lineHeight: 1.5 }}>
              {form.status === "draft" && "Save to create · Submit for Review when ready"}
              {form.status === "review" && "Awaiting admin review · Admin can publish"}
              {form.status === "published" && "Live and visible to all advisers"}
              {form.status === "archived" && "Hidden from advisers · Admin can restore"}
            </div>
          </div>

          {/* Category */}
          <div style={{ background: B.white, borderRadius: 12, border: `1px solid ${B.g2}`, padding: "14px 16px", boxShadow: SH.xs }}>
            <FS label="Category" value={form.categoryId} onChange={e => setField("categoryId", e.target.value)}>
              <option value="">— No Category —</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </FS>
          </div>

          {/* Countries */}
          <div style={{ background: B.white, borderRadius: 12, border: `1px solid ${B.g2}`, padding: "14px 16px", boxShadow: SH.xs }}>
            <label style={LBL}>Applicability</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {["All EMEA", ...countries].map(c => {
                const sel = form.countries.includes(c);
                return (
                  <button key={c} onClick={() => handleCountryToggle(c)} style={{
                    padding: "3px 9px", borderRadius: 12, cursor: "pointer",
                    border: `1.5px solid ${sel ? B.blue : B.g2}`,
                    background: sel ? B.blue : "transparent",
                    color: sel ? B.white : B.g4,
                    fontSize: 9, fontWeight: sel ? 700 : 500,
                    fontFamily: "'Montserrat',sans-serif",
                    transition: "all 0.1s",
                  }}>
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags */}
          <div style={{ background: B.white, borderRadius: 12, border: `1px solid ${B.g2}`, padding: "14px 16px", boxShadow: SH.xs }}>
            <label style={LBL}>Tags</label>
            {form.tags.length > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                {form.tags.map(t => (
                  <span key={t} style={{ ...TAG(), display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10 }}>
                    {t}
                    <button
                      onClick={() => setField("tags", form.tags.filter(x => x !== t))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: B.g3, fontSize: 10, padding: 0, lineHeight: 1 }}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); handleTagAdd(); } }}
                placeholder="Tag, then Enter"
                style={{
                  flex: 1, padding: "7px 10px", borderRadius: 6,
                  border: `1.5px solid ${B.g2}`, fontSize: 11,
                  fontFamily: "'Montserrat',sans-serif", outline: "none",
                }}
                onFocus={e => e.target.style.borderColor = B.teal}
                onBlur={e => e.target.style.borderColor = B.g2}
              />
              <button style={{ ...BS, padding: "7px 12px", fontSize: 11 }} onClick={handleTagAdd}>+</button>
            </div>
          </div>

          {/* Related articles */}
          <div style={{ background: B.white, borderRadius: 12, border: `1px solid ${B.g2}`, padding: "14px 16px", boxShadow: SH.xs }}>
            <label style={LBL}>Related Articles</label>
            {related.length === 0 && (
              <div style={{ fontSize: 11, color: B.g3, marginBottom: 8 }}>No related articles linked.</div>
            )}
            {related.map(r => {
              const rm = typeMeta(r.article_type);
              return (
                <div key={r.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "7px 0", borderBottom: `1px solid ${B.g1}`,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: rm.color }}>{r.article_num}</div>
                    <div style={{ fontSize: 11, color: B.black, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                  </div>
                  <button onClick={() => removeRelated(r.id)} style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: B.g3, fontSize: 14, padding: "2px 4px", flexShrink: 0,
                  }}>×</button>
                </div>
              );
            })}
            <div style={{ position: "relative", marginTop: 8 }}>
              <input
                value={relSearch}
                onChange={e => { setRelSearch(e.target.value); searchRelated(e.target.value); }}
                placeholder="Search to link article…"
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "7px 10px", borderRadius: 6,
                  border: `1.5px solid ${B.g2}`, fontSize: 11,
                  fontFamily: "'Montserrat',sans-serif", outline: "none",
                }}
                onFocus={e => e.target.style.borderColor = B.teal}
                onBlur={e => e.target.style.borderColor = B.g2}
              />
              {relResults.length > 0 && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
                  background: B.white, border: `1px solid ${B.g2}`, borderRadius: 8,
                  boxShadow: SH.md, overflow: "hidden",
                }}>
                  {relResults.map(r => {
                    const rm = typeMeta(r.article_type);
                    return (
                      <div key={r.id} onClick={() => { addRelated(r); setRelSearch(""); setRelResults([]); }}
                        style={{ padding: "9px 12px", cursor: "pointer", borderBottom: `1px solid ${B.g1}`, fontSize: 11 }}
                        onMouseEnter={e => e.currentTarget.style.background = B.g1}
                        onMouseLeave={e => e.currentTarget.style.background = B.white}>
                        <span style={{ fontWeight: 700, color: rm.color, marginRight: 6, fontSize: 10 }}>{r.article_num}</span>
                        {r.title}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
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
      )}
    </div>
  );
}

function getSectionPlaceholder(type, index) {
  const placeholders = {
    kcs: [
      "Describe the issue or question the user experienced…",
      "Describe the environment: system, version, country, role…",
      "Step-by-step resolution: what action solves the issue…",
      "What caused this issue to occur…",
    ],
    qrg: [
      "What this guide helps the user do and why…",
      "What the user needs before following this guide…",
      "Step 1: …\nStep 2: …\nStep 3: …",
      "Additional tips, warnings, or exceptions…",
    ],
    sop: [
      "The purpose of this procedure and who it applies to…",
      "Roles involved and their responsibilities…",
      "Detailed step-by-step procedure…",
      "Reference documents, policies, or related SOPs…",
    ],
  };
  return (placeholders[type] || placeholders.kcs)[index] || "";
}
