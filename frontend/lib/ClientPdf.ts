// utils/ClientPdf.ts
import { jsPDF } from "jspdf";

// ─── Minimal Light Palette ──────────────────────────────────────────────────
const PRIMARY  = [79,  70,  229] as [number, number, number]; // indigo-600
const PRIMARY_L = [238, 242, 255] as [number, number, number]; // indigo-50
const PASS_C   = [22,  163, 74 ] as [number, number, number]; // green-600
const FAIL_C   = [220, 38,  38 ] as [number, number, number]; // red-600
const PEND_C   = [217, 119, 6  ] as [number, number, number]; // amber-600
const TEXT_D   = [31,  41,  55 ] as [number, number, number]; // gray-800
const TEXT_M   = [107, 114, 128] as [number, number, number]; // gray-500
const TEXT_L   = [156, 163, 175] as [number, number, number]; // gray-400
const BG_CARD  = [249, 250, 251] as [number, number, number]; // gray-50
const BORDER   = [229, 231, 235] as [number, number, number]; // gray-200
const CODE_BG  = [243, 244, 246] as [number, number, number]; // gray-100
const CODE_TXT = [55,  65,  81 ] as [number, number, number]; // gray-700
const OUT_BG   = [240, 253, 244] as [number, number, number]; // green-50
const OUT_TXT  = [21,  128, 61 ] as [number, number, number]; // green-700
const WHITE    = [255, 255, 255] as [number, number, number];

// ─── Helpers ────────────────────────────────────────────────────────────────
function cleanText(str: string = ""): string {
  return str
    .normalize("NFKD")
    .replace(/[^\x20-\x7E\n\r\t]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, "    ")
    .trim();
}

function statusColor(status: string): [number, number, number] {
  const s = status.toLowerCase();
  if (s === "passed" || s === "completed") return PASS_C;
  if (s === "failed") return FAIL_C;
  return PEND_C;
}

function statusBgColor(status: string): [number, number, number] {
  const s = status.toLowerCase();
  if (s === "passed" || s === "completed") return [220, 252, 231]; // green-100
  if (s === "failed") return [254, 226, 226]; // red-100
  return [254, 243, 199]; // amber-100
}

// ─── Shared document builder ─────────────────────────────────────────────────

function createDoc() {
  return new jsPDF({ unit: "pt", format: "a4" });
}

function makeHeader(
  doc: jsPDF,
  pageWidth: number,
  _pageHeight: number,
  margin: number,
  title: string,
  subtitle: string
): number {
  // Thin accent line at top
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageWidth, 3, "F");

  // Clean white header area
  let y = 28;

  // Logo mark (small circle with "CG")  
  const logoX = margin;
  doc.setFillColor(...PRIMARY);
  doc.circle(logoX + 12, y + 2, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text("CG", logoX + 12, y + 5, { align: "center" });

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...TEXT_D);
  doc.text(title, logoX + 30, y + 2);

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_M);
  doc.text(subtitle, logoX + 30, y + 16);

  // Separator line
  const sepY = y + 28;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.5);
  doc.line(margin, sepY, pageWidth - margin, sepY);

  return sepY + 14;
}

function drawSectionLabel(
  doc: jsPDF,
  label: string,
  x: number,
  y: number,
  _width: number
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PRIMARY);
  doc.text(label.toUpperCase(), x, y);

  // Small underline accent
  const tw = doc.getTextWidth(label.toUpperCase());
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(1);
  doc.line(x, y + 3, x + tw, y + 3);
}

function drawKV(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  labelW = 100
) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_L);
  doc.text(label, x, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...TEXT_D);
  doc.text(cleanText(value), x + labelW, y);
}

function drawStatusPill(
  doc: jsPDF,
  status: string,
  x: number,
  y: number
) {
  const col = statusColor(status);
  const bgCol = statusBgColor(status);
  const text = status.toUpperCase();
  const tw = doc.getTextWidth(text);
  const pw = tw + 16;
  const ph = 14;

  // Light background pill
  doc.setFillColor(...bgCol);
  doc.roundedRect(x, y - 10, pw, ph, ph / 2, ph / 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(col[0], col[1], col[2]);
  doc.text(text, x + 8, y);
}

function drawCodeBlock(
  doc: jsPDF,
  code: string,
  x: number,
  y: number,
  width: number,
  pageHeight: number,
  margin: number,
  cap = 10000
): number {
  const safe = cleanText((code || "No code submitted").slice(0, cap));
  const lines = doc.splitTextToSize(safe, width - 24) as string[];

  const lineH = 11;
  let cy = y;
  const remainingLines = [...lines];

  while (remainingLines.length > 0) {
    const availableH = pageHeight - cy - margin - 20;
    const linesToDrawCount = Math.floor(availableH / lineH);

    if (linesToDrawCount < 3 && remainingLines.length > 0) {
      doc.addPage();
      cy = margin + 10;
      continue;
    }

    const batch = remainingLines.splice(0, linesToDrawCount);
    const batchH = batch.length * lineH + 16;

    // Light gray background
    doc.setFillColor(...CODE_BG);
    doc.roundedRect(x, cy, width, batchH, 4, 4, "F");

    // Subtle border
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, cy, width, batchH, 4, 4, "S");

    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...CODE_TXT);

    let lineY = cy + 12;
    for (let i = 0; i < batch.length; i++) {
      // Line number
      doc.setTextColor(...TEXT_L);
      const lineNum = String(i + 1).padStart(3, " ");
      doc.text(lineNum, x + 6, lineY);
      // Code
      doc.setTextColor(...CODE_TXT);
      doc.text(batch[i], x + 28, lineY);
      lineY += lineH;
    }

    cy += batchH;

    if (remainingLines.length > 0) {
      doc.addPage();
      cy = margin + 10;
    }
  }

  return cy + 8;
}

