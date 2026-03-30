import { useState, useEffect, useCallback } from "react";
import { B, CARD, BP, BS, BG, LBL, TAG, FI, FS, RichTextEditor, typeMeta, ARTICLE_TYPES, EMEA_COUNTRIES, StatusBadge } from "./shared.jsx";
import * as api from "../api.js";

const BLANK_ARTICLE = {
  articleType: "kcs",
  title: "",
  section1: "",
  section2: "",
  section3: "",
  section4: "",
  workdayPath: "",
  categoryId: "",
  countries: ["All EMEA"],
  tags: [],
  status: "draft",
};

export default function ArticleEditor({ articleId, user, categories, onSaved, onCancel }) {
  const [form, setForm]         = useState(BLANK_ARTICLE);
  const [loading, setLoading]   = useState(!!articleId);
  const [saving, setSaving]     = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [preview, setPreview]   = useState(false);
  const [toast, setToast]       = useState("");
  const [related, setRelated]   = useState([]);
  const [relSearch, setRelSearch] = useState("");
  const [relResults, setRelResults] = useState([]);
  const [showSection4, setShowSection4] = useState(false);

  useEffect(() => {
    if (!articleId) {
      api.getNextNum().then(r => setForm(prev => ({ ...prev, articleNum: r.num }))).catch(()=>{});
      return;
    }
    Promise.all([api.getArticle(articleId), api.getRelated(articleId)]).then(([a, r]) => {
      setForm({
        articleNum:   a.article_num,
        articleType:  a.article_type,
        title:        a.title,
        section1:     a.section1 || "",
        section2:     a.section2 || "",
        section3:     a.section3 || "",
        section4:     a.section4 || "",
        workdayPath:  a.workday_path || "",
        categoryId:   a.category_id || "",
        countries:    (() => { try { return JSON.parse(a.countries || '["All EMEA"]'); } catch { return ["All EMEA"]; } })(),
        tags:         (() => { try { return JSON.parse(a.tags || "[]"); } catch { return []; } })(),
        status:       a.status,
      });
      setShowSection4(!!(a.section4));
      setRelated(r);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [articleId]);

  const setField = useCallback((key, val) => setForm(prev => ({ ...prev, [key]: val })), []);

  const handleSave = async () => {
    if (!form.title.trim()) { setToast("Title is required"); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        countries: form.countries,
        tags: form.tags,
        authorName: user.name,
        _savedBy: user.name,
      };
      if (articleId) {
        await api.updateArticle(articleId, payload);
        setToast("Saved");
        onSaved(articleId);
      } else {
        const res = await api.createArticle(payload);
        setToast("Created");
        onSaved(res.id || articleId);
      }
    } catch (e) {
      setToast("Error: " + e.message);
    }
    setSaving(false);
  };

  const handleTagAdd = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t)) {
      setField("tags", [...form.tags, t]);
    }
    setTagInput("");
  };

  const handleCountryToggle = (c) => {
    if (c === "All EMEA") {
      setField("countries", ["All EMEA"]);
      return;
    }
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
    setRelResults((r.articles||[]).filter(a => a.id !== articleId && !related.some(x=>x.id===a.id)));
  };

  const addRelated = async (a) => {
    if (!articleId) { setToast("Save article first to add related links"); return; }
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
    <div style={{maxWidth:980, margin:"80px auto", textAlign:"center", color:B.g3, fontFamily:"'Montserrat',sans-serif"}}>
      Loading…
    </div>
  );

  return (
    <div style={{maxWidth:980, margin:"0 auto", padding:"28px 24px"}}>

      {/* Header */}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22, flexWrap:"wrap", gap:12}}>
        <div>
          <button onClick={onCancel} style={{...BG(), paddingLeft:0, marginBottom:4}}>← Back</button>
          <h2 style={{fontSize:18, fontWeight:700, color:B.black}}>
            {articleId ? `Editing ${form.articleNum || ""}` : "New Article"}
          </h2>
        </div>
        <div style={{display:"flex", gap:8}}>
          <button style={{...BS, borderColor:preview?B.teal:B.g2, color:preview?B.teal:B.black}}
            onClick={() => setPreview(!preview)}>
            {preview ? "← Edit" : "Preview"}
          </button>
          <button style={BP} onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : articleId ? "Save Changes" : "Create Article"}
          </button>
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 320px", gap:20, alignItems:"start"}}>

        {/* ── Left: content ── */}
        <div style={{display:"flex", flexDirection:"column", gap:16}}>

          {/* Type + Title */}
          <div style={CARD()}>
            <div style={{marginBottom:14}}>
              <label style={LBL}>Article Type</label>
              <div style={{display:"flex", gap:8}}>
                {Object.entries(ARTICLE_TYPES).map(([key, t]) => (
                  <button key={key} onClick={() => setField("articleType", key)} style={{
                    padding:"7px 16px", borderRadius:6,
                    border:`1.5px solid ${form.articleType===key ? t.color : B.g2}`,
                    background: form.articleType===key ? t.color+"18" : B.white,
                    color: form.articleType===key ? t.color : B.g3,
                    fontSize:11, fontWeight:700, fontFamily:"'Montserrat',sans-serif", cursor:"pointer",
                  }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <FI label="Title" value={form.title} onChange={e=>setField("title",e.target.value)} placeholder="Concise description of the issue or procedure" />
            {form.articleType === "qrg" && (
              <div style={{marginTop:12}}>
                <FI label="Workday Navigation Path" value={form.workdayPath}
                  onChange={e=>setField("workdayPath",e.target.value)}
                  placeholder="e.g. Menu > Payroll > Run Payroll" />
              </div>
            )}
          </div>

          {/* Sections */}
          {[0,1,2].map(i => (
            <div key={i} style={{...CARD(), borderLeftWidth:4, borderLeftColor:meta.color}}>
              <RichTextEditor
                label={meta.sections[i]}
                value={form[`section${i+1}`]}
                onChange={e => setField(`section${i+1}`, e.target.value)}
                minHeight={i===2 ? 240 : 140}
              />
            </div>
          ))}

          {/* Section 4 (optional) */}
          <div>
            {!showSection4 ? (
              <button style={{...BG(B.teal), fontSize:11}} onClick={()=>setShowSection4(true)}>
                + Add {meta.sections[3] || meta.s4label}
              </button>
            ) : (
              <div style={{...CARD(), borderLeftWidth:4, borderLeftColor:B.g2}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8}}>
                  <span style={{...LBL, display:"inline"}}>{meta.sections[3] || meta.s4label} (Optional)</span>
                  <button style={{...BG(B.g3), fontSize:10, padding:"2px 8px"}} onClick={()=>{setShowSection4(false); setField("section4","");}}>Remove</button>
                </div>
                <RichTextEditor
                  value={form.section4}
                  onChange={e => setField("section4", e.target.value)}
                  minHeight={120}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Right: metadata sidebar ── */}
        <div style={{display:"flex", flexDirection:"column", gap:12}}>

          {/* Status */}
          <div style={CARD({ padding:"14px 16px" })}>
            <label style={LBL}>Status</label>
            <StatusBadge status={form.status} />
            {form.articleNum && (
              <div style={{fontSize:11, color:B.g3, marginTop:6}}>
                <span style={{fontWeight:700, color:meta.color}}>{form.articleNum}</span>
              </div>
            )}
          </div>

          {/* Category */}
          <div style={CARD({ padding:"14px 16px" })}>
            <FS label="Category" value={form.categoryId} onChange={e=>setField("categoryId",e.target.value)}>
              <option value="">No Category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FS>
          </div>

          {/* Countries */}
          <div style={CARD({ padding:"14px 16px" })}>
            <label style={LBL}>Countries / Applicability</label>
            <div style={{display:"flex", flexWrap:"wrap", gap:4}}>
              {["All EMEA", ...EMEA_COUNTRIES.slice(1)].map(c => {
                const sel = form.countries.includes(c);
                return (
                  <button key={c} onClick={() => handleCountryToggle(c)} style={{
                    padding:"3px 10px", borderRadius:14,
                    border:`1.5px solid ${sel ? B.blue : B.g2}`,
                    background: sel ? B.blue : B.white,
                    color: sel ? B.white : B.g3,
                    fontSize:10, fontWeight:600, cursor:"pointer", fontFamily:"'Montserrat',sans-serif",
                  }}>
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags */}
          <div style={CARD({ padding:"14px 16px" })}>
            <label style={LBL}>Tags</label>
            <div style={{display:"flex", gap:6, marginBottom:8, flexWrap:"wrap"}}>
              {form.tags.map(t => (
                <span key={t} style={{...TAG(), display:"inline-flex", alignItems:"center", gap:4}}>
                  {t}
                  <button style={{background:"none",border:"none",cursor:"pointer",color:B.g3,fontSize:10,padding:0,lineHeight:1}} onClick={()=>setField("tags",form.tags.filter(x=>x!==t))}>✕</button>
                </span>
              ))}
            </div>
            <div style={{display:"flex", gap:6}}>
              <input value={tagInput} onChange={e=>setTagInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"||e.key===","){e.preventDefault();handleTagAdd();}}}
                placeholder="Add tag…"
                style={{flex:1,padding:"6px 10px",borderRadius:6,border:`1.5px solid ${B.g2}`,fontSize:11,fontFamily:"'Montserrat',sans-serif",outline:"none"}}
              />
              <button style={{...BS, padding:"6px 12px", fontSize:11}} onClick={handleTagAdd}>Add</button>
            </div>
          </div>

          {/* Related articles */}
          <div style={CARD({ padding:"14px 16px" })}>
            <label style={LBL}>Related Articles</label>
            {related.map(r => (
              <div key={r.id} style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:`1px solid ${B.g1}`}}>
                <div>
                  <div style={{fontSize:10, fontWeight:700, color:typeMeta(r.article_type).color}}>{r.article_num}</div>
                  <div style={{fontSize:11, color:B.black, lineHeight:1.3}}>{r.title}</div>
                </div>
                <button style={{...BG(B.g3), padding:"2px 7px", fontSize:10}} onClick={() => removeRelated(r.id)}>✕</button>
              </div>
            ))}
            <input
              value={relSearch}
              onChange={e => { setRelSearch(e.target.value); searchRelated(e.target.value); }}
              placeholder="Search to link article…"
              style={{width:"100%",marginTop:8,padding:"6px 10px",borderRadius:6,border:`1.5px solid ${B.g2}`,fontSize:11,fontFamily:"'Montserrat',sans-serif",outline:"none",boxSizing:"border-box"}}
            />
            {relResults.map(r => (
              <div key={r.id} style={{
                padding:"6px 8px", borderRadius:4, cursor:"pointer", marginTop:2,
                background:B.g1, fontSize:11,
              }} onClick={() => { addRelated(r); setRelSearch(""); setRelResults([]); }}>
                <span style={{fontWeight:700, color:typeMeta(r.article_type).color, marginRight:6}}>{r.article_num}</span>
                {r.title}
              </div>
            ))}
          </div>
        </div>
      </div>

      {toast && (
        <div style={{
          position:"fixed", bottom:28, right:28, zIndex:9999,
          background: toast.startsWith("Error") ? B.red : B.teal,
          color:B.white, padding:"12px 22px",
          borderRadius:8, fontSize:13, fontWeight:600, fontFamily:"'Montserrat',sans-serif",
          display:"flex", alignItems:"center", gap:10,
        }}>
          {toast}
          <button style={{background:"none",border:"none",color:B.white,cursor:"pointer",fontSize:14}} onClick={()=>setToast("")}>✕</button>
        </div>
      )}
    </div>
  );
}
