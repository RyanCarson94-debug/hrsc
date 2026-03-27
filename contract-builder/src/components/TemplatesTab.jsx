import { useState } from "react";
import { B, CARD, BP, BS, BG, TAG, FI, FS, FilterBar, clauseAvailable, templateMatches } from "./shared";
import { ALL_COUNTRIES } from "../defaults";

function gid() { return Math.random().toString(36).slice(2,8); }

export default function TemplatesTab({ state, saveTemplate, removeTemplate }) {
  const { settings, clauses, templates } = state;
  const [cf, setCf] = useState(""), [ef, setEf] = useState("");
  const [sel, setSel]   = useState(null);
  const [draft, setDraft] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const filtered = templates.filter(t => templateMatches(t, cf, ef));
  const availClauses = draft ? clauses.filter(c => clauseAvailable(c, draft.country, draft.entityId)) : [];

  function startNew() { setDraft({id:gid(),name:"New Template",country:"United Kingdom",entityId:settings.entities[0]?.id||"",documentType:"contract",description:"",numberingFormat:"hierarchical",sections:[]}); setIsNew(true); setSel(null); }
  function startEdit(t) { setDraft(JSON.parse(JSON.stringify(t))); setIsNew(false); setSel(t); }
  async function save() {
    if (!draft) return;
    setSaving(true);
    try { await saveTemplate(draft, isNew); setSel(draft); setIsNew(false); setDraft(null); }
    finally { setSaving(false); }
  }
  async function del(id) {
    await removeTemplate(id); setSel(null); setDraft(null);
  }
  function addSec() { if (!draft) return; setDraft({...draft, sections:[...draft.sections,{id:gid(),name:"New Section",clauseId:null,level:1,content:"",required:true,ruleSlot:false}]}); }
  function updSec(idx, patch) { if (!draft) return; setDraft({...draft, sections:draft.sections.map((s,i)=>i===idx?{...s,...patch}:s)}); }

  return (
    <div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:20,alignItems:"start"}}>
      <div>
        <FilterBar countries={ALL_COUNTRIES} entities={settings.entities} countryFilter={cf} setCountryFilter={setCf} entityFilter={ef} setEntityFilter={setEf}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <span style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:B.g3}}>{filtered.length} Templates</span>
          <button style={{...BP,padding:"6px 12px",fontSize:11}} onClick={startNew}>+ New</button>
        </div>
        {filtered.map(t => {
          const a = sel?.id===t.id || draft?.id===t.id;
          const ent = settings.entities.find(e=>e.id===t.entityId);
          return (
            <div key={t.id} onClick={()=>!draft&&startEdit(t)} style={{padding:"10px 12px",cursor:"pointer",borderLeft:`3px solid ${a?B.red:"transparent"}`,background:a?B.g1:B.white,marginBottom:2,borderRadius:"0 6px 6px 0",transition:"all 0.15s"}}>
              <div style={{fontSize:12,fontWeight:700,marginBottom:3}}>{t.name}</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                <span style={TAG()}>{t.country==="__global__"?"Global":t.country}</span>
                {ent && <span style={TAG(B.g1,"#0E56A5")}>{ent.shortCode}</span>}
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
                <FI label="Description" value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})} placeholder="Brief description…"/>
              </div>
            </div>

            <div style={CARD()}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:B.g3}}>Sections ({draft.sections.length})</div>
                <button style={{...BS,padding:"6px 12px",fontSize:11}} onClick={addSec}>+ Add Section</button>
              </div>
              {draft.sections.length===0 && <div style={{textAlign:"center",padding:"1.5rem",color:B.g3,fontSize:12}}>No sections yet.</div>}
              {draft.sections.map((s,idx) => (
                <div key={s.id} style={{background:B.g1,borderRadius:8,padding:"12px",marginBottom:10}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 80px auto",gap:10,alignItems:"end",marginBottom:10}}>
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
                  <div style={{display:"flex",gap:16,marginTop:8}}>
                    <label style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:B.g3,cursor:"pointer",fontWeight:500}}><input type="checkbox" checked={s.required} onChange={e=>updSec(idx,{required:e.target.checked})} style={{accentColor:B.red}}/>Required</label>
                    <label style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:B.g3,cursor:"pointer",fontWeight:500}}><input type="checkbox" checked={s.ruleSlot} onChange={e=>updSec(idx,{ruleSlot:e.target.checked})} style={{accentColor:B.red}}/>Rules engine can override</label>
                  </div>
                </div>
              ))}
            </div>

            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              {!isNew && <button style={BG(B.red)} onClick={()=>del(draft.id)}>Delete Template</button>}
              <button style={BS} onClick={()=>{setDraft(null);setSel(null);}}>Cancel</button>
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
                </div>
                <div style={{fontSize:12,color:B.g3}}>{sel.description}</div>
              </div>
              <button style={BP} onClick={()=>startEdit(sel)}>Edit Template</button>
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
  );
}
