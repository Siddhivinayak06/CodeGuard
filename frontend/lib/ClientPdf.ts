// utils/ClientPdf.ts
import { jsPDF } from "jspdf";

/* -----------------------------------------------------------
   TEXT SANITIZER
   Removes emojis, corrupted unicode, smart quotes, symbols.
------------------------------------------------------------ */
function cleanText(str: string = ""): string {
  return str
    .normalize("NFKD")
    .replace(/[^\x20-\x7E\n\r\t]/g, "") // keep only ASCII printable chars
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, "    ")
    .trim();
}

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
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  /* -----------------------------------------------------------
     PAGE SETTINGS
  ------------------------------------------------------------ */
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - margin * 2;

  let cursorY = margin;

  const newPage = () => {
    doc.addPage();
    cursorY = margin;
  };

  /* -----------------------------------------------------------
     HEADER
  ------------------------------------------------------------ */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Practical Submission Report", pageWidth / 2, cursorY, {
    align: "center",
  });
  cursorY += 35;

  /* -----------------------------------------------------------
     STUDENT DETAILS
  ------------------------------------------------------------ */
  const details: [string, string][] = [
    ["Student Name", studentName],
    ["Roll Number", rollNumber],
    ["Practical Title", practicalTitle],
    ["Language", language],
    ["Submission Date", submissionDate],
    ["Status", status.toUpperCase()],
    ["Marks", marks?.toString() ?? "-"],
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);

  details.forEach(([label, value]) => {
    if (cursorY + 18 > pageHeight - margin) newPage();

    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, margin, cursorY);

    doc.setFont("helvetica", "normal");
    doc.text(cleanText(value), margin + 140, cursorY);

    cursorY += 18;
  });

  cursorY += 10;

  /* -----------------------------------------------------------
     PROGRAM OUTPUT
  ------------------------------------------------------------ */
  if (output) {
    if (cursorY + 20 > pageHeight - margin) newPage();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Program Output", margin, cursorY);
    cursorY += 20;

    doc.setFont("courier", "normal");
    doc.setFontSize(10);

    const safeOutput = cleanText(
      output.replace(/\x1B\[[0-9;]*[A-Za-z]/g, "")
    );

    const wrappedOutput = doc.splitTextToSize(safeOutput, usableWidth);

    wrappedOutput.forEach((line) => {
      if (cursorY + 12 > pageHeight - margin) newPage();
      doc.text(line, margin, cursorY);
      cursorY += 12;
    });

    cursorY += 10;
  }

  /* -----------------------------------------------------------
     PLOT IMAGES
  ------------------------------------------------------------ */
  if (plotImages?.length) {
    if (cursorY + 20 > pageHeight - margin) newPage();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Generated Plots", margin, cursorY);
    cursorY += 20;

    const imgWidth = 380;
    const imgHeight = 260;

    for (const img of plotImages) {
      if (cursorY + imgHeight > pageHeight - margin) newPage();

      try {
        doc.addImage(
          `data:image/png;base64,${img}`,
          "PNG",
          margin,
          cursorY,
          imgWidth,
          imgHeight
        );
      } catch (error) {
        console.error("Image load error:", error);
      }

      cursorY += imgHeight + 20;
    }
  }

  /* -----------------------------------------------------------
     SOURCE CODE
  ------------------------------------------------------------ */
  if (cursorY + 20 > pageHeight - margin) newPage();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Source Code", margin, cursorY);
  cursorY += 20;

  doc.setFont("courier", "normal");
  doc.setFontSize(10);

  const safeCode = cleanText(code || "No code submitted");
  const wrappedCode = doc.splitTextToSize(safeCode, usableWidth);

  wrappedCode.forEach((line) => {
    if (cursorY + 12 > pageHeight - margin) newPage();
    doc.text(line, margin, cursorY);
    cursorY += 12;
  });

  /* -----------------------------------------------------------
     FOOTER
  ------------------------------------------------------------ */
  const totalPages = doc.getNumberOfPages();

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    doc.text("CodeGuard", margin, pageHeight - 20);
    doc.text(
      `Page ${p} of ${totalPages}`,
      pageWidth - margin - 60,
      pageHeight - 20
    );
  }

  doc.save(filename);
}
