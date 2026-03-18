// utils/ClientPdf.ts
import { jsPDF } from "jspdf";

// ─── Palette ────────────────────────────────────────────────────────────────
const BRAND   = [67,  56, 202] as [number, number, number]; // indigo-700
const BRAND_L = [224, 231, 255] as [number, number, number]; // indigo-100
const PASS_C  = [16,  185, 129] as [number, number, number]; // emerald-500
const FAIL_C  = [239, 68,  68 ] as [number, number, number]; // red-500
const PEND_C  = [245, 158, 11 ] as [number, number, number]; // amber-500
const DARK    = [17,  24,  39 ] as [number, number, number]; // gray-900
const MID     = [107, 114, 128] as [number, number, number]; // gray-500
const LIGHT   = [249, 250, 251] as [number, number, number]; // gray-50
const CODE_BG = [15,  23,  42 ] as [number, number, number]; // slate-900
const WHITE   = [255, 255, 255] as [number, number, number];

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

// ─── Shared document builder ─────────────────────────────────────────────────

function createDoc() {
  return new jsPDF({ unit: "pt", format: "a4" });
}

function makeHeader(
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  title: string,
  subtitle: string
): number {
  // Top accent bar
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageWidth, 6, "F");

  // Header background
  doc.setFillColor(...BRAND);
  doc.rect(0, 6, pageWidth, 70, "F");

  // Logo mark (circle with "CG")
  const logoX = margin;
  const logoY = 6 + 35;
  doc.setFillColor(...WHITE);
  doc.circle(logoX + 18, logoY, 18, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...BRAND);
  doc.text("CG", logoX + 18, logoY + 4.5, { align: "center" });

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...WHITE);
  doc.text(title, logoX + 44, logoY - 4);

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(196, 181, 253); // violet-300
  doc.text(subtitle, logoX + 44, logoY + 10);

  return 76 + 16; // cursorY after header
}

function drawSectionLabel(
  doc: jsPDF,
  label: string,
  x: number,
  y: number,
  width: number
) {
  doc.setFillColor(...BRAND_L);
  doc.roundedRect(x, y - 11, width, 16, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND);
  doc.text(label.toUpperCase(), x + 8, y);
}

function drawKV(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  labelW = 110
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...MID);
  doc.text(label, x, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text(cleanText(value), x + labelW, y);
}

