import { useState, useEffect, useCallback, useRef } from "react";
import * as api from "./api.js";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const B = {
  red:   "#FC1921",
  black: "#231F20",
  white: "#FFFFFF",
  g0:    "#FAFAF8",
  g1:    "#F1EFEA",
  g2:    "#E2DFDA",
  g3:    "#9B9799",
  g4:    "#555355",
  teal:      "#00A28A",
  tealLight: "#E6F5F2",
  blue:      "#0E56A5",
  blueLight: "#EAF1FA",
  amber:     "#E8900A",
  amberLight:"#FEF3EC",
  green:     "#1A7A4A",
  greenLight:"#E6F5EE",
};

const SH = {
  xs: "0 1px 2px rgba(35,31,32,0.06)",
  sm: "0 1px 3px rgba(35,31,32,0.08), 0 1px 2px rgba(35,31,32,0.04)",
  md: "0 4px 8px rgba(35,31,32,0.08), 0 2px 4px rgba(35,31,32,0.04)",
};

// ─── Country flags (emoji) and names ─────────────────────────────────────────
const COUNTRY_META = {
  EU: { flag: "🇪🇺", name: "European Union" },
  GB: { flag: "🇬🇧", name: "United Kingdom" },
  DE: { flag: "🇩🇪", name: "Germany" },
  FR: { flag: "🇫🇷", name: "France" },
  ES: { flag: "🇪🇸", name: "Spain" },
  IT: { flag: "🇮🇹", name: "Italy" },
  NL: { flag: "🇳🇱", name: "Netherlands" },
  BE: { flag: "🇧🇪", name: "Belgium" },
  IE: { flag: "🇮🇪", name: "Ireland" },
  PL: { flag: "🇵🇱", name: "Poland" },
  SE: { flag: "🇸🇪", name: "Sweden" },
  DK: { flag: "🇩🇰", name: "Denmark" },
  CH: { flag: "🇨🇭", name: "Switzerland" },
  NO: { flag: "🇳🇴", name: "Norway" },
  AT: { flag: "🇦🇹", name: "Austria" },
  PT: { flag: "🇵🇹", name: "Portugal" },
  FI: { flag: "🇫🇮", name: "Finland" },
  AE: { flag: "🇦🇪", name: "UAE" },
  SA: { flag: "🇸🇦", name: "Saudi Arabia" },
  QA: { flag: "🇶🇦", name: "Qatar" },
  BH: { flag: "🇧🇭", name: "Bahrain" },
  KW: { flag: "🇰🇼", name: "Kuwait" },
  OM: { flag: "🇴🇲", name: "Oman" },
  IL: { flag: "🇮🇱", name: "Israel" },
  ZA: { flag: "🇿🇦", name: "South Africa" },
  NG: { flag: "🇳🇬", name: "Nigeria" },
  KE: { flag: "🇰🇪", name: "Kenya" },
  EG: { flag: "🇪🇬", name: "Egypt" },
  MA: { flag: "🇲🇦", name: "Morocco" },
  GH: { flag: "🇬🇭", name: "Ghana" },
  INT: { flag: "🌐", name: "International" },
};

const REGIONS = ["All", "Europe", "Middle East", "Africa", "International"];

const CATEGORIES = {
  minimum_wage:      { label: "Minimum Wage",     color: B.green,  bg: B.greenLight },
  working_time:      { label: "Working Time",     color: B.blue,   bg: B.blueLight },
  termination:       { label: "Termination",      color: B.red,    bg: "#FDEEF4" },
  leave:             { label: "Leave & Holiday",  color: B.teal,   bg: B.tealLight },
  equality:          { label: "Equality & D&I",   color: "#7B2FBE", bg: "#F5EEFF" },
  health_safety:     { label: "Health & Safety",  color: B.amber,  bg: B.amberLight },
  pensions:          { label: "Pensions",         color: B.g4,     bg: B.g1 },
  collective_rights: { label: "Collective Rights",color: "#1A5C8A", bg: "#E8F2FA" },
  immigration:       { label: "Immigration",      color: "#6B4A00", bg: "#FDF5E0" },
  general:           { label: "General",          color: B.g3,     bg: B.g1 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtRelative(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDate(iso);
}

// ─── UI primitives ────────────────────────────────────────────────────────────
function Spinner({ size = 16 }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size,
      border: `2px solid ${B.g2}`, borderTopColor: B.red,
      borderRadius: "50%", animation: "spin 0.7s linear infinite",
    }} />
  );
}

