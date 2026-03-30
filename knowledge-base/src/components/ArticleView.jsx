import { useState, useEffect } from "react";
import { B, SH, CARD, BP, BPR, BS, BG, TAG, TypeBadge, StatusBadge, RichContent, typeMeta, Skeleton } from "./shared.jsx";
import * as api from "../api.js";

export default function ArticleView({ articleId, user, categories, isFavourited, toggleFavourite, onEdit, onBack, onOpenArticle, onArticleLoaded }) {
  const [article, setArticle]           = useState(null);
  const [related, setRelated]           = useState([]);
  const [comments, setComments]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [newComment, setNewComment]     = useState("");
  const [submittingStatus, setSubmittingStatus] = useState(false);
  const [toast, setToast]               = useState(null);

  useEffect(() => {
    if (!articleId) return;
    setLoading(true);
    setArticle(null);
    Promise.all([
      api.getArticle(articleId),
      api.getRelated(articleId),
      api.getComments(articleId),
    ]).then(([a, r, c]) => {
      setArticle(a);
      setRelated(r);
      setComments(c);
      onArticleLoaded?.(a);
      setLoading(false);
    }).catch(e => {
      setError(e.message);
      setLoading(false);
    });
  }, [articleId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFeedback = async (helpful) => {
    if (feedbackDone) return;
    await api.submitFeedback(articleId, { helpful, userName: user.name });
    setFeedbackDone(true);
    setArticle(prev => ({
      ...prev,
      helpful_yes: helpful ? (prev.helpful_yes || 0) + 1 : prev.helpful_yes,
      helpful_no: !helpful ? (prev.helpful_no || 0) + 1 : prev.helpful_no,
    }));
  };

  const handleStatusChange = async (status) => {
    setSubmittingStatus(true);
    try {
      await api.changeStatus(articleId, status, { reviewedBy: user.name });
      setArticle(prev => ({ ...prev, status }));
      showToast(`Article ${status}`, "success");
    } catch (e) { showToast("Error: " + e.message, "error"); }
    setSubmittingStatus(false);
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    await api.addComment(articleId, { comment: newComment.trim(), authorName: user.name });
    setNewComment("");
    const c = await api.getComments(articleId);
    setComments(c);
  };

  const handleResolveComment = async (commentId, resolved) => {
    await api.resolveComment(commentId, resolved);
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, resolved: resolved ? 1 : 0 } : c));
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  if (loading) return <LoadingPane />;
  if (error)   return <ErrorPane message={error} onBack={onBack} />;
  if (!article) return null;

  const meta       = typeMeta(article.article_type);
  const cat        = categories.find(c => c.id === article.category_id);
  const tags       = (() => { try { return JSON.parse(article.tags || "[]"); } catch { return []; } })();
  const countries  = (() => { try { return JSON.parse(article.countries || '["All EMEA"]'); } catch { return ["All EMEA"]; } })();
  const isFav      = isFavourited(articleId);
  const isAdmin    = user.role === "Admin";
  const isAuthor   = article.author_name === user.name;
  const canEdit    = isAdmin || (isAuthor && ["draft", "review"].includes(article.status));
  const openComments = comments.filter(c => !c.resolved);

  const sections = [
    { label: meta.sections[0], icon: meta.sectionIcons[0], content: article.section1 },
    { label: meta.sections[1], icon: meta.sectionIcons[1], content: article.section2 },
    { label: meta.sections[2], icon: meta.sectionIcons[2], content: article.section3 },
    { label: meta.sections[3] || meta.s4label, icon: meta.sectionIcons[3], content: article.section4, optional: true },
  ];

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 24px 48px" }}>

      {/* ── Article header card ── */}
      <div style={{
        background: B.white, borderRadius: 14,
        border: `1px solid ${B.g2}`, boxShadow: SH.sm,
        marginBottom: 16, overflow: "hidden",
      }}>
        {/* Color top stripe */}
        <div style={{ height: 4, background: `linear-gradient(90deg, ${meta.color}, ${meta.color}80)` }} />

        <div style={{ padding: "24px 28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Badges row */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, color: meta.color, letterSpacing: "0.06em",
                  background: meta.lightBg, padding: "3px 10px", borderRadius: 6,
                }}>
                  {article.article_num}
                </span>
                <TypeBadge type={article.article_type} />
                <StatusBadge status={article.status} />
                {cat && (
                  <span style={{ ...TAG(cat.color + "15", cat.color), fontSize: 10 }}>{cat.name}</span>
                )}
              </div>

              {/* Title */}
              <h1 style={{
                fontSize: 22, fontWeight: 800, color: B.black,
                lineHeight: 1.3, margin: "0 0 14px", letterSpacing: "-0.01em",
              }}>
                {article.title}
              </h1>

              {/* Workday path (QRG) */}
              {article.article_type === "qrg" && article.workday_path && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: B.tealLight, border: `1px solid ${B.teal}30`,
                  borderRadius: 8, padding: "7px 14px", marginBottom: 14,
                }}>
                  <span style={{ fontSize: 13, color: B.teal }}>☰</span>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: B.teal, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Workday Path</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: B.black, fontFamily: "monospace" }}>{article.workday_path}</div>
                  </div>
                </div>
              )}

              {/* Meta row */}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11, color: B.g3 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10 }}>✍</span> {article.author_name}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10 }}>📅</span>{" "}
                  {new Date(article.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10 }}>👁</span> {article.view_count || 0} views
                </span>
                {article.last_reviewed_at && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 10, color: B.teal }}>✓</span>{" "}
                    Reviewed {new Date(article.last_reviewed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
              </div>
            </div>

            {/* Bookmark button */}
            <button
              title={isFav ? "Remove bookmark" : "Bookmark this article"}
              onClick={() => toggleFavourite(articleId)}
              style={{
                background: isFav ? "#FFF8E1" : B.g1,
                border: `1.5px solid ${isFav ? B.yellow : B.g2}`,
                borderRadius: 10, cursor: "pointer",
                fontSize: 20, color: isFav ? B.yellow : B.g3,
                padding: "8px 12px", transition: "all 0.15s", flexShrink: 0,
                lineHeight: 1,
              }}
            >
              {isFav ? "★" : "☆"}
            </button>
          </div>

          {/* Tags + countries */}
          {(tags.length > 0 || countries.length > 0) && (
            <div style={{
              display: "flex", gap: 6, flexWrap: "wrap",
              marginTop: 16, paddingTop: 14, borderTop: `1px solid ${B.g2}`,
            }}>
              {tags.map(t => (
                <span key={t} style={{ ...TAG(), fontSize: 10, padding: "3px 10px" }}>{t}</span>
              ))}
              {countries.includes("All EMEA")
                ? <span style={{ ...TAG(B.blue + "15", B.blue), fontSize: 10 }}>🌍 All EMEA</span>
                : countries.map(c => (
                  <span key={c} style={{ ...TAG(B.blue + "15", B.blue), fontSize: 10 }}>🌍 {c}</span>
                ))
              }
            </div>
          )}

          {/* Action bar */}
          <div style={{
            display: "flex", gap: 8, marginTop: 16, paddingTop: 14,
            borderTop: `1px solid ${B.g2}`, flexWrap: "wrap",
          }}>
            {canEdit && (
              <button style={{ ...BP, padding: "8px 16px", fontSize: 12 }} onClick={() => onEdit(articleId)}>
                Edit
              </button>
            )}
            {(isAuthor || isAdmin) && article.status === "draft" && (
              <button style={{ ...BS, padding: "8px 16px", fontSize: 12 }} disabled={submittingStatus}
                onClick={() => handleStatusChange("review")}>
                Submit for Review
              </button>
            )}
            {isAdmin && article.status === "review" && (
              <>
                <button style={{ ...BP, padding: "8px 16px", fontSize: 12 }} disabled={submittingStatus}
                  onClick={() => handleStatusChange("published")}>
                  ✓ Publish
                </button>
                <button style={{ ...BS, padding: "8px 16px", fontSize: 12, color: B.g4 }} disabled={submittingStatus}
                  onClick={() => handleStatusChange("draft")}>
                  Return to Draft
                </button>
              </>
            )}
            {isAdmin && article.status === "published" && (
              <button style={{ ...BS, padding: "8px 16px", fontSize: 12, color: B.g3 }} disabled={submittingStatus}
                onClick={() => handleStatusChange("archived")}>
                Archive
              </button>
            )}
            {isAdmin && article.status === "archived" && (
              <button style={{ ...BS, padding: "8px 16px", fontSize: 12 }} disabled={submittingStatus}
                onClick={() => handleStatusChange("published")}>
                Restore
              </button>
            )}
            <ExportButton article={article} meta={meta} />
          </div>
        </div>
      </div>

      {/* ── Article sections ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        {sections.map((sec, i) => {
          if (sec.optional && !sec.content) return null;
          return (
            <div key={i} style={{
              background: B.white, borderRadius: 12,
              border: `1px solid ${B.g2}`, boxShadow: SH.xs,
              overflow: "hidden",
            }}>
              {/* Section header */}
              <div style={{
                padding: "12px 24px",
                background: meta.lightBg,
                borderBottom: `1px solid ${meta.color}20`,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ fontSize: 14 }}>{sec.icon}</span>
                <span style={{
                  fontSize: 10, fontWeight: 800, color: meta.color,
                  textTransform: "uppercase", letterSpacing: "0.1em",
                }}>
                  {sec.label}
                </span>
              </div>
              {/* Section content */}
              <div style={{ padding: "18px 24px" }}>
                <RichContent html={sec.content} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Helpful feedback ── */}
      <div style={{
        background: B.white, borderRadius: 12, border: `1px solid ${B.g2}`,
        padding: "20px 28px", marginBottom: 16, textAlign: "center", boxShadow: SH.xs,
      }}>
        {feedbackDone ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>🙏</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: B.teal }}>Thank you for your feedback!</div>
              <div style={{ fontSize: 11, color: B.g3, marginTop: 2 }}>Your response helps improve the knowledge base.</div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: B.black, marginBottom: 4 }}>
              Was this article helpful?
            </div>
            <div style={{ fontSize: 11, color: B.g3, marginBottom: 14 }}>
              Your feedback helps us improve our knowledge base.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <FeedbackBtn onClick={() => handleFeedback(true)} emoji="👍" label="Yes, helpful" count={article.helpful_yes} color={B.teal} />
              <FeedbackBtn onClick={() => handleFeedback(false)} emoji="👎" label="Not helpful" count={article.helpful_no} color={B.g3} />
            </div>
          </>
        )}
      </div>

      {/* ── Related articles ── */}
      {related.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionDivider label="Related Articles" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 10, marginTop: 10 }}>
            {related.map(r => {
              const rm = typeMeta(r.article_type);
              return (
                <button key={r.id} onClick={() => onOpenArticle({ _openId: r.id })} style={{
                  background: B.white, border: `1.5px solid ${B.g2}`,
                  borderRadius: 10, padding: "12px 14px", textAlign: "left",
                  cursor: "pointer", fontFamily: "'Montserrat',sans-serif",
                  display: "flex", gap: 10, alignItems: "flex-start",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  boxShadow: SH.xs,
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = rm.color; e.currentTarget.style.boxShadow = SH.sm; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = B.g2; e.currentTarget.style.boxShadow = SH.xs; }}>
                  <div style={{ width: 3, background: rm.color, borderRadius: 2, flexShrink: 0, alignSelf: "stretch" }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: rm.color, marginBottom: 3 }}>{r.article_num}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: B.black, lineHeight: 1.4 }}>{r.title}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Internal review comments ── */}
      {(isAdmin || isAuthor) && (
        <div style={{
          background: B.white, borderRadius: 12, border: `1px solid ${B.g2}`,
          padding: "20px 24px", marginBottom: 16, boxShadow: SH.xs,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <SectionDivider label="Review Comments" />
            {openComments.length > 0 && (
              <span style={{
                background: "#FEF9EC", color: "#7A5C00",
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                flexShrink: 0,
              }}>
                {openComments.length} open
              </span>
            )}
          </div>

          {comments.length === 0 && (
            <div style={{ fontSize: 12, color: B.g3, marginBottom: 12 }}>No review comments yet.</div>
          )}

          {comments.map(c => (
            <div key={c.id} style={{
              padding: "10px 14px", borderRadius: 8, marginBottom: 8,
              background: c.resolved ? B.g0 : "#FFFBEB",
              border: `1px solid ${c.resolved ? B.g2 : "#F5C01740"}`,
              opacity: c.resolved ? 0.7 : 1,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: B.black }}>{c.author_name}</span>
                  <span style={{ fontSize: 10, color: B.g3 }}>
                    {new Date(c.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {c.resolved ? (
                    <span style={{ ...TAG(), fontSize: 9, padding: "1px 7px" }}>resolved</span>
                  ) : null}
                </div>
                {isAdmin && (
                  <button onClick={() => handleResolveComment(c.id, !c.resolved)} style={{
                    background: "none", border: `1px solid ${B.g2}`, borderRadius: 6,
                    cursor: "pointer", fontSize: 10, fontWeight: 600,
                    color: c.resolved ? B.teal : B.g3, padding: "2px 8px",
                    fontFamily: "'Montserrat',sans-serif",
                  }}>
                    {c.resolved ? "Reopen" : "Resolve"}
                  </button>
                )}
              </div>
              <div style={{ fontSize: 12, color: B.black, lineHeight: 1.5 }}>{c.comment}</div>
            </div>
          ))}

          {(isAdmin || article.status === "review") && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                value={newComment} onChange={e => setNewComment(e.target.value)}
                placeholder="Add a review comment…"
                onKeyDown={e => e.key === "Enter" && handleAddComment()}
                style={{
                  flex: 1, padding: "9px 12px", borderRadius: 7,
                  border: `1.5px solid ${B.g2}`, fontSize: 12,
                  fontFamily: "'Montserrat',sans-serif", outline: "none",
                }}
                onFocus={e => e.target.style.borderColor = B.teal}
                onBlur={e => e.target.style.borderColor = B.g2}
              />
              <button style={{ ...BP, padding: "9px 16px", fontSize: 12 }} onClick={handleAddComment}>
                Add
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 9999,
          background: toast.type === "error" ? B.red : B.teal,
          color: B.white, padding: "12px 20px", borderRadius: 10,
          fontSize: 13, fontWeight: 600, fontFamily: "'Montserrat',sans-serif",
          boxShadow: SH.lg, display: "flex", alignItems: "center", gap: 10,
          animation: "kbToastIn 0.25s cubic-bezier(0.34,1.56,0.64,1)",
        }}>
          <span>{toast.type === "error" ? "✕" : "✓"}</span>
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} style={{
            background: "rgba(255,255,255,0.25)", border: "none", borderRadius: 4,
            color: B.white, cursor: "pointer", fontSize: 11, padding: "2px 6px",
            fontFamily: "'Montserrat',sans-serif",
          }}>×</button>
        </div>
      )}
    </div>
  );
}

