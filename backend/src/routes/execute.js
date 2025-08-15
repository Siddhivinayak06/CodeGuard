const express = require("express");
const router = express.Router();
const runPythonCode = require("../utils/dockerRunner");

router.post("/", async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "No code provided." });

  try {
    const result = await runPythonCode(code);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Execution failed." });
  }
});

module.exports = router;
