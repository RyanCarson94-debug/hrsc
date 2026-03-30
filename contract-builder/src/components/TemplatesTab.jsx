import { useState } from "react";
import { B, CARD, BP, BS, BG, TAG, FI, FS, FilterBar, clauseAvailable, templateMatches, mkInp, Toast, usePersistedFilter, compressImage, RichTextEditor } from "./shared";
import { ALL_COUNTRIES } from "../defaults";

function gid() { return Math.random().toString(36).slice(2,8); }

export default function TemplatesTab({ state, saveTemplate, duplicateTemplate, removeTemplate }) {
  const { settings, clauses, templates } = state;
  const [cf, setCf] = usePersistedFilter("hrsc_tm_cf");
  const [ef, setEf] = usePersistedFilter("hrsc_tm_ef");
  const [sel, setSel]   = useState(null);
  const [draft, setDraft] = useState(null);
  const [origDraft, setOrigDraft] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [search, setSearch] = useState("");
  const [sf, setSf] = useState(false);
  const [toast, setToast] = useState(null);

  const filtered = templates.filter(t => templateMatches(t, cf, ef) && (!search || t.name.toLowerCase().includes(search.toLowerCase())));
  const availClauses = draft ? clauses.filter(c => clauseAvailable(c, draft.country, draft.entityId)) : [];

  const STATUS_COLOURS = { live:{ bg:"#DCFCE7", tc:"#166534" }, draft:{ bg:"#FFF9E6", tc:"#7A5E00" }, archived:{ bg:"#F3F4F6", tc:"#6B7280" } };

  function startNew() { const d = {id:gid(),name:"New Template",country:"United Kingdom",entityId:settings.entities[0]?.id||"",documentType:"contract",description:"",numberingFormat:"hierarchical",status:"live",filenamePattern:"",sections:[]}; setDraft(d); setOrigDraft(d); setIsNew(true); setSel(null); }
  function startEdit(t) { const d = JSON.parse(JSON.stringify(t)); setDraft(d); setOrigDraft(d); setIsNew(false); setSel(t); }
  function cancelEdit() {
    if (!isNew && origDraft && JSON.stringify(draft) !== JSON.stringify(origDraft)) {
      if (!window.confirm("Discard unsaved changes?")) return;
    }
    setDraft(null); setSel(null);
  }
  async function duplicate(t) {
    const copy = await duplicateTemplate(t);
    setDraft(JSON.parse(JSON.stringify(copy)));
    setIsNew(false);
    setSel(copy);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try { await saveTemplate(draft, isNew); setSel(draft); setIsNew(false); setDraft(null); setToast("Template saved"); }
    finally { setSaving(false); }
  }
  async function del(id, name) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await removeTemplate(id); setSel(null); setDraft(null);
  }

  function onDragStart(e, idx) { setDragIdx(idx); e.dataTransfer.effectAllowed = "move"; }
  function onDragOver(e, idx)  { e.preventDefault(); setDragOverIdx(idx); }
  function onDragEnd()          { setDragIdx(null); setDragOverIdx(null); }
  function onDrop(e, idx) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) { onDragEnd(); return; }
    const secs = [...draft.sections];
    const [moved] = secs.splice(dragIdx, 1);
    secs.splice(idx, 0, moved);
    setDraft({ ...draft, sections: secs });
    onDragEnd();
  }
  function addSec() { if (!draft) return; setDraft({...draft, sections:[...draft.sections,{id:gid(),name:"New Section",clauseId:null,level:1,content:"",required:true,ruleSlot:false,showHeading:true}]}); }
  function updSec(idx, patch) { if (!draft) return; setDraft({...draft, sections:draft.sections.map((s,i)=>i===idx?{...s,...patch}:s)}); }

  // Schedule helpers
  function addSchedRow() {
    const sched = draft.schedule || { enabled: true, title: "Schedule", rows: [] };
    setDraft({ ...draft, schedule: { ...sched, rows: [...sched.rows, { id: gid(), label: "", content: "" }] } });
  }
  function updSchedRow(idx, patch) {
    const sched = draft.schedule;
    setDraft({ ...draft, schedule: { ...sched, rows: sched.rows.map((r,i) => i===idx ? { ...r, ...patch } : r) } });
  }
  function delSchedRow(idx) {
    const sched = draft.schedule;
    setDraft({ ...draft, schedule: { ...sched, rows: sched.rows.filter((_,i) => i!==idx) } });
  }

  return (
    <>
    <div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:20,alignItems:"start"}}>
      <div>
        <FilterBar countries={ALL_COUNTRIES} entities={settings.entities} countryFilter={cf} setCountryFilter={setCf} entityFilter={ef} setEntityFilter={setEf}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <span style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:B.g3}}>{filtered.length} Templates</span>
          <button style={{...BP,padding:"6px 12px",fontSize:11}} onClick={startNew}>+ New</button>
        </div>
        <input style={{...mkInp(sf),marginBottom:10}} placeholder="Search templates…" value={search} onChange={e=>setSearch(e.target.value)} onFocus={()=>setSf(true)} onBlur={()=>setSf(false)}/>
        {filtered.map(t => {
          const a = sel?.id===t.id || draft?.id===t.id;
          const ent = settings.entities.find(e=>e.id===t.entityId);
          return (
            <div key={t.id} onClick={()=>!draft&&startEdit(t)} style={{padding:"10px 12px",cursor:"pointer",borderLeft:`3px solid ${a?B.red:"transparent"}`,background:a?B.g1:B.white,marginBottom:2,borderRadius:"0 6px 6px 0",transition:"all 0.15s"}}>
              <div style={{fontSize:12,fontWeight:700,marginBottom:3}}>{t.name}</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                <span style={TAG()}>{t.country==="__global__"?"Global":t.country}</span>
                {ent && <span style={TAG(B.g1,"#0E56A5")}>{ent.shortCode}</span>}
                {t.status && t.status !== "live" && <span style={TAG(STATUS_COLOURS[t.status]?.bg, STATUS_COLOURS[t.status]?.tc)}>{t.status}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div>
        {!draft && !sel && <div style={{...CARD({textAlign:"center",padding:"3rem",color:B.g3})}}>Select a template to view or edit, or create a new one.</div>}

        {draft && (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={CARD()}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:B.g3,marginBottom:12}}>Template Details</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
                <FI label="Template Name" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/>
                <FS label="Country" value={draft.country} onChange={e=>setDraft({...draft,country:e.target.value})}>
                  <option value="__global__">Global (all countries)</option>
                  {ALL_COUNTRIES.map(c=><option key={c}>{c}</option>)}
                </FS>
                <FS label="Legal Entity" value={draft.entityId} onChange={e=>setDraft({...draft,entityId:e.target.value})}>
                  <option value="__global__">Global (all entities)</option>
                  {settings.entities.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
                </FS>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
                <FS label="Document Type" value={draft.documentType} onChange={e=>setDraft({...draft,documentType:e.target.value})}>
                  <option value="contract">Employment Contract</option>
                  <option value="addendum">Addendum Letter</option>
                </FS>
                <FS label="Section Numbering" value={draft.numberingFormat} onChange={e=>setDraft({...draft,numberingFormat:e.target.value})}>
                  <option value="none">None</option>
                  <option value="flat">Flat — 1. 2. 3.</option>
                  <option value="hierarchical">Hierarchical — 1. 1.1 2. 2.1</option>
                </FS>
                <FS label="Status" value={draft.status||"live"} onChange={e=>setDraft({...draft,status:e.target.value})}>
                  <option value="live">Live — visible to advisers</option>
                  <option value="draft">Draft — admin only</option>
                  <option value="archived">Archived — hidden</option>
                </FS>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                <FI label="Description" value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})} placeholder="Brief description…"/>
                <div>
                  <FI label="Filename pattern (optional)" value={draft.filenamePattern||""} onChange={e=>setDraft({...draft,filenamePattern:e.target.value})} placeholder="{date}_{country}_{employee_last_name}"/>
                  <div style={{fontSize:10,color:B.g3,marginTop:3}}>Tokens: {"{date} {employee_name} {employee_last_name} {country} {template_name}"}</div>
                </div>
              </div>
              {/* Per-template header/footer override */}
              <div style={{padding:"10px 12px",background:B.g1,borderRadius:8}}>
                <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12,fontWeight:600,marginBottom:draft.useCustomHeaderFooter?10:0}}>
                  <input type="checkbox" checked={!!draft.useCustomHeaderFooter} onChange={e=>setDraft({...draft,useCustomHeaderFooter:e.target.checked,headerFooter:e.target.checked?(draft.headerFooter||{}):undefined})} style={{accentColor:B.red,width:14,height:14}}/>
                  Override entity header/footer for this template
                </label>
                {draft.useCustomHeaderFooter && (
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                      <FI label="Company line" value={draft.headerFooter?.companyLine||""} onChange={e=>setDraft({...draft,headerFooter:{...draft.headerFooter,companyLine:e.target.value}})} placeholder="CSL Behring Ltd"/>
                      <FI label="Address line 1" value={draft.headerFooter?.addressLine1||""} onChange={e=>setDraft({...draft,headerFooter:{...draft.headerFooter,addressLine1:e.target.value}})} placeholder="1 Innovation Drive"/>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                      <FI label="Address line 2" value={draft.headerFooter?.addressLine2||""} onChange={e=>setDraft({...draft,headerFooter:{...draft.headerFooter,addressLine2:e.target.value}})} placeholder="Liverpool, L1 1AA"/>
                      <FI label="Footer text" value={draft.headerFooter?.footerText||""} onChange={e=>setDraft({...draft,headerFooter:{...draft.headerFooter,footerText:e.target.value}})} placeholder="Registered company details…"/>
                    </div>
                    <div>
                      <label style={{fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:B.g3,display:"block",marginBottom:5}}>Logo image (PNG/JPG, max 300kb)</label>
                      {draft.headerFooter?.logoBase64 && (
                        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                          <img src={draft.headerFooter.logoBase64} alt="Logo" style={{maxHeight:40,maxWidth:120,objectFit:"contain",border:`1px solid ${B.g2}`,borderRadius:4,padding:3}}/>
                          <button style={{...BG(B.red)}} onClick={()=>setDraft({...draft,headerFooter:{...draft.headerFooter,logoBase64:null}})}>Remove</button>
                        </div>
                      )}
                      <input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={async e=>{
                        const file=e.target.files[0];
                        if(!file)return;
                        const dataUrl = await compressImage(file);
                        setDraft(d=>({...d,headerFooter:{...d.headerFooter,logoBase64:dataUrl}}));
                      }} style={{fontSize:12,color:B.black}}/>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={CARD()}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:B.g3}}>Sections ({draft.sections.length})</div>
                <button style={{...BS,padding:"6px 12px",fontSize:11}} onClick={addSec}>+ Add Section</button>
              </div>
              {draft.sections.length===0 && <div style={{textAlign:"center",padding:"1.5rem",color:B.g3,fontSize:12}}>No sections yet.</div>}
              {draft.sections.map((s,idx) => (
                <div key={s.id}
                  draggable
                  onDragStart={e=>onDragStart(e,idx)}
                  onDragOver={e=>onDragOver(e,idx)}
                  onDrop={e=>onDrop(e,idx)}
                  onDragEnd={onDragEnd}
                  style={{background:dragOverIdx===idx?B.g2:B.g1,borderRadius:8,padding:"12px",marginBottom:10,transition:"background 0.1s",opacity:dragIdx===idx?0.5:1}}
                >
                  <div style={{display:"grid",gridTemplateColumns:"20px 1fr 1fr 80px auto",gap:10,alignItems:"end",marginBottom:10}}>
                    <div style={{cursor:"grab",color:B.g3,fontSize:16,userSelect:"none",paddingBottom:6,textAlign:"center"}}>⠿</div>
                    <FI label="Section Name" value={s.name} onChange={e=>updSec(idx,{name:e.target.value})}/>
                    <FS label="Linked Clause" value={s.clauseId||""} onChange={e=>updSec(idx,{clauseId:e.target.value||null})}>
                      <option value="">— Free text —</option>
                      {availClauses.map(c=><option key={c.id} value={c.id}>{c.name}{c.global?" (Global)":""}</option>)}
                    </FS>
                    <FS label="Level" value={String(s.level||1)} onChange={e=>updSec(idx,{level:parseInt(e.target.value)})}>
                      <option value="1">Level 1</option>
                      <option value="2">Level 1.x</option>
                    </FS>
                    <button onClick={()=>setDraft({...draft,sections:draft.sections.filter((_,i)=>i!==idx)})} style={{...BG(B.red),fontSize:18,padding:"2px 8px",marginBottom:2}}>×</button>
                  </div>
                  {!s.clauseId && <FI label="Content — use {{variable}} for dynamic fields" value={s.content||""} onChange={e=>updSec(idx,{content:e.target.value})} as="textarea" placeholder="Section text…"/>}
                  <div style={{display:"flex",gap:16,marginTop:8,flexWrap:"wrap"}}>
                    <label style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:B.g3,cursor:"pointer",fontWeight:500}}><input type="checkbox" checked={s.required} onChange={e=>updSec(idx,{required:e.target.checked})} style={{accentColor:B.red}}/>Required</label>
                    <label style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:B.g3,cursor:"pointer",fontWeight:500}}><input type="checkbox" checked={!!s.optional} onChange={e=>updSec(idx,{optional:e.target.checked})} style={{accentColor:B.red}}/>Optional (adviser can include/exclude)</label>
                    <label style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:B.g3,cursor:"pointer",fontWeight:500}}><input type="checkbox" checked={s.ruleSlot} onChange={e=>updSec(idx,{ruleSlot:e.target.checked})} style={{accentColor:B.red}}/>Rules engine can override</label>
                    <label style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:B.g3,cursor:"pointer",fontWeight:500}}><input type="checkbox" checked={s.showHeading !== false} onChange={e=>updSec(idx,{showHeading:e.target.checked})} style={{accentColor:B.red}}/>Show heading in document</label>
                  </div>
                </div>
              ))}
              <div style={{textAlign:"center",marginTop:8}}>
                <button style={{...BS,padding:"7px 20px",fontSize:11}} onClick={addSec}>+ Add Section</button>
              </div>
            </div>

            {/* ── Schedule ──────────────────────────────────────────────────── */}
            <div style={CARD()}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:draft.schedule?.enabled?12:0}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:B.g3}}>Schedule (optional — appended as a table)</div>
                  {draft.schedule?.enabled && <div style={{fontSize:11,color:B.g3,marginTop:3}}>Two-column table with letter labels (a)(b)(c) on the left and rich content on the right.</div>}
                </div>
                <label style={{display:"flex",alignItems:"center",gap:7,fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0}}>
                  <input type="checkbox" checked={!!draft.schedule?.enabled} onChange={e => setDraft({...draft, schedule: { title:"Schedule", rows:[], ...(draft.schedule||{}), enabled:e.target.checked }})} style={{accentColor:B.red,width:14,height:14}}/>
                  Include in document
                </label>
              </div>
              {draft.schedule?.enabled && (
                <>
                  <FI label="Schedule heading" value={draft.schedule.title||"Schedule"} onChange={e=>setDraft({...draft,schedule:{...draft.schedule,title:e.target.value}})} style={{marginBottom:12}}/>
                  {(draft.schedule.rows||[]).map((row,idx) => (
                    <div key={row.id} style={{background:B.g1,borderRadius:8,padding:"12px",marginBottom:10}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                        <span style={{...TAG(),fontWeight:700,minWidth:26,textAlign:"center"}}>({String.fromCharCode(97+idx)})</span>
                        <div style={{flex:1}}><FI label="Left column label" value={row.label} onChange={e=>updSchedRow(idx,{label:e.target.value})} placeholder="e.g. Employee:"/></div>
                        <button style={{...BG(B.red),fontSize:18,padding:"2px 8px",alignSelf:"flex-end",marginBottom:2}} onClick={()=>delSchedRow(idx)}>×</button>
                      </div>
                      <RichTextEditor label="Right column content" value={row.content} onChange={e=>updSchedRow(idx,{content:e.target.value})} variables={draft.sections.flatMap(s=>s.variables||[])}/>
                    </div>
                  ))}
                  <div style={{textAlign:"center",marginTop:8}}>
                    <button style={{...BS,padding:"7px 20px",fontSize:11}} onClick={addSchedRow}>+ Add Row</button>
                  </div>
                </>
              )}
            </div>

            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              {!isNew && <button style={BG(B.red)} onClick={()=>del(draft.id, draft.name)}>Delete Template</button>}
              <button style={BS} onClick={cancelEdit}>Cancel</button>
              <button style={{...BP,opacity:saving?0.6:1}} onClick={save} disabled={saving}>{saving?"Saving…":"Save Template"}</button>
            </div>
          </div>
        )}

        {sel && !draft && (
          <div style={CARD()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
              <div>
                <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>{sel.name}</div>
                <div style={{display:"flex",gap:6,marginBottom:6}}>
                  <span style={TAG()}>{sel.country==="__global__"?"Global":sel.country}</span>
                  {settings.entities.find(e=>e.id===sel.entityId) && <span style={TAG(B.g1,"#0E56A5")}>{settings.entities.find(e=>e.id===sel.entityId)?.shortCode}</span>}
                  <span style={TAG()}>{sel.documentType}</span>
                  <span style={TAG()}>{sel.numberingFormat} numbering</span>
                  {sel.status && <span style={TAG(STATUS_COLOURS[sel.status]?.bg, STATUS_COLOURS[sel.status]?.tc)}>{sel.status}</span>}
                </div>
                <div style={{fontSize:12,color:B.g3}}>{sel.description}</div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button style={BS} onClick={()=>duplicate(sel)}>Duplicate</button>
                <button style={BP} onClick={()=>startEdit(sel)}>Edit Template</button>
              </div>
            </div>
            <div style={{borderTop:`1.5px solid ${B.g2}`,paddingTop:14}}>
              {sel.sections.map((s,i) => (
                <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${B.g1}`}}>
                  <span style={{width:20,height:20,borderRadius:"50%",background:B.g2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:B.g3,flexShrink:0,marginLeft:s.level===2?16:0}}>{i+1}</span>
                  <span style={{fontSize:12,fontWeight:600,flex:1}}>{s.name}</span>
                  {s.clauseId && <span style={TAG()}>{clauses.find(c=>c.id===s.clauseId)?.name}</span>}
                  {s.ruleSlot && <span style={TAG("#FFF9E6","#7A5E00")}>Rule override</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    {toast && <Toast message={toast} onDone={() => setToast(null)}/>}
    </>
  );
}