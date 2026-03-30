import { useState } from "react";
import { B, CARD, BP, BS, BG, TAG, FI, mkInp, Toast, compressImage } from "./shared";
import { ALL_COUNTRIES } from "../defaults";

function gid() { return Math.random().toString(36).slice(2,8); }

export default function SettingsTab({ state, saveSettings, users = [], saveUser, removeUser, userName = "" }) {
  const { settings } = state;
  const [tab, setTab]           = useState("entities");
  const [entDraft, setEntDraft] = useState(null);
  const [entNew, setEntNew]     = useState(false);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast] = useState(null);

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
    setToast("Entity saved");
  }
  async function delEnt(id, name) {
    if (!window.confirm(`Delete entity "${name}"? This cannot be undone.`)) return;
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
    async function delItem(id, label) {
      if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
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
              <button style={BG(B.red)} onClick={()=>delItem(item.id, item.label)}>×</button>
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
    { id:"headers_footers",  label:"Headers & Footers" },
    { id:"users",            label:"User Management" },
  ];

  return (
    <>
    <div>
      {/* User identity card */}
      <div style={{ ...CARD({ marginBottom:20, display:"flex", alignItems:"center", gap:16, borderLeft:`4px solid ${B.red}`, borderRadius:"0 10px 10px 0" }) }}>
        <div style={{ width:40, height:40, borderRadius:"50%", background:B.red, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:B.white, flexShrink:0 }}>
          {userName ? userName.split("@")[0].split(/[._-]/).map(w=>w[0]?.toUpperCase()||"").slice(0,2).join("") : "?"}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:B.g3, marginBottom:4 }}>Signed in via Cloudflare Access</div>
          <div style={{ fontSize:14, fontWeight:700, color:B.black }}>{userName || "Not authenticated"}</div>
          <div style={{ fontSize:11, color:B.g3, marginTop:3 }}>Your identity is automatically applied to all audit log entries.</div>
        </div>
      </div>

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
              <button style={BG(B.red)} onClick={()=>delEnt(e.id, e.name)}>×</button>
            </div>
          ))}
        </div>
      )}

      {tab==="business_units"   && <div style={{ maxWidth:700 }}><DropList listKey="businessUnits"   label="Business Units"/></div>}
      {tab==="employment_types" && <div style={{ maxWidth:700 }}><DropList listKey="employmentTypes" label="Employment Types"/></div>}
      {tab==="manager_levels"   && <div style={{ maxWidth:700 }}><DropList listKey="managerLevels"   label="Manager Levels"/></div>}
      {tab==="headers_footers"  && <HeaderFooterSettings settings={settings} updateSettings={updateSettings}/>}
      {tab==="users"            && <UserManagement users={users} saveUser={saveUser} removeUser={removeUser}/>}
    </div>
    {toast && <Toast message={toast} onDone={() => setToast(null)}/>}
    </>
  );
}

