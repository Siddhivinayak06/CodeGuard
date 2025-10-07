const express = require("express");
const router = express.Router();
const generatePdf = require("../utils/pdfGenerator");

router.post("/", async (req, res) => {
  const { code, output, user } = req.body; // ✅ accept user
  if (!code) return res.status(400).json({ error: "No code provided." });

  try {
    const pdfPath = await generatePdf(code, output, user);
    res.download(pdfPath, "code_output.pdf");
  } catch (err) {
    res.status(500).json({ error: "PDF generation failed." });
  }
});

module.exports = router;