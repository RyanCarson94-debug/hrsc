import { useState, useMemo } from "react";
import { B, CARD, BP, BS, BG, TAG, FI, FS, FilterBar, mkInp, Toast, usePersistedFilter } from "./shared";
import { ALL_COUNTRIES } from "../defaults";
import { evalRule, resolveTemplate, detectConflicts } from "../ruleEngine";

const OPERATORS    = [{ value:"equals",label:"equals" },{ value:"not_equals",label:"does not equal" },{ value:"gte",label:"is ≥",num:true },{ value:"lte",label:"is ≤",num:true },{ value:"in",label:"is one of" }];
const ACTION_TYPES = [{ value:"use_clause",label:"Include clause in section" },{ value:"replace_clause",label:"Replace default clause in section" },{ value:"add_clause",label:"Append clause to template" },{ value:"remove_clause",label:"Remove clause from section" },{ value:"set_variable",label:"Set computed variable value" }];
const COND_FIELDS  = [{ value:"grade",label:"Job Grade" },{ value:"businessUnit",label:"Business Unit" },{ value:"employmentType",label:"Employment Type" },{ value:"managerLevel",label:"Manager Level" },{ value:"country",label:"Country" }];

function gid() { return Math.random().toString(36).slice(2,8); }

// ── Rule Tester Panel ─────────────────────────────────────────────────────────
function RuleTester({ rules, templates, clauses, settings }) {
  const [open, setOpen] = useState(false);
  const [testEmp, setTestEmp] = useState({ grade:"4", businessUnit:"", employmentType:"Full-time", managerLevel:"Individual Contributor", country:"United Kingdom" });
  const [selectedTmpl, setSelectedTmpl] = useState(templates[0]?.id || "");

  const fired = useMemo(() => {
    return rules.filter(r => r.active && evalRule(r, testEmp)).sort((a, b) => a.priority - b.priority);
  }, [rules, testEmp]);

  const effectiveSections = useMemo(() => {
    const tmpl = templates.find(t => t.id === selectedTmpl);
    if (!tmpl) return [];
    return resolveTemplate(tmpl, rules, testEmp);
  }, [templates, rules, testEmp, selectedTmpl]);

  const buOptions = settings.dropdowns.businessUnits.filter(b => b.global);
  const etOptions = settings.dropdowns.employmentTypes.filter(b => b.global);
  const mlOptions = settings.dropdowns.managerLevels.filter(b => b.global);

  return (
    <div style={{ ...CARD({ marginTop:20, borderLeft:`4px solid ${B.blue}`, borderRadius:"0 10px 10px 0" }) }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }} onClick={() => setOpen(o => !o)}>
        <div>
          <div style={{ fontSize:13, fontWeight:700 }}>⚗ Rule Tester</div>
          <div style={{ fontSize:11, color:B.g3 }}>Simulate rule evaluation without generating a document</div>
        </div>
        <span style={{ fontSize:18, color:B.g3 }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div style={{ marginTop:16 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
            <FI label="Job Grade" value={testEmp.grade} onChange={e => setTestEmp({ ...testEmp, grade:e.target.value })} type="number" placeholder="e.g. 4"/>
            <FS label="Country" value={testEmp.country} onChange={e => setTestEmp({ ...testEmp, country:e.target.value })}>
              {ALL_COUNTRIES.map(c => <option key={c}>{c}</option>)}
            </FS>
            <FS label="Template to preview" value={selectedTmpl} onChange={e => setSelectedTmpl(e.target.value)}>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </FS>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:16 }}>
            <FS label="Business Unit" value={testEmp.businessUnit} onChange={e => setTestEmp({ ...testEmp, businessUnit:e.target.value })}>
              <option value="">Select…</option>
              {buOptions.map(b => <option key={b.id} value={b.label}>{b.label}</option>)}
            </FS>
            <FS label="Employment Type" value={testEmp.employmentType} onChange={e => setTestEmp({ ...testEmp, employmentType:e.target.value })}>
              {etOptions.map(b => <option key={b.id} value={b.label}>{b.label}</option>)}
            </FS>
            <FS label="Manager Level" value={testEmp.managerLevel} onChange={e => setTestEmp({ ...testEmp, managerLevel:e.target.value })}>
              {mlOptions.map(b => <option key={b.id} value={b.label}>{b.label}</option>)}
            </FS>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            {/* Fired rules */}
            <div>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:B.g3, marginBottom:8 }}>
                {fired.length > 0 ? `${fired.length} Rule${fired.length !== 1 ? "s" : ""} Would Fire` : "No Rules Would Fire"}
              </div>
              {fired.length === 0 && <div style={{ fontSize:12, color:B.g3 }}>Adjust the inputs above to test rule conditions.</div>}
              {fired.map(r => (
                <div key={r.id} style={{ ...CARD({ marginBottom:6, padding:"8px 12px", borderLeft:`3px solid ${r.action.type === "set_variable" ? B.blue : B.teal}`, borderRadius:"0 8px 8px 0" }) }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ ...TAG(), fontWeight:700 }}>P{r.priority}</span>
                    <span style={{ fontSize:12, fontWeight:700, flex:1 }}>{r.name}</span>
                  </div>
                  <div style={{ fontSize:11, color:B.g3, marginTop:3 }}>
                    → {ACTION_TYPES.find(a => a.value === r.action.type)?.label || r.action.type}
                    {r.action.clauseId && `: "${clauses.find(c => c.id === r.action.clauseId)?.name || "—"}"`}
                    {r.action.variableKey && `: {{${r.action.variableKey}}} = ${r.action.variableValue}`}
                  </div>
                </div>
              ))}
            </div>

            {/* Effective sections */}
            <div>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:B.g3, marginBottom:8 }}>
                Resulting Sections ({effectiveSections.length})
              </div>
              {effectiveSections.length === 0 && <div style={{ fontSize:12, color:B.g3 }}>Select a template above.</div>}
              {effectiveSections.map((s, i) => {
                const cl = s.clauseId ? clauses.find(c => c.id === s.clauseId) : null;
                return (
                  <div key={s.id} style={{ ...CARD({ marginBottom:4, padding:"6px 10px" }) }}>
                    <div style={{ fontSize:11, fontWeight:600 }}>{i + 1}. {s.name}</div>
                    {cl && <div style={{ fontSize:10, color:B.g3 }}>{cl.name}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main RulesTab ─────────────────────────────────────────────────────────────
export default function RulesTab({ state, saveRule, removeRule, toggleRule }) {
  const { settings, clauses, templates, rules } = state;
  const [cf, setCf] = usePersistedFilter("hrsc_rl_cf");
  const [ef, setEf] = usePersistedFilter("hrsc_rl_ef");
  const [draft, setDraft] = useState(null);
  const [origDraft, setOrigDraft] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const filtered = rules.filter(r => {
    if (cf && r.country && r.country !== "__global__" && r.country !== cf) return false;
    if (ef && r.entityId && r.entityId !== "__global__" && r.entityId !== ef) return false;
    return true;
  });

  // Detect conflicts
  const conflicts = useMemo(() => detectConflicts(rules), [rules]);
  const conflictRuleIds = useMemo(() => new Set(conflicts.flatMap(c => [c.ruleA.id, c.ruleB.id])), [conflicts]);

  function startNew() {
    const d = { id:gid(), name:"New Rule", description:"", conditions:[{ field:"grade", operator:"gte", value:"5" }], conditionLogic:"AND", action:{ type:"replace_clause", targetTemplateId:"", targetSectionId:"", clauseId:"" }, country:"__global__", entityId:"__global__", priority:rules.length + 1, active:true };
    setDraft(d); setOrigDraft(d); setIsNew(true);
  }
  function startEdit(r) { const d = JSON.parse(JSON.stringify(r)); setDraft(d); setOrigDraft(d); setIsNew(false); }
  function cancelEdit() {
    if (!isNew && origDraft && JSON.stringify(draft) !== JSON.stringify(origDraft)) {
      if (!window.confirm("Discard unsaved changes?")) return;
    }
    setDraft(null);
  }
  async function save() {
    if (!draft) return;
    setSaving(true);
    try { await saveRule(draft, isNew); setDraft(null); setToast("Rule saved"); }
    finally { setSaving(false); }
  }
  async function del(id, name) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await removeRule(id); setDraft(null);
  }
  function updCond(idx, patch) { if (!draft) return; setDraft({ ...draft, conditions:draft.conditions.map((c, i) => i === idx ? { ...c, ...patch } : c) }); }

  const targetTemplateSections = useMemo(() => {
    if (!draft?.action?.targetTemplateId) return [];
    return templates.find(t => t.id === draft.action.targetTemplateId)?.sections || [];
  }, [draft?.action?.targetTemplateId, templates]);

  function getCondValueOptions(field, entityId) {
    const eid = entityId && entityId !== "__global__" ? entityId : null;
    switch (field) {
      case "businessUnit":   return settings.dropdowns.businessUnits.filter(b => b.global || !eid || b.entityIds.includes(eid)).map(b => b.label);
      case "employmentType": return settings.dropdowns.employmentTypes.filter(b => b.global || !eid || b.entityIds.includes(eid)).map(b => b.label);
      case "managerLevel":   return settings.dropdowns.managerLevels.filter(b => b.global || !eid || b.entityIds.includes(eid)).map(b => b.label);
      case "country":        return ALL_COUNTRIES;
      default:               return null;
    }
  }

  const scopedClauses   = draft ? clauses.filter(c => { if (c.global) return true; const cOk = !draft.country || draft.country === "__global__" || c.countries.includes(draft.country); const eOk = !draft.entityId || draft.entityId === "__global__" || c.entityIds.includes(draft.entityId); return cOk && eOk; }) : [];
  const scopedTemplates = draft ? templates.filter(t => { if (t.country === "__global__" || t.entityId === "__global__") return true; const cOk = !draft.country || draft.country === "__global__" || t.country === draft.country; const eOk = !draft.entityId || draft.entityId === "__global__" || t.entityId === draft.entityId; return cOk && eOk; }) : [];

  const summary = r => {
    const conds = r.conditions.map(c => { const f = COND_FIELDS.find(x => x.value === c.field)?.label || c.field; const op = OPERATORS.find(x => x.value === c.operator)?.label || c.operator; return `${f} ${op} "${Array.isArray(c.value) ? c.value.join(",") : c.value}"`; }).join(` ${r.conditionLogic} `);
    const act  = ACTION_TYPES.find(a => a.value === r.action.type)?.label || r.action.type;
    const cl   = clauses.find(c => c.id === r.action.clauseId)?.name || "–";
    const tmpl = templates.find(t => t.id === r.action.targetTemplateId)?.name || "any template";
    return `IF ${conds} → ${act}: "${cl}" (${tmpl})`;
  };

  return (
    <>
    <div style={{ display:"grid", gridTemplateColumns:draft ? "1fr 480px" : "1fr", gap:20, alignItems:"start" }}>
      <div>
        <FilterBar countries={ALL_COUNTRIES} entities={settings.entities} countryFilter={cf} setCountryFilter={setCf} entityFilter={ef} setEntityFilter={setEf}/>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ fontSize:16, fontWeight:700 }}>Rules Engine</div>
              {conflicts.length > 0 && (
                <span style={{ ...TAG("#FEE2E2", "#b91c1c"), fontSize:10 }}>⚠ {conflicts.length} conflict{conflicts.length !== 1 ? "s" : ""}</span>
              )}
            </div>
            <div style={{ fontSize:12, color:B.g3 }}>Evaluated in priority order at generation time.</div>
          </div>
          <button style={BP} onClick={startNew}>+ New Rule</button>
        </div>

        {conflicts.length > 0 && (
          <div style={{ padding:"10px 14px", background:"#FEE2E2", border:`1.5px solid #FCA5A5`, borderRadius:8, marginBottom:16, fontSize:12 }}>
            <div style={{ fontWeight:700, color:"#b91c1c", marginBottom:6 }}>Rule conflicts detected</div>
            {conflicts.map((c, i) => {
              const section = templates.flatMap(t => t.sections).find(s => s.id === c.sectionId);
              const tmpl    = templates.find(t => t.id === c.templateId);
              return (
                <div key={i} style={{ color:"#991b1b", fontSize:11, marginBottom:3 }}>
                  · "{c.ruleA.name}" and "{c.ruleB.name}" both target {tmpl?.name || "a template"} → {section?.name || "a section"}
                </div>
              );
            })}
          </div>
        )}

        {filtered.length === 0 && <div style={{ ...CARD({ textAlign:"center", padding:"2rem", color:B.g3 }) }}>No rules match your filters.</div>}
        {[...filtered].sort((a, b) => a.priority - b.priority).map(r => (
          <div key={r.id} style={{ ...CARD({ marginBottom:10, borderLeft:`4px solid ${r.active ? (conflictRuleIds.has(r.id) ? "#F59E0B" : B.red) : B.g2}`, borderRadius:"0 10px 10px 0", opacity:r.active ? 1 : 0.6 }) }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                  <span style={{ ...TAG(), fontFamily:"'Montserrat',sans-serif", fontWeight:700 }}>P{r.priority}</span>
                  <span style={{ fontSize:13, fontWeight:700 }}>{r.name}</span>
                  {!r.active && <span style={TAG("#FEE2E2", "#b91c1c")}>Inactive</span>}
                  {conflictRuleIds.has(r.id) && r.active && <span style={TAG("#FFF9E6", "#7A5E00")}>⚠ Conflict</span>}
                  {r.country !== "__global__" && <span style={TAG()}>{r.country}</span>}
                  {r.entityId !== "__global__" && settings.entities.find(e => e.id === r.entityId) && <span style={TAG(B.g1, "#0E56A5")}>{settings.entities.find(e => e.id === r.entityId)?.shortCode}</span>}
                </div>
                {r.description && <div style={{ fontSize:12, color:B.g3, marginBottom:6 }}>{r.description}</div>}
                <div style={{ fontFamily:"'Courier New',monospace", fontSize:10, color:B.g3, background:B.g1, padding:"7px 10px", borderRadius:6, lineHeight:1.6 }}>{summary(r)}</div>
              </div>
              <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                <button style={{ ...BS, padding:"5px 12px", fontSize:11 }} onClick={() => toggleRule(r.id)}>{r.active ? "Disable" : "Enable"}</button>
                <button style={{ ...BS, padding:"5px 12px", fontSize:11 }} onClick={() => startEdit(r)}>Edit</button>
              </div>
            </div>
          </div>
        ))}

        <RuleTester rules={rules} templates={templates} clauses={clauses} settings={settings}/>
      </div>

      {draft && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={CARD()}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:B.g3, marginBottom:12 }}>Rule Scope</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
              <FS label="Country" value={draft.country} onChange={e => setDraft({ ...draft, country:e.target.value })}>
                <option value="__global__">Global (all countries)</option>
                {ALL_COUNTRIES.map(c => <option key={c}>{c}</option>)}
              </FS>
              <FS label="Legal Entity" value={draft.entityId} onChange={e => setDraft({ ...draft, entityId:e.target.value })}>
                <option value="__global__">Global (all entities)</option>
                {settings.entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </FS>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <FI label="Rule Name"                value={draft.name}     onChange={e => setDraft({ ...draft, name:e.target.value })}/>
              <FI label="Priority (lower = first)" value={String(draft.priority)} onChange={e => setDraft({ ...draft, priority:parseInt(e.target.value) || 1 })} type="number" min="1"/>
            </div>
            <div style={{ marginTop:12 }}><FI label="Description" value={draft.description} onChange={e => setDraft({ ...draft, description:e.target.value })} placeholder="When does this rule apply?"/></div>
            <div style={{ marginTop:10 }}>
              <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:12, fontWeight:600 }}>
                <input type="checkbox" checked={draft.active} onChange={e => setDraft({ ...draft, active:e.target.checked })} style={{ accentColor:B.red, width:14, height:14 }}/>Rule is active
              </label>
            </div>
          </div>

          <div style={CARD()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:B.g3 }}>Conditions</span>
                {draft.conditions.length > 1 && ["AND", "OR"].map(l => (
                  <button key={l} onClick={() => setDraft({ ...draft, conditionLogic:l })} style={{ padding:"2px 10px", background:draft.conditionLogic === l ? B.black : "transparent", color:draft.conditionLogic === l ? B.white : B.g3, border:`1.5px solid ${B.g2}`, borderRadius:4, cursor:"pointer", fontSize:10, fontWeight:700, fontFamily:"'Montserrat',sans-serif", letterSpacing:"0.05em" }}>{l}</button>
                ))}
              </div>
              <button style={{ ...BS, padding:"5px 10px", fontSize:11 }} onClick={() => setDraft({ ...draft, conditions:[...draft.conditions, { field:"grade", operator:"equals", value:"" }] })}>+ Add</button>
            </div>
            {draft.conditions.map((c, idx) => {
              const valOptions = getCondValueOptions(c.field, draft.entityId);
              return (
                <div key={idx} style={{ background:B.g1, borderRadius:8, padding:"10px", marginBottom:8 }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:8, alignItems:"end" }}>
                    <FS label="Field" value={c.field} onChange={e => updCond(idx, { field:e.target.value, value:"" })}>
                      {COND_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </FS>
                    <FS label="Operator" value={c.operator} onChange={e => updCond(idx, { operator:e.target.value })}>
                      {OPERATORS.filter(o => !o.num || c.field === "grade").map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </FS>
                    <div>
                      <label style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:B.g3, display:"block", marginBottom:5 }}>Value</label>
                      {valOptions
                        ? c.operator === "in"
                          ? <select multiple style={{ ...mkInp(false), height:80, padding:"4px" }} value={Array.isArray(c.value) ? c.value : [c.value].filter(Boolean)} onChange={e => updCond(idx, { value:[...e.target.selectedOptions].map(o => o.value) })}>
                              {valOptions.map(v => <option key={v}>{v}</option>)}
                            </select>
                          : <select style={{ ...mkInp(false), appearance:"none", backgroundRepeat:"no-repeat", backgroundPosition:"right 10px center" }} value={Array.isArray(c.value) ? c.value[0] : c.value} onChange={e => updCond(idx, { value:e.target.value })}>
                              <option value="">Select…</option>
                              {valOptions.map(v => <option key={v}>{v}</option>)}
                            </select>
                        : <input style={mkInp(false)} value={Array.isArray(c.value) ? c.value.join(", ") : c.value} onChange={e => updCond(idx, { value:e.target.value })} placeholder="e.g. 5"/>
                      }
                    </div>
                    <button onClick={() => setDraft({ ...draft, conditions:draft.conditions.filter((_, i) => i !== idx) })} style={{ ...BG(B.red), fontSize:18, marginBottom:2 }}>×</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={CARD()}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:B.g3, marginBottom:12 }}>Then Do This</div>
            <div style={{ marginBottom:10 }}>
              <FS label="Action Type" value={draft.action.type} onChange={e => setDraft({ ...draft, action:{ ...draft.action, type:e.target.value } })}>
                {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </FS>
            </div>
            {draft.action.type !== "add_clause" && draft.action.type !== "set_variable" && <>
              <div style={{ marginBottom:10 }}>
                <FS label="Target Template" value={draft.action.targetTemplateId || ""} onChange={e => setDraft({ ...draft, action:{ ...draft.action, targetTemplateId:e.target.value, targetSectionId:"" } })}>
                  <option value="">— Select template —</option>
                  {scopedTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </FS>
              </div>
              <div style={{ marginBottom:10 }}>
                <FS label="Target Section" value={draft.action.targetSectionId || ""} onChange={e => setDraft({ ...draft, action:{ ...draft.action, targetSectionId:e.target.value } })} disabled={!draft.action.targetTemplateId}>
                  <option value="">— Select section —</option>
                  {targetTemplateSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </FS>
              </div>
            </>}
            {draft.action.type === "set_variable" && (
              <div style={{ background:B.g1, borderRadius:8, padding:"12px", marginBottom:10 }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:B.teal, marginBottom:10 }}>✦ Computed Variable</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <FI label="Variable key (must match {{key}} in clause)" value={draft.action.variableKey || ""} onChange={e => setDraft({ ...draft, action:{ ...draft.action, variableKey:e.target.value.replace(/\s/g, "_").toLowerCase() } })} placeholder="e.g. sti_percentage"/>
                  <FI label="Value to set" value={draft.action.variableValue || ""} onChange={e => setDraft({ ...draft, action:{ ...draft.action, variableValue:e.target.value } })} placeholder="e.g. 15"/>
                </div>
                <div style={{ fontSize:11, color:B.g3, marginTop:8 }}>When this rule fires, <code style={{ fontFamily:"'Courier New',monospace", background:B.g2, padding:"1px 5px", borderRadius:3 }}>{`{{${draft.action.variableKey || "key"}}}`}</code> will contribute <strong>{draft.action.variableValue || "value"}</strong> to the final value. If multiple rules match, numeric values are <strong>added together</strong>.</div>
              </div>
            )}
            {draft.action.type !== "remove_clause" && draft.action.type !== "set_variable" && (
              <FS label="Clause to Use" value={draft.action.clauseId || ""} onChange={e => setDraft({ ...draft, action:{ ...draft.action, clauseId:e.target.value } })}>
                <option value="">— Select clause —</option>
                {scopedClauses.map(c => <option key={c.id} value={c.id}>{c.name}{c.global ? " (Global)" : ""}</option>)}
              </FS>
            )}
          </div>

          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            {!isNew && <button style={BG(B.red)} onClick={() => del(draft.id, draft.name)}>Delete Rule</button>}
            <button style={BS} onClick={cancelEdit}>Cancel</button>
            <button style={{ ...BP, opacity:saving ? 0.6 : 1 }} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Rule"}</button>
          </div>
        </div>
      )}
    </div>
    {toast && <Toast message={toast} onDone={() => setToast(null)}/>}
    </>
  );
}
