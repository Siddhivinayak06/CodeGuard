// utils/ClientPdf.ts
import { jsPDF } from "jspdf";

// ─── Monochrome Palette ─────────────────────────────────────────────────────
const BLACK    = [0,   0,   0  ] as [number, number, number];
const DARK     = [38,  38,  38 ] as [number, number, number]; // near-black
const MEDIUM   = [115, 115, 115] as [number, number, number]; // mid-gray
const LIGHT    = [180, 180, 180] as [number, number, number]; // light gray
const RULE     = [210, 210, 210] as [number, number, number]; // rule lines
const BG_ALT   = [247, 247, 247] as [number, number, number]; // very light bg
const CODE_BG  = [245, 245, 245] as [number, number, number]; // code bg
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

interface TestCaseResultPdf {
  test_case_id?: number;
  status: string;
  stdout?: string;
  stderr?: string;
  execution_time_ms?: number;
  memory_used_kb?: number;
}

// ─── Drawing primitives ─────────────────────────────────────────────────────

function createDoc() {
  return new jsPDF({ unit: "pt", format: "a4" });
}

function makeHeader(
  doc: jsPDF,
  pageWidth: number,
  margin: number,
  title: string,
  subtitle: string
): number {
  let y = 36;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...BLACK);
  doc.text(title, margin, y);

  // Subtitle line
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MEDIUM);
  doc.text(subtitle, margin, y);

  // Thin rule
  y += 10;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  return y + 14;
}

function drawLabel(doc: jsPDF, text: string, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text(text, x, y);
  // Small underline
  const tw = doc.getTextWidth(text);
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.5);
  doc.line(x, y + 4, x + tw, y + 4);
}

function drawField(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  labelW = 90
) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...LIGHT);
  doc.text(label, x, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text(cleanText(value), x + labelW, y);
}

function drawStatusText(doc: jsPDF, status: string, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...DARK);
  doc.text(status.replace(/_/g, " ").toUpperCase(), x, y);
}

