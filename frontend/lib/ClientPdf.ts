// utils/ClientPdf.ts
import { jsPDF } from "jspdf";

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
  filename?: string;
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - margin * 2;

  let cursorY = margin;

  const newPage = () => {
    doc.addPage();
    cursorY = margin;
  };

  // -------------------------------------------
  // Header - Center aligned
  // -------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(40, 40, 40);
  doc.text("Practical Submission Report", pageWidth / 2, cursorY, { align: "center" });

  cursorY += 40;

  // -------------------------------------------
  // Student Details Table
  // -------------------------------------------
  const rowHeight = 22;
  const tableData = [
    ["Student Name", studentName],
    ["Roll Number", rollNumber],
    ["Practical Title", practicalTitle],
    ["Language", language],
    ["Submission Date", submissionDate],
    ["Status", status.toUpperCase()],
    ["Marks", marks !== undefined ? marks.toString() : "-"],
  ];

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");

  tableData.forEach(([label, value]) => {
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, cursorY, usableWidth, rowHeight, "F");

    doc.setFont("helvetica", "bold");
    doc.text(label + ":", margin + 10, cursorY + 15);

    doc.setFont("helvetica", "normal");
    doc.text(value, margin + 150, cursorY + 15);

    cursorY += rowHeight + 4;
  });

  cursorY += 15;

  // -------------------------------------------
  // Output Section (if provided)
  // -------------------------------------------
  if (output) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Program Output", margin, cursorY);
    cursorY += 20;

    // Background box
    const outputLines = doc.splitTextToSize(output, usableWidth - 20);

    doc.setFillColor(250, 250, 250);
    doc.rect(margin, cursorY - 12, usableWidth, outputLines.length * 16 + 25, "F");

    doc.setFont("courier", "normal");
    doc.setFontSize(10);

    outputLines.forEach((line: string) => {
      if (cursorY + 16 > pageHeight - margin) newPage();

      doc.text(line, margin + 10, cursorY);
      cursorY += 14;
    });

    cursorY += 20;
  }

  // -------------------------------------------
  // Code Section
  // -------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Source Code", margin, cursorY);
  cursorY += 20;

  const codeLines = doc.splitTextToSize(code || "No code submitted", usableWidth - 20);

  doc.setFillColor(245, 248, 250);
  doc.setDrawColor(210);
  doc.rect(margin, cursorY - 12, usableWidth, codeLines.length * 16 + 25, "FD");

  doc.setFont("courier", "normal");
  doc.setFontSize(10);

  codeLines.forEach((line: string) => {
    if (cursorY + 16 > pageHeight - margin) newPage();
    doc.text(line, margin + 10, cursorY);
    cursorY += 14;
  });

  // -------------------------------------------
  // Footer (each page)
  // -------------------------------------------
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setTextColor(130);

    doc.text("CodeGuard", margin, pageHeight - 20);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 60, pageHeight - 20);
  }

  doc.save(filename);
}
