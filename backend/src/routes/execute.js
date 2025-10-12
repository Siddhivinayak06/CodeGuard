const express = require("express");
const router = express.Router();
const runBatchCode = require("../utils/dockerRunner");

router.post("/", async (req, res) => {
  const { code, lang = "python", batch = [] } = req.body;

  if (!code || !Array.isArray(batch) || batch.length === 0) {
    return res.status(400).json({ error: "No code or test cases provided." });
  }

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
        stdout: r.stdout,
        stderr: r.stderr
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
});

module.exports = router;
