import { useState, useMemo } from "react";
import {
  B, CARD, BP, BS, BG, TAG, FI, FS, FilterBar,
  renderClauseContent, buildSectionNumbers, templateMatches, PreviewContent,
} from "./shared";
import { generateDocx } from "./docxExport";
import { saveGeneration } from "../api";
import { ALL_COUNTRIES } from "../defaults";

const OPERATORS = [{value:"equals",label:"equals"},{value:"not_equals",label:"does not equal"},{value:"gte",label:"is ≥",num:true},{value:"lte",label:"is ≤",num:true},{value:"in",label:"is one of"}];

function evalCond(c, data) {
  const v = String(data[c.field] || ""), cv = c.value;
  switch (c.operator) {
    case "equals":    return v.toLowerCase() === String(cv).toLowerCase();
    case "not_equals":return v.toLowerCase() !== String(cv).toLowerCase();
    case "gte":       return parseFloat(v) >= parseFloat(cv);
    case "lte":       return parseFloat(v) <= parseFloat(cv);
    case "in":        return Array.isArray(cv) ? cv.map(x=>x.toLowerCase()).includes(v.toLowerCase()) : false;
    default:          return false;
  }
}
function evalRule(r, data) {
  if (!r.active) return false;
  const res = r.conditions.map(c => evalCond(c, data));
  return r.conditionLogic === "AND" ? res.every(Boolean) : res.some(Boolean);
}
function resolveTemplate(tmpl, rules, data) {
  const sorted = [...rules].sort((a,b) => a.priority - b.priority);
  let sections = JSON.parse(JSON.stringify(tmpl.sections));
  sorted.forEach(rule => {
    if (rule.action.targetTemplateId && rule.action.targetTemplateId !== tmpl.id) return;
    if (!evalRule(rule, data)) return;
    const { type, targetSectionId, clauseId } = rule.action;
    if (type==="replace_clause" && targetSectionId) sections = sections.map(s => s.id===targetSectionId ? {...s, clauseId} : s);
    if (type==="use_clause"     && targetSectionId) sections = sections.map(s => s.id===targetSectionId ? {...s, clauseId, content:undefined} : s);
    if (type==="remove_clause"  && targetSectionId) sections = sections.filter(s => s.id!==targetSectionId);
    if (type==="add_clause") { if (!sections.some(s=>s.clauseId===clauseId)) sections.push({id:`inj-${clauseId}`,name:"Additional Clause",clauseId,level:1,required:false,ruleSlot:false}); }
  });
  return sections;
}

