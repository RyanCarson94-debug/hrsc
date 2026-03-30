import { useState, useRef, useEffect, useCallback } from "react";

export const B = {
  red:"#FC1921", black:"#231F20", white:"#FFFFFF",
  g1:"#F1EFEA", g2:"#E2DFDA", g3:"#808284",
  teal:"#00A28A", blue:"#0E56A5", yellow:"#F5C017",
};

export const SEL_ARROW = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23808284' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`;

export const mkInp = (focused) => ({
  width:"100%", boxSizing:"border-box", padding:"9px 12px",
  background:B.white, border:`1.5px solid ${focused ? B.teal : B.g2}`,
  borderRadius:6, fontSize:13, fontFamily:"'Montserrat',sans-serif",
  fontWeight:400, color:B.black, outline:"none", transition:"border-color 0.15s",
});

export const LBL = { fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:B.g3, display:"block", marginBottom:5 };
export const CARD = (x={}) => ({ background:B.white, border:`1.5px solid ${B.g2}`, borderRadius:10, padding:"1.25rem", ...x });
export const BP   = { padding:"9px 20px", background:B.teal, color:B.white, border:"none", borderRadius:6, fontSize:12, fontWeight:700, fontFamily:"'Montserrat',sans-serif", cursor:"pointer", letterSpacing:"0.03em" };
export const BPR  = { ...BP, background:B.red };
export const BS   = { padding:"9px 20px", background:"transparent", color:B.black, border:`1.5px solid ${B.g2}`, borderRadius:6, fontSize:12, fontWeight:600, fontFamily:"'Montserrat',sans-serif", cursor:"pointer" };
export const BG   = (c=B.g3) => ({ padding:"7px 14px", background:"transparent", color:c, border:"none", borderRadius:6, fontSize:12, fontWeight:500, fontFamily:"'Montserrat',sans-serif", cursor:"pointer" });
export const TAG  = (bg=B.g1, tc=B.g3) => ({ display:"inline-block", padding:"2px 9px", background:bg, color:tc, borderRadius:20, fontSize:10, fontWeight:600, letterSpacing:"0.04em" });

export function gid() { return Math.random().toString(36).slice(2,10); }

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

