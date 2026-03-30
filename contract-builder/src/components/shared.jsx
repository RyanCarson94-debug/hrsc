import { useState, useRef, useEffect, useCallback } from "react";

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

/**
 * Persistent filter state — reads initial value from localStorage,
 * writes on every change. Use in place of useState for country/entity filters.
 */
export function usePersistedFilter(storageKey) {
  const [val, setVal] = useState(() => {
    try { return localStorage.getItem(storageKey) || ""; } catch { return ""; }
  });
  const set = useCallback((v) => {
    setVal(v);
    try { localStorage.setItem(storageKey, v); } catch {}
  }, [storageKey]);
  return [val, set];
}

/**
 * Compress an image file to JPEG via canvas.
 * Returns a data-URL string. Falls back to FileReader for SVGs.
 */
export function compressImage(file, maxW = 400, maxH = 200, quality = 0.82) {
  return new Promise((resolve) => {
    if (file.type === "image/svg+xml") {
      const reader = new FileReader();
      reader.onload = ev => resolve(ev.target.result);
      reader.readAsDataURL(file);
      return;
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let w = img.width, h = img.height;
      const ratio = Math.min(maxW / w, maxH / h, 1);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = ev => resolve(ev.target.result);
      reader.readAsDataURL(file);
    };
    img.src = objectUrl;
  });
}

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

// Render clause content to plain text (for textarea storage / .doc export)
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

