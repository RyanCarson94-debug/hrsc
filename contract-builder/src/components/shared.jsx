import { useState } from "react";

export const B = {
  red:"#FC1921", black:"#231F20", white:"#FFFFFF",
  g1:"#F1EFEA", g2:"#E2DFDA", g3:"#808284",
  teal:"#00A28A", blue:"#0E56A5", yellow:"#F5C017",
};

export const SEL_ARROW = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23808284' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`;

export const mkInp = (focused) => ({
  width:"100%", boxSizing:"border-box", padding:"9px 12px",
  background:B.white, border:`1.5px solid ${focused ? B.red : B.g2}`,
  borderRadius:6, fontSize:13, fontFamily:"'Montserrat',sans-serif",
  fontWeight:400, color:B.black, outline:"none", transition:"border-color 0.15s",
});

export const LBL = { fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:B.g3, display:"block", marginBottom:5 };
export const CARD = (x={}) => ({ background:B.white, border:`1.5px solid ${B.g2}`, borderRadius:10, padding:"1.25rem", ...x });
export const BP = { padding:"9px 20px", background:B.red, color:B.white, border:"none", borderRadius:6, fontSize:12, fontWeight:700, fontFamily:"'Montserrat',sans-serif", cursor:"pointer", letterSpacing:"0.03em" };
export const BS = { padding:"9px 20px", background:"transparent", color:B.black, border:`1.5px solid ${B.g2}`, borderRadius:6, fontSize:12, fontWeight:600, fontFamily:"'Montserrat',sans-serif", cursor:"pointer" };
export const BG = (c=B.g3) => ({ padding:"7px 14px", background:"transparent", color:c, border:"none", borderRadius:6, fontSize:12, fontWeight:500, fontFamily:"'Montserrat',sans-serif", cursor:"pointer" });
export const TAG = (bg=B.g1, tc=B.g3) => ({ display:"inline-block", padding:"2px 9px", background:bg, color:tc, borderRadius:20, fontSize:10, fontWeight:600, letterSpacing:"0.04em" });

export function gid() { return Math.random().toString(36).slice(2,8); }

export function FI({ label, value, onChange, type="text", placeholder="", as="input", min, rows=4 }) {
  const [f, setF] = useState(false);
  const s = mkInp(f);
  return (
    <div>
      <label style={LBL}>{label}</label>
      {as === "textarea"
        ? <textarea style={{...s, minHeight:rows*22, resize:"vertical", lineHeight:1.6}} value={value} onChange={onChange} placeholder={placeholder} onFocus={()=>setF(true)} onBlur={()=>setF(false)}/>
        : <input type={type} min={min} style={s} value={value} onChange={onChange} placeholder={placeholder} onFocus={()=>setF(true)} onBlur={()=>setF(false)}/>
      }
    </div>
  );
}

export function FS({ label, value, onChange, children, disabled=false }) {
  const [f, setF] = useState(false);
  return (
    <div>
      <label style={LBL}>{label}</label>
      <select disabled={disabled} style={{...mkInp(f), appearance:"none", backgroundImage:SEL_ARROW, backgroundRepeat:"no-repeat", backgroundPosition:"right 10px center", opacity:disabled?0.5:1}} value={value} onChange={onChange} onFocus={()=>setF(true)} onBlur={()=>setF(false)}>
        {children}
      </select>
    </div>
  );
}

