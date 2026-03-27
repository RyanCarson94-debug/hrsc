import { useState } from "react";
import { useAppState } from "./useAppState";
import GenerateTab   from "./components/GenerateTab";
import TemplatesTab  from "./components/TemplatesTab";
import ClausesTab    from "./components/ClausesTab";
import RulesTab      from "./components/RulesTab";
import SettingsTab   from "./components/SettingsTab";

const B = { red:"#FC1921", black:"#231F20", white:"#FFFFFF", g1:"#F1EFEA", g2:"#E2DFDA", g3:"#808284" };

export default function App() {
  const [tab, setTab] = useState("generate");
  const appState = useAppState();
  const { loading, error } = appState;

  const TABS = [
    { id:"generate",  label:"Generate Document" },
    { id:"templates", label:"Templates" },
    { id:"clauses",   label:"Clause Library" },
    { id:"rules",     label:"Rules Engine" },
    { id:"settings",  label:"Settings" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:B.g1, fontFamily:"'Montserrat',sans-serif", color:B.black }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap');`}</style>

      {/* Header */}
      <div style={{ background:B.black }}>
        <div style={{ maxWidth:1240, margin:"0 auto", padding:"0 2rem", display:"flex", alignItems:"center", justifyContent:"space-between", height:58 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:5, height:32, background:B.red, borderRadius:2, flexShrink:0 }}/>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:B.white, lineHeight:1, letterSpacing:"0.01em" }}>Contract Builder</div>
              <div style={{ fontSize:9, fontWeight:500, color:B.g3, letterSpacing:"0.1em", textTransform:"uppercase", marginTop:3 }}>HRSC · EMEA · 23 Countries</div>
            </div>
          </div>
          <nav style={{ display:"flex" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:"0 18px", height:58, background:"transparent", border:"none", borderBottom:`3px solid ${tab===t.id ? B.red : "transparent"}`, cursor:"pointer", fontSize:11, fontWeight:tab===t.id ? 700 : 500, color:tab===t.id ? B.white : B.g3, letterSpacing:"0.04em", transition:"all 0.15s", fontFamily:"'Montserrat',sans-serif", marginBottom:-1 }}>
                {t.label}
              </button>
            ))}
          </nav>
          <div style={{ fontSize:10, fontWeight:700, color:B.g3, letterSpacing:"0.12em" }}>CSL</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth:1240, margin:"0 auto", padding:"2rem" }}>
        {loading && (
          <div style={{ textAlign:"center", padding:"4rem", color:B.g3 }}>
            <div style={{ fontSize:13 }}>Loading…</div>
          </div>
        )}
        {error && (
          <div style={{ padding:"1rem", background:"#FEE2E2", border:"1.5px solid #FC1921", borderRadius:8, color:"#b91c1c", fontSize:13, marginBottom:16 }}>
            ⚠ Could not connect to API: {error}. Changes will not be saved until the API is available.
          </div>
        )}
        {!loading && tab === "generate"  && <GenerateTab  {...appState} />}
        {!loading && tab === "templates" && <TemplatesTab {...appState} />}
        {!loading && tab === "clauses"   && <ClausesTab   {...appState} />}
        {!loading && tab === "rules"     && <RulesTab     {...appState} />}
        {!loading && tab === "settings"  && <SettingsTab  {...appState} />}
      </div>
    </div>
  );
}