// Render clause content to React JSX (for in-app preview — handles formatting markers)
export function renderClauseContentRich(text, vars={}) {
  if (!text) return null;
  // HTML path: if content starts with an HTML tag, render as HTML with variable substitution
  if (text.trim().startsWith("<")) {
    let html = text.replace(/\{\{(\w+)\}\}/g, (_, k) =>
      `<span style="color:#FC1921;font-weight:600">${vars[k] || `[${k}]`}</span>`
    );
    return <div dangerouslySetInnerHTML={{ __html: html }} style={{ lineHeight:1.85 }}/>;
  }
  // Legacy markdown path
  let resolved = text.replace(/\{\{(\w+)\}\}/g, (_,k) => vars[k] || `[${k}]`);
  // numbered lists
  resolved = resolved.replace(/@(num|alpha|ALPHA|roman|ROMAN)\{([^}]+)\}/g, (_, type, inner) => {
    const items = inner.split("\n").map(s=>s.trim()).filter(Boolean);
    return items.map((item,i) => {
      const n=i+1;
      const prefix = type==="num" ? `${n}.` : type==="alpha" ? `${toAlpha(n)}.` : type==="ALPHA" ? `${toAlpha(n,true)}.` : type==="roman" ? `${toRoman(n).toLowerCase()}.` : `${toRoman(n)}.`;
      return `    ${prefix} ${item}`;
    }).join("\n");
  });
  // Split into lines and render formatting per line
  const lines = resolved.split("\n");
  const elements = [];
  lines.forEach((line, i) => {
    const key = i;
    if (/^# /.test(line)) {
      elements.push(<div key={key} style={{fontSize:16,fontWeight:700,color:B.black,marginBottom:6,marginTop:10}}>{renderInline(line.replace(/^# /,""))}</div>);
    } else if (/^## /.test(line)) {
      elements.push(<div key={key} style={{fontSize:14,fontWeight:700,color:B.black,marginBottom:4,marginTop:8}}>{renderInline(line.replace(/^## /,""))}</div>);
    } else if (/^### /.test(line)) {
      elements.push(<div key={key} style={{fontSize:13,fontWeight:700,color:B.black,marginBottom:3,marginTop:6}}>{renderInline(line.replace(/^### /,""))}</div>);
    } else if (line === "") {
      elements.push(<div key={key} style={{height:8}}/>);
    } else {
      elements.push(<div key={key} style={{lineHeight:1.85}}>{renderInline(line)}</div>);
    }
  });
  return <>{elements}</>;
}

function renderInline(text) {
  // Bold+italic: ***text***
  // Bold: **text**
  // Italic: *text*
  // Underline: __text__
  const parts = [];
  const re = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|__(.+?)__)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1].startsWith("***"))      parts.push(<strong key={m.index}><em>{m[2]}</em></strong>);
    else if (m[1].startsWith("**"))  parts.push(<strong key={m.index}>{m[3]}</strong>);
    else if (m[1].startsWith("*"))   parts.push(<em key={m.index}>{m[4]}</em>);
    else if (m[1].startsWith("__"))  parts.push(<span key={m.index} style={{textDecoration:"underline"}}>{m[5]}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : text;
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

// ── Toast notification ─────────────────────────────────────────────────────────
export function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{
      position:"fixed", bottom:28, right:28, zIndex:9999,
      background:B.teal, color:B.white,
      padding:"12px 22px", borderRadius:8,
      fontSize:13, fontWeight:600, fontFamily:"'Montserrat',sans-serif",
      boxShadow:"0 4px 20px rgba(0,162,138,0.35)",
      display:"flex", alignItems:"center", gap:10,
      animation:"hrsc-toast-in 0.2s ease",
    }}>
      <span style={{fontSize:16}}>✓</span>
      {message}
      <style>{`@keyframes hrsc-toast-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ── Markdown → HTML helper (for legacy content) ────────────────────────────────
function applyInline(text) {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g,     "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,         "<em>$1</em>")
    .replace(/__(.+?)__/g,          "<u>$1</u>");
}

function markdownToHtml(text) {
  if (!text) return "";
  // @num{} and list variants → <ol>
  let html = text.replace(/@(?:num|alpha|ALPHA|roman|ROMAN)\{([^}]+)\}/g, (_, inner) => {
    const items = inner.split("\n").map(s => s.trim()).filter(Boolean);
    return "<ol>" + items.map(item => `<li>${item}</li>`).join("") + "</ol>";
  });
  // Process line by line
  const lines = html.split("\n");
  const result = [];
  for (const line of lines) {
    if (line.startsWith("<")) { result.push(line); continue; }
    if (/^### /.test(line)) { result.push(`<h3>${applyInline(line.slice(4))}</h3>`); continue; }
    if (/^## /.test(line))  { result.push(`<h2>${applyInline(line.slice(3))}</h2>`); continue; }
    if (/^# /.test(line))   { result.push(`<h1>${applyInline(line.slice(2))}</h1>`); continue; }
    if (line.trim() === "") continue;
    result.push(`<p>${applyInline(line)}</p>`);
  }
  return result.join("");
}

// ── Rich text editor (contenteditable WYSIWYG) ────────────────────────────────
export function RichTextEditor({ label, value, onChange, variables = [] }) {
  const ref = useRef(null);

  // Init innerHTML on mount only
  useEffect(() => {
    if (ref.current) {
      const initialHtml = value && value.trim().startsWith("<")
        ? value
        : markdownToHtml(value || "");
      ref.current.innerHTML = initialHtml;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function exec(cmd, val=null) {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    onChange({ target: { value: ref.current.innerHTML } });
  }

  function insertVar() {
    const varName = prompt("Variable key (without {{ }}):", "variable_name");
    if (!varName) return;
    ref.current?.focus();
    document.execCommand("insertText", false, `{{${varName.trim()}}}`);
    onChange({ target: { value: ref.current.innerHTML } });
  }

  function insertAlphaList() {
    ref.current?.focus();
    document.execCommand("insertOrderedList", false, null);
    // Find the <ol> containing the cursor and set lower-alpha style
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      let node = sel.getRangeAt(0).startContainer;
      while (node && node !== ref.current) {
        if (node.nodeName === "OL") { node.style.listStyleType = "lower-alpha"; break; }
        node = node.parentNode;
      }
    }
    onChange({ target: { value: ref.current.innerHTML } });
  }

  const FMT_BTNS = [
    { label:"B",  title:"Bold",        style:{fontWeight:700},           action:()=>exec("bold") },
    { label:"I",  title:"Italic",      style:{fontStyle:"italic"},        action:()=>exec("italic") },
    { label:"U",  title:"Underline",   style:{textDecoration:"underline"},action:()=>exec("underline") },
    { label:"H1", title:"Heading 1",   style:{fontWeight:700},            action:()=>exec("formatBlock","h1") },
    { label:"H2", title:"Heading 2",   style:{fontWeight:700},            action:()=>exec("formatBlock","h2") },
  ];
  const LIST_BTNS = [
    { label:"1.",  title:"Numbered list (1. 2. 3.)", action:()=>exec("insertOrderedList") },
    { label:"a.",  title:"Alpha list (a. b. c.)",    action:insertAlphaList },
    { label:"•",   title:"Bullet list",              action:()=>exec("insertUnorderedList") },
    { label:"→",   title:"Indent",                   action:()=>exec("indent") },
    { label:"←",   title:"Outdent",                  action:()=>exec("outdent") },
    { label:"{{var}}", title:"Insert variable",      action:insertVar, style:{fontWeight:700} },
  ];

  return (
    <div>
      <label style={LBL}>{label}</label>
      {/* Toolbar */}
      <div style={{background:B.g1, borderRadius:"6px 6px 0 0", border:`1.5px solid ${B.g2}`, borderBottom:"none"}}>
        <div style={{display:"flex", gap:4, padding:"6px 8px", borderBottom:`1px solid ${B.g2}`, flexWrap:"wrap", alignItems:"center"}}>
          <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:B.g3,marginRight:4}}>Format</span>
          {FMT_BTNS.map(b => (
            <button key={b.label} title={b.title}
              onMouseDown={e => { e.preventDefault(); b.action(); }}
              style={{...BS, padding:"3px 9px", fontSize:12, background:B.white, borderColor:B.g2, minWidth:32, ...(b.style||{})}}>
              {b.label}
            </button>
          ))}
          <div style={{width:1, height:20, background:B.g2, margin:"0 4px"}}/>
          <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:B.g3,marginRight:4}}>Lists & vars</span>
          {LIST_BTNS.map(b => (
            <button key={b.label} title={b.title}
              onMouseDown={e => { e.preventDefault(); b.action(); }}
              style={{...BS, padding:"3px 9px", fontSize:11, background:B.white, borderColor:B.g2, fontWeight:700, ...(b.style||{})}}>
              {b.label}
            </button>
          ))}
        </div>
      </div>
      {/* Editable area */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange({ target: { value: ref.current.innerHTML } })}
        style={{
          ...mkInp(false),
          minHeight:180, lineHeight:1.65,
          borderRadius:"0 0 6px 6px",
          resize:"vertical", overflow:"auto",
          whiteSpace:"pre-wrap",
        }}
      />
    </div>
  );
}

// Keep ClauseEditor as an alias so existing imports still work
export { RichTextEditor as ClauseEditor };

// ── Preview renderer ───────────────────────────────────────────────────────────
export function DocHeader({ hf }) {
  if (!hf) return null;
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",paddingBottom:16,marginBottom:20,borderBottom:`3px solid ${B.red}`}}>
      <div style={{flex:1}}>
        {hf.logoBase64 && <img src={hf.logoBase64} alt="Logo" style={{maxHeight:60,maxWidth:200,objectFit:"contain",marginBottom:8,display:"block"}}/>}
        {hf.companyLine && <div style={{fontSize:13,fontWeight:700,color:B.black}}>{hf.companyLine}</div>}
        {hf.addressLine1 && <div style={{fontSize:11,color:B.g3}}>{hf.addressLine1}</div>}
        {hf.addressLine2 && <div style={{fontSize:11,color:B.g3}}>{hf.addressLine2}</div>}
        {hf.phone && <div style={{fontSize:11,color:B.g3}}>{hf.phone}</div>}
        {hf.email && <div style={{fontSize:11,color:B.g3}}>{hf.email}</div>}
        {hf.website && <div style={{fontSize:11,color:B.g3}}>{hf.website}</div>}
      </div>
    </div>
  );
}

export function DocFooter({ hf }) {
  if (!hf?.footerText) return null;
  return (
    <div style={{borderTop:`1px solid ${B.g2}`,marginTop:24,paddingTop:10,fontSize:10,color:B.g3,lineHeight:1.6}}>
      {hf.footerText}
    </div>
  );
}

export function PreviewContent({ sections, clauses, vars, numberingFormat, headerFooter }) {
  const nums = buildSectionNumbers(sections, numberingFormat);
  return (
    <div>
      <DocHeader hf={headerFooter}/>
      {sections.map((s,i) => {
        const txt = s.clauseId ? (clauses.find(c=>c.id===s.clauseId)?.content||"") : (s.content||"");
        const prefix = nums[i] ? `${nums[i]} ` : "";
        return (
          <div key={s.id} style={{marginBottom:26}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:B.g3,marginBottom:6}}>{prefix}{s.name}</div>
            <div style={{fontSize:13,color:B.black}}>{renderClauseContentRich(txt,vars)}</div>
            {i<sections.length-1 && <div style={{borderBottom:`1px solid ${B.g1}`,marginTop:22}}/>}
          </div>
        );
      })}
      <DocFooter hf={headerFooter}/>
    </div>
  );
}
