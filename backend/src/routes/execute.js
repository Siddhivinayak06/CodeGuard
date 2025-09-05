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
    res.json(result);
  } catch (err) {
    console.error("❌ Execution error:", err.message);
    res.status(500).json({ error: err.message || "Execution failed." });
  }
});

module.exports = router;