function drawTestCaseTable(
  doc: jsPDF,
  results: TestCaseResultPdf[],
  x: number,
  y: number,
  width: number,
  pageHeight: number,
  margin: number
): number {
  if (!results || results.length === 0) return y;

  let cy = y;
  const rowH = 16;
  const headerH = 16;

  if (cy + headerH + results.length * rowH > pageHeight - margin) {
    if (cy + headerH + 3 * rowH > pageHeight - margin) {
      doc.addPage();
      cy = margin + 10;
    }
  }

  // Determine which optional columns to show (only if at least one result has data)
  const hasTime = results.some(r => r.execution_time_ms !== undefined && r.execution_time_ms !== null);
  const hasMemory = results.some(r => r.memory_used_kb !== undefined && r.memory_used_kb !== null);

  // Column positions
  const c1 = x + 10;
  const c2 = x + 40;
  const c3 = hasTime ? x + width * 0.55 : 0;
  const c4 = hasMemory ? x + width * 0.78 : 0;

  // Header row
  doc.setFillColor(...BG_ALT);
  doc.rect(x, cy, width, headerH, "F");
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(x, cy + headerH, x + width, cy + headerH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...MEDIUM);
  doc.text("#", c1, cy + 11);
  doc.text("RESULT", c2, cy + 11);
  if (hasTime) doc.text("TIME", c3, cy + 11);
  if (hasMemory) doc.text("MEMORY", c4, cy + 11);

  cy += headerH;

  // Rows
  results.forEach((tc, idx) => {
    if (cy + rowH > pageHeight - margin) {
      doc.addPage();
      cy = margin + 10;
    }

    if (idx % 2 === 1) {
      doc.setFillColor(...BG_ALT);
      doc.rect(x, cy, width, rowH, "F");
    }

    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.15);
    doc.line(x, cy + rowH, x + width, cy + rowH);

    const textY = cy + 11;

    // Test number
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.text(String(idx + 1), c1, textY);

    // Status
    const isPassed = tc.status.toLowerCase() === "passed";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...DARK);
    doc.text(
      isPassed ? "PASS" : tc.status.replace(/_/g, " ").toUpperCase(),
      c2,
      textY
    );

    // Time (only if column is shown)
    if (hasTime) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MEDIUM);
      doc.text(
        tc.execution_time_ms !== undefined ? `${tc.execution_time_ms} ms` : "-",
        c3,
        textY
      );
    }

    // Memory (only if column is shown)
    if (hasMemory) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MEDIUM);
      doc.text(
        tc.memory_used_kb !== undefined ? `${tc.memory_used_kb} KB` : "-",
        c4,
        textY
      );
    }

    cy += rowH;
  });

  // Summary
  cy += 8;
  const passed = results.filter(r => r.status.toLowerCase() === "passed").length;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MEDIUM);
  doc.text(`Result: ${passed} / ${results.length} passed`, x + 10, cy + 4);

  // Simple progress bar (monochrome)
  const barX = x + width * 0.45;
  const barW = width * 0.5;
  const barH = 4;
  const barY = cy;
  const ratio = results.length > 0 ? passed / results.length : 0;

  doc.setFillColor(...RULE);
  doc.roundedRect(barX, barY, barW, barH, 2, 2, "F");

  if (ratio > 0) {
    doc.setFillColor(...DARK);
    doc.roundedRect(barX, barY, barW * ratio, barH, 2, 2, "F");
  }

  return cy + 14;
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

  // Set font BEFORE splitting so metrics are correct for Courier
  doc.setFont("courier", "normal");
  doc.setFontSize(8.5);

  const lines = doc.splitTextToSize(safe, width - 34) as string[];

  const lineH = 10;
  let cy = y;
  const remainingLines = [...lines];
  let lineNum = 0;

  while (remainingLines.length > 0) {
    const availableH = pageHeight - cy - margin - 20;
    const linesToDrawCount = Math.floor(availableH / lineH);

    if (linesToDrawCount < 3 && remainingLines.length > 0) {
      doc.addPage();
      cy = margin + 10;
      continue;
    }

    const batch = remainingLines.splice(0, linesToDrawCount);
    const batchH = batch.length * lineH + 14;

    // Light background
    doc.setFillColor(...CODE_BG);
    doc.rect(x, cy, width, batchH, "F");

    // Left border accent
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.5);
    doc.line(x, cy, x, cy + batchH);
    doc.line(x + width, cy, x + width, cy + batchH);
    doc.line(x, cy, x + width, cy);
    doc.line(x, cy + batchH, x + width, cy + batchH);


    let lineY = cy + 11;
    for (let i = 0; i < batch.length; i++) {
      lineNum++;
      // Line number
      doc.setTextColor(...LIGHT);
      doc.text(String(lineNum).padStart(3, " "), x + 5, lineY);
      // Separator
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.2);
      doc.line(x + 24, cy, x + 24, cy + batchH);
      // Code
      doc.setTextColor(...BLACK);
      doc.text(batch[i], x + 28, lineY);
      lineY += lineH;
    }

    cy += batchH;

    if (remainingLines.length > 0) {
      doc.addPage();
      cy = margin + 10;
    }
  }

  return cy + 16;
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

  // Set font BEFORE splitting so metrics are correct for Courier
  doc.setFont("courier", "normal");
  doc.setFontSize(7.5);

  const lines = doc.splitTextToSize(safe, width - 20) as string[];
  const lineH = 10;

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
    const batchH = batch.length * lineH + 14;

    doc.setFillColor(...BG_ALT);
    doc.rect(x, cy, width, batchH, "F");
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.rect(x, cy, width, batchH, "S");

    doc.setTextColor(...DARK);

    let lineY = cy + 11;
    for (const line of batch) {
      doc.text(line, x + 8, lineY);
      lineY += lineH;
    }

    cy += batchH;

    if (remainingLines.length > 0) {
      doc.addPage();
      cy = margin + 10;
    }
  }

  return cy + 16;
}

