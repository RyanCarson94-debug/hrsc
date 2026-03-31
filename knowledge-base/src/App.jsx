import { useState, useCallback, useEffect } from "react";
import { useKbState } from "./useKbState.js";
import { B, SH, BP } from "./components/shared.jsx";
import HomeView from "./components/HomeView.jsx";
import BrowseView from "./components/BrowseView.jsx";
import ArticleView from "./components/ArticleView.jsx";
import ArticleEditor from "./components/ArticleEditor.jsx";
import AdminView from "./components/AdminView.jsx";

// View state machine:
// { type: "home" }
// { type: "browse", categoryId? }
// { type: "article", id, articleNum?, articleTitle? }
// { type: "editor", id?, prefillTitle? }
// { type: "admin" }

export default function App() {
  const kb = useKbState();

  // Initialise view from URL ?article= param (for AI-generated deep links)
  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const articleId = params.get("article");
    if (articleId) return { type: "article", id: articleId };
    return { type: "home" };
  });

  // Keep URL in sync with view so article links are shareable / bookmarkable
  const navigate = useCallback((v) => {
    setView(v);
    const url = new URL(window.location.href);
    if (v.type === "article" && v.id) {
      url.searchParams.set("article", v.id);
    } else {
      url.searchParams.delete("article");
    }
    window.history.pushState(null, "", url.toString());
  }, []);

  // Handle browser back/forward
  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      const articleId = params.get("article");
      if (articleId) {
        setView({ type: "article", id: articleId });
      } else {
        setView({ type: "home" });
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const handleOpenArticle = useCallback((sig) => {
    if (sig._openId) {
      navigate({ type: "article", id: sig._openId });
    } else if (sig._browseCat) {
      navigate({ type: "browse", categoryId: sig._browseCat });
    }
  }, [navigate]);

  const handleNewArticle = useCallback((opts = {}) => {
    navigate({ type: "editor", id: null, prefillTitle: opts.prefillTitle });
  }, [navigate]);

  const handleEditorSaved = useCallback((id) => {
    navigate({ type: "article", id });
  }, [navigate]);

  if (kb.loading) return <SplashScreen />;
  if (kb.error)   return <ErrorScreen message={kb.error} />;

  const isAdmin = kb.user.role === "Admin";

  // Build breadcrumbs for sub-views
  const crumbs = (() => {
    if (view.type === "browse") {
      const c = [{ label: "Home", nav: { type: "home" } }, { label: "Browse" }];
      if (view.categoryId) {
        const cat = kb.categories.find(x => x.id === view.categoryId);
        if (cat) c.push({ label: cat.name });
      }
      return c;
    }
    if (view.type === "article") {
      const label = view.articleNum
        ? (view.articleTitle ? `${view.articleNum} — ${view.articleTitle.slice(0, 48)}${view.articleTitle.length > 48 ? "…" : ""}` : view.articleNum)
        : "Article";
      return [
        { label: "Home", nav: { type: "home" } },
        { label: "Browse", nav: { type: "browse" } },
        { label },
      ];
    }
    if (view.type === "editor") {
      return [
        { label: "Home", nav: { type: "home" } },
        { label: view.id ? "Edit Article" : "New Article" },
      ];
    }
    if (view.type === "admin") {
      return [{ label: "Home", nav: { type: "home" } }, { label: "Admin" }];
    }
    return [];
  })();

  return (
    <div style={{ minHeight: "100vh", background: B.g1, fontFamily: "'Montserrat',sans-serif" }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── Top navigation bar ── */}
      <header style={{
        background: B.black, height: 56, display: "flex", alignItems: "stretch",
        padding: "0 24px", position: "sticky", top: 0, zIndex: 200,
        boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
      }}>
        {/* Logo */}
        <button onClick={() => navigate({ type: "home" })} style={{
          display: "flex", alignItems: "center", gap: 10, marginRight: 24,
          background: "none", border: "none", cursor: "pointer", padding: "0 4px", flexShrink: 0,
        }}>
          <img src="/askhr-logo.png" alt="AskHR" style={{ height: 26, objectFit: "contain" }}
            onError={e => { e.currentTarget.style.display = "none"; }} />
          <span style={{ width: 1, height: 18, background: "rgba(255,255,255,0.18)", display: "block" }} />
          <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 600, letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
            Knowledge Base
          </span>
        </button>

        {/* Nav tabs */}
        <nav style={{ display: "flex", alignItems: "stretch", gap: 2, flex: 1 }}>
          {[{ key: "home", label: "Home" }, { key: "browse", label: "Browse" }].map(t => (
            <NavTab key={t.key} label={t.label} active={view.type === t.key} onClick={() => navigate({ type: t.key })} />
          ))}
          {isAdmin && (
            <NavTab label="Admin" active={view.type === "admin"} onClick={() => navigate({ type: "admin" })} />
          )}
        </nav>

        {/* Right controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => navigate({ type: "editor", id: null })} style={{
            padding: "7px 16px", background: B.teal, color: B.white, border: "none",
            borderRadius: 7, fontSize: 12, fontWeight: 700, fontFamily: "'Montserrat',sans-serif",
            cursor: "pointer", letterSpacing: "0.02em",
            boxShadow: "0 2px 8px rgba(0,162,138,0.35)",
            transition: "background 0.15s",
          }}>
            + New Article
          </button>
          <UserPill user={kb.user} />
        </div>
      </header>

      {/* ── Breadcrumb bar ── */}
      {crumbs.length > 0 && (
        <div style={{
          background: B.white, borderBottom: `1px solid ${B.g2}`,
          padding: "0 28px", height: 36,
          display: "flex", alignItems: "center",
        }}>
          <nav aria-label="breadcrumb" style={{ display: "flex", alignItems: "center", gap: 3 }}>
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                {i > 0 && <span style={{ color: B.g3, fontSize: 11, userSelect: "none" }}>›</span>}
                {c.nav ? (
                  <button onClick={() => navigate(c.nav)} style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: B.teal, fontSize: 11, fontWeight: 600,
                    fontFamily: "'Montserrat',sans-serif", padding: "0 2px",
                  }}>
                    {c.label}
                  </button>
                ) : (
                  <span style={{ color: B.g4, fontSize: 11, fontWeight: 500 }}>{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        </div>
      )}

      {/* ── Main content ── */}
      <main>
        {view.type === "home" && (
          <HomeView
            user={kb.user}
            categories={kb.categories}
            countries={kb.countries}
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
            countries={kb.countries}
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
            onEdit={(id) => navigate({ type: "editor", id })}
            onBack={() => navigate({ type: "browse" })}
            onOpenArticle={handleOpenArticle}
            onArticleLoaded={(a) =>
              setView(v => ({
                ...v,
                articleNum: a.article_num,
                articleTitle: a.title,
              }))
            }
          />
        )}
        {view.type === "editor" && (
          <ArticleEditor
            articleId={view.id || null}
            prefillTitle={view.prefillTitle}
            user={kb.user}
            categories={kb.categories}
            countries={kb.countries}
            onSaved={handleEditorSaved}
            onCancel={() =>
              view.id
                ? navigate({ type: "article", id: view.id })
                : navigate({ type: "home" })
            }
          />
        )}
        {view.type === "admin" && (
          <AdminView
            user={kb.user}
            categories={kb.categories}
            countries={kb.countries}
            onOpenArticle={handleOpenArticle}
            onNewArticle={handleNewArticle}
            refreshCategories={kb.refreshCategories}
            refreshCountries={kb.refreshCountries}
            refreshStats={kb.refreshStats}
          />
        )}
      </main>
    </div>
  );
}

// ─── Nav tab ───────────────────────────────────────────────────────────────────
function NavTab({ label, active, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: "relative", padding: "0 16px", background: "none", border: "none",
        color: active ? B.white : hov ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.45)",
        fontWeight: active ? 700 : 500, fontSize: 12,
        fontFamily: "'Montserrat',sans-serif", cursor: "pointer",
        transition: "color 0.15s", letterSpacing: "0.02em",
      }}
    >
      {label}
      {active && (
        <span style={{
          position: "absolute", bottom: 0, left: 10, right: 10,
          height: 2, background: B.teal, borderRadius: "2px 2px 0 0",
        }} />
      )}
    </button>
  );
}

