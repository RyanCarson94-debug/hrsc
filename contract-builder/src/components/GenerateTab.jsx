import { useState, useMemo, useRef } from "react";
import {
  B, CARD, BP, BS, BG, TAG, FI, FS, FilterBar,
  renderClauseContent, buildSectionNumbers, templateMatches, PreviewContent,
  usePersistedFilter,
} from "./shared";
import { generateDocx, generateDocxBlob } from "./docxExport";
import { saveGeneration, logAudit } from "../api";
import { ALL_COUNTRIES } from "../defaults";
import { evalRule, resolveTemplate, computeVariables } from "../ruleEngine";

// ── Bulk Generate Modal ────────────────────────────────────────────────────────
function BulkGenerateModal({ tmpl, rules, clauses, settings, userName, headerFooter, onClose }) {
  const [step, setStep]         = useState("upload");   // upload | preview | generating | done
  const [rows, setRows]         = useState([]);
  const [errors, setErrors]     = useState([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [zipUrl, setZipUrl]     = useState(null);
  const fileRef = useRef(null);

  const CSV_COLUMNS = ["employee_name","job_title","company_name","country","grade","businessUnit","employmentType","managerLevel"];

  function parseCSV(text) {
    const lines = text.trim().split("\n").filter(l => l.trim());
    if (lines.length < 2) return { rows: [], errs: ["CSV must have a header row and at least one data row."] };
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    const parsed = [], errs = [];
    lines.slice(1).forEach((line, idx) => {
      const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const row = {};
      headers.forEach((h, i) => { row[h] = vals[i] || ""; });
      if (!row.employee_name) errs.push(`Row ${idx + 2}: missing employee_name`);
      if (!row.job_title)     errs.push(`Row ${idx + 2}: missing job_title`);
      parsed.push(row);
    });
    return { rows: parsed, errs };
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const { rows: parsed, errs } = parseCSV(ev.target.result);
      setRows(parsed);
      setErrors(errs);
    };
    reader.readAsText(file);
  }

  async function generate() {
    setStep("generating");
    setProgress({ done: 0, total: rows.length });
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    // Cache logo if present
    let cachedLogo = null;
    if (headerFooter?.logoBase64) {
      try { cachedLogo = await fetch(headerFooter.logoBase64).then(r => r.arrayBuffer()); } catch {}
    }
    const hfWithCachedLogo = cachedLogo
      ? { ...headerFooter, _cachedLogoBuffer: cachedLogo }
      : headerFooter;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const emp = {
        employee_name: row.employee_name || "",
        job_title:     row.job_title     || "",
        company_name:  row.company_name  || (settings.entities[0]?.name || ""),
        country:       row.country       || (tmpl.country !== "__global__" ? tmpl.country : "United Kingdom"),
        entityId:      tmpl.entityId     !== "__global__" ? tmpl.entityId : (settings.entities[0]?.id || ""),
        grade:         row.grade         || "1",
        businessUnit:  row.businessUnit  || "",
        employmentType:row.employmentType|| "Full-time",
        managerLevel:  row.managerLevel  || "Individual Contributor",
      };
      const res = resolveTemplate(tmpl, rules, emp);
      const { computedVars } = computeVariables(rules, res, clauses, emp);
      const vars = {
        employee_name: emp.employee_name,
        company_name:  emp.company_name,
        job_title:     emp.job_title,
        business_unit: emp.businessUnit,
        country:       emp.country,
        ...computedVars,
      };
      res.forEach(s => {
        const ct = s.clauseId ? (clauses.find(c => c.id === s.clauseId)?.content || "") : (s.content || "");
        (ct.match(/\{\{(\w+)\}\}/g) || []).forEach(m => { const k = m.slice(2, -2); if (vars[k] === undefined) vars[k] = ""; });
      });
      try {
        const blob = await generateDocxBlob({
          tmpl, resolved: res, clauses, vars,
          headerFooter: hfWithCachedLogo, emp,
          numberingFormat: tmpl.numberingFormat || "flat",
        });
        const fname = `${emp.employee_name.replace(/\s+/g, "_") || "employee_" + (i + 1)}.docx`;
        zip.file(fname, blob);
        saveGeneration({
          id: Math.random().toString(36).slice(2, 10),
          templateName: tmpl.name,
          employeeName: emp.employee_name,
          country: emp.country,
          userName: userName || "Unknown",
          generatedAt: new Date().toISOString(),
          snapshot: JSON.stringify({ tmpl, resolved: res, clauses, vars, headerFooter, emp, numberingFormat: tmpl.numberingFormat || "flat", firedRules: [] }),
        }).catch(() => {});
      } catch (e) {
        console.warn("Error generating doc for row", i, e);
      }
      setProgress({ done: i + 1, total: rows.length });
      await new Promise(r => setTimeout(r, 0)); // let browser breathe
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    setZipUrl(url);
    setStep("done");
  }

  const overlay = { position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center" };
  const modal   = { background:B.white,borderRadius:12,padding:"2rem",maxWidth:580,width:"100%",maxHeight:"80vh",overflowY:"auto",margin:"0 1rem" };

  return (
    <div style={overlay} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:15,fontWeight:700}}>Bulk Generate — {tmpl.name}</div>
          <button style={{...BG(B.g3),fontSize:20}} onClick={onClose}>×</button>
        </div>

        {step === "upload" && (
          <>
            <div style={{padding:"12px 14px",background:B.g1,borderRadius:8,marginBottom:16,fontSize:12,color:B.g3}}>
              Upload a CSV with columns:<br/>
              <code style={{fontSize:10,color:B.black}}>{CSV_COLUMNS.join(", ")}</code><br/>
              <code>employee_name</code> and <code>job_title</code> are required.
            </div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} style={{display:"block",marginBottom:12,fontSize:12}}/>
            {errors.length > 0 && (
              <div style={{padding:"10px 14px",background:"#FEE2E2",borderRadius:8,fontSize:12,color:"#b91c1c",marginBottom:12}}>
                {errors.map((e,i) => <div key={i}>{e}</div>)}
              </div>
            )}
            {rows.length > 0 && errors.length === 0 && (
              <div style={{padding:"10px 14px",background:"#DCFCE7",borderRadius:8,fontSize:12,color:"#166534",marginBottom:12}}>
                ✓ {rows.length} employee{rows.length !== 1 ? "s" : ""} ready to generate
              </div>
            )}
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button style={BS} onClick={onClose}>Cancel</button>
              <button style={{...BP,opacity:rows.length===0||errors.length>0?0.4:1}} disabled={rows.length===0||errors.length>0} onClick={()=>setStep("preview")}>Preview →</button>
            </div>
          </>
        )}

        {step === "preview" && (
          <>
            <div style={{marginBottom:14,fontSize:12,color:B.g3}}>{rows.length} documents will be generated and downloaded as a .zip file.</div>
            <div style={{maxHeight:260,overflowY:"auto",marginBottom:16}}>
              {rows.map((r, i) => (
                <div key={i} style={{...CARD({marginBottom:6,padding:"8px 12px",display:"flex",gap:12,alignItems:"center"})}}>
                  <span style={{fontSize:11,fontWeight:700,flex:1}}>{r.employee_name || "(unnamed)"}</span>
                  <span style={{fontSize:11,color:B.g3}}>{r.job_title}</span>
                  <span style={TAG()}>{r.country || "—"}</span>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button style={BS} onClick={()=>setStep("upload")}>Back</button>
              <button style={BP} onClick={generate}>Generate {rows.length} Documents →</button>
            </div>
          </>
        )}

        {step === "generating" && (
          <div style={{textAlign:"center",padding:"2rem 0"}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:14}}>Generating documents…</div>
            <div style={{background:B.g2,borderRadius:8,height:12,overflow:"hidden",marginBottom:10}}>
              <div style={{height:"100%",background:B.teal,borderRadius:8,width:`${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,transition:"width 0.2s"}}/>
            </div>
            <div style={{fontSize:12,color:B.g3}}>{progress.done} / {progress.total}</div>
          </div>
        )}

        {step === "done" && (
          <div style={{textAlign:"center",padding:"1rem 0"}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:8,color:B.teal}}>✓ All documents generated</div>
            <div style={{fontSize:12,color:B.g3,marginBottom:20}}>{rows.length} .docx files packed into a .zip</div>
            <a href={zipUrl} download={`${tmpl.name.replace(/\s+/g,"_")}_bulk.zip`} style={{...BP,textDecoration:"none",display:"inline-block",marginBottom:12}}>↓ Download .zip</a>
            <br/>
            <button style={BS} onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main GenerateTab ───────────────────────────────────────────────────────────
export default function GenerateTab({ state, userName }) {
  const { settings, clauses, templates, rules } = state;
  const [cf, setCf] = usePersistedFilter("hrsc_gen_cf");
  const [ef, setEf] = usePersistedFilter("hrsc_gen_ef");
  const [tmplSearch, setTmplSearch] = useState("");
  const [step, setStep]   = useState("select");
  const [tmpl, setTmpl]   = useState(null);
  const [emp, setEmp]     = useState({ country:"United Kingdom", entityId:"e1", grade:"4", businessUnit:"", employmentType:"Full-time", managerLevel:"Individual Contributor", employee_name:"", job_title:"", company_name:"" });
  const [vars, setVars]   = useState({});
  const [fired, setFired] = useState([]);
  const [resolved, setResolved] = useState([]);
  const [blockedVars, setBlockedVars] = useState([]);
  const [disabledRules, setDisabledRules] = useState(new Set());
  const [validationError, setValidationError] = useState("");
  const [downloadMsg, setDownloadMsg]         = useState("");
  const [showBulk, setShowBulk] = useState(false);

  const filteredTemplates = templates.filter(t => {
    if (!templateMatches(t, cf, ef)) return false;
    if (tmplSearch && !t.name.toLowerCase().includes(tmplSearch.toLowerCase())) return false;
    return true;
  });
  const contracts  = filteredTemplates.filter(t => t.documentType === "contract");
  const addendums  = filteredTemplates.filter(t => t.documentType === "addendum");
  const buOptions  = settings.dropdowns.businessUnits.filter(b => b.global || b.entityIds.includes(emp.entityId));
  const etOptions  = settings.dropdowns.employmentTypes.filter(b => b.global || b.entityIds.includes(emp.entityId));
  const mlOptions  = settings.dropdowns.managerLevels.filter(b => b.global || b.entityIds.includes(emp.entityId));

  const headerFooter = useMemo(() => {
    if (!tmpl) return null;
    if (tmpl.headerFooter) return tmpl.headerFooter;
    const entityId = tmpl.entityId && tmpl.entityId !== "__global__" ? tmpl.entityId : emp.entityId;
    return settings.headerFooters?.[entityId] || null;
  }, [tmpl, emp.entityId, settings.headerFooters]);

  function onSelect(t) {
    setTmpl(t);
    const entity = settings.entities.find(e => e.id === t.entityId);
    setEmp(e => ({ ...e, country: t.country !== "__global__" ? t.country : e.country, entityId: t.entityId !== "__global__" ? t.entityId : e.entityId, company_name: entity?.name || e.company_name }));
    setStep("employee");
  }

  function onEmpNext() {
    if (!emp.employee_name.trim()) { setValidationError("Employee Name is required."); return; }
    if (!emp.job_title.trim())     { setValidationError("Job Title is required."); return; }
    setValidationError("");

    const fr  = rules.filter(r => evalRule(r, emp));
    const res = resolveTemplate(tmpl, rules, emp);
    setFired(fr);
    setResolved(res);
    setDisabledRules(new Set());

    const { computedVars, unresolved } = computeVariables(rules, res, clauses, emp);
    if (unresolved.length > 0) { setBlockedVars(unresolved); return; }
    setBlockedVars([]);

    const av = {
      employee_name: emp.employee_name, company_name: emp.company_name,
      job_title: emp.job_title, business_unit: emp.businessUnit, country: emp.country,
      ...computedVars,
    };
    res.forEach(s => {
      const ct = s.clauseId ? (clauses.find(c => c.id === s.clauseId)?.content || "") : (s.content || "");
      (ct.match(/\{\{(\w+)\}\}/g) || []).forEach(m => { const k = m.slice(2, -2); if (av[k] === undefined) av[k] = ""; });
    });
    setVars(av);
    setStep("variables");
  }

  // Derive effective resolved sections based on which rules are disabled
  const effectiveResolved = useMemo(() => {
    if (!tmpl || disabledRules.size === 0) return resolved;
    return resolveTemplate(tmpl, rules, emp, disabledRules);
  }, [tmpl, rules, emp, resolved, disabledRules]);

  const computedVarKeys = useMemo(() => {
    const keys = new Set();
    effectiveResolved.forEach(s => {
      const cl = s.clauseId ? clauses.find(c => c.id === s.clauseId) : null;
      if (cl) cl.variables.filter(v => v.type === "computed").forEach(v => keys.add(v.key));
    });
    return keys;
  }, [effectiveResolved, clauses]);

  const neededVars = useMemo(() => {
    const r = [], seen = new Set();
    effectiveResolved.forEach(s => {
      const cl = s.clauseId ? clauses.find(c => c.id === s.clauseId) : null;
      const t  = cl?.content || s.content || "";
      (t.match(/\{\{(\w+)\}\}/g) || []).forEach(m => {
        const k = m.slice(2, -2);
        if (!seen.has(k) && !computedVarKeys.has(k)) {
          seen.add(k);
          const v = cl?.variables.find(v => v.key === k);
          r.push({ key: k, label: v?.label || k.replace(/_/g, " "), type: v?.type || "text" });
        }
      });
    });
    return r;
  }, [effectiveResolved, clauses, computedVarKeys]);

  function toggleDisabledRule(ruleId) {
    setDisabledRules(prev => {
      const next = new Set(prev);
      if (next.has(ruleId)) next.delete(ruleId); else next.add(ruleId);
      return next;
    });
  }

  async function downloadDoc() {
    await generateDocx({
      tmpl, resolved: effectiveResolved, clauses, vars, headerFooter, emp,
      numberingFormat: tmpl?.numberingFormat || "flat",
    });
    const userName_ = userName || localStorage.getItem("hrsc_user_name") || "Unknown";
    saveGeneration({
      id: Math.random().toString(36).slice(2, 10),
      templateName: tmpl.name,
      employeeName: emp.employee_name || "",
      country: emp.country,
      userName: userName_,
      generatedAt: new Date().toISOString(),
      snapshot: JSON.stringify({
        tmpl, resolved: effectiveResolved, clauses, vars, headerFooter, emp,
        numberingFormat: tmpl?.numberingFormat || "flat",
        firedRules: fired,
        disabledRules: [...disabledRules],
      }),
    }).catch(() => {});
    logAudit({
      action: "generate", recordType: "document", recordName: tmpl.name,
      detail: { employee: emp.employee_name, country: emp.country },
      userName: userName_, timestamp: new Date().toISOString(),
    }).catch(() => {});
    setDownloadMsg("✓ Downloaded and saved to Document History");
    setTimeout(() => setDownloadMsg(""), 4000);
  }

  const STEPS   = ["select", "employee", "variables", "preview"];
  const SLABELS = ["Template", "Employee", "Variables", "Preview"];
  const curIdx  = STEPS.indexOf(step);

  return (
    <div>
      {showBulk && tmpl && (
        <BulkGenerateModal
          tmpl={tmpl} rules={rules} clauses={clauses}
          settings={settings} userName={userName}
          headerFooter={headerFooter}
          onClose={() => setShowBulk(false)}
        />
      )}

      <FilterBar countries={ALL_COUNTRIES} entities={settings.entities} countryFilter={cf} setCountryFilter={setCf} entityFilter={ef} setEntityFilter={setEf}/>

      {/* Step progress */}
      <div style={{ display:"flex", alignItems:"center", gap:0, marginBottom:28, background:B.g2, borderRadius:8, padding:4, width:"fit-content" }}>
        {STEPS.map((s, i) => {
          const active = step === s, done = curIdx > i;
          return (
            <div key={s} style={{ display:"flex", alignItems:"center" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 16px", borderRadius:6, background:active ? B.white : "transparent", boxShadow:active ? "0 1px 6px rgba(0,0,0,0.1)" : "none" }}>
                <span style={{ width:18, height:18, borderRadius:"50%", background:done ? B.teal : active ? B.red : B.g3, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:B.white, flexShrink:0 }}>{done ? "✓" : i + 1}</span>
                <span style={{ fontSize:11, fontWeight:active ? 700 : 500, color:active ? B.black : B.g3, whiteSpace:"nowrap" }}>{SLABELS[i]}</span>
              </div>
              {i < 3 && <div style={{ width:12, height:1, background:B.g3, opacity:.3 }}/>}
            </div>
          );
        })}
      </div>

      {step === "select" && (
        <div>
          {/* Template search */}
          <div style={{ display:"flex", gap:10, marginBottom:18, alignItems:"center" }}>
            <input
              style={{ flex:1, padding:"9px 12px", border:`1.5px solid ${B.g2}`, borderRadius:6, fontSize:13, fontFamily:"'Montserrat',sans-serif", color:B.black, outline:"none", background:B.white, maxWidth:360 }}
              value={tmplSearch}
              onChange={e => setTmplSearch(e.target.value)}
              placeholder="Search templates…"
            />
            {tmplSearch && <button style={{ ...BG(B.red) }} onClick={() => setTmplSearch("")}>Clear</button>}
          </div>

          {contracts.length === 0 && addendums.length === 0 && (
            <div style={{ ...CARD({ textAlign:"center", padding:"2.5rem", color:B.g3 }) }}>No templates match your filters.</div>
          )}
          {contracts.length > 0 && <>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:B.g3, marginBottom:10 }}>Employment Contracts</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))", gap:12, marginBottom:24 }}>
              {contracts.map(t => {
                const ent = settings.entities.find(e => e.id === t.entityId);
                return (
                  <div key={t.id} onClick={() => onSelect(t)} style={{ ...CARD({ cursor:"pointer", transition:"all 0.15s", overflow:"hidden", position:"relative" }) }} onMouseEnter={e => { e.currentTarget.style.borderColor = B.red; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(252,25,33,0.08)"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = B.g2; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
                    <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:B.red, borderRadius:"10px 10px 0 0" }}/>
                    <div style={{ paddingTop:6 }}>
                      <div style={{ fontSize:13, fontWeight:700, marginBottom:5, lineHeight:1.3 }}>{t.name}</div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                        <span style={TAG()}>{t.country === "__global__" ? "Global" : t.country}</span>
                        {ent && <span style={TAG(B.g1, "#0E56A5")}>{ent.shortCode}</span>}
                      </div>
                      <div style={{ fontSize:12, color:B.g3, lineHeight:1.5, marginBottom:12 }}>{t.description}</div>
                      <div style={{ display:"flex", justifyContent:"space-between", paddingTop:10, borderTop:`1px solid ${B.g1}` }}>
                        <span style={{ fontSize:10, fontWeight:600, color:B.g3 }}>{t.sections.length} sections</span>
                        <span style={{ fontSize:11, fontWeight:700, color:B.red }}>Select →</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>}
          {addendums.length > 0 && <>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:B.g3, marginBottom:10 }}>Addendum Letters</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))", gap:12 }}>
              {addendums.map(t => {
                const ent = settings.entities.find(e => e.id === t.entityId);
                return (
                  <div key={t.id} onClick={() => onSelect(t)} style={{ ...CARD({ cursor:"pointer", transition:"all 0.15s" }) }} onMouseEnter={e => { e.currentTarget.style.borderColor = B.red; e.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = B.g2; e.currentTarget.style.transform = "none"; }}>
                    <div style={{ fontSize:13, fontWeight:700, marginBottom:5 }}>{t.name}</div>
                    <div style={{ display:"flex", gap:6, marginBottom:10 }}><span style={TAG()}>{t.country === "__global__" ? "Global" : t.country}</span>{ent && <span style={TAG(B.g1, "#0E56A5")}>{ent.shortCode}</span>}</div>
                    <div style={{ fontSize:12, color:B.g3, marginBottom:12 }}>{t.description}</div>
                    <div style={{ display:"flex", justifyContent:"space-between", paddingTop:10, borderTop:`1px solid ${B.g1}` }}><span style={{ fontSize:10, fontWeight:600, color:B.g3 }}>{t.sections.length} sections</span><span style={{ fontSize:11, fontWeight:700, color:B.red }}>Select →</span></div>
                  </div>
                );
              })}
            </div>
          </>}
        </div>
      )}

      {step === "employee" && tmpl && (
        <div style={{ maxWidth:760 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
            <div>
              <div style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>{tmpl.name}</div>
              <div style={{ fontSize:12, color:B.g3 }}>Enter the employee's details to evaluate which clauses apply.</div>
            </div>
            <button style={{ ...BS, padding:"6px 14px", fontSize:11 }} onClick={() => setShowBulk(true)}>⬛ Bulk Generate</button>
          </div>
          <div style={{ ...CARD(), marginBottom:18 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:14 }}>
              <FI label="Employee Name"      value={emp.employee_name} onChange={e => setEmp({ ...emp, employee_name:e.target.value })} placeholder="Full name"/>
              <FI label="Job Title"          value={emp.job_title}     onChange={e => setEmp({ ...emp, job_title:e.target.value })}     placeholder="e.g. Senior Analyst"/>
              <FI label="Company / Entity Name" value={emp.company_name} onChange={e => setEmp({ ...emp, company_name:e.target.value })}/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:14 }}>
              <FS label="Country"       value={emp.country}   onChange={e => setEmp({ ...emp, country:e.target.value })}>{ALL_COUNTRIES.map(c => <option key={c}>{c}</option>)}</FS>
              <FS label="Legal Entity"  value={emp.entityId}  onChange={e => setEmp({ ...emp, entityId:e.target.value })}>{settings.entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</FS>
              <FI label="Job Grade / Level" value={emp.grade} onChange={e => setEmp({ ...emp, grade:e.target.value })} type="number" placeholder="e.g. 4"/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 }}>
              <FS label="Business Unit"   value={emp.businessUnit}   onChange={e => setEmp({ ...emp, businessUnit:e.target.value })}><option value="">Select…</option>{buOptions.map(b => <option key={b.id} value={b.label}>{b.label}</option>)}</FS>
              <FS label="Employment Type" value={emp.employmentType} onChange={e => setEmp({ ...emp, employmentType:e.target.value })}>{etOptions.map(b => <option key={b.id} value={b.label}>{b.label}</option>)}</FS>
              <FS label="Manager Level"   value={emp.managerLevel}   onChange={e => setEmp({ ...emp, managerLevel:e.target.value })}>{mlOptions.map(b => <option key={b.id} value={b.label}>{b.label}</option>)}</FS>
            </div>
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", flexDirection:"column" }}>
            {validationError && (
              <div style={{ padding:"10px 14px", background:"#FEE2E2", border:`1.5px solid ${B.red}`, borderRadius:8, fontSize:12, color:"#b91c1c" }}>{validationError}</div>
            )}
            {blockedVars.length > 0 && (
              <div style={{ padding:"12px 16px", background:"#FEE2E2", border:`1.5px solid ${B.red}`, borderRadius:8, fontSize:13 }}>
                <div style={{ fontWeight:700, color:"#b91c1c", marginBottom:4 }}>Cannot generate — unresolved computed variables</div>
                <div style={{ color:"#991b1b", fontSize:12 }}>No rule matched for: <strong>{blockedVars.join(", ")}</strong>. Add a rule in the Rules Engine or set a default value on the variable.</div>
              </div>
            )}
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button style={BS} onClick={() => setStep("select")}>Back</button>
              <button style={BP} onClick={onEmpNext}>Evaluate Rules</button>
            </div>
          </div>
        </div>
      )}

      {step === "variables" && (
        <div style={{ maxWidth:760 }}>
          <div style={{ ...CARD({ marginBottom:18, borderLeft:`4px solid ${fired.length > 0 ? B.teal : B.g2}`, borderRadius:"0 10px 10px 0" }) }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:fired.length > 0 ? B.teal : B.g3, marginBottom:8 }}>
              {fired.length > 0 ? `${fired.length} Rule${fired.length !== 1 ? "s" : ""} Matched` : "No Rules Matched"}
            </div>
            {fired.length === 0
              ? <div style={{ fontSize:12, color:B.g3 }}>Default template sections will be used.</div>
              : fired.map(r => {
                  const isDisabled = disabledRules.has(r.id);
                  const isSetVar   = r.action.type === "set_variable";
                  return (
                    <div key={r.id} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"8px 0", borderBottom:`1px solid ${B.g1}`, opacity:isDisabled ? 0.5 : 1 }}>
                      {!isSetVar && (
                        <input
                          type="checkbox"
                          checked={!isDisabled}
                          onChange={() => toggleDisabledRule(r.id)}
                          title="Apply this rule"
                          style={{ accentColor:B.teal, marginTop:3, flexShrink:0 }}
                        />
                      )}
                      {isSetVar && <span style={{ width:14, flexShrink:0 }}/>}
                      <span style={{ width:6, height:6, borderRadius:"50%", background:isSetVar ? B.blue : B.teal, flexShrink:0, marginTop:5 }}/>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:600 }}>{r.name}</div>
                        <div style={{ fontSize:11, color:B.g3 }}>{r.description}</div>
                      </div>
                      {isDisabled && <span style={{ fontSize:10, fontWeight:700, background:B.yellow, color:"#7A5E00", padding:"2px 8px", borderRadius:20, flexShrink:0 }}>Manual override</span>}
                      {isSetVar && r.action.variableKey && !isDisabled && (
                        <div style={{ fontSize:11, fontWeight:700, color:B.white, background:B.blue, padding:"2px 10px", borderRadius:20, flexShrink:0 }}>
                          {`{{${r.action.variableKey}}}`} = {vars[r.action.variableKey] ?? r.action.variableValue}
                        </div>
                      )}
                    </div>
                  );
                })
            }
          </div>

          <div style={{ ...CARD(), marginBottom:18 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:B.g3, marginBottom:14 }}>Complete All Fields</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              {neededVars.map(v => (
                <FI key={v.key} label={v.label} type={v.type === "date" ? "date" : v.type === "number" ? "number" : "text"} value={vars[v.key] || ""} onChange={e => setVars({ ...vars, [v.key]:e.target.value })} placeholder={`Enter ${v.label.toLowerCase()}`}/>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button style={BS} onClick={() => setStep("employee")}>Back</button>
            <button style={BP} onClick={() => setStep("preview")}>Preview Document</button>
          </div>
        </div>
      )}

      {step === "preview" && tmpl && (
        <div style={{ maxWidth:840 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18 }}>
            <div>
              <div style={{ fontSize:16, fontWeight:700, marginBottom:3 }}>{tmpl.name}</div>
              <div style={{ fontSize:12, color:B.g3 }}>{emp.employee_name || "Employee"} · {emp.country} · Grade {emp.grade} · {new Date().toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" })}</div>
            </div>
            <button style={BP} onClick={downloadDoc}>↓ Download .docx</button>
          </div>
          {downloadMsg && (
            <div style={{ marginBottom:14, padding:"10px 16px", background:"#DCFCE7", border:`1.5px solid #86EFAC`, borderRadius:8, fontSize:12, color:"#166534", fontWeight:600 }}>
              {downloadMsg}
            </div>
          )}
          <div style={{ ...CARD({ padding:"2rem", maxHeight:540, overflowY:"auto" }) }}>
            <div style={{ borderBottom:`3px solid ${B.red}`, paddingBottom:14, marginBottom:22 }}>
              <div style={{ fontSize:16, fontWeight:700 }}>{tmpl.name}</div>
              <div style={{ fontSize:12, color:B.g3, marginTop:3 }}>{emp.employee_name || "[Employee Name]"} · {emp.company_name || "[Company]"}</div>
            </div>
            <PreviewContent sections={effectiveResolved} clauses={clauses} vars={vars} numberingFormat={tmpl.numberingFormat} headerFooter={headerFooter}/>
          </div>
          {downloadMsg && (
            <div style={{ marginTop:14, padding:"10px 16px", background:"#DCFCE7", border:"1.5px solid #00A28A", borderRadius:8, fontSize:13, color:"#166534", fontWeight:600 }}>
              {downloadMsg}
            </div>
          )}
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:14 }}>
            <button style={BS} onClick={() => setStep("variables")}>Back</button>
            <button style={BS} onClick={() => { setStep("select"); setTmpl(null); setVars({}); setDownloadMsg(""); }}>New Document</button>
            <button style={BP} onClick={downloadDoc}>↓ Download .docx</button>
          </div>
        </div>
      )}
    </div>
  );
}
