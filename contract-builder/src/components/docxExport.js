/**
 * docxExport.js
 * Generates a proper .docx file using the docx library.
 * Handles: headers/footers, logo image, bold/italic/underline,
 * headings, numbered lists, section numbering.
 */

import {
  Document, Packer, Paragraph, TextRun,
  Header, Footer, ImageRun, AlignmentType, PageNumber,
  Table, TableRow, TableCell, WidthType,
  BorderStyle, TabStopType, TabStopPosition,
} from "docx";
import { buildSectionNumbers, renderClauseContent } from "./shared";

const pt   = n => n * 20;
const twip = n => Math.round(n * 567);

// CSL Red in hex without #
const CSL_RED = "FC1921";
const BODY_FONT = "Calibri";
const BODY_SIZE = 22; // half-points → 11pt

// ── Parse inline markdown → TextRun array ─────────────────────────────────────
function parseInline(text, baseProps = {}) {
  const runs = [];
  const re = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|__(.+?)__)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      runs.push(new TextRun({ text: text.slice(last, m.index), ...baseProps, size: BODY_SIZE, font: BODY_FONT }));
    }
    if (m[1].startsWith("***")) {
      runs.push(new TextRun({ text: m[2], bold: true, italics: true, ...baseProps, size: BODY_SIZE, font: BODY_FONT }));
    } else if (m[1].startsWith("**")) {
      runs.push(new TextRun({ text: m[3], bold: true, ...baseProps, size: BODY_SIZE, font: BODY_FONT }));
    } else if (m[1].startsWith("*")) {
      runs.push(new TextRun({ text: m[4], italics: true, ...baseProps, size: BODY_SIZE, font: BODY_FONT }));
    } else if (m[1].startsWith("__")) {
      runs.push(new TextRun({ text: m[5], underline: {}, ...baseProps, size: BODY_SIZE, font: BODY_FONT }));
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    runs.push(new TextRun({ text: text.slice(last), ...baseProps, size: BODY_SIZE, font: BODY_FONT }));
  }
  return runs.length ? runs : [new TextRun({ text, ...baseProps, size: BODY_SIZE, font: BODY_FONT })];
}

// ── Convert a block of clause text → array of Paragraphs ──────────────────────
function textToParagraphs(text) {
  const paragraphs = [];
  const lines = text.split("\n");

  for (const line of lines) {
    // Headings
    if (/^# /.test(line)) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: line.replace(/^# /, ""), bold: true, size: 28, font: BODY_FONT })],
        spacing: { before: pt(12), after: pt(4) },
      }));
      continue;
    }
    if (/^## /.test(line)) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: line.replace(/^## /, ""), bold: true, size: 24, font: BODY_FONT })],
        spacing: { before: pt(10), after: pt(3) },
      }));
      continue;
    }
    if (/^### /.test(line)) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: line.replace(/^### /, ""), bold: true, size: 22, font: BODY_FONT })],
        spacing: { before: pt(8), after: pt(2) },
      }));
      continue;
    }
    // Numbered list items (already rendered by renderClauseContent as "    1. item")
    const listMatch = line.match(/^\s{4}([\d]+\.|[a-z]+\.|[A-Z]+\.|[ivxlcdmIVXLCDM]+\.)\s(.+)$/);
    if (listMatch) {
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: listMatch[1] + "  ", size: BODY_SIZE, font: BODY_FONT }),
          ...parseInline(listMatch[2]),
        ],
        indent: { left: twip(1), hanging: twip(0.5) },
        spacing: { before: pt(2), after: pt(2) },
      }));
      continue;
    }
    // Empty line → spacing paragraph
    if (line.trim() === "") {
      paragraphs.push(new Paragraph({ children: [], spacing: { before: 0, after: pt(4) } }));
      continue;
    }
    // Normal paragraph
    paragraphs.push(new Paragraph({
      children: parseInline(line),
      spacing: { before: 0, after: pt(6) },
    }));
  }

  return paragraphs;
}

// ── Fetch image as ArrayBuffer (for base64 data URIs) ─────────────────────────
async function dataUriToArrayBuffer(dataUri) {
  const res = await fetch(dataUri);
  return res.arrayBuffer();
}

