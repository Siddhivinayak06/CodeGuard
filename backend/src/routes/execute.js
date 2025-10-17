const express = require("express");
const router = express.Router();
const runBatchCode = require("../utils/dockerRunner");
const runCode = require("../utils/runCode"); // your old runner

router.post("/", async (req, res) => {
  const { code, lang = "python", batch = [], stdinInput = "" } = req.body;

  // If batch is provided (test cases), use batch runner
  if (Array.isArray(batch) && batch.length > 0) {
    try {
      const runnerResults = await runBatchCode(code, lang, batch);

      const details = runnerResults.map((r, idx) => {
        const tc = batch[idx];
        let status = "failed";

        if (r.stderr && r.stderr.toLowerCase().includes("compile")) status = "compile_error";
        else if (r.stderr && r.stderr.toLowerCase().includes("timeout")) status = "time_limit_exceeded";
        else if (r.stderr && r.stderr !== "") status = "runtime_error";
        else status = "passed";

        return {
          test_case_id: tc.id ?? idx + 1,
          status,
          time_ms: tc.time_limit_ms ?? null,
          memory_kb: tc.memory_limit_kb ?? null,
          // ✅ Trim trailing whitespace from stdout/stderr to ignore whitespace issues
          stdout: r.stdout.trimEnd(),
          stderr: r.stderr.trimEnd()
        };
      });

      const passed = details.filter(d => d.status === "passed").length;
      const total = details.length;

      let verdict = "accepted";
      if (passed === 0) verdict = "wrong_answer";
      else if (passed < total) verdict = "partial";

      res.json({ verdict, details, results: details });
    } catch (err) {
      console.error("Execution error:", err);
      res.status(500).json({ error: "Execution failed." });
    }

  } else {
    // Normal static terminal mode: use single-run runner
    if (!code) return res.status(400).json({ error: "No code provided." });

    try {
      const result = await runCode(code, lang, stdinInput);
      res.json({ output: result.output, error: result.error, exitCode: result.exitCode });
    } catch (err) {
      console.error("Execution error:", err);
      res.status(500).json({ error: "Execution failed." });
    }
  }
});

module.exports = router;
