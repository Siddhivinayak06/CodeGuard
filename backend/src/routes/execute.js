// src/routes/execute.js
const express = require("express");
const router = express.Router();
const runCode = require("../utils/dockerRunner"); // ✅ generic runner

router.post("/", async (req, res) => {
  const { code, lang = "python", stdinInput = "" } = req.body;

  if (!code) {
    return res.status(400).json({ error: "No code provided." });
  }

  try {
    const result = await runCode(code, lang, stdinInput);

    let cleanError = result.error;

    if (cleanError) {
      // 🧹 Remove file paths like /tmp/xyz/code.py or /usr/local/bin/...
      cleanError = cleanError.replace(/\/[^\s:]+/g, "").trim();

      if (lang === "python") {
        // Keep only last line (most useful error message)
        cleanError = cleanError.split("\n").slice(-1)[0].trim();
      }

      if (lang === "c") {
        // Keep only first 1–2 lines of compiler error
        cleanError = cleanError.split("\n").slice(0, 2).join("\n").trim();
      }
    }

    res.json({
      output: result.output,
      error: cleanError || "",
      exitCode: result.exitCode,
    });
  } catch (err) {
    console.error("❌ Execution error:", err.message);
    res.status(500).json({ error: err.message || "Execution failed." });
  }
});

module.exports = router;