export function FilterBar({ countries, entities, countryFilter, setCountryFilter, entityFilter, setEntityFilter }) {
  const [fc, setFc] = useState(false), [fe, setFe] = useState(false);
  return (
    <div style={{display:"flex", gap:12, marginBottom:24, padding:"12px 14px", background:B.white, border:`1.5px solid ${B.g2}`, borderRadius:8, alignItems:"flex-end"}}>
      <div style={{flex:1}}>
        <label style={LBL}>Filter by Country</label>
        <select style={{...mkInp(fc), appearance:"none", backgroundImage:SEL_ARROW, backgroundRepeat:"no-repeat", backgroundPosition:"right 10px center"}} value={countryFilter} onChange={e=>setCountryFilter(e.target.value)} onFocus={()=>setFc(true)} onBlur={()=>setFc(false)}>
          <option value="">All Countries</option>
          {countries.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div style={{flex:1}}>
        <label style={LBL}>Filter by Legal Entity</label>
        <select style={{...mkInp(fe), appearance:"none", backgroundImage:SEL_ARROW, backgroundRepeat:"no-repeat", backgroundPosition:"right 10px center"}} value={entityFilter} onChange={e=>setEntityFilter(e.target.value)} onFocus={()=>setFe(true)} onBlur={()=>setFe(false)}>
          <option value="">All Entities</option>
          {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>
      {(countryFilter || entityFilter) && (
        <button style={{...BG(B.red), paddingBottom:10}} onClick={()=>{setCountryFilter(""); setEntityFilter("");}}>Clear</button>
      )}
    </div>
  );
}

// ── Numbering helpers ──────────────────────────────────────────────────────────
const ROMAN_MAP = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
export function toRoman(n) { let r=""; ROMAN_MAP.forEach(([v,s])=>{while(n>=v){r+=s;n-=v;}}); return r; }
export function toAlpha(n, upper=false) { let r="",x=n; while(x>0){r=String.fromCharCode(64+(x%26||26))+r; x=Math.floor((x-1)/26);} return upper?r:r.toLowerCase(); }

export function renderClauseContent(text, vars={}) {
  let resolved = text.replace(/\{\{(\w+)\}\}/g, (_,k) => vars[k] || `[${k}]`);
  resolved = resolved.replace(/@(num|alpha|ALPHA|roman|ROMAN)\{([^}]+)\}/g, (_, type, inner) => {
    const items = inner.split("\n").map(s=>s.trim()).filter(Boolean);
    return items.map((item,i) => {
      const n=i+1;
      const prefix = type==="num" ? `${n}.` : type==="alpha" ? `${toAlpha(n)}.` : type==="ALPHA" ? `${toAlpha(n,true)}.` : type==="roman" ? `${toRoman(n).toLowerCase()}.` : `${toRoman(n)}.`;
      return `    ${prefix} ${item}`;
    }).join("\n");
  });
  return resolved;
}

export function buildSectionNumbers(sections, format) {
  if (format === "none") return sections.map(()=>"");
  let counter=0, subCounters={};
  return sections.map(s => {
    if (s.level===2 && format==="hierarchical") {
      subCounters[counter] = (subCounters[counter]||0)+1;
      return `${counter}.${subCounters[counter]}`;
    } else {
      counter++; subCounters[counter]=0;
      return `${counter}.`;
    }
  });
}

export function clauseAvailable(clause, country, entityId) {
  if (clause.global) return true;
  const cOk = !country || country==="__global__" || clause.countries.includes(country);
  const eOk = !entityId || entityId==="__global__" || clause.entityIds.includes(entityId);
  return cOk && eOk;
}

export function templateMatches(t, countryFilter, entityFilter) {
  if (t.country==="__global__" || t.entityId==="__global__") return true;
  const cOk = !countryFilter || t.country===countryFilter;
  const eOk = !entityFilter  || t.entityId===entityFilter;
  return cOk && eOk;
}

// ── Clause content editor with toolbar ────────────────────────────────────────
export function ClauseEditor({ label, value, onChange }) {
  const [f, setF] = useState(false);
  const EDITOR_ID = "clause-editor-ta";
  const BTNS = [
    {label:"1. 2. 3.",     code:"@num{\nItem one\nItem two\nItem three\n}"},
    {label:"a. b. c.",     code:"@alpha{\nItem one\nItem two\nItem three\n}"},
    {label:"A. B. C.",     code:"@ALPHA{\nItem one\nItem two\nItem three\n}"},
    {label:"i. ii. iii.",  code:"@roman{\nItem one\nItem two\nItem three\n}"},
    {label:"I. II. III.",  code:"@ROMAN{\nItem one\nItem two\nItem three\n}"},
    {label:"{{var}}",      code:"{{variable_name}}"},
  ];
  function insertAtCursor(code) {
    const ta = document.getElementById(EDITOR_ID);
    if (!ta) { onChange({ target:{value: value+"\n"+code} }); return; }
    const start=ta.selectionStart, end=ta.selectionEnd;
    onChange({ target:{value: value.slice(0,start)+"\n"+code+"\n"+value.slice(end)} });
    setTimeout(()=>{ ta.focus(); ta.selectionStart=ta.selectionEnd=start+code.length+2; }, 10);
  }
  return (
    <div>
      <label style={LBL}>{label}</label>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",padding:"8px 10px",background:B.g1,borderRadius:"6px 6px 0 0",border:`1.5px solid ${B.g2}`,borderBottom:"none"}}>
        {BTNS.map(b => (
          <button key={b.label} onClick={()=>insertAtCursor(b.code)} style={{...BS,padding:"4px 10px",fontSize:11,fontWeight:700,color:B.black,background:B.white,borderColor:B.g2}}>
            {b.label}
          </button>
        ))}
        <span style={{fontSize:10,color:B.g3,alignSelf:"center",marginLeft:4,fontStyle:"italic"}}>Insert at cursor — list items on separate lines</span>
      </div>
      <textarea id={EDITOR_ID} style={{...mkInp(f),minHeight:140,resize:"vertical",lineHeight:1.65,borderRadius:"0 0 6px 6px"}} value={value} onChange={onChange} onFocus={()=>setF(true)} onBlur={()=>setF(false)}/>
    </div>
  );
}

// ── Preview renderer ───────────────────────────────────────────────────────────
export function PreviewContent({ sections, clauses, vars, numberingFormat }) {
  const nums = buildSectionNumbers(sections, numberingFormat);
  return (
    <div>
      {sections.map((s,i) => {
        const txt = s.clauseId ? (clauses.find(c=>c.id===s.clauseId)?.content||"") : (s.content||"");
        const rendered = renderClauseContent(txt, vars);
        const prefix = nums[i] ? `${nums[i]} ` : "";
        return (
          <div key={s.id} style={{marginBottom:26}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:B.g3,marginBottom:6}}>{prefix}{s.name}</div>
            <div style={{fontSize:13,lineHeight:1.85,whiteSpace:"pre-wrap",color:B.black}}>{rendered}</div>
            {i<sections.length-1 && <div style={{borderBottom:`1px solid ${B.g1}`,marginTop:22}}/>}
          </div>
        );
      })}
    </div>
  );
}