function CategoryBadge({ category }) {
  const meta = CATEGORIES[category] || CATEGORIES.general;
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 20,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
      color: meta.color, background: meta.bg,
      fontFamily: "'Montserrat',sans-serif",
    }}>
      {meta.label.toUpperCase()}
    </span>
  );
}

function RegionChip({ region, count, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 14px", borderRadius: 20, border: "none",
      background: active ? B.red : B.g1,
      color: active ? B.white : B.g4,
      fontSize: 12, fontWeight: 700, cursor: "pointer",
      fontFamily: "'Montserrat',sans-serif",
      letterSpacing: "0.04em",
      transition: "background 0.15s, color 0.15s",
    }}>
      {region} {count > 0 && <span style={{ opacity: 0.8 }}>({count})</span>}
    </button>
  );
}

function Toast({ msg, type = "info", onClose }) {
  const bg = type === "error" ? B.red : type === "success" ? B.green : B.blue;
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: bg, color: B.white, borderRadius: 8,
      padding: "12px 16px", fontSize: 13, fontFamily: "'Montserrat',sans-serif",
      fontWeight: 600, boxShadow: SH.md, display: "flex", alignItems: "center", gap: 10,
      maxWidth: 360,
    }}>
      <span style={{ flex: 1 }}>{msg}</span>
      <button onClick={onClose} style={{
        background: "none", border: "none", color: B.white,
        cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0,
      }}>×</button>
    </div>
  );
}