export default function GenerateTab({ state, userName }) {
  const { settings, clauses, templates, rules } = state;
  const [cf, setCf]   = useState(""), [ef, setEf] = useState("");
  const [step, setStep]   = useState("select");
  const [tmpl, setTmpl]   = useState(null);
  const [emp, setEmp]     = useState({country:"United Kingdom",entityId:"e1",grade:"4",businessUnit:"",employmentType:"Full-time",managerLevel:"Individual Contributor",employee_name:"",job_title:"",company_name:""});
  const [vars, setVars]   = useState({});
  const [fired, setFired] = useState([]);
  const [resolved, setResolved] = useState([]);
  const [blockedVars, setBlockedVars] = useState([]);

  const filteredTemplates = templates.filter(t => templateMatches(t, cf, ef));
  const contracts  = filteredTemplates.filter(t => t.documentType === "contract");
  const addendums  = filteredTemplates.filter(t => t.documentType === "addendum");
  const buOptions  = settings.dropdowns.businessUnits.filter(b => b.global || b.entityIds.includes(emp.entityId));
  const etOptions  = settings.dropdowns.employmentTypes.filter(b => b.global || b.entityIds.includes(emp.entityId));
  const mlOptions  = settings.dropdowns.managerLevels.filter(b => b.global || b.entityIds.includes(emp.entityId));

  // Resolve header/footer: template override takes precedence, then entity default
  const headerFooter = useMemo(() => {
    if (!tmpl) return null;
    if (tmpl.headerFooter) return tmpl.headerFooter; // per-template override
    const entityId = tmpl.entityId && tmpl.entityId !== "__global__" ? tmpl.entityId : emp.entityId;
    return settings.headerFooters?.[entityId] || null;
  }, [tmpl, emp.entityId, settings.headerFooters]);

  function onSelect(t) {
    setTmpl(t);
    const entity = settings.entities.find(e => e.id === t.entityId);
    setEmp(e => ({ ...e, country: t.country!=="__global__" ? t.country : e.country, entityId: t.entityId!=="__global__" ? t.entityId : e.entityId, company_name: entity?.name || e.company_name }));
    setStep("employee");
  }

  function onEmpNext() {
    const fr  = rules.filter(r => evalRule(r, emp));
    const res = resolveTemplate(tmpl, rules, emp);
    setFired(fr); setResolved(res);

    // Resolve computed variables — stack numeric values from all matching set_variable rules
    const computedAccum = {}; // key -> array of values from matching rules
    const setVarRules = [...rules]
      .filter(r => r.active && r.action.type === "set_variable" && evalRule(r, emp));
    setVarRules.forEach(r => {
      const key = r.action.variableKey;
      if (!key) return;
      if (!computedAccum[key]) computedAccum[key] = [];
      computedAccum[key].push(r.action.variableValue || "0");
    });

    // Stack: sum numeric values; if non-numeric concatenate with space
    const computedVars = {};
    Object.entries(computedAccum).forEach(([key, values]) => {
      const nums = values.map(v => parseFloat(v));
      if (nums.every(n => !isNaN(n))) {
        computedVars[key] = String(nums.reduce((a,b) => a+b, 0));
      } else {
        computedVars[key] = values.join(" ");
      }
    });

    // For computed variables with no rule match — check for defaults or block
    const allComputedKeys = new Set();
    res.forEach(s => {
      const cl = s.clauseId ? clauses.find(c=>c.id===s.clauseId) : null;
      if (cl) cl.variables.filter(v=>v.type==="computed").forEach(v=>allComputedKeys.add({key:v.key,defaultValue:v.defaultValue,label:v.label}));
    });

    const unresolved = [];
    allComputedKeys.forEach(({key, defaultValue, label}) => {
      if (!(key in computedVars)) {
        if (defaultValue !== undefined && defaultValue !== "") {
          computedVars[key] = defaultValue;
        } else {
          unresolved.push(label || key);
        }
      }
    });

    if (unresolved.length > 0) {
      setBlockedVars(unresolved);
      return; // block — do not proceed to variables step
    }
    setBlockedVars([]);

    const av = {
      employee_name:emp.employee_name, company_name:emp.company_name,
      job_title:emp.job_title, business_unit:emp.businessUnit, country:emp.country,
      ...computedVars,
    };
    res.forEach(s => {
      const ct = s.clauseId ? (clauses.find(c=>c.id===s.clauseId)?.content||"") : (s.content||"");
      (ct.match(/\{\{(\w+)\}\}/g)||[]).forEach(m => { const k=m.slice(2,-2); if (av[k]===undefined) av[k]=""; });
    });
    setVars(av); setStep("variables");
  }

  const computedVarKeys = useMemo(() => {
    const keys = new Set();
    resolved.forEach(s => {
      const cl = s.clauseId ? clauses.find(c=>c.id===s.clauseId) : null;
      if (cl) cl.variables.filter(v=>v.type==="computed").forEach(v=>keys.add(v.key));
    });
    return keys;
  }, [resolved, clauses]);

  const neededVars = useMemo(() => {
    const r=[], seen=new Set();
    resolved.forEach(s => {
      const cl = s.clauseId ? clauses.find(c=>c.id===s.clauseId) : null;
      const t  = cl?.content || s.content || "";
      (t.match(/\{\{(\w+)\}\}/g)||[]).forEach(m => {
        const k = m.slice(2,-2);
        if (!seen.has(k) && !computedVarKeys.has(k)) {
          seen.add(k);
          const v=cl?.variables.find(v=>v.key===k);
          r.push({key:k, label:v?.label||k.replace(/_/g," "), type:v?.type||"text"});
        }
      });
    });
    return r;
  }, [resolved, clauses, computedVarKeys]);

  async function downloadDoc() {
    await generateDocx({
      tmpl, resolved, clauses, vars, headerFooter, emp,
      numberingFormat: tmpl?.numberingFormat || "flat",
    });
    // Save generation snapshot for history/versioning
    saveGeneration({
      id: Math.random().toString(36).slice(2,10),
      templateName: tmpl.name,
      employeeName: emp.employee_name || "",
      country: emp.country,
      userName: userName || localStorage.getItem("hrsc_user_name") || "Unknown",
      generatedAt: new Date().toISOString(),
      snapshot: JSON.stringify({
        tmpl, resolved, clauses, vars, headerFooter, emp,
        numberingFormat: tmpl?.numberingFormat || "flat",
        firedRules: fired,
      }),
    }).catch(() => {}); // fire-and-forget
  }

  const STEPS  = ["select","employee","variables","preview"];
  const SLABELS = ["Template","Employee","Variables","Preview"];
  const curIdx = STEPS.indexOf(step);

  return (
    <div>
      <FilterBar countries={ALL_COUNTRIES} entities={settings.entities} countryFilter={cf} setCountryFilter={setCf} entityFilter={ef} setEntityFilter={setEf}/>

      {/* Step progress */}
      <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:28,background:B.g2,borderRadius:8,padding:4,width:"fit-content"}}>
        {STEPS.map((s,i) => { const active=step===s, done=curIdx>i; return (
          <div key={s} style={{display:"flex",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 16px",borderRadius:6,background:active?B.white:"transparent",boxShadow:active?"0 1px 6px rgba(0,0,0,0.1)":"none"}}>
              <span style={{width:18,height:18,borderRadius:"50%",background:done?B.teal:active?B.red:B.g3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:B.white,flexShrink:0}}>{done?"✓":i+1}</span>
              <span style={{fontSize:11,fontWeight:active?700:500,color:active?B.black:B.g3,whiteSpace:"nowrap"}}>{SLABELS[i]}</span>
            </div>
            {i<3 && <div style={{width:12,height:1,background:B.g3,opacity:.3}}/>}
          </div>
        ); })}
      </div>

      {step==="select" && (
        <div>
          {contracts.length===0 && addendums.length===0 && <div style={{...CARD({textAlign:"center",padding:"2.5rem",color:B.g3})}}>No templates match your filters.</div>}
          {contracts.length>0 && <>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:B.g3,marginBottom:10}}>Employment Contracts</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:12,marginBottom:24}}>
              {contracts.map(t => {
                const ent = settings.entities.find(e=>e.id===t.entityId);
                return (
                  <div key={t.id} onClick={()=>onSelect(t)} style={{...CARD({cursor:"pointer",transition:"all 0.15s",overflow:"hidden",position:"relative"})}} onMouseEnter={e=>{e.currentTarget.style.borderColor=B.red;e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 6px 20px rgba(252,25,33,0.08)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=B.g2;e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
                    <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:B.red,borderRadius:"10px 10px 0 0"}}/>
                    <div style={{paddingTop:6}}>
                      <div style={{fontSize:13,fontWeight:700,marginBottom:5,lineHeight:1.3}}>{t.name}</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                        <span style={TAG()}>{t.country==="__global__"?"Global":t.country}</span>
                        {ent && <span style={TAG(B.g1,"#0E56A5")}>{ent.shortCode}</span>}
                      </div>
                      <div style={{fontSize:12,color:B.g3,lineHeight:1.5,marginBottom:12}}>{t.description}</div>
                      <div style={{display:"flex",justifyContent:"space-between",paddingTop:10,borderTop:`1px solid ${B.g1}`}}>
                        <span style={{fontSize:10,fontWeight:600,color:B.g3}}>{t.sections.length} sections</span>
                        <span style={{fontSize:11,fontWeight:700,color:B.red}}>Select →</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>}
          {addendums.length>0 && <>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:B.g3,marginBottom:10}}>Addendum Letters</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:12}}>
              {addendums.map(t => {
                const ent = settings.entities.find(e=>e.id===t.entityId);
                return (
                  <div key={t.id} onClick={()=>onSelect(t)} style={{...CARD({cursor:"pointer",transition:"all 0.15s"})}} onMouseEnter={e=>{e.currentTarget.style.borderColor=B.red;e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=B.g2;e.currentTarget.style.transform="none";}}>
                    <div style={{fontSize:13,fontWeight:700,marginBottom:5}}>{t.name}</div>
                    <div style={{display:"flex",gap:6,marginBottom:10}}><span style={TAG()}>{t.country==="__global__"?"Global":t.country}</span>{ent && <span style={TAG(B.g1,"#0E56A5")}>{ent.shortCode}</span>}</div>
                    <div style={{fontSize:12,color:B.g3,marginBottom:12}}>{t.description}</div>
                    <div style={{display:"flex",justifyContent:"space-between",paddingTop:10,borderTop:`1px solid ${B.g1}`}}><span style={{fontSize:10,fontWeight:600,color:B.g3}}>{t.sections.length} sections</span><span style={{fontSize:11,fontWeight:700,color:B.red}}>Select →</span></div>
                  </div>
                );
              })}
            </div>
          </>}
        </div>
      )}

      {step==="employee" && tmpl && (
        <div style={{maxWidth:760}}>
          <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>{tmpl.name}</div>
          <div style={{fontSize:12,color:B.g3,marginBottom:20}}>Enter the employee's details to evaluate which clauses apply.</div>
          <div style={{...CARD(),marginBottom:18}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:14}}>
              <FI label="Employee Name"      value={emp.employee_name} onChange={e=>setEmp({...emp,employee_name:e.target.value})} placeholder="Full name"/>
              <FI label="Job Title"          value={emp.job_title}     onChange={e=>setEmp({...emp,job_title:e.target.value})}     placeholder="e.g. Senior Analyst"/>
              <FI label="Company / Entity Name" value={emp.company_name} onChange={e=>setEmp({...emp,company_name:e.target.value})}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:14}}>
              <FS label="Country"       value={emp.country}   onChange={e=>setEmp({...emp,country:e.target.value})}>{ALL_COUNTRIES.map(c=><option key={c}>{c}</option>)}</FS>
              <FS label="Legal Entity"  value={emp.entityId}  onChange={e=>setEmp({...emp,entityId:e.target.value})}>{settings.entities.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</FS>
              <FI label="Job Grade / Level" value={emp.grade} onChange={e=>setEmp({...emp,grade:e.target.value})} type="number" placeholder="e.g. 4"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
              <FS label="Business Unit"   value={emp.businessUnit}  onChange={e=>setEmp({...emp,businessUnit:e.target.value})}><option value="">Select…</option>{buOptions.map(b=><option key={b.id} value={b.label}>{b.label}</option>)}</FS>
              <FS label="Employment Type" value={emp.employmentType} onChange={e=>setEmp({...emp,employmentType:e.target.value})}>{etOptions.map(b=><option key={b.id} value={b.label}>{b.label}</option>)}</FS>
              <FS label="Manager Level"   value={emp.managerLevel}  onChange={e=>setEmp({...emp,managerLevel:e.target.value})}>{mlOptions.map(b=><option key={b.id} value={b.label}>{b.label}</option>)}</FS>
            </div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",flexDirection:"column"}}>
            {blockedVars.length>0 && (
              <div style={{padding:"12px 16px",background:"#FEE2E2",border:`1.5px solid ${B.red}`,borderRadius:8,fontSize:13}}>
                <div style={{fontWeight:700,color:"#b91c1c",marginBottom:4}}>Cannot generate — unresolved computed variables</div>
                <div style={{color:"#991b1b",fontSize:12}}>No rule matched for: <strong>{blockedVars.join(", ")}</strong>. Add a rule in the Rules Engine that sets {blockedVars.length===1?"this variable":"these variables"} for this employee's profile, or set a default value on the variable in the Clause Library.</div>
              </div>
            )}
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button style={BS} onClick={()=>setStep("select")}>Back</button>
              <button style={BP} onClick={onEmpNext}>Evaluate Rules</button>
            </div>
          </div>
        </div>
      )}

      {step==="variables" && (
        <div style={{maxWidth:760}}>
          <div style={{...CARD({marginBottom:18,borderLeft:`4px solid ${fired.length>0?B.teal:B.g2}`,borderRadius:"0 10px 10px 0"})}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:fired.length>0?B.teal:B.g3,marginBottom:8}}>{fired.length>0 ? `${fired.length} Rule${fired.length!==1?"s":""} Applied` : "No Rules Matched"}</div>
            {fired.length===0
              ? <div style={{fontSize:12,color:B.g3}}>Default template sections will be used.</div>
              : fired.map(r => (
                  <div key={r.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"7px 0",borderBottom:`1px solid ${B.g1}`}}>
                    <span style={{width:6,height:6,borderRadius:"50%",background:r.action.type==="set_variable"?B.blue:B.teal,flexShrink:0,marginTop:4}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:600}}>{r.name}</div>
                      <div style={{fontSize:11,color:B.g3}}>{r.description}</div>
                    </div>
                    {r.action.type==="set_variable" && r.action.variableKey && (
                      <div style={{fontSize:11,fontWeight:700,color:B.white,background:B.blue,padding:"2px 10px",borderRadius:20,flexShrink:0}}>
                        {`{{${r.action.variableKey}}}`} = {vars[r.action.variableKey] ?? r.action.variableValue}
                      </div>
                    )}
                  </div>
                ))
            }
            {/* Show any computed vars resolved via defaults (no rule fired) */}
            {[...computedVarKeys].filter(k=>!fired.some(r=>r.action.type==="set_variable"&&r.action.variableKey===k)).map(k=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:`1px solid ${B.g1}`}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:B.g3,flexShrink:0}}/>
                <div style={{flex:1,fontSize:12,color:B.g3}}>No rule matched for <code style={{fontFamily:"'Courier New',monospace"}}>{`{{${k}}}`}</code> — using default value</div>
                <div style={{fontSize:11,fontWeight:700,color:B.g3,background:B.g1,padding:"2px 10px",borderRadius:20}}>{vars[k]||"(empty)"}</div>
              </div>
            ))}
          </div>
          <div style={{...CARD(),marginBottom:18}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:B.g3,marginBottom:14}}>Complete All Fields</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              {neededVars.map(v => (
                <FI key={v.key} label={v.label} type={v.type==="date"?"date":v.type==="number"?"number":"text"} value={vars[v.key]||""} onChange={e=>setVars({...vars,[v.key]:e.target.value})} placeholder={`Enter ${v.label.toLowerCase()}`}/>
              ))}
            </div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button style={BS} onClick={()=>setStep("employee")}>Back</button>
            <button style={BP} onClick={()=>setStep("preview")}>Preview Document</button>
          </div>
        </div>
      )}

      {step==="preview" && tmpl && (
        <div style={{maxWidth:840}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
            <div>
              <div style={{fontSize:16,fontWeight:700,marginBottom:3}}>{tmpl.name}</div>
              <div style={{fontSize:12,color:B.g3}}>{emp.employee_name||"Employee"} · {emp.country} · Grade {emp.grade} · {new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</div>
            </div>
            <button style={BP} onClick={downloadDoc}>↓ Download .doc</button>
          </div>
          <div style={{...CARD({padding:"2rem",maxHeight:540,overflowY:"auto"})}}>
            <div style={{borderBottom:`3px solid ${B.red}`,paddingBottom:14,marginBottom:22}}>
              <div style={{fontSize:16,fontWeight:700}}>{tmpl.name}</div>
              <div style={{fontSize:12,color:B.g3,marginTop:3}}>{emp.employee_name||"[Employee Name]"} · {emp.company_name||"[Company]"}</div>
            </div>
            <PreviewContent sections={resolved} clauses={clauses} vars={vars} numberingFormat={tmpl.numberingFormat} headerFooter={headerFooter}/>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:14}}>
            <button style={BS} onClick={()=>setStep("variables")}>Back</button>
            <button style={BS} onClick={()=>{setStep("select");setTmpl(null);setVars({});}}>New Document</button>
            <button style={BP} onClick={downloadDoc}>↓ Download .doc</button>
          </div>
        </div>
      )}
    </div>
  );
}