// ─── Feedback button ───────────────────────────────────────────────────────────
function FeedbackBtn({ onClick, emoji, label, count, color }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        padding: "10px 22px",
        background: hov ? color + "12" : B.white,
        border: `1.5px solid ${hov ? color : B.g2}`,
        borderRadius: 8, cursor: "pointer",
        fontSize: 13, fontFamily: "'Montserrat',sans-serif",
        color: hov ? color : B.g4,
        fontWeight: 600, transition: "all 0.15s",
        display: "flex", alignItems: "center", gap: 6,
      }}
    >
      <span style={{ fontSize: 16 }}>{emoji}</span>
      <span>{label}</span>
      {count > 0 && (
        <span style={{
          background: color + "20", color,
          fontSize: 10, fontWeight: 700,
          padding: "1px 6px", borderRadius: 8,
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Section divider ───────────────────────────────────────────────────────────
function SectionDivider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flex: 1 }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: B.g3, whiteSpace: "nowrap" }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: B.g2 }} />
    </div>
  );
}

// ─── Export button ─────────────────────────────────────────────────────────────
function ExportButton({ article, meta }) {
  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    setExporting(true);
    try {
      const { exportArticle } = await import("../kbExport.js");
      await exportArticle(article, meta);
    } catch (e) { alert("Export failed: " + e.message); }
    setExporting(false);
  };
  return (
    <button style={{
      ...BS, padding: "8px 16px", fontSize: 12,
      display: "flex", alignItems: "center", gap: 6,
    }} onClick={handleExport} disabled={exporting}>
      <span>⬇</span>
      <span>{exporting ? "Exporting…" : "Export to Word"}</span>
    </button>
  );
}