// ─── Change card ──────────────────────────────────────────────────────────────
function ChangeCard({ change, onMarkRead, onStar, onDismiss }) {
  const cm = COUNTRY_META[change.country] || { flag: "🏳", name: change.country };
  const [busy, setBusy] = useState(false);

  const handle = (fn) => async () => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <div style={{
      background: B.white,
      border: `1px solid ${change.is_read ? B.g2 : B.red + "40"}`,
      borderLeft: `4px solid ${change.is_read ? B.g2 : B.red}`,
      borderRadius: 8, padding: "14px 16px",
      boxShadow: change.is_read ? SH.xs : SH.sm,
      transition: "box-shadow 0.15s, border-color 0.15s",
      opacity: change.is_read ? 0.8 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {/* Flag */}
        <div style={{
          fontSize: 22, lineHeight: 1, flexShrink: 0, marginTop: 2,
          width: 32, textAlign: "center",
        }}>
          {cm.flag}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: B.g3, letterSpacing: "0.07em", fontFamily: "'Montserrat',sans-serif" }}>
              {cm.name.toUpperCase()}
            </span>
            <span style={{ color: B.g2, fontSize: 10 }}>·</span>
            <span style={{ fontSize: 10, color: B.g3, fontFamily: "'Montserrat',sans-serif" }}>
              {change.source_name}
            </span>
            <span style={{ color: B.g2, fontSize: 10 }}>·</span>
            <span style={{ fontSize: 10, color: B.g3 }} title={change.detected_at}>
              {fmtRelative(change.detected_at)}
            </span>
          </div>

          <a
            href={change.link || "#"}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 14, fontWeight: change.is_read ? 600 : 700,
              color: change.is_read ? B.g4 : B.black,
              textDecoration: "none", fontFamily: "'Montserrat',sans-serif",
              display: "block", lineHeight: 1.4, marginBottom: 6,
            }}
          >
            {change.title}
          </a>

          {change.summary && (
            <p style={{
              fontSize: 12, color: B.g4, margin: "0 0 8px",
              lineHeight: 1.5, display: "-webkit-box",
              WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              {change.summary}
            </p>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <CategoryBadge category={change.category} />
            {change.published_at && (
              <span style={{ fontSize: 10, color: B.g3, fontFamily: "'Montserrat',sans-serif" }}>
                Published {fmtDate(change.published_at)}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
          {busy ? <Spinner size={14} /> : (
            <>
              <ActionBtn
                title={change.is_starred ? "Unstar" : "Star"}
                onClick={handle(onStar)}
                active={change.is_starred}
                activeColor="#F5C017"
              >★</ActionBtn>
              <ActionBtn
                title={change.is_read ? "Mark unread" : "Mark read"}
                onClick={handle(onMarkRead)}
              >
                {change.is_read ? "●" : "○"}
              </ActionBtn>
              <ActionBtn title="Dismiss" onClick={handle(onDismiss)} danger>×</ActionBtn>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ children, title, onClick, active, activeColor, danger }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 26, height: 26, border: "none", borderRadius: 4,
        background: active ? activeColor + "20" : "transparent",
        color: active ? activeColor : danger ? B.red : B.g3,
        cursor: "pointer", fontSize: 14, lineHeight: 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "sans-serif",
        transition: "background 0.1s, color 0.1s",
      }}
    >
      {children}
    </button>
  );
}

// ─── Source row ───────────────────────────────────────────────────────────────
function SourceRow({ source, onToggle }) {
  const cm = COUNTRY_META[source.country] || { flag: "🏳", name: source.country };
  const [busy, setBusy] = useState(false);

  const handleToggle = async () => {
    setBusy(true);
    try { await onToggle(source.id, !source.active); } finally { setBusy(false); }
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
      borderBottom: `1px solid ${B.g1}`,
    }}>
      <span style={{ fontSize: 16 }}>{cm.flag}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: B.black, fontFamily: "'Montserrat',sans-serif" }}>
          {source.name}
        </div>
        <div style={{ fontSize: 10, color: B.g3, display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
          <span>{cm.name}</span>
          <span>·</span>
          <span>{source.region}</span>
          <span>·</span>
          <span>{source.feed_type === "html" ? "Page monitor" : "RSS/Atom feed"}</span>
          {source.last_checked && (
            <>
              <span>·</span>
              <span>Checked {fmtRelative(source.last_checked)}</span>
            </>
          )}
        </div>
      </div>
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: 10, color: B.blue, textDecoration: "none", flexShrink: 0 }}
        title="Open official source"
      >
        ↗
      </a>
      {busy ? <Spinner size={14} /> : (
        <button
          onClick={handleToggle}
          style={{
            padding: "4px 10px", borderRadius: 20, border: "none",
            background: source.active ? B.greenLight : B.g1,
            color: source.active ? B.green : B.g3,
            fontSize: 10, fontWeight: 700, cursor: "pointer",
            fontFamily: "'Montserrat',sans-serif", letterSpacing: "0.06em",
          }}
        >
          {source.active ? "ACTIVE" : "PAUSED"}
        </button>
      )}
    </div>
  );
}

