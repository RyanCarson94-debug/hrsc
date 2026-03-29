import { useState, useEffect, useCallback } from "react";
import { getAuditLog, getGenerations, getGeneration } from "../api";
import { B, CARD, BP, BS, BG, TAG } from "./shared";
import { generateDocx } from "./docxExport";

const ACTION_COLOURS = {
  create:  { bg:"#DCFCE7", tc:"#166534" },
  update:  { bg:"#DBEAFE", tc:"#1e40af" },
  delete:  { bg:"#FEE2E2", tc:"#b91c1c" },
  enable:  { bg:"#DCFCE7", tc:"#166534" },
  disable: { bg:"#F3F4F6", tc:"#374151" },
  generate:{ bg:"#FFF9E6", tc:"#7A5E00" },
};

function ActionBadge({ action }) {
  const c = ACTION_COLOURS[action] || { bg:B.g1, tc:B.g3 };
  return <span style={{ ...TAG(c.bg, c.tc), textTransform:"capitalize" }}>{action}</span>;
}

function RecordTypeBadge({ type }) {
  return <span style={TAG()}>{type}</span>;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

const INP = { padding:"7px 10px", border:`1.5px solid ${B.g2}`, borderRadius:6, fontSize:12, fontFamily:"'Montserrat',sans-serif", color:B.black, outline:"none", background:B.white };

// ── Audit Log sub-tab ──────────────────────────────────────────────────────────
function AuditLog() {
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [filterAction, setFilterAction] = useState("");
  const [filterType,   setFilterType]   = useState("");
  const [filterUser,   setFilterUser]   = useState("");
  const [fromDate,     setFromDate]     = useState("");
  const [toDate,       setToDate]       = useState("");
  const [page, setPage]                 = useState(0);
  const [total, setTotal]               = useState(0);
  const PAGE_SIZE = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterAction) params.set("action",     filterAction);
      if (filterType)   params.set("recordType", filterType);
      if (filterUser)   params.set("userName",   filterUser);
      if (fromDate)     params.set("from",        fromDate);
      if (toDate)       params.set("to",          toDate);
      params.set("limit",  PAGE_SIZE);
      params.set("offset", page * PAGE_SIZE);
      const data = await getAuditLog(`?${params}`);
      setEntries(data.entries || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filterAction, filterType, filterUser, fromDate, toDate, page]);

  useEffect(() => { load(); }, [load]);

  function clearFilters() {
    setFilterAction(""); setFilterType(""); setFilterUser("");
    setFromDate(""); setToDate(""); setPage(0);
  }

  const hasFilters = filterAction || filterType || filterUser || fromDate || toDate;

  return (
    <div>
      {/* Filters */}
      <div style={{ display:"flex", gap:10, marginBottom:10, flexWrap:"wrap", alignItems:"flex-end" }}>
        <select style={INP} value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0); }}>
          <option value="">All actions</option>
          {["create","update","delete","enable","disable","generate"].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select style={INP} value={filterType} onChange={e => { setFilterType(e.target.value); setPage(0); }}>
          <option value="">All record types</option>
          {["template","clause","rule","settings","document"].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input style={{ ...INP, width:160 }} value={filterUser} onChange={e => { setFilterUser(e.target.value); setPage(0); }} placeholder="Filter by user…"/>
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap", alignItems:"flex-end" }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:B.g3, marginBottom:4 }}>From date</div>
          <input type="date" style={INP} value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(0); }}/>
        </div>
        <div>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:B.g3, marginBottom:4 }}>To date</div>
          <input type="date" style={INP} value={toDate} onChange={e => { setToDate(e.target.value); setPage(0); }}/>
        </div>
        {hasFilters && (
          <button style={{ ...BS, padding:"7px 14px", fontSize:12 }} onClick={clearFilters}>Clear all</button>
        )}
      </div>

      {loading && <div style={{ color:B.g3, fontSize:13 }}>Loading…</div>}
      {error   && <div style={{ color:"#b91c1c", fontSize:13 }}>Error: {error}</div>}
      {!loading && entries.length === 0 && <div style={{ ...CARD({ textAlign:"center", padding:"2.5rem", color:B.g3 }) }}>No log entries found.</div>}

      {entries.map((e, i) => (
        <div key={i} style={{ ...CARD({ marginBottom:6, display:"flex", alignItems:"center", gap:12, padding:"10px 14px" }) }}>
          <ActionBadge action={e.action}/>
          <RecordTypeBadge type={e.record_type || e.recordType}/>
          <span style={{ flex:1, fontSize:13, fontWeight:600 }}>{e.record_name || e.recordName}</span>
          <span style={{ fontSize:12, color:B.g3, minWidth:120 }}>{e.user_name || e.userName || "—"}</span>
          <span style={{ fontSize:11, color:B.g3, minWidth:140, textAlign:"right" }}>{formatDate(e.timestamp)}</span>
        </div>
      ))}

      {/* Pagination */}
      <div style={{ display:"flex", gap:8, justifyContent:"center", marginTop:16, alignItems:"center" }}>
        <button style={{ ...BS, padding:"6px 14px", fontSize:12, opacity:page === 0 ? 0.4 : 1 }} disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Previous</button>
        <span style={{ fontSize:12, color:B.g3 }}>Page {page + 1} · {total} total</span>
        <button style={{ ...BS, padding:"6px 14px", fontSize:12, opacity:entries.length < PAGE_SIZE ? 0.4 : 1 }} disabled={entries.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>Next →</button>
      </div>
    </div>
  );
}