// ─── User pill ─────────────────────────────────────────────────────────────────
function UserPill({ user }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 24, padding: "3px 10px 3px 3px",
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
        background: `linear-gradient(135deg, ${B.teal} 0%, ${B.tealDark} 100%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 800, color: B.white,
      }}>
        {(user.name || "?")[0].toUpperCase()}
      </div>
      <div>
        <div style={{ color: B.white, fontSize: 11, fontWeight: 600, lineHeight: 1.2, whiteSpace: "nowrap" }}>
          {user.name || "Unknown"}
        </div>
        <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {user.role}
        </div>
      </div>
    </div>
  );
}

// ─── Splash screen ─────────────────────────────────────────────────────────────
function SplashScreen() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: `linear-gradient(160deg, ${B.black} 0%, #2d2829 100%)`,
      fontFamily: "'Montserrat',sans-serif",
    }}>
      <img src="/askhr-logo.png" alt="AskHR" style={{ height: 40, marginBottom: 20, opacity: 0.88 }}
        onError={e => { e.currentTarget.style.display = "none"; }} />
      <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.6)", marginBottom: 28 }}>
        Knowledge Base
      </div>
      <div style={{ display: "flex", gap: 7 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: "50%", background: B.teal,
            animation: `kbDot 1.2s ease-in-out ${i * 0.18}s infinite`,
          }} />
        ))}
      </div>
      <style>{`@keyframes kbDot{0%,100%{opacity:0.25;transform:scale(0.75)}50%{opacity:1;transform:scale(1.15)}}`}</style>
    </div>
  );
}

