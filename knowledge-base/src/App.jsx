import { useState, useCallback } from "react";
import { useKbState } from "./useKbState.js";
import { B } from "./components/shared.jsx";
import HomeView from "./components/HomeView.jsx";
import BrowseView from "./components/BrowseView.jsx";
import ArticleView from "./components/ArticleView.jsx";
import ArticleEditor from "./components/ArticleEditor.jsx";
import AdminView from "./components/AdminView.jsx";

// View state machine:
// { type: "home" }
// { type: "browse", categoryId? }
// { type: "article", id }
// { type: "editor", id? }   (null id = new article)
// { type: "admin" }

const NAV_TABS = [
  { key: "home",   label: "Home",    icon: "🏠" },
  { key: "browse", label: "Browse",  icon: "📂" },
];

export default function App() {
  const kb = useKbState();
  const [view, setView] = useState({ type: "home" });

  const navigate = useCallback((v) => setView(v), []);

  // Handle navigation signals from child components
  const handleOpenArticle = useCallback((sig) => {
    if (sig._openId) {
      navigate({ type: "article", id: sig._openId });
    } else if (sig._browseCat) {
      navigate({ type: "browse", categoryId: sig._browseCat });
    }
  }, [navigate]);

  const handleNewArticle = useCallback((opts={}) => {
    navigate({ type: "editor", id: null, prefillTitle: opts.prefillTitle });
  }, [navigate]);

  const handleEditArticle = useCallback((id) => {
    navigate({ type: "editor", id });
  }, [navigate]);

  const handleEditorSaved = useCallback((id) => {
    // After saving, open the article
    navigate({ type: "article", id });
  }, [navigate]);

  if (kb.loading) return <SplashScreen />;
  if (kb.error)   return <ErrorScreen message={kb.error} />;

  const isAdmin = kb.user.role === "Admin";

  return (
    <div style={{minHeight:"100vh", background:B.g1, fontFamily:"'Montserrat',sans-serif"}}>

      {/* ── Top navigation bar ── */}
      <header style={{
        background:B.black, height:56, display:"flex", alignItems:"center",
        padding:"0 24px", gap:0, position:"sticky", top:0, zIndex:100,
        boxShadow:"0 2px 8px rgba(0,0,0,0.2)",
      }}>
        {/* Logo / brand */}
        <div style={{display:"flex", alignItems:"center", gap:10, marginRight:32}}>
          <div style={{
            width:30, height:30, borderRadius:6,
            background:B.teal, display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:16, fontWeight:700,
          }}>
            K
          </div>
          <div>
            <div style={{color:B.white, fontSize:13, fontWeight:700, lineHeight:1.1}}>Knowledge Base</div>
            <div style={{color:B.g3, fontSize:9, letterSpacing:"0.08em", textTransform:"uppercase"}}>HRSC · EMEA</div>
          </div>
        </div>

        {/* Nav tabs */}
        <div style={{display:"flex", gap:2, flex:1}}>
          {NAV_TABS.map(t => {
            const active = view.type === t.key || (t.key==="browse" && view.type==="browse");
            return (
              <button key={t.key} onClick={() => navigate({ type: t.key })} style={{
                padding:"8px 16px",
                border:"none", borderRadius:6,
                color: active ? B.white : B.g3,
                fontWeight: active ? 700 : 500,
                fontSize:12, fontFamily:"'Montserrat',sans-serif", cursor:"pointer",
                background: active ? "rgba(255,255,255,0.1)" : "transparent",
              }}>
                {t.icon} {t.label}
              </button>
            );
          })}
          {isAdmin && (
            <button onClick={() => navigate({ type: "admin" })} style={{
              padding:"8px 16px",
              border:"none", borderRadius:6,
              color: view.type==="admin" ? B.white : B.g3,
              fontWeight: view.type==="admin" ? 700 : 500,
              fontSize:12, fontFamily:"'Montserrat',sans-serif", cursor:"pointer",
              background: view.type==="admin" ? "rgba(255,255,255,0.1)" : "transparent",
            }}>
              ⚙ Admin
            </button>
          )}
        </div>

        {/* New article shortcut */}
        <button onClick={() => navigate({ type:"editor", id:null })} style={{
          padding:"7px 16px", background:B.teal, color:B.white, border:"none",
          borderRadius:6, fontSize:12, fontWeight:700, fontFamily:"'Montserrat',sans-serif",
          cursor:"pointer", marginRight:16,
        }}>
          + New
        </button>

        {/* User pill */}
        <div style={{
          display:"flex", alignItems:"center", gap:8,
          background:"rgba(255,255,255,0.08)", borderRadius:20, padding:"5px 12px",
        }}>
          <div style={{width:22, height:22, borderRadius:"50%", background:B.teal, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:B.white}}>
            {(kb.user.name||"?")[0].toUpperCase()}
          </div>
          <div>
            <div style={{color:B.white, fontSize:11, fontWeight:600, lineHeight:1}}>{kb.user.name||"Unknown"}</div>
            <div style={{color:B.g3, fontSize:9}}>{kb.user.role}</div>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main>
        {view.type === "home" && (
          <HomeView
            user={kb.user}
            categories={kb.categories}
            favourites={kb.favourites}
            onOpenArticle={handleOpenArticle}
            onNewArticle={handleNewArticle}
            isFavourited={kb.isFavourited}
            toggleFavourite={kb.toggleFavourite}
          />
        )}
        {view.type === "browse" && (
          <BrowseView
            user={kb.user}
            categories={kb.categories}
            initialCategoryId={view.categoryId}
            onOpenArticle={handleOpenArticle}
            onNewArticle={handleNewArticle}
            isFavourited={kb.isFavourited}
            toggleFavourite={kb.toggleFavourite}
          />
        )}
        {view.type === "article" && (
          <ArticleView
            articleId={view.id}
            user={kb.user}
            categories={kb.categories}
            isFavourited={kb.isFavourited}
            toggleFavourite={kb.toggleFavourite}
            onEdit={handleEditArticle}
            onBack={() => window.history.length > 1 ? setView({ type: "home" }) : setView({ type: "home" })}
            onOpenArticle={handleOpenArticle}
          />
        )}
        {view.type === "editor" && (
          <ArticleEditor
            articleId={view.id || null}
            user={kb.user}
            categories={kb.categories}
            onSaved={handleEditorSaved}
            onCancel={() => view.id ? navigate({ type:"article", id:view.id }) : navigate({ type:"home" })}
          />
        )}
        {view.type === "admin" && (
          <AdminView
            user={kb.user}
            categories={kb.categories}
            onOpenArticle={handleOpenArticle}
            onNewArticle={handleNewArticle}
            refreshCategories={kb.refreshCategories}
            refreshStats={kb.refreshStats}
          />
        )}
      </main>
    </div>
  );
}

function SplashScreen() {
  return (
    <div style={{
      minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:B.g1, fontFamily:"'Montserrat',sans-serif",
    }}>
      <div style={{textAlign:"center"}}>
        <div style={{width:56, height:56, borderRadius:12, background:B.teal, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, fontWeight:700, color:B.white, margin:"0 auto 16px"}}>
          K
        </div>
        <div style={{fontSize:16, fontWeight:700, color:B.black, marginBottom:6}}>HRSC Knowledge Base</div>
        <div style={{fontSize:12, color:B.g3}}>Loading…</div>
      </div>
    </div>
  );
}

function ErrorScreen({ message }) {
  return (
    <div style={{
      minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:B.g1, fontFamily:"'Montserrat',sans-serif", textAlign:"center",
    }}>
      <div>
        <div style={{fontSize:48, marginBottom:16}}>⚠️</div>
        <div style={{fontSize:16, fontWeight:700, color:B.red, marginBottom:8}}>Unable to load Knowledge Base</div>
        <div style={{fontSize:12, color:B.g3, maxWidth:400}}>{message}</div>
        <div style={{fontSize:11, color:B.g3, marginTop:16}}>
          Ensure the D1 database is configured and the schema has been applied.
        </div>
      </div>
    </div>
  );
}