// ── Document History sub-tab ───────────────────────────────────────────────────
function DocHistory() {
  const [gens, setGens]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [search, setSearch]     = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate]     = useState("");
  const [expanded, setExpanded] = useState(null);
  const [redownloading, setRedownloading] = useState(null);
  const [page, setPage]         = useState(0);
  const [total, setTotal]       = useState(0);
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)   params.set("search", search);
      if (fromDate) params.set("from",   fromDate);
      if (toDate)   params.set("to",     toDate);
      params.set("limit",  PAGE_SIZE);
      params.set("offset", page * PAGE_SIZE);
      const data = await getGenerations(`?${params}`);
      setGens(data.entries || []);
      setTotal(data.total  || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, fromDate, toDate, page]);

  useEffect(() => { load(); }, [load]);

  async function redownload(gen) {
    setRedownloading(gen.id);
    try {
      const full = await getGeneration(gen.id);
      const snapshot = full.snapshot; // already parsed by API
      await generateDocx({
        tmpl:            snapshot.tmpl,
        resolved:        snapshot.resolved,
        clauses:         snapshot.clauses,
        vars:            snapshot.vars,
        headerFooter:    snapshot.headerFooter,
        emp:             snapshot.emp,
        numberingFormat: snapshot.numberingFormat,
      });
    } catch (e) {
      alert("Could not re-download: " + e.message);
    } finally {
      setRedownloading(null);
    }
  }

  const hasFilters = search || fromDate || toDate;

  return (
    <div>
      <div style={{ display:"flex", gap:10, marginBottom:10, flexWrap:"wrap", alignItems:"flex-end" }}>
        <input style={{ ...INP, flex:1 }} value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search by employee name, template, or user…"/>
        {search && <button style={{ ...BG(B.red) }} onClick={() => { setSearch(""); setPage(0); }}>Clear</button>}
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap", alignItems:"flex-end" }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:B.g3, marginBottom:4 }}>From date</div>
          <input type="date" style={INP} value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(0); }}/>
        </div>
        <div>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:B.g3, marginBottom:4 }}>To date</div>
          <input type="date" style={INP} value={toDate} onChange={e => { setToDate(e.target.value); setPage(0); }}/>
        </div>
        {(fromDate || toDate) && (
          <button style={{ ...BS, padding:"7px 14px", fontSize:12 }} onClick={() => { setFromDate(""); setToDate(""); setPage(0); }}>Clear dates</button>
        )}
      </div>

      {loading && <div style={{ color:B.g3, fontSize:13 }}>Loading…</div>}
      {error   && <div style={{ color:"#b91c1c", fontSize:13 }}>Error: {error}</div>}
      {!loading && gens.length === 0 && <div style={{ ...CARD({ textAlign:"center", padding:"2.5rem", color:B.g3 }) }}>No documents generated yet.</div>}

      {gens.map(g => (
        <div key={g.id} style={CARD({ marginBottom:8 })}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:3 }}>{g.employee_name || "—"}</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <span style={TAG()}>{g.template_name}</span>
                <span style={TAG()}>{g.country}</span>
                <span style={{ fontSize:11, color:B.g3 }}>by {g.user_name || "—"}</span>
              </div>
            </div>
            <span style={{ fontSize:11, color:B.g3, minWidth:140, textAlign:"right" }}>{formatDate(g.generated_at)}</span>
            <button style={{ ...BS, padding:"6px 14px", fontSize:12 }} onClick={() => setExpanded(expanded === g.id ? null : g.id)}>
              {expanded === g.id ? "Collapse" : "View"}
            </button>
            <button
              style={{ ...BP, padding:"6px 14px", fontSize:12, opacity:redownloading === g.id ? 0.6 : 1 }}
              onClick={() => redownload(g)}
              disabled={redownloading === g.id}
            >
              {redownloading === g.id ? "…" : "↓ Re-download"}
            </button>
          </div>

          {expanded === g.id && (
            <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${B.g2}` }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:B.g3, marginBottom:8 }}>Document snapshot</div>
              {(() => {
                try {
                  const snap = typeof g.snapshot === "string" ? JSON.parse(g.snapshot) : (g.snapshot || {});
                  return (
                    <div style={{ fontSize:12, color:B.g3 }}>
                      <div style={{ marginBottom:4 }}><strong>Template:</strong> {snap.tmpl?.name}</div>
                      <div style={{ marginBottom:4 }}><strong>Employee:</strong> {snap.emp?.employee_name} · {snap.emp?.country} · Grade {snap.emp?.grade}</div>
                      <div style={{ marginBottom:4 }}><strong>Sections:</strong> {snap.resolved?.length || 0}</div>
                      <div style={{ marginBottom:4 }}><strong>Rules fired:</strong> {snap.firedRules?.length || 0}</div>
                      {snap.disabledRules?.length > 0 && <div style={{ marginBottom:4 }}><strong>Rules overridden:</strong> {snap.disabledRules.length}</div>}
                      {snap.firedRules?.length > 0 && <div style={{ paddingLeft:12 }}>{snap.firedRules.map((r, i) => <div key={i}>· {r.name}</div>)}</div>}
                    </div>
                  );
                } catch { return <div style={{ fontSize:12, color:B.g3 }}>Snapshot not available.</div>; }
              })()}
            </div>
          )}
        </div>
      ))}

      <div style={{ display:"flex", gap:8, justifyContent:"center", marginTop:16, alignItems:"center" }}>
        <button style={{ ...BS, padding:"6px 14px", fontSize:12, opacity:page === 0 ? 0.4 : 1 }} disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Previous</button>
        <span style={{ fontSize:12, color:B.g3 }}>Page {page + 1} · {total} total</span>
        <button style={{ ...BS, padding:"6px 14px", fontSize:12, opacity:gens.length < PAGE_SIZE ? 0.4 : 1 }} disabled={gens.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>Next →</button>
      </div>
    </div>
  );
}

// ── Main HistoryTab ────────────────────────────────────────────────────────────
export default function HistoryTab() {
  const [sub, setSub] = useState("audit");

  const STABS = [
    { id:"audit",     label:"Audit Log" },
    { id:"documents", label:"Document History" },
  ];

  return (
    <div>
      <div style={{ display:"flex", gap:2, marginBottom:20, borderBottom:`1.5px solid ${B.g2}` }}>
        {STABS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)} style={{ padding:"8px 16px", background:"transparent", border:"none", borderBottom:`2px solid ${sub === t.id ? B.red : "transparent"}`, cursor:"pointer", fontSize:12, fontWeight:sub === t.id ? 700 : 500, color:sub === t.id ? B.black : B.g3, fontFamily:"'Montserrat',sans-serif", marginBottom:-2 }}>
            {t.label}
          </button>
        ))}
      </div>
      {sub === "audit"     && <AuditLog/>}
      {sub === "documents" && <DocHistory/>}
    </div>
  );
}
