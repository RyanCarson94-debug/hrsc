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

const CSL_RED   = "FC1921";
const BODY_FONT = "Montserrat";
const BODY_SIZE = 22;  // half-points → 11pt
const H1_SIZE   = 28;  // 14pt
const H2_SIZE   = 24;  // 12pt
const BLACK     = "000000";
const GRAY      = "808284";

// ── Parse inline HTML nodes → TextRun array ───────────────────────────────────
function domToTextRuns(node, props = {}) {
  const runs = [];
  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      const text = child.textContent;
      if (text) runs.push(new TextRun({ text, size: BODY_SIZE, font: BODY_FONT, color: BLACK, ...props }));
    } else if (child.nodeType === 1) {
      const tag = child.tagName.toLowerCase();
      if (tag === "br") { runs.push(new TextRun({ break: 1 })); continue; }
      const cp = { ...props };
      if (tag === "strong" || tag === "b") cp.bold = true;
      if (tag === "em"     || tag === "i") cp.italics = true;
      if (tag === "u")                     cp.underline = {};
      runs.push(...domToTextRuns(child, cp));
    }
  }
  return runs;
}

// ── Convert HTML string → Paragraph array (browser DOM parser) ───────────────
function htmlToParagraphs(html, indentLeft = 0) {
  const div = document.createElement("div");
  div.innerHTML = html;
  const out = [];

  for (const node of div.childNodes) {
    if (node.nodeType === 3) {
      const text = node.textContent.trim();
      if (text) out.push(new Paragraph({
        children: [new TextRun({ text, size: BODY_SIZE, font: BODY_FONT, color: BLACK })],
        spacing: { before: 0, after: pt(6) },
        ...(indentLeft ? { indent: { left: indentLeft } } : {}),
      }));
      continue;
    }
    if (node.nodeType !== 1) continue;
    const tag = node.tagName.toLowerCase();

    if (tag === "p" || tag === "div") {
      const runs = domToTextRuns(node);
      out.push(new Paragraph({
        children: runs.length ? runs : [new TextRun({ text: "", size: BODY_SIZE, font: BODY_FONT })],
        spacing: { before: 0, after: pt(6) },
        ...(indentLeft ? { indent: { left: indentLeft } } : {}),
      }));
    } else if (tag === "h1") {
      out.push(new Paragraph({
        children: domToTextRuns(node, { bold: true, size: H1_SIZE }),
        spacing: { before: pt(12), after: pt(4) },
      }));
    } else if (tag === "h2") {
      out.push(new Paragraph({
        children: domToTextRuns(node, { bold: true, size: H2_SIZE }),
        spacing: { before: pt(10), after: pt(3) },
      }));
    } else if (tag === "h3") {
      out.push(new Paragraph({
        children: domToTextRuns(node, { bold: true, size: BODY_SIZE }),
        spacing: { before: pt(8), after: pt(2) },
      }));
    } else if (tag === "ol" || tag === "ul") {
      const styleAttr = node.getAttribute("style") || "";
      const isAlpha  = styleAttr.includes("lower-alpha") || node.style.listStyleType === "lower-alpha";
      const isBullet = tag === "ul";
      Array.from(node.children)
        .filter(c => c.tagName.toLowerCase() === "li")
        .forEach((li, idx) => {
          const prefix = isBullet
            ? "•"
            : isAlpha ? `(${String.fromCharCode(97 + idx)})`
            : `${idx + 1}.`;
          out.push(new Paragraph({
            children: [
              new TextRun({ text: prefix + "\t", size: BODY_SIZE, font: BODY_FONT, color: BLACK }),
              ...domToTextRuns(li),
            ],
            indent: { left: indentLeft + twip(0.6), hanging: twip(0.35) },
            spacing: { before: pt(2), after: pt(2) },
          }));
        });
    } else if (tag === "br") {
      out.push(new Paragraph({ children: [], spacing: { before: 0, after: pt(4) } }));
    }
  }
  return out;
}