export function compressImage(file, maxW = 800, maxH = 600, quality = 0.82) {
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

export function FI({ label, value, onChange, type="text", placeholder="", as="input", rows=4, disabled=false }) {
  const [f, setF] = useState(false);
  const s = { ...mkInp(f), opacity: disabled ? 0.6 : 1 };
  return (
    <div>
      {label && <label style={LBL}>{label}</label>}
      {as === "textarea"
        ? <textarea style={{...s, minHeight:rows*22, resize:"vertical", lineHeight:1.6}} value={value} onChange={onChange} placeholder={placeholder} onFocus={()=>setF(true)} onBlur={()=>setF(false)} disabled={disabled}/>
        : <input type={type} style={s} value={value} onChange={onChange} placeholder={placeholder} onFocus={()=>setF(true)} onBlur={()=>setF(false)} disabled={disabled}/>
      }
    </div>
  );
}

export function FS({ label, value, onChange, children, disabled=false }) {
  const [f, setF] = useState(false);
  return (
    <div>
      {label && <label style={LBL}>{label}</label>}
      <select disabled={disabled} style={{...mkInp(f), appearance:"none", backgroundImage:SEL_ARROW, backgroundRepeat:"no-repeat", backgroundPosition:"right 10px center", opacity:disabled?0.5:1}} value={value} onChange={onChange} onFocus={()=>setF(true)} onBlur={()=>setF(false)}>
        {children}
      </select>
    </div>
  );
}

export function Toast({ message, type="success", onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);
  const bg = type === "error" ? B.red : B.teal;
  return (
    <div style={{
      position:"fixed", bottom:28, right:28, zIndex:9999,
      background:bg, color:B.white,
      padding:"12px 22px", borderRadius:8,
      fontSize:13, fontWeight:600, fontFamily:"'Montserrat',sans-serif",
      boxShadow:`0 4px 20px rgba(0,0,0,0.2)`,
      display:"flex", alignItems:"center", gap:10,
      animation:"kb-toast-in 0.2s ease",
    }}>
      <span style={{fontSize:16}}>{type === "error" ? "✕" : "✓"}</span>
      {message}
      <style>{`@keyframes kb-toast-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ── Article type helpers ───────────────────────────────────────────────────────
export const ARTICLE_TYPES = {
  kcs: {
    label: "KCS Article",
    color: B.teal,
    sections: ["Issue", "Environment", "Resolution", "Cause"],
    s4optional: true,
    s4label: "Cause",
  },
  qrg: {
    label: "Quick Reference Guide",
    color: B.blue,
    sections: ["Purpose", "Prerequisites", "Steps", "Notes"],
    s4optional: true,
    s4label: "Notes",
    hasWorkdayPath: true,
  },
  sop: {
    label: "Standard Operating Procedure",
    color: B.black,
    sections: ["Purpose & Scope", "Roles & Responsibilities", "Procedure", "Related Documents"],
    s4optional: true,
    s4label: "Related Documents",
  },
};

export function typeMeta(type) {
  return ARTICLE_TYPES[type] || ARTICLE_TYPES.kcs;
}

export const STATUS_COLORS = {
  draft:     { bg:"#F1EFEA", tc:"#808284" },
  review:    { bg:"#FFF3CD", tc:"#8B6914" },
  published: { bg:"#D4EDDA", tc:"#155724" },
  archived:  { bg:"#E2DFDA", tc:"#808284" },
};

export function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.draft;
  return (
    <span style={{...TAG(c.bg, c.tc), textTransform:"capitalize"}}>{status}</span>
  );
}

export function TypeBadge({ type }) {
  const m = typeMeta(type);
  return (
    <span style={{...TAG(m.color + "18", m.color), fontWeight:700}}>{m.label}</span>
  );
}

// ── Rich text editor (WYSIWYG with image support) ──────────────────────────────
export function RichTextEditor({ label, value, onChange, minHeight = 160 }) {
  const ref = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = value || "";
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function exec(cmd, val=null) {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    sync();
  }

  function sync() {
    onChange({ target: { value: ref.current?.innerHTML || "" } });
  }

  async function insertImage(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const dataUrl = await compressImage(file);
    ref.current?.focus();
    document.execCommand("insertHTML", false, `<img src="${dataUrl}" style="max-width:100%;height:auto;border-radius:4px;margin:6px 0;" />`);
    sync();
  }

  function handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        insertImage(item.getAsFile());
        return;
      }
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file?.type.startsWith("image/")) insertImage(file);
  }

  const FMT_BTNS = [
    { label:"B",  title:"Bold",      style:{fontWeight:700},            action:()=>exec("bold") },
    { label:"I",  title:"Italic",    style:{fontStyle:"italic"},         action:()=>exec("italic") },
    { label:"U",  title:"Underline", style:{textDecoration:"underline"}, action:()=>exec("underline") },
    { label:"H2", title:"Heading 2", style:{fontWeight:700},             action:()=>exec("formatBlock","h2") },
    { label:"H3", title:"Heading 3", style:{fontWeight:700},             action:()=>exec("formatBlock","h3") },
  ];
  const LIST_BTNS = [
    { label:"1.", title:"Numbered list", action:()=>exec("insertOrderedList") },
    { label:"•",  title:"Bullet list",   action:()=>exec("insertUnorderedList") },
    { label:"→",  title:"Indent",        action:()=>exec("indent") },
    { label:"←",  title:"Outdent",       action:()=>exec("outdent") },
    { label:"🖼",  title:"Insert image",  action:()=>fileRef.current?.click() },
  ];

  return (
    <div>
      {label && <label style={LBL}>{label}</label>}
      <div style={{background:B.g1, borderRadius:"6px 6px 0 0", border:`1.5px solid ${B.g2}`, borderBottom:"none"}}>
        <div style={{display:"flex", gap:4, padding:"6px 8px", borderBottom:`1px solid ${B.g2}`, flexWrap:"wrap", alignItems:"center"}}>
          {FMT_BTNS.map(b => (
            <button key={b.label} title={b.title}
              onMouseDown={e => { e.preventDefault(); b.action(); }}
              style={{...BS, padding:"3px 9px", fontSize:12, background:B.white, borderColor:B.g2, minWidth:32, ...(b.style||{})}}>
              {b.label}
            </button>
          ))}
          <div style={{width:1, height:20, background:B.g2, margin:"0 4px"}}/>
          {LIST_BTNS.map(b => (
            <button key={b.label} title={b.title}
              onMouseDown={e => { e.preventDefault(); b.action(); }}
              style={{...BS, padding:"3px 9px", fontSize:12, background:B.white, borderColor:B.g2, fontWeight:700}}>
              {b.label}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={e=>e.preventDefault()}
        style={{
          ...mkInp(false),
          minHeight, lineHeight:1.7,
          borderRadius:"0 0 6px 6px",
          resize:"vertical", overflow:"auto",
          whiteSpace:"pre-wrap",
          borderColor: B.g2,
        }}
      />
      <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}}
        onChange={e => { if(e.target.files?.[0]) insertImage(e.target.files[0]); e.target.value=""; }} />
    </div>
  );
}

// ── Render rich HTML content safely ───────────────────────────────────────────
export function RichContent({ html }) {
  if (!html) return null;
  return (
    <div
      style={{fontSize:14, lineHeight:1.75, color:B.black}}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ── Article number formatting ─────────────────────────────────────────────────
export function ArticleNum({ num, type }) {
  const m = typeMeta(type);
  return (
    <span style={{fontWeight:700, color:m.color, fontSize:12, letterSpacing:"0.05em"}}>{num}</span>
  );
}

export const EMEA_COUNTRIES = [
  "All EMEA",
  "United Kingdom","Germany","France","Netherlands","Switzerland","Austria",
  "Belgium","Ireland","Sweden","Norway","Denmark","Finland","Italy","Spain",
  "Portugal","Poland","Czech Republic","Hungary","Romania","Turkey",
  "South Africa","UAE","Saudi Arabia",
];