function drawStatusPill(
  doc: jsPDF,
  status: string,
  x: number,
  y: number
) {
  const col = statusColor(status);
  const text = status.toUpperCase();
  const tw = doc.getTextWidth(text);
  const pw = tw + 16;
  const ph = 14;

  // Pill background (light tint)
  doc.setFillColor(col[0], col[1], col[2]);
  doc.roundedRect(x, y - 10, pw, ph, ph / 2, ph / 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);
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
  cap = 900 // characters cap so code doesn't run hundreds of pages
): number {
  const safe = cleanText((code || "No code submitted").slice(0, cap));
  const lines = doc.splitTextToSize(safe, width - 20);

  const lineH = 11;
  const blockH = Math.min(lines.length * lineH + 16, pageHeight - y - margin - 20);

  doc.setFillColor(...CODE_BG);
  doc.roundedRect(x, y, width, blockH, 4, 4, "F");

  doc.setFont("courier", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // slate-400

  let cy = y + 12;
  for (const line of lines) {
    if (cy + lineH > y + blockH - 4) break;
    doc.text(line, x + 10, cy);
    cy += lineH;
  }

  return y + blockH + 10;
}

function drawOutputBlock(
  doc: jsPDF,
  output: string,
  x: number,
  y: number,
  width: number,
  pageHeight: number,
  margin: number
): number {
  // eslint-disable-next-line no-control-regex
  const safe = cleanText(output.replace(/\x1B\[[0-9;]*[A-Za-z]/g, "")).slice(0, 600);
  const lines = doc.splitTextToSize(safe, width - 20);
  const lineH = 11;
  const blockH = Math.min(lines.length * lineH + 16, pageHeight - y - margin - 20);

  doc.setFillColor(30, 41, 59); // slate-800
  doc.roundedRect(x, y, width, blockH, 4, 4, "F");

  doc.setFont("courier", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(134, 239, 172); // green-300

  let cy = y + 12;
  for (const line of lines) {
    if (cy + lineH > y + blockH - 4) break;
    doc.text(line, x + 10, cy);
    cy += lineH;
  }

  return y + blockH + 10;
}

function addFooters(doc: jsPDF, pageWidth: number, pageHeight: number) {
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);

    // Footer rule
    doc.setDrawColor(...BRAND_L);
    doc.setLineWidth(0.5);
    doc.line(40, pageHeight - 28, pageWidth - 40, pageHeight - 28);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MID);
    doc.text("CodeGuard", 40, pageHeight - 15);
    doc.text(`Page ${p} of ${total}`, pageWidth - 40, pageHeight - 15, { align: "right" });
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
  filename?: string;
}) {
  const doc = createDoc();
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableW = pageWidth - margin * 2;

  let y = makeHeader(doc, pageWidth, pageHeight, margin, "Practical Submission Report", practicalTitle);

  const newPage = () => { doc.addPage(); y = margin + 10; };
  const need = (h: number) => { if (y + h > pageHeight - margin) { newPage(); return true; } return false; };

  // ── Student info card ────────────────────────────────────────────
  doc.setFillColor(...LIGHT);
  doc.roundedRect(margin, y, usableW, 58, 6, 6, "F");
  doc.setDrawColor(...BRAND_L);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, usableW, 58, 6, 6, "S");

  // Left column
  drawKV(doc, "Student Name", studentName, margin + 12, y + 18);
  drawKV(doc, "Roll Number", rollNumber, margin + 12, y + 34);
  drawKV(doc, "Language", language, margin + 12, y + 50);

  // Right column
  const rx = margin + usableW / 2 + 10;
  drawKV(doc, "Submission Date", submissionDate, rx, y + 18);
  drawKV(doc, "Marks", marks !== undefined ? String(marks) : "—", rx, y + 34);

  // Status pill (top-right of card)
  drawStatusPill(doc, status, margin + usableW - 80, y + 16);

  y += 70;

  // ── Plot images ───────────────────────────────────────────────────
  if (plotImages?.length) {
    need(30);
    drawSectionLabel(doc, "Generated Plots", margin, y, usableW);
    y += 10;
    for (const img of plotImages) {
      need(270);
      try {
        doc.addImage(`data:image/png;base64,${img}`, "PNG", margin, y, 380, 260);
      } catch (e) { console.error("Image:", e); }
      y += 270;
    }
  }

  // ── Source code ───────────────────────────────────────────────────
  need(50);
  drawSectionLabel(doc, `Source Code  ·  ${language}`, margin, y, usableW);
  y += 10;
  y = drawCodeBlock(doc, code, margin, y, usableW, pageHeight, margin);

  // ── Output ────────────────────────────────────────────────────────
  if (output) {
    need(50);
    drawSectionLabel(doc, "Program Output", margin, y, usableW);
    y += 10;
    y = drawOutputBlock(doc, output, margin, y, usableW, pageHeight, margin);
  }

  addFooters(doc, pageWidth, pageHeight);
  doc.save(filename);
}

// ─── Combined multi‑task PDF ──────────────────────────────────────────────────

