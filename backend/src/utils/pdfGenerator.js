const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

module.exports = function generatePdf(code, output) {
  const tmpDir = path.join(__dirname, "../../tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

  const pdfPath = path.join(tmpDir, "code_output.pdf");
  const doc = new PDFDocument();
  const stream = fs.createWriteStream(pdfPath);
  doc.pipe(stream);

  doc.fontSize(18).text("Code Submission", { underline: true });
  doc.moveDown();
  doc.fontSize(12).text("Code:", { bold: true });
  doc.moveDown(0.5);
  doc.font("Courier").text(code, { lineGap: 4 });

  doc.moveDown();
  doc.fontSize(12).text("Output:", { bold: true });
  doc.moveDown(0.5);
  doc.font("Courier").text(output || "No output", { lineGap: 4 });

  doc.moveDown();
  doc.fontSize(10).text(`Generated at: ${new Date().toLocaleString()}`);

  doc.end();

  return new Promise((resolve) => {
    stream.on("finish", () => resolve(pdfPath));
  });
};