// ── Core document builder — returns a Blob ────────────────────────────────────
export async function generateDocxBlob({ tmpl, resolved, clauses, vars, headerFooter, emp, numberingFormat }) {
  const nums = buildSectionNumbers(resolved, numberingFormat || "flat");
  const hf   = headerFooter;
  const date = new Date().toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" });

  // ── Word header ──────────────────────────────────────────────────────────────
  let logoImageRun = null;
  if (hf?.logoBase64) {
    try {
      const buf = await dataUriToArrayBuffer(hf.logoBase64);
      // Detect image type from data URI
      const mimeMatch = hf.logoBase64.match(/^data:(image\/\w+);/);
      const mimeType  = mimeMatch?.[1] || "image/png";
      const typeMap   = { "image/png":"png", "image/jpeg":"jpg", "image/gif":"gif", "image/bmp":"bmp" };
      logoImageRun = new ImageRun({
        data: buf,
        transformation: { width: 120, height: 45 },
        type: typeMap[mimeType] || "png",
      });
    } catch(e) {
      console.warn("Logo image could not be loaded:", e);
    }
  }

  // Header: two-column table — logo left, title+name+date right
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top:    { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.SINGLE, size: 12, color: CSL_RED },
      left:   { style: BorderStyle.NONE },
      right:  { style: BorderStyle.NONE },
      insideH:{ style: BorderStyle.NONE },
      insideV:{ style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          // Left cell: logo
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            borders: { top:{style:BorderStyle.NONE}, bottom:{style:BorderStyle.NONE}, left:{style:BorderStyle.NONE}, right:{style:BorderStyle.NONE} },
            children: [
              new Paragraph({
                children: logoImageRun
                  ? [logoImageRun]
                  : [new TextRun({ text: hf?.companyLine || "", bold: true, size: 24, font: BODY_FONT })],
              }),
            ],
          }),
          // Right cell: document title + employee + date
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            borders: { top:{style:BorderStyle.NONE}, bottom:{style:BorderStyle.NONE}, left:{style:BorderStyle.NONE}, right:{style:BorderStyle.NONE} },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: tmpl.name, bold: true, size: 24, font: BODY_FONT, color: CSL_RED })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: emp.employee_name || "", size: 18, font: BODY_FONT, color: "808284" })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: date, size: 18, font: BODY_FONT, color: "808284" })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // ── Word footer ──────────────────────────────────────────────────────────────
  const footerParagraphs = [
    new Paragraph({
      children: [
        new TextRun({ text: hf?.footerText || "", size: 16, font: BODY_FONT, color: "808284" }),
        new TextRun({ text: "\t", size: 16 }),
        new TextRun({ text: "Page ", size: 16, font: BODY_FONT, color: "808284" }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, font: BODY_FONT, color: "808284" }),
        new TextRun({ text: " of ", size: 16, font: BODY_FONT, color: "808284" }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: BODY_FONT, color: "808284" }),
      ],
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "E2DFDA" } },
    }),
  ];

  // ── Body sections ─────────────────────────────────────────────────────────────
  const bodyChildren = [];

  resolved.forEach((s, i) => {
    const txt      = s.clauseId ? (clauses.find(c=>c.id===s.clauseId)?.content || "") : (s.content || "");
    const resolved_text = renderClauseContent(txt, vars);
    const prefix   = nums[i] ? `${nums[i]} ` : "";
    const heading  = `${prefix}${s.name}`.toUpperCase();

    // Section heading paragraph
    bodyChildren.push(
      new Paragraph({
        children: [new TextRun({ text: heading, bold: true, size: 20, font: BODY_FONT, color: "808284", allCaps: true })],
        spacing: { before: pt(14), after: pt(4) },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "E2DFDA" } },
      })
    );

    // Section body paragraphs
    const sectionParas = textToParagraphs(resolved_text);
    bodyChildren.push(...sectionParas);
  });

  // ── Assemble document ─────────────────────────────────────────────────────────
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top:    twip(2.5),
            bottom: twip(2.5),
            left:   twip(2.5),
            right:  twip(2.5),
          },
          size: {
            width:  twip(21),   // A4 width in cm
            height: twip(29.7), // A4 height in cm
          },
        },
      },
      headers: {
        default: new Header({ children: [headerTable] }),
      },
      footers: {
        default: new Footer({ children: footerParagraphs }),
      },
      children: bodyChildren,
    }],
    styles: {
      default: {
        document: {
          run: { font: BODY_FONT, size: BODY_SIZE },
          paragraph: { spacing: { line: 276, lineRule: "auto" } }, // ~1.15 line spacing
        },
      },
    },
  });

  return Packer.toBlob(doc);
}

// ── Convenience wrapper — builds blob then triggers browser download ───────────
export async function generateDocx(opts) {
  const blob = await generateDocxBlob(opts);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = opts.filename || `${(opts.tmpl.name + " " + (opts.emp.employee_name || "draft")).replace(/\s+/g, "_")}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}