export async function generateCombinedPdfClient({
  studentName,
  rollNumber,
  practicalTitle,
  tasks,
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
  filename?: string;
}) {
  const doc = createDoc();
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableW = pageWidth - margin * 2;

  let y = makeHeader(doc, pageWidth, pageHeight, margin, "Practical Submission Report", practicalTitle);

  const newPage = () => { doc.addPage(); y = margin + 10; };
  const need = (h: number) => { if (y + h > pageHeight - margin) { newPage(); return true; } return false; };

  // ── Shared info card ────────────────────────────────────────────
  doc.setFillColor(...LIGHT);
  doc.roundedRect(margin, y, usableW, 42, 6, 6, "F");
  doc.setDrawColor(...BRAND_L);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, usableW, 42, 6, 6, "S");

  drawKV(doc, "Student Name", studentName, margin + 12, y + 16);
  drawKV(doc, "Roll Number", rollNumber, margin + 12, y + 32);
  drawKV(doc, "Total Tasks", String(tasks.length), margin + usableW / 2 + 10, y + 16);

  y += 52;

  // ── Task overview chips ─────────────────────────────────────────
  // Small chips row showing Task 1, Task 2, …
  let cx = margin;
  tasks.forEach((t, i) => {
    const label = `Task ${i + 1}: ${t.taskTitle}`;
    const tw = Math.min(doc.getTextWidth(label) + 18, (usableW - 8 * (tasks.length - 1)) / tasks.length);
    const col = statusColor(t.status);
    doc.setFillColor(col[0], col[1], col[2]);
    doc.roundedRect(cx, y, tw, 18, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...WHITE);
    // Truncate label to fit
    const truncated = doc.getTextWidth(label) + 18 > tw
      ? label.slice(0, Math.floor(label.length * tw / (doc.getTextWidth(label) + 18)) - 2) + "…"
      : label;
    doc.text(truncated, cx + 9, y + 12);
    cx += tw + 8;
  });
  y += 28;

  // ── Per-task sections ───────────────────────────────────────────
  tasks.forEach((task, idx) => {
    need(60);

    // Task header bar
    const col = statusColor(task.status);
    doc.setFillColor(col[0], col[1], col[2]);
    doc.roundedRect(margin, y, 4, 44, 2, 2, "F"); // left accent stripe
    doc.setFillColor(LIGHT[0], LIGHT[1], LIGHT[2]);
    doc.roundedRect(margin + 6, y, usableW - 6, 44, 4, 4, "F");
    doc.setDrawColor(...BRAND_L);
    doc.roundedRect(margin + 6, y, usableW - 6, 44, 4, 4, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...BRAND);
    doc.text(`Task ${idx + 1} — ${cleanText(task.taskTitle)}`, margin + 18, y + 16);

    // Meta row
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MID);
    const meta = [
      task.language,
      task.submissionDate,
      task.marks !== undefined
        ? `Marks: ${task.marks}${task.maxMarks !== undefined ? ` / ${task.maxMarks}` : ""}`
        : "Not graded",
    ].join("   ·   ");
    doc.text(meta, margin + 18, y + 32);

    // Status pill
    drawStatusPill(doc, task.status, margin + usableW - 70, y + 20);

    y += 54;

    // Plot images
    if (task.plotImages?.length) {
      need(50);
      drawSectionLabel(doc, "Generated Plots", margin, y, usableW);
      y += 10;
      for (const img of task.plotImages) {
        need(270);
        try {
          doc.addImage(`data:image/png;base64,${img}`, "PNG", margin, y, 380, 260);
        } catch (e) { console.error("Image:", e); }
        y += 270;
      }
    }

    // Source code
    need(50);
    drawSectionLabel(doc, `Source Code  ·  ${task.language}`, margin, y, usableW);
    y += 10;
    y = drawCodeBlock(doc, task.code, margin, y, usableW, pageHeight, margin);

    // Output
    if (task.output) {
      need(50);
      drawSectionLabel(doc, "Program Output", margin, y, usableW);
      y += 10;
      y = drawOutputBlock(doc, task.output, margin, y, usableW, pageHeight, margin);
    }

    y += 6; // gap between tasks
  });

  addFooters(doc, pageWidth, pageHeight);
  doc.save(filename);
}