// ─── Error screen ──────────────────────────────────────────────────────────────
function ErrorScreen({ message }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: B.g1, fontFamily: "'Montserrat',sans-serif", padding: 24,
    }}>
      <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18, margin: "0 auto 20px",
          background: "#FEF0F0", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26, color: "#C0392B",
        }}>⚠</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: B.black, marginBottom: 12 }}>
          Unable to load Knowledge Base
        </div>
        <div style={{
          background: B.white, border: `1px solid ${B.g2}`, borderRadius: 10,
          padding: "12px 16px", marginBottom: 16, textAlign: "left",
          fontSize: 12, fontFamily: "monospace", color: B.g4,
          wordBreak: "break-all", lineHeight: 1.6,
        }}>
          {message}
        </div>
        <div style={{ fontSize: 12, color: B.g3, marginBottom: 20, lineHeight: 1.6 }}>
          Ensure the D1 database is configured and the migration SQL has been applied via the Cloudflare dashboard.
        </div>
        <button onClick={() => window.location.reload()} style={{
          padding: "9px 24px", background: B.teal, color: B.white, border: "none",
          borderRadius: 8, fontSize: 12, fontWeight: 700,
          fontFamily: "'Montserrat',sans-serif", cursor: "pointer",
        }}>
          Retry
        </button>
      </div>
    </div>
  );
}

// ─── Global CSS ────────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; -webkit-font-smoothing: antialiased; }
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
  @keyframes kbDot{0%,100%{opacity:0.25;transform:scale(0.75)}50%{opacity:1;transform:scale(1.15)}}
  @keyframes kbToastIn{from{opacity:0;transform:translateY(16px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}
  @keyframes kbSkeleton{0%{background-position:200% 0}100%{background-position:-200% 0}}
  [data-placeholder]:empty:before{content:attr(data-placeholder);color:#9B9799;pointer-events:none}
`;