function drawOutputBlock(
  doc: jsPDF,
  output: string,
  x: number,
  y: number,
  width: number,
  pageHeight: number,
  margin: number,
  cap = 5000
): number {
  // eslint-disable-next-line no-control-regex
  const safe = cleanText(output.replace(/\x1B\[[0-9;]*[A-Za-z]/g, "")).slice(0, cap);
  const lines = doc.splitTextToSize(safe, width - 24) as string[];
  const lineH = 11;
  
  let cy = y;
  const remainingLines = [...lines];

  while (remainingLines.length > 0) {
    const availableH = pageHeight - cy - margin - 20;
    const linesToDrawCount = Math.floor(availableH / lineH);

    if (linesToDrawCount < 3 && remainingLines.length > 0) {
      doc.addPage();
      cy = margin + 10;
      continue;
    }

    const batch = remainingLines.splice(0, linesToDrawCount);
    const batchH = batch.length * lineH + 16;

    // Light green background
    doc.setFillColor(...OUT_BG);
    doc.roundedRect(x, cy, width, batchH, 4, 4, "F");
    doc.setDrawColor(187, 247, 208); // green-200
    doc.setLineWidth(0.3);
    doc.roundedRect(x, cy, width, batchH, 4, 4, "S");

    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...OUT_TXT);

    let lineY = cy + 12;
    for (const line of batch) {
      doc.text(line, x + 10, lineY);
      lineY += lineH;
    }

    cy += batchH;

    if (remainingLines.length > 0) {
      doc.addPage();
      cy = margin + 10;
    }
  }

  return cy + 8;
}

function addFooters(doc: jsPDF, pageWidth: number, pageHeight: number, margin: number) {
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);

    // Light separator
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 28, pageWidth - margin, pageHeight - 28);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_L);
    doc.text("CodeGuard", margin, pageHeight - 16);
    doc.text(
      `Generated ${new Date().toLocaleDateString()}  ·  Page ${p} of ${total}`,
      pageWidth - margin,
      pageHeight - 16,
      { align: "right" }
    );
  }
}

// ─── Single‑submission PDF ────────────────────────────────────────────────────

export async function generatePdfClient({
  studentName,
  rollNumber,
  practicalTitle,
  code,
  language,
  submissionDate,
  status,
  marks,
  output,
  plotImages,
  showMarks,
  filename = "submission_report.pdf",
}: {
  studentName: string;
  rollNumber: string;
  practicalTitle: string;
  code: string;
  language: string;
  submissionDate: string;
  status: string;
  marks?: number;
  output?: string;
  plotImages?: string[];
  showMarks?: boolean;
  filename?: string;
}) {
  const doc = createDoc();
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableW = pageWidth - margin * 2;

  let y = makeHeader(doc, pageWidth, pageHeight, margin, "Submission Report", practicalTitle);

  const newPage = () => { doc.addPage(); y = margin + 10; };
  const need = (h: number) => { if (y + h > pageHeight - margin) { newPage(); return true; } return false; };

  // ── Student info card ────────────────────────────────────────────
  doc.setFillColor(...BG_CARD);
  doc.roundedRect(margin, y, usableW, 58, 4, 4, "F");
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, usableW, 58, 4, 4, "S");

  // Left column
  drawKV(doc, "Student", studentName, margin + 12, y + 18);
  drawKV(doc, "Roll No.", rollNumber, margin + 12, y + 34);
  drawKV(doc, "Language", language, margin + 12, y + 50);

  // Right column
  const rx = margin + usableW / 2 + 10;
  drawKV(doc, "Date", submissionDate, rx, y + 18);
  if (showMarks !== false) {
    drawKV(doc, "Marks", marks !== undefined ? String(marks) : "—", rx, y + 34);
  }

  // Status pill
  drawStatusPill(doc, status, margin + usableW - 80, y + 16);

  y += 70;

  // ── Plot images ───────────────────────────────────────────────────
  if (plotImages?.length) {
    need(30);
    drawSectionLabel(doc, "Generated Plots", margin, y, usableW);
    y += 14;
    for (const img of plotImages) {
      need(270);
      try {
        doc.addImage(`data:image/png;base64,${img}`, "PNG", margin, y, 380, 260);
      } catch (e) { console.error("Image:", e); }
      y += 270;
    }
  }

  // ── Submitted code ───────────────────────────────────────────────
  need(50);
  drawSectionLabel(doc, `Submitted Code  ·  ${language}`, margin, y, usableW);
  y += 14;
  y = drawCodeBlock(doc, code, margin, y, usableW, pageHeight, margin);

  // ── Output ────────────────────────────────────────────────────────
  if (output) {
    need(50);
    drawSectionLabel(doc, "Program Output", margin, y, usableW);
    y += 14;
    y = drawOutputBlock(doc, output, margin, y, usableW, pageHeight, margin);
  }

  addFooters(doc, pageWidth, pageHeight, margin);
  doc.save(filename);
}