function addFooters(doc: jsPDF, pageWidth: number, pageHeight: number, margin: number) {
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);

    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 26, pageWidth - margin, pageHeight - 26);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...LIGHT);
    doc.text("CodeGuard", margin, pageHeight - 14);
    doc.text(
      `Page ${p} / ${total}`,
      pageWidth - margin,
      pageHeight - 14,
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
  maxMarks,
  output,
  plotImages,
  showMarks,
  subjectName,
  subjectCode,
  testCaseResults,
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
  maxMarks?: number;
  output?: string;
  plotImages?: string[];
  showMarks?: boolean;
  subjectName?: string;
  subjectCode?: string;
  testCaseResults?: TestCaseResultPdf[];
  filename?: string;
}) {
  const safeStudent = studentName?.replace(/\s+/g, "_") || "User";
  const safeRoll = rollNumber?.replace(/\s+/g, "_") || "Unknown";
  const finalFilename = `${safeStudent}_${safeRoll}.pdf`;

  const doc = createDoc();
  const margin = 42;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableW = pageWidth - margin * 2;

  let y = makeHeader(doc, pageWidth, margin, "Submission Report", practicalTitle);

  const newPage = () => { doc.addPage(); y = margin + 10; };
  const need = (h: number) => { if (y + h > pageHeight - margin) { newPage(); return true; } return false; };

  // ── Details grid ───────────────────────────────────────────────
  const col1 = margin;
  const col2 = margin + usableW / 2;

  drawField(doc, "Student", studentName, col1, y);
  drawField(doc, "Date", submissionDate, col2, y);
  y += 14;

  drawField(doc, "Roll No.", rollNumber, col1, y);
  drawField(doc, "Language", language.toUpperCase(), col2, y);
  y += 14;

  if (subjectName || subjectCode) {
    drawField(doc, "Subject", `${subjectName || ""}${subjectCode ? ` (${subjectCode})` : ""}`, col1, y);
  }
  drawField(doc, "Status", status.replace(/_/g, " ").toUpperCase(), col2, y);
  y += 14;

  if (showMarks !== false) {
    const marksStr = marks !== undefined
      ? `${marks}${maxMarks !== undefined ? ` / ${maxMarks}` : ""}`
      : "Not graded";
    drawField(doc, "Marks", marksStr, col1, y);
    y += 14;
  }

  // Separator
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 12;

  // ── Test Case Results ──────────────────────────────────────────
  if (testCaseResults && testCaseResults.length > 0) {
    need(50);
    drawLabel(doc, "Test Cases", margin, y);
    y += 14;
    y = drawTestCaseTable(doc, testCaseResults, margin, y, usableW, pageHeight, margin);
    y += 4;
  }

  // ── Plot images ───────────────────────────────────────────────
  if (plotImages?.length) {
    need(30);
    drawLabel(doc, "Generated Plots", margin, y);
    y += 14;
    for (const img of plotImages) {
      need(270);
      try {
        doc.addImage(`data:image/png;base64,${img}`, "PNG", margin, y, 380, 260);
      } catch (e) { console.error("Image:", e); }
      y += 270;
    }
  }

  // ── Submitted code ────────────────────────────────────────────
  need(50);
  drawLabel(doc, `Code (${language.toUpperCase()})`, margin, y);
  y += 14;
  y = drawCodeBlock(doc, code, margin, y, usableW, pageHeight, margin);

  // ── Output ────────────────────────────────────────────────────
  if (output) {
    need(50);
    drawLabel(doc, "Output", margin, y);
    y += 14;
    y = drawOutputBlock(doc, output, margin, y, usableW, pageHeight, margin);
  }

  addFooters(doc, pageWidth, pageHeight, margin);
  doc.save(finalFilename);
}

// ─── Combined multi‑task PDF ──────────────────────────────────────────────────

