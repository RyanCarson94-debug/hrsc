import { useState } from "react";
import { B, CARD, BP, BS, BG, TAG, FI, FS, FilterBar, RichTextEditor, renderClauseContent, renderClauseContentRich, mkInp, Toast, usePersistedFilter } from "./shared";
import { getClauseUsage, getClauseVersions } from "../api";
import { ALL_COUNTRIES } from "../defaults";

function gid() { return Math.random().toString(36).slice(2,8); }

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

// ── Version History Modal ─────────────────────────────────────────────────────
function VersionHistoryModal({ clauseId, clauseName, onClose, onRestore }) {
  const [versions, setVersions] = useState(null);
  const [loading, setLoading]   = useState(true);

  useState(() => {
    getClauseVersions(clauseId)
      .then(setVersions)
      .catch(() => setVersions([]))
      .finally(() => setLoading(false));
  }, [clauseId]);

  const overlay = { position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" };
  const modal   = { background:B.white, borderRadius:12, padding:"2rem", maxWidth:600, width:"100%", maxHeight:"75vh", overflowY:"auto", margin:"0 1rem" };

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div style={{ fontSize:15, fontWeight:700 }}>Version History — {clauseName}</div>
          <button style={{ ...BG(B.g3), fontSize:20 }} onClick={onClose}>×</button>
        </div>
        {loading && <div style={{ color:B.g3, fontSize:13 }}>Loading versions…</div>}
        {!loading && versions?.length === 0 && (
          <div style={{ color:B.g3, fontSize:13, textAlign:"center", padding:"2rem" }}>No previous versions saved yet.<br/><span style={{ fontSize:11 }}>Versions are created automatically when you save a clause with changed content.</span></div>
        )}
        {versions?.map((v, i) => (
          <div key={v.id} style={{ ...CARD({ marginBottom:8, padding:"12px 14px" }) }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:B.g3 }}>Version {versions.length - i}</div>
                <div style={{ fontSize:11, color:B.g3 }}>Saved by {v.saved_by || "—"} · {formatDate(v.saved_at)}</div>
              </div>
              <button style={{ ...BS, padding:"4px 10px", fontSize:11 }} onClick={() => onRestore(v.content)}>Restore</button>
            </div>
            <div style={{ fontFamily:"'Courier New',monospace", fontSize:11, color:B.g3, background:B.g1, padding:"8px 10px", borderRadius:6, whiteSpace:"pre-wrap", maxHeight:80, overflow:"hidden" }}>
              {v.preview || v.content?.slice(0, 200)}…
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Delete Confirmation Modal ─────────────────────────────────────────────────
function DeleteConfirmModal({ clause, onConfirm, onClose }) {
  const [usedIn, setUsedIn] = useState(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    getClauseUsage(clause.id)
      .then(data => setUsedIn(data.templates || []))
      .catch(() => setUsedIn([]))
      .finally(() => setLoading(false));
  }, [clause.id]);

  const overlay = { position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" };
  const modal   = { background:B.white, borderRadius:12, padding:"2rem", maxWidth:460, width:"100%", margin:"0 1rem" };

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={{ fontSize:15, fontWeight:700, marginBottom:10 }}>Delete "{clause.name}"?</div>
        {loading ? (
          <div style={{ color:B.g3, fontSize:12, marginBottom:16 }}>Checking usage…</div>
        ) : usedIn?.length > 0 ? (
          <div style={{ padding:"12px 14px", background:"#FFF9E6", border:`1.5px solid ${B.yellow}`, borderRadius:8, marginBottom:16, fontSize:12 }}>
            <div style={{ fontWeight:700, color:"#7A5E00", marginBottom:6 }}>⚠ This clause is used in {usedIn.length} template{usedIn.length !== 1 ? "s" : ""}:</div>
            {usedIn.map(t => <div key={t.id} style={{ color:"#7A5E00" }}>· {t.name}</div>)}
            <div style={{ marginTop:8, color:"#7A5E00" }}>Deleting it will leave those sections empty.</div>
          </div>
        ) : (
          <div style={{ fontSize:12, color:B.g3, marginBottom:16 }}>This clause is not currently used in any templates.</div>
        )}
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button style={BS} onClick={onClose}>Cancel</button>
          <button style={{ ...BP, background:"#b91c1c" }} onClick={onConfirm}>Delete Clause</button>
        </div>
      </div>
    </div>
  );
}

// ── Main ClausesTab ───────────────────────────────────────────────────────────
export default function ClausesTab({ state, saveClause, removeClause }) {
  const { settings, clauses } = state;
  const [cf, setCf] = usePersistedFilter("hrsc_cl_cf");
  const [ef, setEf] = usePersistedFilter("hrsc_cl_ef");
  const [sel, setSel]     = useState(null);
  const [draft, setDraft] = useState(null);
  const [origDraft, setOrigDraft] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [search, setSearch]           = useState("");
  const [sf, setSf]                   = useState(false);
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showVersions, setShowVersions]       = useState(false);

  const filtered = clauses.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.tags.some(t => t.includes(search.toLowerCase()))) return false;
    if (c.global) return true;
    if (cf && !c.countries.includes(cf)) return false;
    if (ef && !c.entityIds.includes(ef)) return false;
    return true;
  });

  const missing = draft
    ? (draft.content.match(/\{\{(\w+)\}\}/g) || []).map(m => m.slice(2, -2)).filter(k => !draft.variables.some(v => v.key === k))
    : [];

  function startNew() {
    const d = { id:gid(), name:"New Clause", description:"", content:"", variables:[], tags:[], global:false, countries:[], entityIds:[] };
    setDraft(d); setOrigDraft(d); setIsNew(true); setSel(null);
  }
  function startEdit(c) {
    const d = JSON.parse(JSON.stringify(c));
    setDraft(d); setOrigDraft(d); setIsNew(false); setSel(c);
  }
  function cancelEdit() {
    if (!isNew && origDraft && JSON.stringify(draft) !== JSON.stringify(origDraft)) {
      if (!window.confirm("Discard unsaved changes?")) return;
    }
    setDraft(null); setSel(null);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const toSave = { ...draft, _savedBy: localStorage.getItem("hrsc_user_name") || "Unknown" };
      await saveClause(toSave, isNew);
      setSel(draft); setIsNew(false); setDraft(null); setToast("Clause saved");
    } finally { setSaving(false); }
  }

  async function confirmDelete() {
    if (!draft) return;
    await removeClause(draft.id, draft.name);
    setSel(null); setDraft(null); setShowDeleteModal(false);
  }

  function restoreVersion(content) {
    setDraft(d => ({ ...d, content }));
    setShowVersions(false);
  }

  return (
    <>
      {showDeleteModal && draft && (
        <DeleteConfirmModal
          clause={draft}
          onConfirm={confirmDelete}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
      {showVersions && (sel || draft) && (
        <VersionHistoryModal
          clauseId={(sel || draft).id}
          clauseName={(sel || draft).name}
          onClose={() => setShowVersions(false)}
          onRestore={restoreVersion}
        />
      )}

      <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap:20, alignItems:"start" }}>
        <div>
          <FilterBar countries={ALL_COUNTRIES} entities={settings.entities} countryFilter={cf} setCountryFilter={setCf} entityFilter={ef} setEntityFilter={setEf}/>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:B.g3 }}>{filtered.length} Clauses</span>
            <button style={{ ...BP, padding:"6px 12px", fontSize:11 }} onClick={startNew}>+ New</button>
          </div>
          <input style={{ ...mkInp(sf), marginBottom:10 }} placeholder="Search clauses…" value={search} onChange={e => setSearch(e.target.value)} onFocus={() => setSf(true)} onBlur={() => setSf(false)}/>
          {filtered.map(c => {
            const a = sel?.id === c.id || draft?.id === c.id;
            return (
              <div key={c.id} onClick={() => !draft && startEdit(c)} style={{ padding:"10px 12px", cursor:"pointer", borderLeft:`3px solid ${a ? B.red : "transparent"}`, background:a ? B.g1 : B.white, marginBottom:2, borderRadius:"0 6px 6px 0" }}>
                <div style={{ fontSize:12, fontWeight:700, marginBottom:4, lineHeight:1.3 }}>{c.name}</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                  {c.global && <span style={TAG(B.g1, B.teal)}>Global</span>}
                  {c.tags.map(t => <span key={t} style={TAG()}>{t}</span>)}
                </div>
              </div>
            );
          })}
        </div>

        <div>
          {!draft && !sel && <div style={{ ...CARD({ textAlign:"center", padding:"3rem", color:B.g3 }) }}>Select a clause to view or edit, or create a new one.</div>}

          {draft && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div style={CARD()}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:B.g3, marginBottom:12 }}>Clause Details</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                  <FI label="Clause Name" value={draft.name} onChange={e => setDraft({ ...draft, name:e.target.value })}/>
                  <FI label="Tags (comma-separated)" value={draft.tags.join(", ")} onChange={e => setDraft({ ...draft, tags:e.target.value.split(",").map(t => t.trim()).filter(Boolean) })} placeholder="e.g. probation, senior"/>
                </div>
                <div style={{ marginBottom:12 }}><FI label="Description" value={draft.description} onChange={e => setDraft({ ...draft, description:e.target.value })} placeholder="When is this clause used?"/></div>

                {/* Scope */}
                <div style={{ padding:"12px", background:B.g1, borderRadius:8, marginBottom:12 }}>
                  <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginBottom:draft.global ? 0 : 12, fontSize:12, fontWeight:600 }}>
                    <input type="checkbox" checked={draft.global} onChange={e => setDraft({ ...draft, global:e.target.checked, countries:e.target.checked ? [] : draft.countries, entityIds:e.target.checked ? [] : draft.entityIds })} style={{ accentColor:B.red, width:14, height:14 }}/>
                    Global clause (available to all countries and entities)
                  </label>
                  {!draft.global && (
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                      <div>
                        <label style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:B.g3, display:"block", marginBottom:5 }}>Countries (hold Ctrl)</label>
                        <select multiple style={{ ...mkInp(false), height:100, padding:"6px" }} value={draft.countries} onChange={e => setDraft({ ...draft, countries:[...e.target.selectedOptions].map(o => o.value) })}>
                          {ALL_COUNTRIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:B.g3, display:"block", marginBottom:5 }}>Legal Entities</label>
                        <select multiple style={{ ...mkInp(false), height:100, padding:"6px" }} value={draft.entityIds} onChange={e => setDraft({ ...draft, entityIds:[...e.target.selectedOptions].map(o => o.value) })}>
                          {settings.entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <RichTextEditor key={draft.id} label="Clause Content" value={draft.content} onChange={e => setDraft({ ...draft, content:e.target.value })} variables={draft.variables}/>
                {missing.length > 0 && <div style={{ marginTop:8, padding:"9px 12px", background:"#FFF9E6", border:`1.5px solid ${B.yellow}`, borderRadius:6, fontSize:11, color:"#7A5E00", fontWeight:500 }}>⚠ Undeclared variables: {missing.join(", ")} — add them below.</div>}
              </div>

              <div style={CARD()}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:B.g3 }}>Variables</div>
                  <button style={{ ...BS, padding:"5px 12px", fontSize:11 }} onClick={() => setDraft({ ...draft, variables:[...draft.variables, { key:"new_var", label:"New variable", type:"text" }] })}>+ Add</button>
                </div>
                {draft.variables.length === 0 && <div style={{ color:B.g3, fontSize:12 }}>Use {"{{key}}"} in content above, then declare variables here.</div>}
                {draft.variables.map((v, idx) => (
                  <div key={idx} style={{ background:B.g1, borderRadius:8, padding:"10px 12px", marginBottom:8 }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 140px auto", gap:10, alignItems:"end", marginBottom:v.type === "computed" ? 10 : 0 }}>
                      <FI label="Key"   value={v.key}   onChange={e => setDraft({ ...draft, variables:draft.variables.map((x, i) => i === idx ? { ...x, key:e.target.value.replace(/\s/g, "_").toLowerCase() } : x) })} placeholder="var_key"/>
                      <FI label="Label" value={v.label} onChange={e => setDraft({ ...draft, variables:draft.variables.map((x, i) => i === idx ? { ...x, label:e.target.value } : x) })}/>
                      <FS label="Type" value={v.type} onChange={e => setDraft({ ...draft, variables:draft.variables.map((x, i) => i === idx ? { ...x, type:e.target.value, defaultValue:e.target.value === "computed" ? (x.defaultValue || "") : "" } : x) })}>
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="computed">Computed (rule-driven)</option>
                      </FS>
                      <button onClick={() => setDraft({ ...draft, variables:draft.variables.filter((_, i) => i !== idx) })} style={{ ...BG(B.red), fontSize:18, marginBottom:2 }}>×</button>
                    </div>
                    {v.type === "computed" && (
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:2 }}>
                        <FI label="Default value (if no rule matches)" value={v.defaultValue || ""} onChange={e => setDraft({ ...draft, variables:draft.variables.map((x, i) => i === idx ? { ...x, defaultValue:e.target.value } : x) })} placeholder="e.g. 0"/>
                        <div style={{ display:"flex", alignItems:"flex-end", paddingBottom:2 }}>
                          <span style={{ fontSize:11, color:B.teal, fontWeight:600 }}>✦ Value set automatically by Rules Engine</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
                {!isNew && <button style={BG(B.g3)} onClick={() => setShowVersions(true)}>⏱ History</button>}
                {!isNew && <button style={BG(B.red)} onClick={() => setShowDeleteModal(true)}>Delete Clause</button>}
                <button style={BS} onClick={cancelEdit}>Cancel</button>
                <button style={{ ...BP, opacity:saving ? 0.6 : 1 }} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Clause"}</button>
              </div>
            </div>
          )}

          {sel && !draft && (
            <div style={CARD()}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>{sel.name}</div>
                  <div style={{ fontSize:12, color:B.g3, marginBottom:8 }}>{sel.description}</div>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    {sel.global && <span style={TAG(B.g1, B.teal)}>Global</span>}
                    {!sel.global && sel.countries.map(c => <span key={c} style={TAG()}>{c}</span>)}
                    {sel.tags.map(t => <span key={t} style={TAG()}>{t}</span>)}
                  </div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button style={{ ...BS, padding:"6px 12px", fontSize:11 }} onClick={() => setShowVersions(true)}>⏱ History</button>
                  <button style={BP} onClick={() => startEdit(sel)}>Edit Clause</button>
                </div>
              </div>
              <div style={{ fontSize:13, lineHeight:1.8, background:B.g1, padding:"1rem", borderRadius:8, borderLeft:`3px solid ${B.red}`, marginBottom:12 }}>
                {renderClauseContentRich(sel.content)}
              </div>
              {sel.variables.map(v => (
                <div key={v.key} style={{ display:"flex", gap:10, fontSize:12, padding:"6px 0", borderBottom:`1px solid ${B.g1}`, alignItems:"center" }}>
                  <code style={{ fontFamily:"'Courier New',monospace", color:B.red, background:B.g1, padding:"1px 7px", borderRadius:4, fontSize:11 }}>{`{{${v.key}}}`}</code>
                  <span style={{ flex:1 }}>{v.label}</span>
                  <span style={TAG()}>{v.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {toast && <Toast message={toast} onDone={() => setToast(null)}/>}
    </>
  );
}