// ── User Management sub-tab ───────────────────────────────────────────────────
function UserManagement({ users, saveUser, removeUser }) {
  const [draft, setDraft]   = useState(null);
  const [isNew, setIsNew]   = useState(false);
  const [saving, setSaving] = useState(false);

  function startNew() {
    setDraft({ id: Math.random().toString(36).slice(2, 10), name:"", email:"", role:"Adviser" });
    setIsNew(true);
  }
  function startEdit(u) { setDraft(JSON.parse(JSON.stringify(u))); setIsNew(false); }

  async function save() {
    if (!draft || !draft.name.trim()) return;
    setSaving(true);
    try { await saveUser(draft, isNew); setDraft(null); }
    finally { setSaving(false); }
  }

  async function del(id) {
    if (!window.confirm("Remove this user?")) return;
    await removeUser(id);
  }

  const ROLES = ["Adviser", "Admin"];
  const roleColour = r => r === "Admin" ? { bg:"#DBEAFE", tc:"#1e40af" } : { bg:B.g1, tc:B.g3 };

  return (
    <div style={{ maxWidth:700 }}>
      <div style={{ fontSize:12, color:B.g3, marginBottom:14 }}>Manage who has access to this tool and their role. Role determines whether a user can see Admin tabs.</div>

      {draft && (
        <div style={{ ...CARD({ marginBottom:14, borderLeft:`4px solid ${B.red}`, borderRadius:"0 10px 10px 0" }) }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 140px", gap:12, marginBottom:12 }}>
            <FI label="Full Name" value={draft.name} onChange={e => setDraft({ ...draft, name:e.target.value })} placeholder="Jane Smith"/>
            <FI label="Email (optional)" value={draft.email || ""} onChange={e => setDraft({ ...draft, email:e.target.value })} placeholder="jane@company.com"/>
            <div>
              <label style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:B.g3, display:"block", marginBottom:5 }}>Role</label>
              <select style={{ ...mkInp(false), appearance:"none" }} value={draft.role} onChange={e => setDraft({ ...draft, role:e.target.value })}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button style={BS} onClick={() => setDraft(null)}>Cancel</button>
            <button style={{ ...BP, opacity:saving || !draft.name.trim() ? 0.5 : 1 }} onClick={save} disabled={saving || !draft.name.trim()}>{saving ? "Saving…" : "Save User"}</button>
          </div>
        </div>
      )}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:B.g3 }}>{users.length} User{users.length !== 1 ? "s" : ""}</span>
        <button style={BP} onClick={startNew}>+ Add User</button>
      </div>

      {users.length === 0 && !draft && (
        <div style={{ ...CARD({ textAlign:"center", padding:"2rem", color:B.g3 }) }}>No users configured yet. Add users to manage access.</div>
      )}

      {users.map(u => (
        <div key={u.id} style={{ ...CARD({ marginBottom:8, display:"flex", alignItems:"center", gap:14 }) }}>
          <div style={{ width:36, height:36, borderRadius:"50%", background:B.red, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:B.white, flexShrink:0 }}>
            {u.name.trim().split(/\s+/).map(w => w[0]?.toUpperCase() || "").slice(0, 2).join("")}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700 }}>{u.name}</div>
            {u.email && <div style={{ fontSize:11, color:B.g3 }}>{u.email}</div>}
          </div>
          <span style={{ ...TAG(roleColour(u.role).bg, roleColour(u.role).tc) }}>{u.role}</span>
          <button style={{ ...BS, padding:"4px 10px", fontSize:11 }} onClick={() => startEdit(u)}>Edit</button>
          <button style={BG(B.red)} onClick={() => del(u.id)}>×</button>
        </div>
      ))}

      <div style={{ marginTop:16, padding:"10px 14px", background:B.g1, borderRadius:8, fontSize:11, color:B.g3 }}>
        ℹ️ Role is enforced via the role selector in the top navigation bar. Users can identify themselves via their Cloudflare Access identity shown above.
      </div>
    </div>
  );
}

