// utils/ClientPdf.ts
import { jsPDF } from "jspdf";

export async function generatePdfClient({
  code,
  output,
  user = "Anonymous",
  filename = "code_output.pdf",
}: {
  code: string;
  output?: string;
  user?: string;
  filename?: string;
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginLeft = 40;
  const marginTop = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - marginLeft * 2;

  const headingFontSize = 18;
  const textFontSize = 11;
  const monoFont = "courier";

  let cursorY = marginTop;

  const newPage = () => {
    doc.addPage();
    cursorY = marginTop;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(headingFontSize);
  doc.text("Code Submission", marginLeft, cursorY);
  cursorY += headingFontSize + 12;

  doc.setFontSize(textFontSize);
  doc.setFont("helvetica", "normal");
  doc.text(`Submitted by: ${user}`, marginLeft, cursorY);
  cursorY += textFontSize + 12;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated at: ${new Date().toLocaleString()}`, marginLeft, cursorY);
  doc.setTextColor(0);
  cursorY += 16;

  cursorY += 6;

  const drawPreformattedBlock = (title: string, content: string) => {
    const titleSize = 12;
    const lineHeight = textFontSize * 1.35;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(titleSize);
    if (cursorY + titleSize > pageHeight - marginTop) newPage();
    doc.text(title, marginLeft, cursorY);
    cursorY += titleSize + 6;

    doc.setFont(monoFont as any, "normal");
    doc.setFontSize(textFontSize);

    const lines = doc.splitTextToSize(content || "No output", usableWidth);

    lines.forEach((line) => {
      if (cursorY + lineHeight > pageHeight - marginTop) {
        newPage();
        doc.setFont(monoFont as any, "normal");
        doc.setFontSize(textFontSize);
      }
      doc.text(line, marginLeft, cursorY);
      cursorY += lineHeight;
    });

    cursorY += 10;
    doc.setFont("helvetica", "normal");
  };

  drawPreformattedBlock("Code:", code || "");
  drawPreformattedBlock("Output:", output || "No output");

  doc.save(filename);
}
