import { useState, useEffect } from "react";
import { B, CARD, BP, BPR, BS, BG, TAG, LBL, TypeBadge, StatusBadge, RichContent, typeMeta, ARTICLE_TYPES } from "./shared.jsx";
import * as api from "../api.js";

export default function ArticleView({ articleId, user, categories, isFavourited, toggleFavourite, onEdit, onBack, onOpenArticle }) {
  const [article, setArticle]       = useState(null);
  const [related, setRelated]       = useState([]);
  const [comments, setComments]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingStatus, setSubmittingStatus] = useState(false);
  const [toast, setToast]           = useState("");

  useEffect(() => {
    if (!articleId) return;
    setLoading(true);
    Promise.all([
      api.getArticle(articleId),
      api.getRelated(articleId),
      api.getComments(articleId),
    ]).then(([a, r, c]) => {
      setArticle(a);
      setRelated(r);
      setComments(c);
      setLoading(false);
    }).catch(e => {
      setError(e.message);
      setLoading(false);
    });
  }, [articleId]);

  const handleFeedback = async (helpful) => {
    if (feedbackDone) return;
    await api.submitFeedback(articleId, { helpful, userName: user.name });
    setFeedbackDone(true);
    setArticle(prev => ({
      ...prev,
      helpful_yes: helpful ? (prev.helpful_yes||0)+1 : prev.helpful_yes,
      helpful_no:  !helpful ? (prev.helpful_no||0)+1  : prev.helpful_no,
    }));
  };

  const handleStatusChange = async (status) => {
    setSubmittingStatus(true);
    try {
      await api.changeStatus(articleId, status, { reviewedBy: user.name });
      setArticle(prev => ({ ...prev, status }));
      setToast(`Article ${status}`);
    } catch (e) { setToast("Error: " + e.message); }
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
    setComments(prev => prev.map(c => c.id === commentId ? {...c, resolved: resolved?1:0} : c));
  };

  if (loading) return <LoadingPane />;
  if (error)   return <ErrorPane message={error} onBack={onBack} />;
  if (!article) return null;

  const meta    = typeMeta(article.article_type);
  const cat     = categories.find(c => c.id === article.category_id);
  const tags    = (() => { try { return JSON.parse(article.tags || "[]"); } catch { return []; } })();
  const countries = (() => { try { return JSON.parse(article.countries || '["All EMEA"]'); } catch { return ["All EMEA"]; } })();
  const isFav   = isFavourited(articleId);
  const isAdmin = user.role === "Admin";
  const isAuthor = article.author_name === user.name;
  const canEdit  = isAdmin || (isAuthor && article.status === "draft");
  const openComments = comments.filter(c => !c.resolved);

  return (
    <div style={{maxWidth:860, margin:"0 auto", padding:"28px 24px"}}>

      {/* Back */}
      <button onClick={onBack} style={{...BG(), marginBottom:18, paddingLeft:0}}>
        ← Back
      </button>

      {/* ── Header ── */}
      <div style={{...CARD(), marginBottom:20, padding:"24px 28px"}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16, flexWrap:"wrap"}}>
          <div style={{flex:1, minWidth:0}}>
            <div style={{display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", marginBottom:10}}>
              <span style={{fontWeight:700, color:meta.color, fontSize:12, letterSpacing:"0.05em"}}>{article.article_num}</span>
              <TypeBadge type={article.article_type} />
              <StatusBadge status={article.status} />
              {cat && <span style={{...TAG(cat.color+"18", cat.color)}}>{cat.name}</span>}
            </div>
            <h1 style={{fontSize:22, fontWeight:700, color:B.black, lineHeight:1.3, marginBottom:12}}>
              {article.title}
            </h1>
            {/* Workday path (QRG only) */}
            {article.article_type === "qrg" && article.workday_path && (
              <div style={{
                display:"inline-flex", alignItems:"center", gap:6,
                background:"#f0f8f6", border:`1.5px solid ${B.teal}30`,
                borderRadius:6, padding:"6px 12px", marginBottom:12,
                fontSize:12, color:B.teal, fontWeight:600,
              }}>
                <span>☰ Workday:</span>
                <span style={{color:B.black}}>{article.workday_path}</span>
              </div>
            )}
            <div style={{display:"flex", gap:12, flexWrap:"wrap", fontSize:11, color:B.g3}}>
              <span>✍ {article.author_name}</span>
              <span>📅 {new Date(article.updated_at).toLocaleDateString("en-GB", {day:"numeric",month:"short",year:"numeric"})}</span>
              <span>👁 {article.view_count||0} views</span>
              {article.reviewed_by && <span>✓ Reviewed by {article.reviewed_by}</span>}
            </div>
          </div>
          <div style={{display:"flex", flexDirection:"column", gap:8, alignItems:"flex-end"}}>
            <button title={isFav ? "Remove bookmark" : "Bookmark"} onClick={() => toggleFavourite(articleId)} style={{
              background:"none", border:`1.5px solid ${isFav ? B.yellow : B.g2}`, borderRadius:8,
              cursor:"pointer", fontSize:18, color: isFav ? B.yellow : B.g3, padding:"6px 10px",
              transition:"all 0.15s",
            }}>
              {isFav ? "★" : "☆"}
            </button>
          </div>
        </div>

        {/* Tags + countries */}
        {(tags.length > 0 || countries.length > 0) && (
          <div style={{display:"flex", gap:6, flexWrap:"wrap", marginTop:12, paddingTop:12, borderTop:`1px solid ${B.g2}`}}>
            {tags.map(t => <span key={t} style={TAG()}>{t}</span>)}
            {countries.filter(c=>c!=="All EMEA").map(c => <span key={c} style={TAG(B.blue+"12", B.blue)}>🌍 {c}</span>)}
            {countries.includes("All EMEA") && <span style={TAG(B.blue+"12", B.blue)}>🌍 All EMEA</span>}
          </div>
        )}

        {/* Action bar */}
        <div style={{display:"flex", gap:8, marginTop:16, flexWrap:"wrap"}}>
          {canEdit && (
            <button style={BP} onClick={() => onEdit(articleId)}>Edit</button>
          )}
          {(isAuthor || isAdmin) && article.status === "draft" && (
            <button style={BS} disabled={submittingStatus} onClick={() => handleStatusChange("review")}>
              Submit for Review
            </button>
          )}
          {isAdmin && article.status === "review" && (
            <>
              <button style={BP} disabled={submittingStatus} onClick={() => handleStatusChange("published")}>
                ✓ Publish
              </button>
              <button style={{...BS, borderColor:B.g3}} disabled={submittingStatus} onClick={() => handleStatusChange("draft")}>
                ✕ Return to Draft
              </button>
            </>
          )}
          {isAdmin && article.status === "published" && (
            <button style={{...BS, borderColor:B.g3, color:B.g3}} disabled={submittingStatus} onClick={() => handleStatusChange("archived")}>
              Archive
            </button>
          )}
          {isAdmin && article.status === "archived" && (
            <button style={BS} disabled={submittingStatus} onClick={() => handleStatusChange("published")}>
              Restore
            </button>
          )}
          <ExportButton article={article} meta={meta} />
        </div>
      </div>

      {/* ── KCS sections ── */}
      {[
        { label: meta.sections[0], content: article.section1 },
        { label: meta.sections[1], content: article.section2 },
        { label: meta.sections[2], content: article.section3 },
        { label: meta.sections[3] || meta.s4label, content: article.section4, optional: true },
      ].map((sec, i) => {
        if (sec.optional && !sec.content) return null;
        return (
          <div key={i} style={{
            ...CARD({ marginBottom:16, padding:"20px 24px",
              borderLeft:`4px solid ${meta.color}`,
            }),
          }}>
            <div style={{fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:meta.color, marginBottom:10}}>
              {sec.label}
            </div>
            <RichContent html={sec.content} />
          </div>
        );
      })}

      {/* ── Helpful feedback ── */}
      <div style={{...CARD({ marginBottom:16, padding:"18px 24px" }), textAlign:"center"}}>
        {feedbackDone ? (
          <div style={{color:B.teal, fontWeight:600, fontSize:13}}>Thanks for your feedback!</div>
        ) : (
          <>
            <div style={{fontSize:12, color:B.g3, marginBottom:12, fontWeight:600}}>Was this article helpful?</div>
            <div style={{display:"flex", gap:12, justifyContent:"center"}}>
              <button onClick={() => handleFeedback(true)} style={{
                ...BS, padding:"8px 22px", fontSize:13,
                borderColor:B.teal, color:B.teal,
              }}>
                👍 Yes {article.helpful_yes > 0 ? `(${article.helpful_yes})` : ""}
              </button>
              <button onClick={() => handleFeedback(false)} style={{
                ...BS, padding:"8px 22px", fontSize:13,
              }}>
                👎 No {article.helpful_no > 0 ? `(${article.helpful_no})` : ""}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Related articles ── */}
      {related.length > 0 && (
        <div style={{marginBottom:16}}>
          <div style={{fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:B.g3, marginBottom:10}}>
            Related Articles
          </div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:10}}>
            {related.map(r => (
              <button key={r.id} onClick={() => onOpenArticle({ _openId: r.id })} style={{
                ...CARD({ padding:"12px 14px", textAlign:"left", cursor:"pointer" }),
                background:B.white, border:`1.5px solid ${B.g2}`,
                fontFamily:"'Montserrat',sans-serif", display:"block", width:"100%",
              }}>
                <div style={{fontSize:10, fontWeight:700, color:typeMeta(r.article_type).color, marginBottom:4}}>
                  {r.article_num}
                </div>
                <div style={{fontSize:12, fontWeight:600, color:B.black, lineHeight:1.4}}>
                  {r.title}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Internal comments (author + admin only) ── */}
      {(isAdmin || isAuthor) && (
        <div style={CARD({ marginBottom:16, padding:"18px 24px" })}>
          <div style={{fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:B.g3, marginBottom:12}}>
            Review Comments {openComments.length > 0 && (
              <span style={{...TAG("#FFF3CD","#8B6914"), marginLeft:6}}>{openComments.length} open</span>
            )}
          </div>
          {comments.map(c => (
            <div key={c.id} style={{
              padding:"10px 12px", borderRadius:6,
              background: c.resolved ? B.g1 : "#FFF3CD",
              border:`1.5px solid ${c.resolved ? B.g2 : "#F5C017"}`,
              marginBottom:8, opacity: c.resolved ? 0.6 : 1,
            }}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
                <div>
                  <span style={{fontSize:11, fontWeight:700}}>{c.author_name}</span>
                  <span style={{fontSize:10, color:B.g3, marginLeft:8}}>{new Date(c.created_at).toLocaleString("en-GB")}</span>
                  {c.resolved ? <span style={{...TAG(), marginLeft:8, fontSize:9}}>resolved</span> : null}
                </div>
                {isAdmin && (
                  <button style={{...BG(c.resolved ? B.teal : B.g3), fontSize:10, padding:"2px 8px"}}
                    onClick={() => handleResolveComment(c.id, !c.resolved)}>
                    {c.resolved ? "Reopen" : "Resolve"}
                  </button>
                )}
              </div>
              <div style={{fontSize:12, marginTop:5, color:B.black}}>{c.comment}</div>
            </div>
          ))}
          {(isAdmin || article.status === "review") && (
            <div style={{display:"flex", gap:8, marginTop:8}}>
              <input
                value={newComment} onChange={e=>setNewComment(e.target.value)}
                placeholder="Add a review comment…"
                onKeyDown={e => e.key === "Enter" && handleAddComment()}
                style={{
                  flex:1, padding:"8px 12px", borderRadius:6, border:`1.5px solid ${B.g2}`,
                  fontSize:12, fontFamily:"'Montserrat',sans-serif", outline:"none",
                }}
              />
              <button style={{...BP, padding:"8px 16px", fontSize:12}} onClick={handleAddComment}>
                Add
              </button>
            </div>
          )}
        </div>
      )}

      {toast && (
        <div style={{
          position:"fixed", bottom:28, right:28, zIndex:9999,
          background:B.teal, color:B.white, padding:"12px 22px",
          borderRadius:8, fontSize:13, fontWeight:600, fontFamily:"'Montserrat',sans-serif",
        }}>
          {toast}
          <button style={{...BG(B.white), marginLeft:12, fontSize:11}} onClick={()=>setToast("")}>✕</button>
        </div>
      )}
    </div>
  );
}

function ExportButton({ article, meta }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { exportArticle } = await import("../kbExport.js");
      await exportArticle(article, meta);
    } catch (e) {
      alert("Export failed: " + e.message);
    }
    setExporting(false);
  };

  return (
    <button style={{...BS, borderColor:B.g2}} onClick={handleExport} disabled={exporting}>
      {exporting ? "Exporting…" : "⬇ Export to Word"}
    </button>
  );
}

function LoadingPane() {
  return (
    <div style={{maxWidth:860, margin:"80px auto", textAlign:"center", color:B.g3, fontFamily:"'Montserrat',sans-serif"}}>
      <div style={{fontSize:32, marginBottom:12}}>⏳</div>
      <div style={{fontWeight:600}}>Loading article…</div>
    </div>
  );
}

function ErrorPane({ message, onBack }) {
  return (
    <div style={{maxWidth:860, margin:"80px auto", textAlign:"center", fontFamily:"'Montserrat',sans-serif"}}>
      <div style={{fontSize:32, marginBottom:12}}>⚠️</div>
      <div style={{fontWeight:600, color:B.red, marginBottom:12}}>Failed to load article</div>
      <div style={{fontSize:12, color:B.g3, marginBottom:20}}>{message}</div>
      <button style={BS} onClick={onBack}>← Go Back</button>
    </div>
  );
}