export async function generateCombinedPdfClient({
  studentName,
  rollNumber,
  practicalTitle,
  tasks,
  showMarks,
  subjectName,
  subjectCode,
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
    testCaseResults?: TestCaseResultPdf[];
  }[];
  showMarks?: boolean;
  subjectName?: string;
  subjectCode?: string;
  filename?: string;
}) {
  const safeStudent = studentName?.replace(/\s+/g, "_") || "User";
  const safeRoll = rollNumber?.replace(/\s+/g, "_") || "Unknown";
  const finalFilename = `${safeStudent}_${safeRoll}.pdf`;

  const doc = createDoc();
  const margin = 42;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableW = pageWidth - margin * 2;

  let y = makeHeader(doc, pageWidth, margin, "Submission Report", practicalTitle);

  const newPage = () => { doc.addPage(); y = margin + 10; };
  const need = (h: number) => { if (y + h > pageHeight - margin) { newPage(); return true; } return false; };

  // ── Student details ────────────────────────────────────────────
  const col1 = margin;
  const col2 = margin + usableW / 2;

  drawField(doc, "Student", studentName, col1, y);
  drawField(doc, "Tasks", String(tasks.length), col2, y);
  y += 14;

  drawField(doc, "Roll No.", rollNumber, col1, y);
  if (subjectName || subjectCode) {
    drawField(doc, "Subject", `${subjectName || ""}${subjectCode ? ` (${subjectCode})` : ""}`, col2, y);
  }
  y += 14;

  drawField(doc, "Language", tasks[0]?.language?.toUpperCase() || "-", col1, y);

  // Total marks
  if (showMarks !== false) {
    const totalMarks = tasks.reduce((sum, t) => sum + (t.marks ?? 0), 0);
    const totalMaxMarks = tasks.reduce((sum, t) => sum + (t.maxMarks ?? 0), 0);
    const hasAny = tasks.some(t => t.marks !== undefined);
    if (hasAny && totalMaxMarks > 0) {
      drawField(doc, "Total", `${totalMarks} / ${totalMaxMarks}`, col2, y);
    }
  }
  y += 6;

  // Separator
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 12;

  // ── Task summary table ────────────────────────────────────────
  need(30 + tasks.length * 18);
  drawLabel(doc, "Summary", margin, y);
  y += 14;

  // Table header
  const sc1 = margin + 8;
  const sc2 = margin + usableW * 0.45;
  const sc3 = margin + usableW * 0.65;
  const sc4 = margin + usableW * 0.85;

  doc.setFillColor(...BG_ALT);
  doc.rect(margin, y, usableW, 16, "F");
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(margin, y + 16, margin + usableW, y + 16);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...MEDIUM);
  doc.text("TASK", sc1, y + 11);
  doc.text("LANGUAGE", sc2, y + 11);
  doc.text("STATUS", sc3, y + 11);
  if (showMarks !== false) doc.text("MARKS", sc4, y + 11);
  y += 16;

  tasks.forEach((t, idx) => {
    const rowH = 16;
    if (idx % 2 === 1) {
      doc.setFillColor(...BG_ALT);
      doc.rect(margin, y, usableW, rowH, "F");
    }
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.15);
    doc.line(margin, y + rowH, margin + usableW, y + rowH);

    const textY = y + 11;

    // Task name (truncated)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    const taskLabel = `${idx + 1}. ${cleanText(t.taskTitle)}`;
    const maxLabelW = usableW * 0.4;
    const truncLabel = doc.getTextWidth(taskLabel) > maxLabelW
      ? taskLabel.slice(0, Math.floor(taskLabel.length * maxLabelW / doc.getTextWidth(taskLabel)) - 2) + "..."
      : taskLabel;
    doc.text(truncLabel, sc1, textY);

    // Language
    doc.setTextColor(...MEDIUM);
    doc.text(t.language.toUpperCase(), sc2, textY);

    // Status
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...DARK);
    doc.text(t.status.replace(/_/g, " ").toUpperCase(), sc3, textY);

    // Marks
    if (showMarks !== false) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...DARK);
      const marksStr = t.marks !== undefined
        ? `${t.marks}${t.maxMarks !== undefined ? ` / ${t.maxMarks}` : ""}`
        : "-";
      doc.text(marksStr, sc4, textY);
    }

    y += rowH;
  });
  y += 12;

  // ── Per-task detail sections ──────────────────────────────────
  tasks.forEach((task, idx) => {
    need(50);

    // Task header — thin rule with title
    doc.setDrawColor(...DARK);
    doc.setLineWidth(0.8);
    doc.line(margin, y, margin + usableW, y);
    y += 14;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...BLACK);
    doc.text(`${idx + 1}. ${cleanText(task.taskTitle)}`, margin, y);
    y += 6;

    // Meta line
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MEDIUM);
    const meta = [
      task.language.toUpperCase(),
      task.submissionDate,
      task.status.replace(/_/g, " ").toUpperCase(),
      showMarks !== false ? (
        task.marks !== undefined
          ? `${task.marks}${task.maxMarks !== undefined ? ` / ${task.maxMarks}` : ""} marks`
          : "Not graded"
      ) : null,
    ].filter(Boolean).join("  ·  ");
    doc.text(meta, margin, y + 8);
    y += 18;

    // Test case results
    if (task.testCaseResults && task.testCaseResults.length > 0) {
      need(50);
      drawLabel(doc, "Test Cases", margin, y);
      y += 14;
      y = drawTestCaseTable(doc, task.testCaseResults, margin, y, usableW, pageHeight, margin);
      y += 4;
    }

    // Plot images
    if (task.plotImages?.length) {
      need(50);
      drawLabel(doc, "Plots", margin, y);
      y += 14;
      for (const img of task.plotImages) {
        need(270);
        try {
          doc.addImage(`data:image/png;base64,${img}`, "PNG", margin, y, 380, 260);
        } catch (e) { console.error("Image:", e); }
        y += 270;
      }
    }

    // Code
    need(50);
    drawLabel(doc, `Code (${task.language.toUpperCase()})`, margin, y);
    y += 14;
    y = drawCodeBlock(doc, task.code, margin, y, usableW, pageHeight, margin);

    // Output
    if (task.output) {
      need(50);
      drawLabel(doc, "Output", margin, y);
      y += 14;
      y = drawOutputBlock(doc, task.output, margin, y, usableW, pageHeight, margin);
    }

    y += 6;
  });

  addFooters(doc, pageWidth, pageHeight, margin);
  doc.save(finalFilename);
}