// ── Legacy: plain-text + markdown markers → Paragraph array ──────────────────
function parseInline(text, baseProps = {}) {
  const runs = [];
  const re = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|__(.+?)__)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push(new TextRun({ text: text.slice(last, m.index), ...baseProps, size: BODY_SIZE, font: BODY_FONT, color: BLACK }));
    if      (m[1].startsWith("***")) runs.push(new TextRun({ text: m[2], bold: true, italics: true, ...baseProps, size: BODY_SIZE, font: BODY_FONT, color: BLACK }));
    else if (m[1].startsWith("**"))  runs.push(new TextRun({ text: m[3], bold: true,               ...baseProps, size: BODY_SIZE, font: BODY_FONT, color: BLACK }));
    else if (m[1].startsWith("*"))   runs.push(new TextRun({ text: m[4], italics: true,            ...baseProps, size: BODY_SIZE, font: BODY_FONT, color: BLACK }));
    else if (m[1].startsWith("__"))  runs.push(new TextRun({ text: m[5], underline: {},            ...baseProps, size: BODY_SIZE, font: BODY_FONT, color: BLACK }));
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push(new TextRun({ text: text.slice(last), ...baseProps, size: BODY_SIZE, font: BODY_FONT, color: BLACK }));
  return runs.length ? runs : [new TextRun({ text, ...baseProps, size: BODY_SIZE, font: BODY_FONT, color: BLACK })];
}