function HeaderFooterSettings({ settings, updateSettings }) {
  const entities = settings.entities || [];
  const hfMap = settings.headerFooters || {};
  const [selEntityId, setSelEntityId] = useState(entities[0]?.id || "");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const currentHF = hfMap[selEntityId] || {};

  function startEdit() { setDraft(JSON.parse(JSON.stringify(currentHF))); }

  async function saveDraft() {
    if (!draft) return;
    setSaving(true);
    try { await updateSettings({ headerFooters:{ ...hfMap, [selEntityId]: draft } }); setDraft(null); setToast("Header & Footer saved"); }
    finally { setSaving(false); }
  }

  async function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const dataUrl = await compressImage(file);
    setDraft(d => ({ ...d, logoBase64: dataUrl }));
  }

  const activeEnt = entities.find(e=>e.id===selEntityId);

  return (
    <>
    <div style={{ maxWidth:760 }}>
      <div style={{ fontSize:12, color:B.g3, marginBottom:16 }}>Configure a default header and footer for each legal entity. Templates can override this individually.</div>
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {entities.map(e => (
          <button key={e.id} onClick={()=>{ setSelEntityId(e.id); setDraft(null); }} style={{ padding:"7px 16px", background:selEntityId===e.id?B.black:"transparent", color:selEntityId===e.id?B.white:B.black, border:`1.5px solid ${selEntityId===e.id?B.black:B.g2}`, borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"'Montserrat',sans-serif" }}>
            {e.shortCode} — {e.name}
          </button>
        ))}
      </div>
      {!draft ? (
        <div style={{ background:B.white, border:`1.5px solid ${B.g2}`, borderRadius:10, padding:"1.25rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700 }}>{activeEnt?.name} — Header & Footer</div>
            <button style={{ padding:"9px 20px", background:B.red, color:B.white, border:"none", borderRadius:6, fontSize:12, fontWeight:700, fontFamily:"'Montserrat',sans-serif", cursor:"pointer" }} onClick={startEdit}>Edit</button>
          </div>
          {currentHF.logoBase64 && <img src={currentHF.logoBase64} alt="Logo" style={{ maxHeight:50, maxWidth:160, objectFit:"contain", marginBottom:8, display:"block" }}/>}
          {currentHF.companyLine && <div style={{ fontSize:13, fontWeight:700, marginBottom:2 }}>{currentHF.companyLine}</div>}
          {currentHF.addressLine1 && <div style={{ fontSize:12, color:B.g3 }}>{currentHF.addressLine1}</div>}
          {currentHF.addressLine2 && <div style={{ fontSize:12, color:B.g3 }}>{currentHF.addressLine2}</div>}
          {currentHF.phone && <div style={{ fontSize:12, color:B.g3 }}>{currentHF.phone}</div>}
          {currentHF.email && <div style={{ fontSize:12, color:B.g3 }}>{currentHF.email}</div>}
          {currentHF.website && <div style={{ fontSize:12, color:B.g3 }}>{currentHF.website}</div>}
          {currentHF.footerText && <div style={{ marginTop:12, paddingTop:10, borderTop:`1px solid ${B.g2}`, fontSize:11, color:B.g3 }}>{currentHF.footerText}</div>}
          {!currentHF.companyLine && !currentHF.logoBase64 && <div style={{ color:B.g3, fontSize:12 }}>No header/footer configured yet. Click Edit to set one up.</div>}
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ background:B.white, border:`1.5px solid ${B.g2}`, borderRadius:10, padding:"1.25rem" }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:B.g3, marginBottom:14 }}>Header</div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:B.g3, display:"block", marginBottom:6 }}>Logo image (PNG, JPG or SVG — auto-compressed)</label>
              {draft.logoBase64 && (
                <div style={{ marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
                  <img src={draft.logoBase64} alt="Logo preview" style={{ maxHeight:50, maxWidth:160, objectFit:"contain", border:`1px solid ${B.g2}`, borderRadius:4, padding:4 }}/>
                  <button style={{ padding:"7px 14px", background:"transparent", color:B.red, border:"none", borderRadius:6, fontSize:12, fontWeight:500, fontFamily:"'Montserrat',sans-serif", cursor:"pointer" }} onClick={()=>setDraft({...draft,logoBase64:null})}>Remove logo</button>
                </div>
              )}
              <input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={handleLogoUpload} style={{ fontSize:12, color:B.black }}/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
              <div><label style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:B.g3, display:"block", marginBottom:5 }}>Company / entity line</label><input style={{ width:"100%", boxSizing:"border-box", padding:"9px 12px", background:B.white, border:`1.5px solid ${B.g2}`, borderRadius:6, fontSize:13, fontFamily:"'Montserrat',sans-serif", color:B.black, outline:"none" }} value={draft.companyLine||""} onChange={e=>setDraft({...draft,companyLine:e.target.value})} placeholder="CSL Behring Ltd"/></div>
              <div><label style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:B.g3, display:"block", marginBottom:5 }}>Address line 1</label><input style={{ width:"100%", boxSizing:"border-box", padding:"9px 12px", background:B.white, border:`1.5px solid ${B.g2}`, borderRadius:6, fontSize:13, fontFamily:"'Montserrat',sans-serif", color:B.black, outline:"none" }} value={draft.addressLine1||""} onChange={e=>setDraft({...draft,addressLine1:e.target.value})} placeholder="1 Innovation Drive"/></div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
              <div><label style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:B.g3, display:"block", marginBottom:5 }}>Address line 2</label><input style={{ width:"100%", boxSizing:"border-box", padding:"9px 12px", background:B.white, border:`1.5px solid ${B.g2}`, borderRadius:6, fontSize:13, fontFamily:"'Montserrat',sans-serif", color:B.black, outline:"none" }} value={draft.addressLine2||""} onChange={e=>setDraft({...draft,addressLine2:e.target.value})} placeholder="Liverpool, L1 1AA"/></div>
              <div><label style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:B.g3, display:"block", marginBottom:5 }}>Phone</label><input style={{ width:"100%", boxSizing:"border-box", padding:"9px 12px", background:B.white, border:`1.5px solid ${B.g2}`, borderRadius:6, fontSize:13, fontFamily:"'Montserrat',sans-serif", color:B.black, outline:"none" }} value={draft.phone||""} onChange={e=>setDraft({...draft,phone:e.target.value})} placeholder="+44 151 000 0000"/></div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
              <div><label style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:B.g3, display:"block", marginBottom:5 }}>Email</label><input style={{ width:"100%", boxSizing:"border-box", padding:"9px 12px", background:B.white, border:`1.5px solid ${B.g2}`, borderRadius:6, fontSize:13, fontFamily:"'Montserrat',sans-serif", color:B.black, outline:"none" }} value={draft.email||""} onChange={e=>setDraft({...draft,email:e.target.value})} placeholder="hr@cslbehring.com"/></div>
              <div><label style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:B.g3, display:"block", marginBottom:5 }}>Registration line (centre of header)</label><input style={{ width:"100%", boxSizing:"border-box", padding:"9px 12px", background:B.white, border:`1.5px solid ${B.g2}`, borderRadius:6, fontSize:13, fontFamily:"'Montserrat',sans-serif", color:B.black, outline:"none" }} value={draft.registrationLine||""} onChange={e=>setDraft({...draft,registrationLine:e.target.value})} placeholder="Registered in England and Wales No. 9614642"/></div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div><label style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:B.g3, display:"block", marginBottom:5 }}>Website line 1 (shown in red, right of header)</label><input style={{ width:"100%", boxSizing:"border-box", padding:"9px 12px", background:B.white, border:`1.5px solid ${B.g2}`, borderRadius:6, fontSize:13, fontFamily:"'Montserrat',sans-serif", color:B.black, outline:"none" }} value={draft.websiteLine1||draft.website||""} onChange={e=>setDraft({...draft,websiteLine1:e.target.value,website:e.target.value})} placeholder="CSL.com"/></div>
              <div><label style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:B.g3, display:"block", marginBottom:5 }}>Website line 2 (shown in red, right of header)</label><input style={{ width:"100%", boxSizing:"border-box", padding:"9px 12px", background:B.white, border:`1.5px solid ${B.g2}`, borderRadius:6, fontSize:13, fontFamily:"'Montserrat',sans-serif", color:B.black, outline:"none" }} value={draft.websiteLine2||""} onChange={e=>setDraft({...draft,websiteLine2:e.target.value})} placeholder="CSLSeqirus.com"/></div>
            </div>
          </div>
          <div style={{ background:B.white, border:`1.5px solid ${B.g2}`, borderRadius:10, padding:"1.25rem" }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:B.g3, marginBottom:12 }}>Footer</div>
            <div><label style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:B.g3, display:"block", marginBottom:5 }}>Footer text (e.g. registered company details, legal disclaimer)</label><textarea style={{ width:"100%", boxSizing:"border-box", padding:"9px 12px", background:B.white, border:`1.5px solid ${B.g2}`, borderRadius:6, fontSize:13, fontFamily:"'Montserrat',sans-serif", color:B.black, outline:"none", minHeight:80, resize:"vertical", lineHeight:1.6 }} value={draft.footerText||""} onChange={e=>setDraft({...draft,footerText:e.target.value})} placeholder="CSL Behring Ltd is registered in England & Wales. Company No. 000000..."/></div>
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button style={{ padding:"9px 20px", background:"transparent", color:B.black, border:`1.5px solid ${B.g2}`, borderRadius:6, fontSize:12, fontWeight:600, fontFamily:"'Montserrat',sans-serif", cursor:"pointer" }} onClick={()=>setDraft(null)}>Cancel</button>
            <button style={{ padding:"9px 20px", background:B.red, color:B.white, border:"none", borderRadius:6, fontSize:12, fontWeight:700, fontFamily:"'Montserrat',sans-serif", cursor:"pointer", opacity:saving?0.6:1 }} onClick={saveDraft} disabled={saving}>{saving?"Saving…":"Save Header & Footer"}</button>
          </div>
        </div>
      )}
    </div>
    {toast && <Toast message={toast} onDone={() => setToast(null)}/>}
    </>
  );
}