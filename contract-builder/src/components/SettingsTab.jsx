import { useState } from "react";
import { B, CARD, BP, BS, BG, TAG, FI, mkInp } from "./shared";
import { ALL_COUNTRIES } from "../defaults";

function gid() { return Math.random().toString(36).slice(2,8); }

export default function SettingsTab({ state, saveSettings }) {
  const { settings } = state;
  const [tab, setTab]       = useState("entities");
  const [entDraft, setEntDraft] = useState(null);
  const [entNew, setEntNew]     = useState(false);
  const [saving, setSaving]     = useState(false);

  async function updateSettings(patch) {
    const next = { ...settings, ...patch };
    setSaving(true);
    try { await saveSettings(next); }
    finally { setSaving(false); }
  }

  // ── Entities ────────────────────────────────────────────────────────────────
  function startNewEnt() { setEntDraft({ id:gid(), name:"", countries:[], shortCode:"" }); setEntNew(true); }
  async function saveEnt() {
    if (!entDraft) return;
    const entities = entNew
      ? [...settings.entities, entDraft]
      : settings.entities.map(e => e.id===entDraft.id ? entDraft : e);
    await updateSettings({ entities });
    setEntDraft(null);
  }
  async function delEnt(id) {
    await updateSettings({ entities: settings.entities.filter(e => e.id!==id) });
  }

  // ── Dropdown list editor ────────────────────────────────────────────────────
  function DropList({ listKey, label }) {
    const items = settings.dropdowns[listKey] || [];
    const [editIdx, setEditIdx] = useState(null);
    const [newLabel, setNewLabel] = useState("");

    async function addItem() {
      if (!newLabel.trim()) return;
      const newItems = [...items, { id:gid(), label:newLabel.trim(), global:true, entityIds:[] }];
      await updateSettings({ dropdowns:{ ...settings.dropdowns, [listKey]:newItems } });
      setNewLabel("");
    }
    async function delItem(id) {
      await updateSettings({ dropdowns:{ ...settings.dropdowns, [listKey]:items.filter(i=>i.id!==id) } });
    }
    async function toggleGlobal(id) {
      await updateSettings({ dropdowns:{ ...settings.dropdowns, [listKey]:items.map(i=>i.id===id?{...i,global:!i.global}:i) } });
    }
    async function toggleEntity(id, eid) {
      await updateSettings({ dropdowns:{ ...settings.dropdowns, [listKey]:items.map(i=>i.id===id?{...i,entityIds:i.entityIds.includes(eid)?i.entityIds.filter(e=>e!==eid):[...i.entityIds,eid]}:i) } });
    }

    return (
      <div style={CARD({ marginBottom:14 })}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:B.g3, marginBottom:12 }}>{label}</div>
        {items.map((item, idx) => (
          <div key={item.id} style={{ padding:"8px 0", borderBottom:`1px solid ${B.g1}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:editIdx===idx?8:0 }}>
              <span style={{ flex:1, fontSize:12, fontWeight:600 }}>{item.label}</span>
              <span style={item.global ? TAG(B.g1,B.teal) : TAG()}>{item.global ? "Global" : "Entity-specific"}</span>
              <button style={{...BS, padding:"3px 10px", fontSize:11}} onClick={()=>setEditIdx(editIdx===idx?null:idx)}>Configure</button>
              <button style={BG(B.red)} onClick={()=>delItem(item.id)}>×</button>
            </div>
            {editIdx===idx && (
              <div style={{ marginTop:8, padding:"10px", background:B.g1, borderRadius:6 }}>
                <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:11, fontWeight:600, marginBottom:8 }}>
                  <input type="checkbox" checked={item.global} onChange={()=>toggleGlobal(item.id)} style={{ accentColor:B.red }}/> Available to all entities (global)
                </label>
                {!item.global && (
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color:B.g3, marginBottom:6 }}>Available to these entities:</div>
                    {settings.entities.map(e => (
                      <label key={e.id} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:11, fontWeight:500, marginBottom:4 }}>
                        <input type="checkbox" checked={item.entityIds.includes(e.id)} onChange={()=>toggleEntity(item.id, e.id)} style={{ accentColor:B.red }}/>{e.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <div style={{ display:"flex", gap:8, marginTop:12 }}>
          <input
            style={{ ...mkInp(false), flex:1 }}
            value={newLabel}
            onChange={e=>setNewLabel(e.target.value)}
            placeholder={`Add new ${label.toLowerCase()} value…`}
            onKeyDown={e=>e.key==="Enter"&&addItem()}
          />
          <button style={BP} onClick={addItem}>Add</button>
        </div>
      </div>
    );
  }

  const STABS = [
    { id:"entities",         label:"Legal Entities" },
    { id:"business_units",   label:"Business Units" },
    { id:"employment_types", label:"Employment Types" },
    { id:"manager_levels",   label:"Manager Levels" },
  ];

  return (
    <div>
      {saving && (
        <div style={{ marginBottom:12, padding:"8px 14px", background:B.g1, borderRadius:6, fontSize:12, color:B.g3 }}>
          Saving…
        </div>
      )}

      {/* Sub-tabs */}
      <div style={{ display:"flex", gap:2, marginBottom:20, borderBottom:`1.5px solid ${B.g2}` }}>
        {STABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:"8px 16px", background:"transparent", border:"none", borderBottom:`2px solid ${tab===t.id?B.red:"transparent"}`, cursor:"pointer", fontSize:12, fontWeight:tab===t.id?700:500, color:tab===t.id?B.black:B.g3, fontFamily:"'Montserrat',sans-serif", marginBottom:-2 }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab==="entities" && (
        <div style={{ maxWidth:700 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ fontSize:12, color:B.g3 }}>Legal entities assigned to templates, clauses, and rules.</div>
            <button style={BP} onClick={startNewEnt}>+ New Entity</button>
          </div>

          {entDraft && (
            <div style={{ ...CARD({ marginBottom:14, borderLeft:`4px solid ${B.red}`, borderRadius:"0 10px 10px 0" }) }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 120px", gap:12, marginBottom:12 }}>
                <FI label="Entity Name" value={entDraft.name} onChange={e=>setEntDraft({...entDraft,name:e.target.value})} placeholder="e.g. CSL Behring Ltd"/>
                <div>
                  <label style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:B.g3, display:"block", marginBottom:5 }}>Countries (hold Ctrl)</label>
                  <select multiple style={{ ...mkInp(false), height:90, padding:"4px" }} value={entDraft.countries} onChange={e=>setEntDraft({...entDraft,countries:[...e.target.selectedOptions].map(o=>o.value)})}>
                    {ALL_COUNTRIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <FI label="Short Code" value={entDraft.shortCode} onChange={e=>setEntDraft({...entDraft,shortCode:e.target.value})} placeholder="CSL-B"/>
              </div>
              <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
                <button style={BS} onClick={()=>setEntDraft(null)}>Cancel</button>
                <button style={BP} onClick={saveEnt}>Save Entity</button>
              </div>
            </div>
          )}

          {settings.entities.map(e => (
            <div key={e.id} style={{ ...CARD({ marginBottom:8, display:"flex", alignItems:"center", gap:14 }) }}>
              <div style={{ width:44, height:44, borderRadius:8, background:B.g1, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:B.black, flexShrink:0 }}>{e.shortCode}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:3 }}>{e.name}</div>
                <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>{e.countries.map(c => <span key={c} style={TAG()}>{c}</span>)}</div>
              </div>
              <button style={{ ...BS, padding:"5px 12px", fontSize:11 }} onClick={()=>{ setEntDraft(JSON.parse(JSON.stringify(e))); setEntNew(false); }}>Edit</button>
              <button style={BG(B.red)} onClick={()=>delEnt(e.id)}>×</button>
            </div>
          ))}
        </div>
      )}

      {tab==="business_units"   && <div style={{ maxWidth:700 }}><DropList listKey="businessUnits"   label="Business Units"/></div>}
      {tab==="employment_types" && <div style={{ maxWidth:700 }}><DropList listKey="employmentTypes" label="Employment Types"/></div>}
      {tab==="manager_levels"   && <div style={{ maxWidth:700 }}><DropList listKey="managerLevels"   label="Manager Levels"/></div>}
    </div>
  );
}