// ─── Scan status bar ──────────────────────────────────────────────────────────
function ScanBar({ status, onScan, scanning }) {
  return (
    <div style={{
      background: B.white, border: `1px solid ${B.g2}`,
      borderRadius: 8, padding: "10px 16px",
      display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
    }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        {status ? (
          <span style={{ fontSize: 11, color: B.g3, fontFamily: "'Montserrat',sans-serif" }}>
            Last scan: {fmtRelative(status.last_scan)} ·{" "}
            <span style={{ color: B.green, fontWeight: 700 }}>{status.total_changes}</span> changes detected ·{" "}
            <span style={{ color: B.red, fontWeight: 700 }}>{status.unread_count}</span> unread ·{" "}
            {status.sources_active} sources active
          </span>
        ) : (
          <span style={{ fontSize: 11, color: B.g3 }}>No scan has run yet</span>
        )}
      </div>
      <button
        onClick={onScan}
        disabled={scanning}
        style={{
          padding: "8px 18px", borderRadius: 6, border: "none",
          background: scanning ? B.g2 : B.red,
          color: scanning ? B.g3 : B.white,
          fontSize: 11, fontWeight: 700, cursor: scanning ? "not-allowed" : "pointer",
          fontFamily: "'Montserrat',sans-serif", letterSpacing: "0.06em",
          display: "flex", alignItems: "center", gap: 8,
        }}
      >
        {scanning && <Spinner size={12} />}
        {scanning ? "SCANNING…" : "SCAN NOW"}
      </button>
    </div>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────
function StatsBar({ changes }) {
  const byRegion = {};
  changes.forEach(c => {
    byRegion[c.region] = (byRegion[c.region] || 0) + (c.is_read ? 0 : 1);
  });

  const items = [
    { label: "Europe",        count: byRegion["Europe"]        || 0, color: B.blue },
    { label: "Middle East",   count: byRegion["Middle East"]   || 0, color: B.amber },
    { label: "Africa",        count: byRegion["Africa"]        || 0, color: B.green },
    { label: "International", count: byRegion["International"] || 0, color: B.teal },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
      {items.map(it => (
        <div key={it.label} style={{
          background: B.white, border: `1px solid ${B.g2}`,
          borderRadius: 8, padding: "12px 16px", textAlign: "center",
          boxShadow: SH.xs,
        }}>
          <div style={{
            fontSize: 28, fontWeight: 800, color: it.count > 0 ? it.color : B.g2,
            fontFamily: "'Montserrat',sans-serif", lineHeight: 1,
          }}>
            {it.count}
          </div>
          <div style={{ fontSize: 9, color: B.g3, fontWeight: 700, letterSpacing: "0.08em", marginTop: 4, fontFamily: "'Montserrat',sans-serif" }}>
            {it.label.toUpperCase()}
          </div>
          <div style={{ fontSize: 9, color: B.g3, marginTop: 1 }}>unread</div>
        </div>
      ))}
    </div>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────
function FilterBar({ filters, onChange, countries }) {
  const selStyle = {
    padding: "7px 10px", borderRadius: 6, border: `1px solid ${B.g2}`,
    background: B.white, fontSize: 12, color: B.black,
    fontFamily: "'Montserrat',sans-serif", cursor: "pointer", outline: "none",
  };
  const inpStyle = {
    padding: "7px 12px", borderRadius: 6, border: `1px solid ${B.g2}`,
    background: B.white, fontSize: 12, color: B.black,
    fontFamily: "'Montserrat',sans-serif", outline: "none", flex: 1, minWidth: 140,
  };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input
        type="search"
        placeholder="Search changes…"
        value={filters.search}
        onChange={e => onChange({ ...filters, search: e.target.value })}
        style={inpStyle}
      />
      <select value={filters.region} onChange={e => onChange({ ...filters, region: e.target.value, country: "" })} style={selStyle}>
        <option value="">All regions</option>
        {["Europe", "Middle East", "Africa", "International"].map(r => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <select value={filters.country} onChange={e => onChange({ ...filters, country: e.target.value })} style={selStyle}>
        <option value="">All countries</option>
        {countries.map(c => (
          <option key={c} value={c}>{(COUNTRY_META[c] || {}).flag || ""} {(COUNTRY_META[c] || {}).name || c}</option>
        ))}
      </select>
      <select value={filters.category} onChange={e => onChange({ ...filters, category: e.target.value })} style={selStyle}>
        <option value="">All categories</option>
        {Object.entries(CATEGORIES).map(([k, v]) => (
          <option key={k} value={k}>{v.label}</option>
        ))}
      </select>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: B.g4, cursor: "pointer", fontFamily: "'Montserrat',sans-serif", userSelect: "none" }}>
        <input
          type="checkbox"
          checked={filters.showRead}
          onChange={e => onChange({ ...filters, showRead: e.target.checked })}
          style={{ accentColor: B.red }}
        />
        Show read
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: B.g4, cursor: "pointer", fontFamily: "'Montserrat',sans-serif", userSelect: "none" }}>
        <input
          type="checkbox"
          checked={filters.starredOnly}
          onChange={e => onChange({ ...filters, starredOnly: e.target.checked })}
          style={{ accentColor: "#F5C017" }}
        />
        Starred only
      </label>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("feed"); // feed | sources
  const [changes, setChanges] = useState([]);
  const [sources, setSources] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [toast, setToast] = useState(null);
  const [filters, setFilters] = useState({
    search: "", region: "", country: "", category: "", showRead: false, starredOnly: false,
  });

  const showToast = useCallback((msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const st = await api.getScanStatus();
      if (st.needs_init) {
        await api.initDB();
      }
      const [c, s, st2] = await Promise.all([
        api.listChanges({ limit: 200 }),
        api.listSources(),
        st.needs_init ? api.getScanStatus() : Promise.resolve(st),
      ]);
      setChanges(c.changes || c || []);
      setSources(s.sources || s || []);
      setStatus(st2);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const t = setInterval(loadAll, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [loadAll]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await api.triggerScan();
      showToast(`Scan complete — ${result.new_items} new item${result.new_items !== 1 ? "s" : ""} found across ${result.sources_scanned} sources`, "success");
      await loadAll();
    } catch (e) {
      showToast("Scan failed: " + e.message, "error");
    } finally {
      setScanning(false);
    }
  };

  const handleMarkRead = useCallback(async (id, isRead) => {
    await (isRead ? api.markUnread(id) : api.markRead(id));
    setChanges(prev => prev.map(c => c.id === id ? { ...c, is_read: !isRead } : c));
  }, []);

  const handleStar = useCallback(async (id, isStarred) => {
    await (isStarred ? api.unstarChange(id) : api.starChange(id));
    setChanges(prev => prev.map(c => c.id === id ? { ...c, is_starred: !isStarred } : c));
  }, []);

  const handleDismiss = useCallback(async (id) => {
    await api.dismissChange(id);
    setChanges(prev => prev.filter(c => c.id !== id));
  }, []);

  const handleToggleSource = async (id, active) => {
    await api.toggleSource(id, active);
    setSources(prev => prev.map(s => s.id === id ? { ...s, active: active ? 1 : 0 } : s));
  };

  const handleMarkAllRead = async () => {
    await api.markAllRead();
    setChanges(prev => prev.map(c => ({ ...c, is_read: 1 })));
    showToast("All changes marked as read", "success");
  };

  // Filter changes
  const filtered = changes.filter(c => {
    if (!filters.showRead && c.is_read) return false;
    if (filters.starredOnly && !c.is_starred) return false;
    if (filters.region && c.region !== filters.region) return false;
    if (filters.country && c.country !== filters.country) return false;
    if (filters.category && c.category !== filters.category) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!(c.title || "").toLowerCase().includes(q) &&
          !(c.summary || "").toLowerCase().includes(q) &&
          !(c.source_name || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Distinct countries in current changes
  const countries = [...new Set(changes.map(c => c.country))].sort();

  const unreadCount = changes.filter(c => !c.is_read).length;

  return (
    <div style={{
      minHeight: "100vh", background: B.g0,
      fontFamily: "Arial, Helvetica, sans-serif",
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { margin: 0; }
        a:hover { text-decoration: underline !important; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: ${B.g1}; }
        ::-webkit-scrollbar-thumb { background: ${B.g2}; border-radius: 3px; }
      `}</style>

      {/* Header */}
      <div style={{ background: B.white, borderBottom: `1px solid ${B.g2}`, boxShadow: SH.xs }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0" }}>
            <div style={{ width: 36, height: 36, background: B.red, borderRadius: 4, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Montserrat',sans-serif", color: B.black, lineHeight: 1.2 }}>
                EMEA Employment Law Monitor
              </div>
              <div style={{ fontSize: 11, color: B.g3, marginTop: 2 }}>
                Real-time monitoring of official government &amp; legislative sources across Europe, Middle East &amp; Africa
              </div>
            </div>
            <a href="/copilot.html" style={{ fontSize: 11, color: B.g3, textDecoration: "none" }}>
              ← HRSC Home
            </a>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 0, borderTop: `1px solid ${B.g1}` }}>
            {[
              { id: "feed",    label: `Changes${unreadCount > 0 ? ` (${unreadCount})` : ""}` },
              { id: "sources", label: `Sources (${sources.length})` },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: "10px 18px", border: "none", background: "none",
                  borderBottom: `3px solid ${tab === t.id ? B.red : "transparent"}`,
                  color: tab === t.id ? B.red : B.g3,
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                  fontFamily: "'Montserrat',sans-serif", letterSpacing: "0.04em",
                  transition: "color 0.15s, border-color 0.15s",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px" }}>

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: B.g3 }}>
            <Spinner size={32} />
            <div style={{ marginTop: 16, fontSize: 13 }}>Loading…</div>
          </div>
        ) : tab === "feed" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <ScanBar status={status} onScan={handleScan} scanning={scanning} />
            <StatsBar changes={changes} />

            {/* Filter + actions row */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <FilterBar filters={filters} onChange={setFilters} countries={countries} />
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  style={{
                    padding: "7px 14px", borderRadius: 6,
                    border: `1px solid ${B.g2}`, background: B.white,
                    color: B.g4, fontSize: 11, fontWeight: 700, cursor: "pointer",
                    fontFamily: "'Montserrat',sans-serif", whiteSpace: "nowrap",
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Changes list */}
            {filtered.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "60px 20px",
                background: B.white, borderRadius: 8, border: `1px solid ${B.g2}`,
                color: B.g3, fontSize: 13,
              }}>
                {changes.length === 0
                  ? <>No changes detected yet. Click <b>SCAN NOW</b> to run the first scan.</>
                  : "No changes match the current filters."}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 11, color: B.g3, fontFamily: "'Montserrat',sans-serif" }}>
                  Showing {filtered.length} of {changes.length} change{changes.length !== 1 ? "s" : ""}
                </div>
                {filtered.map(c => (
                  <ChangeCard
                    key={c.id}
                    change={c}
                    onMarkRead={() => handleMarkRead(c.id, !!c.is_read)}
                    onStar={() => handleStar(c.id, !!c.is_starred)}
                    onDismiss={() => handleDismiss(c.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Sources tab */
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <ScanBar status={status} onScan={handleScan} scanning={scanning} />

            {["Europe", "Middle East", "Africa", "International"].map(region => {
              const regionSources = sources.filter(s => s.region === region);
              if (regionSources.length === 0) return null;
              return (
                <div key={region} style={{
                  background: B.white, border: `1px solid ${B.g2}`,
                  borderRadius: 8, padding: "16px 20px", boxShadow: SH.xs,
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: B.g3,
                    letterSpacing: "0.09em", marginBottom: 8,
                    fontFamily: "'Montserrat',sans-serif",
                    textTransform: "uppercase",
                  }}>
                    {region} — {regionSources.filter(s => s.active).length}/{regionSources.length} active
                  </div>
                  {regionSources.map(s => (
                    <SourceRow key={s.id} source={s} onToggle={handleToggleSource} />
                  ))}
                </div>
              );
            })}

            <div style={{
              background: B.g1, borderRadius: 8, padding: "14px 16px",
              fontSize: 11, color: B.g4, lineHeight: 1.6,
            }}>
              <b>How it works:</b> The monitor fetches RSS/Atom feeds from official government and legislative sources every 4 hours via a Cloudflare Cron Trigger.
              For sources without structured feeds, it performs content-hash comparison to detect page changes.
              Only changes to employment, labour, and social legislation are captured.
              All sources are official government, parliament, or ministry websites.
            </div>
          </div>
        )}
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