// ─── Combined multi‑task PDF ──────────────────────────────────────────────────

export async function generateCombinedPdfClient({
  studentName,
  rollNumber,
  practicalTitle,
  tasks,
  showMarks,
  filename = "submission_report.pdf",
}: {
  studentName: string;
  rollNumber: string;
  practicalTitle: string;
  tasks: {
    taskTitle: string;
    code: string;
    language: string;
    submissionDate: string;
    status: string;
    marks?: number;
    maxMarks?: number;
    output?: string;
    plotImages?: string[];
  }[];
  showMarks?: boolean;
  filename?: string;
}) {
  const doc = createDoc();
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableW = pageWidth - margin * 2;

  let y = makeHeader(doc, pageWidth, pageHeight, margin, "Submission Report", practicalTitle);

  const newPage = () => { doc.addPage(); y = margin + 10; };
  const need = (h: number) => { if (y + h > pageHeight - margin) { newPage(); return true; } return false; };

  // ── Shared info card ────────────────────────────────────────────
  doc.setFillColor(...BG_CARD);
  doc.roundedRect(margin, y, usableW, 42, 4, 4, "F");
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, usableW, 42, 4, 4, "S");

  drawKV(doc, "Student", studentName, margin + 12, y + 16);
  drawKV(doc, "Roll No.", rollNumber, margin + 12, y + 32);
  drawKV(doc, "Tasks", String(tasks.length), margin + usableW / 2 + 10, y + 16);

  y += 52;

  // ── Task overview — minimal status dots ─────────────────────────
  let cx = margin;
  tasks.forEach((t, i) => {
    const col = statusColor(t.status);
    const bgCol = statusBgColor(t.status);
    const label = `Task ${i + 1}`;
    const tw = doc.getTextWidth(label) + 20;

    doc.setFillColor(...bgCol);
    doc.roundedRect(cx, y, tw, 18, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(col[0], col[1], col[2]);
    doc.text(label, cx + 10, y + 12);
    cx += tw + 6;
  });
  y += 28;

  // ── Per-task sections ───────────────────────────────────────────
  tasks.forEach((task, idx) => {
    need(60);

    // Task header — clean card with left accent
    const col = statusColor(task.status);
    doc.setFillColor(col[0], col[1], col[2]);
    doc.roundedRect(margin, y, 3, 40, 1.5, 1.5, "F"); // left accent

    doc.setFillColor(...BG_CARD);
    doc.roundedRect(margin + 5, y, usableW - 5, 40, 4, 4, "F");
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin + 5, y, usableW - 5, 40, 4, 4, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_D);
    doc.text(`Task ${idx + 1} — ${cleanText(task.taskTitle)}`, margin + 16, y + 16);

    // Meta row
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_M);
    const meta = [
      task.language,
      task.submissionDate,
      showMarks !== false ? (
        task.marks !== undefined
          ? `Marks: ${task.marks}${task.maxMarks !== undefined ? ` / ${task.maxMarks}` : ""}`
          : "Not graded"
      ) : null,
    ].filter(Boolean).join("   ·   ");
    doc.text(meta, margin + 16, y + 30);

    // Status pill
    drawStatusPill(doc, task.status, margin + usableW - 70, y + 18);

    y += 50;

    // Plot images
    if (task.plotImages?.length) {
      need(50);
      drawSectionLabel(doc, "Generated Plots", margin, y, usableW);
      y += 14;
      for (const img of task.plotImages) {
        need(270);
        try {
          doc.addImage(`data:image/png;base64,${img}`, "PNG", margin, y, 380, 260);
        } catch (e) { console.error("Image:", e); }
        y += 270;
      }
    }

    // Submitted code
    need(50);
    drawSectionLabel(doc, `Submitted Code  ·  ${task.language}`, margin, y, usableW);
    y += 14;
    y = drawCodeBlock(doc, task.code, margin, y, usableW, pageHeight, margin);

    // Output
    if (task.output) {
      need(50);
      drawSectionLabel(doc, "Program Output", margin, y, usableW);
      y += 14;
      y = drawOutputBlock(doc, task.output, margin, y, usableW, pageHeight, margin);
    }

    // Separator between tasks
    if (idx < tasks.length - 1) {
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.3);
      doc.line(margin + 20, y + 2, pageWidth - margin - 20, y + 2);
      y += 12;
    }
  });

  addFooters(doc, pageWidth, pageHeight, margin);
  doc.save(filename);
}