function textToParagraphs(text) {
  const paragraphs = [];
  for (const line of text.split("\n")) {
    if (/^# /.test(line))  { paragraphs.push(new Paragraph({ children: [new TextRun({ text: line.slice(2), bold: true, size: H1_SIZE, font: BODY_FONT, color: BLACK })], spacing: { before: pt(12), after: pt(4) } })); continue; }
    if (/^## /.test(line)) { paragraphs.push(new Paragraph({ children: [new TextRun({ text: line.slice(3), bold: true, size: H2_SIZE, font: BODY_FONT, color: BLACK })], spacing: { before: pt(10), after: pt(3) } })); continue; }
    const listMatch = line.match(/^\s{4}([\d]+\.|[a-z]+\.|[A-Z]+\.|[ivxlcdmIVXLCDM]+\.)\s(.+)$/);
    if (listMatch) { paragraphs.push(new Paragraph({ children: [new TextRun({ text: listMatch[1] + "  ", size: BODY_SIZE, font: BODY_FONT, color: BLACK }), ...parseInline(listMatch[2])], indent: { left: twip(1), hanging: twip(0.5) }, spacing: { before: pt(2), after: pt(2) } })); continue; }
    if (line.trim() === "") { paragraphs.push(new Paragraph({ children: [], spacing: { before: 0, after: pt(4) } })); continue; }
    paragraphs.push(new Paragraph({ children: parseInline(line), spacing: { before: 0, after: pt(6) } }));
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
  const hf   = headerFooter || {};
  const date = new Date().toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" });

  // ── Logo image ───────────────────────────────────────────────────────────────
  let logoImageRun = null;
  if (hf.logoBase64) {
    try {
      const buf       = await dataUriToArrayBuffer(hf.logoBase64);
      const mimeMatch = hf.logoBase64.match(/^data:(image\/\w+);/);
      const mimeType  = mimeMatch?.[1] || "image/png";
      const typeMap   = { "image/png":"png", "image/jpeg":"jpg", "image/gif":"gif", "image/bmp":"bmp" };
      logoImageRun = new ImageRun({ data: buf, transformation: { width: 130, height: 50 }, type: typeMap[mimeType] || "png" });
    } catch(e) { console.warn("Logo image could not be loaded:", e); }
  }

  // ── Header: 3-column table — logo | address | websites ──────────────────────
  // Matches the CSL Seqirus header style: logo left, address centred, websites right
  const NO_BORDER = { style: BorderStyle.NONE };
  const cellBorders = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

  const addrLines = [hf.addressLine1, hf.addressLine2 || hf.phone, hf.registrationLine].filter(Boolean);
  const webLines  = [hf.websiteLine1 || hf.website, hf.websiteLine2].filter(Boolean);

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top:     NO_BORDER,
      bottom:  { style: BorderStyle.SINGLE, size: 8, color: CSL_RED },
      left:    NO_BORDER,
      right:   NO_BORDER,
      insideH: NO_BORDER,
      insideV: NO_BORDER,
    },
    rows: [
      new TableRow({
        children: [
          // Col 1: Logo (28%)
          new TableCell({
            width: { size: 28, type: WidthType.PERCENTAGE },
            borders: cellBorders,
            verticalAlign: "center",
            children: [
              new Paragraph({
                children: logoImageRun
                  ? [logoImageRun]
                  : [new TextRun({ text: hf.companyLine || "", bold: true, size: 32, font: BODY_FONT, color: CSL_RED })],
              }),
            ],
          }),
          // Col 2: Address block (44%, centred)
          new TableCell({
            width: { size: 44, type: WidthType.PERCENTAGE },
            borders: cellBorders,
            children: addrLines.length
              ? addrLines.map(line => new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: line, size: 16, font: BODY_FONT, color: GRAY })],
                  spacing: { before: 0, after: pt(1) },
                }))
              : [new Paragraph({ children: [] })],
          }),
          // Col 3: Websites (28%, right-aligned, CSL red)
          new TableCell({
            width: { size: 28, type: WidthType.PERCENTAGE },
            borders: cellBorders,
            children: webLines.length
              ? webLines.map(line => new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: line, size: 16, font: BODY_FONT, color: CSL_RED })],
                  spacing: { before: 0, after: pt(1) },
                }))
              : [new Paragraph({ children: [] })],
          }),
        ],
      }),
    ],
  });

  // ── Footer ───────────────────────────────────────────────────────────────────
  const footerParagraphs = [
    new Paragraph({
      children: [
        new TextRun({ text: hf.footerText || "", size: 16, font: BODY_FONT, color: GRAY }),
        new TextRun({ text: "\t", size: 16 }),
        new TextRun({ text: "Page ", size: 16, font: BODY_FONT, color: GRAY }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, font: BODY_FONT, color: GRAY }),
        new TextRun({ text: " of ", size: 16, font: BODY_FONT, color: GRAY }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: BODY_FONT, color: GRAY }),
      ],
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "E2DFDA" } },
    }),
  ];

  // ── Body sections ─────────────────────────────────────────────────────────────
  const bodyChildren = [];

  resolved.forEach((s, i) => {
    const raw  = s.clauseId ? (clauses.find(c => c.id === s.clauseId)?.content || "") : (s.content || "");
    const txt  = renderClauseContent(raw, vars);
    const level = s.level || 1;

    // Section heading (opt-out per section)
    if (s.showHeading !== false) {
      const prefix  = nums[i] ? `${nums[i]} ` : "";
      const heading = `${prefix}${s.name}`;
      bodyChildren.push(
        new Paragraph({
          children: [new TextRun({ text: heading, bold: true, size: level === 1 ? H1_SIZE : H2_SIZE, font: BODY_FONT, color: BLACK })],
          spacing: { before: pt(level === 1 ? 16 : 10), after: pt(4) },
          ...(level === 1 ? { border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "C0BDBA" } } } : {}),
        })
      );
    }

    // Section body
    const sectionParas = txt.trim().startsWith("<") ? htmlToParagraphs(txt) : textToParagraphs(txt);
    bodyChildren.push(...sectionParas);
  });

  // ── Assemble document ─────────────────────────────────────────────────────────
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: twip(2.5), bottom: twip(2.5), left: twip(2.5), right: twip(2.5) },
          size:   { width: twip(21), height: twip(29.7) },
        },
      },
      headers: { default: new Header({ children: [headerTable] }) },
      footers: { default: new Footer({ children: footerParagraphs }) },
      children: bodyChildren,
    }],
    styles: {
      default: {
        document: {
          run:       { font: BODY_FONT, size: BODY_SIZE, color: BLACK },
          paragraph: { spacing: { line: 276, lineRule: "auto" } },
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
