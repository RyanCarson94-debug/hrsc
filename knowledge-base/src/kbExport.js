/**
 * kbExport.js — Export a KB article to a .docx file.
 *
 * Uses the `docx` library (same version as contract-builder).
 * Images embedded in HTML as base64 data URLs are extracted and
 * embedded as ImageRun objects in the Word document.
 *
 * Usage:
 *   import { exportArticle } from './kbExport.js';
 *   await exportArticle(article, meta);
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  ImageRun, AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType,
} from "docx";

// ── HTML → docx paragraphs converter ──────────────────────────────────────────

function htmlToParagraphs(html) {
  if (!html) return [];
  const paragraphs = [];

  // Create a temporary DOM element to parse HTML
  const div = document.createElement("div");
  div.innerHTML = html;

  function processNode(node, runs = [], listDepth = 0, listType = null, listCounters = []) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (text) runs.push(new TextRun({ text }));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName.toLowerCase();

    if (tag === "img") {
      // Extract base64 image
      const src = node.getAttribute("src") || "";
      if (src.startsWith("data:image/")) {
        try {
          const [meta, b64] = src.split(",");
          const mimeMatch = meta.match(/data:([^;]+)/);
          const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
          const binary = atob(b64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

          // Estimate dimensions (default 400×300, respect natural sizes if available)
          const imgW = node.naturalWidth || node.width || 400;
          const imgH = node.naturalHeight || node.height || 300;
          const maxW = 580; // points ≈ 8 inches
          const scale = imgW > maxW ? maxW / imgW : 1;

          const typeMap = { "image/jpeg":"jpg","image/png":"png","image/gif":"gif","image/webp":"jpg" };
          const imgType = typeMap[mimeType] || "jpg";

          paragraphs.push(new Paragraph({
            children: [new ImageRun({
              data: bytes.buffer,
              transformation: { width: Math.round(imgW * scale), height: Math.round(imgH * scale) },
              type: imgType,
            })],
            spacing: { before: 100, after: 100 },
          }));
        } catch {}
      }
      return;
    }

    if (tag === "h1" || tag === "h2" || tag === "h3") {
      const level = tag === "h1" ? HeadingLevel.HEADING_2 : tag === "h2" ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_4;
      const childRuns = [];
      node.childNodes.forEach(c => processNode(c, childRuns));
      if (childRuns.length) {
        paragraphs.push(new Paragraph({ heading: level, children: childRuns }));
      }
      return;
    }

    if (tag === "p" || tag === "div") {
      const childRuns = [];
      node.childNodes.forEach(c => processNode(c, childRuns));
      if (childRuns.length) {
        paragraphs.push(new Paragraph({ children: childRuns, spacing: { before: 80, after: 80 } }));
      } else {
        // Check if children contain block elements (nested)
        node.childNodes.forEach(c => {
          const subParagraphs = [];
          processNodeToList(c, subParagraphs);
          paragraphs.push(...subParagraphs);
        });
      }
      return;
    }

    if (tag === "br") {
      runs.push(new TextRun({ text: "", break: 1 }));
      return;
    }

    if (tag === "strong" || tag === "b") {
      const childRuns = [];
      node.childNodes.forEach(c => processNode(c, childRuns));
      childRuns.forEach(r => {
        if (r instanceof TextRun) runs.push(new TextRun({ ...r._data, bold: true }));
        else runs.push(r);
      });
      return;
    }

    if (tag === "em" || tag === "i") {
      const childRuns = [];
      node.childNodes.forEach(c => processNode(c, childRuns));
      childRuns.forEach(r => {
        if (r instanceof TextRun) runs.push(new TextRun({ ...r._data, italics: true }));
        else runs.push(r);
      });
      return;
    }

    if (tag === "u") {
      const childRuns = [];
      node.childNodes.forEach(c => processNode(c, childRuns));
      childRuns.forEach(r => {
        if (r instanceof TextRun) runs.push(new TextRun({ ...r._data, underline: {} }));
        else runs.push(r);
      });
      return;
    }

    if (tag === "ul" || tag === "ol") {
      node.childNodes.forEach(li => {
        if (li.tagName && li.tagName.toLowerCase() === "li") {
          const liRuns = [];
          li.childNodes.forEach(c => processNode(c, liRuns));
          if (liRuns.length) {
            paragraphs.push(new Paragraph({
              children: liRuns,
              bullet: { level: 0 },
              spacing: { before: 40, after: 40 },
            }));
          }
        }
      });
      return;
    }

    // Default: recurse
    node.childNodes.forEach(c => processNode(c, runs));
  }

  function processNodeToList(node, out) {
    const childRuns = [];
    processNode(node, childRuns);
    if (childRuns.length) {
      out.push(new Paragraph({ children: childRuns }));
    }
  }

  div.childNodes.forEach(node => {
    const childRuns = [];
    processNode(node, childRuns);
    if (childRuns.length) {
      paragraphs.push(new Paragraph({ children: childRuns, spacing: { before: 80, after: 80 } }));
    }
  });

  return paragraphs;
}

// ── Section builder ───────────────────────────────────────────────────────────

function buildSection(label, html, accentColor) {
  const content = htmlToParagraphs(html);
  if (!content.length) return [];

  return [
    new Paragraph({
      children: [new TextRun({ text: label, bold: true, color: accentColor.replace("#",""), size: 22 })],
      spacing: { before: 300, after: 80 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: accentColor.replace("#","") },
      },
    }),
    ...content,
    new Paragraph({ text: "", spacing: { after: 120 } }),
  ];
}

// ── Color hex to docx ─────────────────────────────────────────────────────────

const TYPE_COLORS = { kcs:"00A28A", qrg:"0E56A5", sop:"231F20" };

// ── Main export function ──────────────────────────────────────────────────────

export async function exportArticle(article, meta) {
  const accentHex = TYPE_COLORS[article.article_type] || "00A28A";
  const tags = (() => { try { return JSON.parse(article.tags||"[]"); } catch { return []; } })();
  const countries = (() => { try { return JSON.parse(article.countries||'["All EMEA"]'); } catch { return ["All EMEA"]; } })();

  const sections = [article.section1, article.section2, article.section3, article.section4];
  const sectionLabels = meta.sections;

  const children = [
    // ── Document header ──
    new Paragraph({
      children: [new TextRun({ text: meta.label.toUpperCase(), size: 16, color: accentHex, bold: true, characterSpacing: 100 })],
      spacing: { before: 0, after: 60 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: article.article_num + "  ", bold: true, color: accentHex, size: 24 }),
        new TextRun({ text: article.title, bold: true, size: 36 }),
      ],
      spacing: { before: 0, after: 160 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: accentHex } },
    }),

    // ── Workday path (QRG only) ──
    ...(article.article_type === "qrg" && article.workday_path ? [
      new Paragraph({
        children: [
          new TextRun({ text: "☰ Workday: ", bold: true, color: accentHex }),
          new TextRun({ text: article.workday_path }),
        ],
        spacing: { before: 80, after: 160 },
      }),
    ] : []),

    // ── Metadata ──
    new Paragraph({
      children: [
        new TextRun({ text: `Author: ${article.author_name}   `, size: 18, color: "808284" }),
        new TextRun({ text: `Status: ${article.status}   `, size: 18, color: "808284" }),
        new TextRun({ text: `Updated: ${new Date(article.updated_at).toLocaleDateString("en-GB")}   `, size: 18, color: "808284" }),
        ...(article.last_reviewed_at ? [new TextRun({ text: `Reviewed: ${new Date(article.last_reviewed_at).toLocaleDateString("en-GB")}`, size: 18, color: "808284" })] : []),
      ],
      spacing: { before: 80, after: 80 },
    }),

    ...(tags.length > 0 ? [
      new Paragraph({
        children: [
          new TextRun({ text: "Tags: ", bold: true, size: 18, color: "808284" }),
          new TextRun({ text: tags.join(", "), size: 18, color: "808284" }),
        ],
        spacing: { before: 0, after: 80 },
      }),
    ] : []),

    new Paragraph({ text: "", spacing: { after: 200 } }),

    // ── Content sections ──
    ...buildSection(sectionLabels[0], sections[0], "#"+accentHex),
    ...buildSection(sectionLabels[1], sections[1], "#"+accentHex),
    ...buildSection(sectionLabels[2], sections[2], "#"+accentHex),
    ...(sections[3] ? buildSection(sectionLabels[3] || meta.s4label, sections[3], "#"+accentHex) : []),

    // ── Footer ──
    new Paragraph({
      children: [
        new TextRun({
          text: `HRSC Internal Knowledge Base — Confidential · Exported ${new Date().toLocaleDateString("en-GB")}`,
          size: 16, color: "A0A0A0", italics: true,
        }),
      ],
      spacing: { before: 400 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "E2DFDA" } },
    }),
  ];

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${article.article_num} - ${article.title.replace(/[/\\?%*:|"<>]/g,"_")}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