// ─── Loading pane ──────────────────────────────────────────────────────────────
function LoadingPane() {
  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 24px" }}>
      <div style={{ background: B.white, borderRadius: 14, border: `1px solid ${B.g2}`, padding: "28px", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <Skeleton w={80} h={22} r={6} /><Skeleton w={100} h={22} r={10} /><Skeleton w={90} h={22} r={10} />
        </div>
        <Skeleton h={24} mb={10} /><Skeleton w="70%" h={24} mb={16} />
        <Skeleton h={14} mb={6} /><Skeleton w="85%" h={14} />
      </div>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ background: B.white, borderRadius: 12, border: `1px solid ${B.g2}`, padding: "18px 24px", marginBottom: 10 }}>
          <Skeleton w={120} h={14} mb={12} />
          <Skeleton h={13} mb={6} /><Skeleton h={13} mb={6} /><Skeleton w="75%" h={13} />
        </div>
      ))}
    </div>
  );
}

// ─── Error pane ────────────────────────────────────────────────────────────────
function ErrorPane({ message, onBack }) {
  return (
    <div style={{
      maxWidth: 480, margin: "80px auto", padding: 32, textAlign: "center",
      fontFamily: "'Montserrat',sans-serif",
    }}>
      <div style={{ fontSize: 40, marginBottom: 14 }}>⚠</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: B.red, marginBottom: 10 }}>Failed to load article</div>
      <div style={{ fontSize: 12, color: B.g3, marginBottom: 24, lineHeight: 1.6 }}>{message}</div>
      <button style={{ ...BS, padding: "9px 22px" }} onClick={onBack}>← Go Back</button>
    </div>
  );
}
