import { useState, useRef, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// BRAND TOKENS — CSL brand palette + KB design system
// ─────────────────────────────────────────────────────────────────────────────
export const B = {
  // Core brand
  red:   "#FC1921",
  black: "#231F20",
  white: "#FFFFFF",
  // Warm grays
  g0:  "#FAFAF8",
  g1:  "#F1EFEA",
  g2:  "#E2DFDA",
  g3:  "#9B9799",
  g4:  "#555355",
  // Accents
  teal:      "#00A28A",
  tealDark:  "#007A68",
  tealLight: "#E6F5F2",
  blue:      "#0E56A5",
  blueLight: "#EAF1FA",
  yellow:    "#F5C017",
};

// Shadow tokens
export const SH = {
  xs: "0 1px 2px rgba(35,31,32,0.06)",
  sm: "0 1px 3px rgba(35,31,32,0.08), 0 1px 2px rgba(35,31,32,0.04)",
  md: "0 4px 8px rgba(35,31,32,0.08), 0 2px 4px rgba(35,31,32,0.04)",
  lg: "0 8px 24px rgba(35,31,32,0.10), 0 2px 8px rgba(35,31,32,0.06)",
  teal: "0 4px 16px rgba(0,162,138,0.18)",
};

// Custom select arrow
export const SEL_ARROW = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239B9799' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`;

// ─────────────────────────────────────────────────────────────────────────────
// BASE STYLE GENERATORS
// ─────────────────────────────────────────────────────────────────────────────
export const mkInp = (focused) => ({
  width: "100%", boxSizing: "border-box", padding: "10px 14px",
  background: B.white, border: `1.5px solid ${focused ? B.teal : B.g2}`,
  borderRadius: 8, fontSize: 13, fontFamily: "'Montserrat',sans-serif",
  fontWeight: 400, color: B.black, outline: "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
  boxShadow: focused ? `0 0 0 3px ${B.teal}18` : "none",
});

export const LBL = {
  fontSize: 10, fontWeight: 700, letterSpacing: "0.09em",
  textTransform: "uppercase", color: B.g3, display: "block", marginBottom: 6,
};

export const CARD = (x = {}) => ({
  background: B.white, border: `1px solid ${B.g2}`,
  borderRadius: 12, padding: "1.25rem",
  boxShadow: SH.xs, ...x,
});

// Buttons
export const BP  = { padding: "10px 20px", background: B.teal, color: B.white, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: "'Montserrat',sans-serif", cursor: "pointer", letterSpacing: "0.02em", transition: "background 0.15s, transform 0.1s", boxShadow: SH.teal };
export const BPR = { ...BP, background: B.red, boxShadow: "0 4px 16px rgba(252,25,33,0.18)" };
export const BS  = { padding: "10px 20px", background: B.white, color: B.black, border: `1.5px solid ${B.g2}`, borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "'Montserrat',sans-serif", cursor: "pointer", transition: "border-color 0.15s, background 0.15s" };
export const BG  = (c = B.g3) => ({ padding: "8px 14px", background: "transparent", color: c, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 500, fontFamily: "'Montserrat',sans-serif", cursor: "pointer" });
export const TAG = (bg = B.g1, tc = B.g3) => ({ display: "inline-block", padding: "3px 10px", background: bg, color: tc, borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", whiteSpace: "nowrap" });

export function gid() { return Math.random().toString(36).slice(2, 10); }

// ─────────────────────────────────────────────────────────────────────────────
// ARTICLE TYPE SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
export const ARTICLE_TYPES = {
  kcs: {
    label: "KCS Article",
    shortLabel: "KCS",
    color: B.teal,
    lightBg: B.tealLight,
    sections: ["Issue", "Environment", "Resolution", "Cause"],
    sectionIcons: ["🔍", "🌐", "✅", "💡"],
    s4optional: true,
    s4label: "Cause",
  },
  qrg: {
    label: "Quick Reference Guide",
    shortLabel: "QRG",
    color: B.blue,
    lightBg: B.blueLight,
    sections: ["Purpose", "Prerequisites", "Steps", "Notes"],
    sectionIcons: ["📌", "⚙️", "📋", "📝"],
    s4optional: true,
    s4label: "Notes",
    hasWorkdayPath: true,
  },
  sop: {
    label: "Standard Operating Procedure",
    shortLabel: "SOP",
    color: B.black,
    lightBg: B.g1,
    sections: ["Purpose & Scope", "Roles & Responsibilities", "Procedure", "Related Documents"],
    sectionIcons: ["📄", "👥", "🔄", "🔗"],
    s4optional: true,
    s4label: "Related Documents",
  },
};

export function typeMeta(type) { return ARTICLE_TYPES[type] || ARTICLE_TYPES.kcs; }

// ─────────────────────────────────────────────────────────────────────────────
// STATUS SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
export const STATUS_META = {
  draft:     { label: "Draft",     bg: B.g1,      tc: B.g4,      dot: B.g3 },
  review:    { label: "In Review", bg: "#FEF9EC",  tc: "#7A5C00", dot: B.yellow },
  published: { label: "Published", bg: B.tealLight, tc: B.tealDark, dot: B.teal },
  archived:  { label: "Archived",  bg: B.g1,       tc: B.g3,      dot: B.g3 },
};

export function StatusBadge({ status, size = "sm" }) {
  const m = STATUS_META[status] || STATUS_META.draft;
  const pad = size === "sm" ? "3px 10px" : "5px 14px";
  const fs  = size === "sm" ? 10 : 12;
  return (
    <span style={{ ...TAG(m.bg, m.tc), padding: pad, fontSize: fs, display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: m.dot, flexShrink: 0 }} />
      {m.label}
    </span>
  );
}

export function TypeBadge({ type, size = "sm" }) {
  const m = typeMeta(type);
  const pad = size === "sm" ? "3px 10px" : "5px 14px";
  const fs  = size === "sm" ? 10 : 12;
  return (
    <span style={{ ...TAG(m.lightBg, m.color), padding: pad, fontSize: fs, fontWeight: 700 }}>
      {size === "sm" ? m.shortLabel : m.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
export function FI({ label, value, onChange, type = "text", placeholder = "", as = "input", rows = 4, disabled = false, hint }) {
  const [f, setF] = useState(false);
  return (
    <div>
      {label && <label style={LBL}>{label}</label>}
      {as === "textarea"
        ? <textarea style={{ ...mkInp(f), minHeight: rows * 22, resize: "vertical", lineHeight: 1.65 }} value={value} onChange={onChange} placeholder={placeholder} onFocus={() => setF(true)} onBlur={() => setF(false)} disabled={disabled} />
        : <input type={type} style={{ ...mkInp(f), opacity: disabled ? 0.6 : 1 }} value={value} onChange={onChange} placeholder={placeholder} onFocus={() => setF(true)} onBlur={() => setF(false)} disabled={disabled} />
      }
      {hint && <div style={{ fontSize: 11, color: B.g3, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export function FS({ label, value, onChange, children, disabled = false }) {
  const [f, setF] = useState(false);
  return (
    <div>
      {label && <label style={LBL}>{label}</label>}
      <select disabled={disabled} style={{ ...mkInp(f), appearance: "none", backgroundImage: SEL_ARROW, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 36, opacity: disabled ? 0.5 : 1 }} value={value} onChange={onChange} onFocus={() => setF(true)} onBlur={() => setF(false)}>
        {children}
      </select>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────────────────────
export function Toast({ message, type = "success", onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  const bg = type === "error" ? B.red : B.teal;
  return (
    <div style={{
      position: "fixed", bottom: 28, right: 28, zIndex: 9999,
      background: bg, color: B.white,
      padding: "12px 20px", borderRadius: 10,
      fontSize: 13, fontWeight: 600, fontFamily: "'Montserrat',sans-serif",
      boxShadow: SH.lg,
      display: "flex", alignItems: "center", gap: 10,
      animation: "kbToastIn 0.25s cubic-bezier(0.34,1.56,0.64,1)",
      maxWidth: 340,
    }}>
      <span style={{ fontSize: 15 }}>{type === "error" ? "✕" : "✓"}</span>
      <span>{message}</span>
      <style>{`@keyframes kbToastIn{from{opacity:0;transform:translateY(16px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
export function EmptyState({ icon = "📭", title, body, action, onAction }) {
  return (
    <div style={{ textAlign: "center", padding: "56px 32px", fontFamily: "'Montserrat',sans-serif" }}>
      <div style={{ fontSize: 44, marginBottom: 16, opacity: 0.7 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: B.black, marginBottom: 8 }}>{title}</div>
      {body && <div style={{ fontSize: 13, color: B.g3, maxWidth: 320, margin: "0 auto 20px", lineHeight: 1.6 }}>{body}</div>}
      {action && <button style={BP} onClick={onAction}>{action}</button>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON LOADER
// ─────────────────────────────────────────────────────────────────────────────
export function Skeleton({ w = "100%", h = 16, r = 6, mb = 0 }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r, marginBottom: mb,
      background: `linear-gradient(90deg, ${B.g1} 25%, ${B.g2} 50%, ${B.g1} 75%)`,
      backgroundSize: "200% 100%",
      animation: "kbSkeleton 1.4s ease infinite",
    }}>
      <style>{`@keyframes kbSkeleton{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
}

export function ArticleSkeleton() {
  return (
    <div style={{ ...CARD(), padding: "18px 20px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <Skeleton w={60} h={20} r={10} /><Skeleton w={80} h={20} r={10} />
      </div>
      <Skeleton h={18} mb={8} /><Skeleton w="70%" h={18} mb={12} />
      <Skeleton h={13} mb={4} /><Skeleton w="85%" h={13} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────
export function StatCard({ value, label, color = B.teal, icon }) {
  return (
    <div style={{ ...CARD({ padding: "16px 20px" }), textAlign: "center" }}>
      {icon && <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>}
      <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: B.g3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RICH TEXT EDITOR — WYSIWYG with image support
// ─────────────────────────────────────────────────────────────────────────────
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
      w = Math.round(w * ratio); h = Math.round(h * ratio);
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

export function RichTextEditor({ label, value, onChange, minHeight = 160, placeholder }) {
  const ref     = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value || "";
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function exec(cmd, val = null) { ref.current?.focus(); document.execCommand(cmd, false, val); sync(); }
  function sync() { onChange({ target: { value: ref.current?.innerHTML || "" } }); }

  async function insertImage(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const dataUrl = await compressImage(file);
    ref.current?.focus();
    document.execCommand("insertHTML", false, `<img src="${dataUrl}" style="max-width:100%;height:auto;border-radius:6px;margin:8px 0;display:block;" />`);
    sync();
  }

  const FMT = [
    { label: "B", title: "Bold",      s: { fontWeight: 700 },            a: () => exec("bold") },
    { label: "I", title: "Italic",    s: { fontStyle: "italic" },         a: () => exec("italic") },
    { label: "U", title: "Underline", s: { textDecoration: "underline" }, a: () => exec("underline") },
    { label: "H2", title: "Heading",  s: { fontWeight: 700 },             a: () => exec("formatBlock", "h2") },
  ];
  const LISTS = [
    { label: "1.", title: "Numbered list",  a: () => exec("insertOrderedList") },
    { label: "•",  title: "Bullet list",    a: () => exec("insertUnorderedList") },
    { label: "→",  title: "Indent",         a: () => exec("indent") },
    { label: "←",  title: "Outdent",        a: () => exec("outdent") },
    { label: "🖼",  title: "Insert image",   a: () => fileRef.current?.click() },
  ];

  return (
    <div>
      {label && <label style={{ ...LBL, marginBottom: 8 }}>{label}</label>}
      <div style={{ border: `1.5px solid ${B.g2}`, borderRadius: 8, overflow: "hidden" }}>
        {/* Toolbar */}
        <div style={{ background: B.g0, borderBottom: `1px solid ${B.g2}`, padding: "6px 8px", display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center" }}>
          {FMT.map(b => (
            <button key={b.label} title={b.title} onMouseDown={e => { e.preventDefault(); b.a(); }}
              style={{ padding: "3px 10px", background: B.white, border: `1px solid ${B.g2}`, borderRadius: 5, fontSize: 12, cursor: "pointer", fontFamily: "'Montserrat',sans-serif", ...(b.s || {}) }}>
              {b.label}
            </button>
          ))}
          <div style={{ width: 1, height: 18, background: B.g2, margin: "0 4px" }} />
          {LISTS.map(b => (
            <button key={b.label} title={b.title} onMouseDown={e => { e.preventDefault(); b.a(); }}
              style={{ padding: "3px 10px", background: B.white, border: `1px solid ${B.g2}`, borderRadius: 5, fontSize: 12, cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontWeight: 700 }}>
              {b.label}
            </button>
          ))}
        </div>
        {/* Content area */}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={sync}
          onPaste={e => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
              if (item.type.startsWith("image/")) { e.preventDefault(); insertImage(item.getAsFile()); return; }
            }
          }}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f?.type.startsWith("image/")) insertImage(f); }}
          onDragOver={e => e.preventDefault()}
          data-placeholder={placeholder}
          style={{
            padding: "14px 16px", minHeight, lineHeight: 1.75, outline: "none",
            fontSize: 13, fontFamily: "'Montserrat',sans-serif", color: B.black,
            overflowY: "auto", whiteSpace: "pre-wrap",
          }}
        />
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={e => { if (e.target.files?.[0]) insertImage(e.target.files[0]); e.target.value = ""; }} />
      <style>{`[data-placeholder]:empty:before{content:attr(data-placeholder);color:${B.g3};pointer-events:none}`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RICH CONTENT RENDERER
// ─────────────────────────────────────────────────────────────────────────────
export function RichContent({ html, compact = false }) {
  if (!html) return null;
  return (
    <div
      className="kb-rich"
      style={{ fontSize: compact ? 13 : 14, lineHeight: 1.75, color: B.black }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Global rich content styles — injected once
export const RICH_CONTENT_CSS = `
.kb-rich h1{font-size:18px;font-weight:700;color:#231F20;margin:16px 0 8px}
.kb-rich h2{font-size:15px;font-weight:700;color:#231F20;margin:14px 0 6px}
.kb-rich h3{font-size:13px;font-weight:700;color:#231F20;margin:12px 0 5px}
.kb-rich p{margin:0 0 10px}
.kb-rich ul,.kb-rich ol{padding-left:20px;margin:0 0 10px}
.kb-rich li{margin-bottom:4px;line-height:1.6}
.kb-rich strong{font-weight:700}
.kb-rich em{font-style:italic}
.kb-rich u{text-decoration:underline}
.kb-rich img{max-width:100%;height:auto;border-radius:6px;margin:8px 0;box-shadow:0 2px 8px rgba(35,31,32,0.10)}
.kb-rich a{color:#00A28A;text-decoration:underline}
.kb-rich blockquote{border-left:3px solid #E2DFDA;padding-left:12px;margin:10px 0;color:#808284}
`;

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
export function usePersistedFilter(storageKey) {
  const [val, setVal] = useState(() => { try { return localStorage.getItem(storageKey) || ""; } catch { return ""; } });
  const set = useCallback((v) => { setVal(v); try { localStorage.setItem(storageKey, v); } catch {} }, [storageKey]);
  return [val, set];
}

export const EMEA_COUNTRIES = [
  "All EMEA",
  "United Kingdom", "Germany", "France", "Netherlands", "Switzerland", "Austria",
  "Belgium", "Ireland", "Sweden", "Norway", "Denmark", "Finland", "Italy", "Spain",
  "Portugal", "Poland", "Czech Republic", "Hungary", "Romania", "Turkey",
  "South Africa", "UAE", "Saudi Arabia",
];
