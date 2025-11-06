const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const runBatchCode = require("../utils/dockerRunner");
const runCode = require("../utils/runCode"); // single test case fallback

router.post("/", async (req, res) => {
  const { code, reference_code, lang = "c", batch = [], stdinInput = "", problem = "" } = req.body;

  try {
    // ========================
    // 1️⃣ Batch mode (multiple test cases)
    // ========================
    if (Array.isArray(batch) && batch.length > 0) {
      console.log(`Executing ${batch.length} test cases for ${lang}...`);

      const runnerResults = await runBatchCode(code, lang, batch);

for (const result of runnerResults) {
  const tc = batch.find(b => b.id === result.test_case_id);
  if (!tc) continue;

  console.log("Test case:", tc.id);
  console.log("is_hidden:", tc.is_hidden);
  console.log("has reference_code:", !!reference_code);

  if (!tc.is_hidden && reference_code) {
    console.log("Running reference code...");
    const refRes = await runCode(reference_code, lang, tc.stdinInput ?? tc.input ?? "");
    result.reference_stdout = (refRes.output ?? "").trimEnd();
  } else if (tc.is_hidden) {
    console.log("Using expectedOutput from tc:", tc.expectedOutput);
    result.reference_stdout = tc.expectedOutput ?? "";
  }
  
  console.log("Final reference_stdout:", result.reference_stdout);

    // ✅ ADD THESE TWO LINES HERE:
  console.log("Student stdout:", result.stdout);
  console.log("Expected (reference_stdout):", result.reference_stdout);

        const userOut = (result.stdout ?? "").trimEnd();
        const refOut = (result.reference_stdout ?? "").trimEnd();

        if (result.stderr?.toLowerCase().includes("compile")) result.status = "compile_error";
        else if (result.stderr?.toLowerCase().includes("timeout")) result.status = "time_limit_exceeded";
        else if (result.stderr && result.stderr !== "") result.status = "runtime_error";
        else result.status = (userOut === refOut) ? "passed" : "failed";
      }

      return res.json({ verdict: "evaluated", details: runnerResults });
    }

    // ========================
    // 2️⃣ Single input / normal static terminal mode
    // ========================
    if (!code) return res.status(400).json({ error: "No code provided." });

    // Run user's code
    const userResult = await runCode(code, lang, stdinInput);

    // If a problem is provided, compare with reference code
    let refOut = "";
    if (problem) {
      const referencePath = path.join(process.cwd(), "reference", `${problem}.c`);
      if (fs.existsSync(referencePath)) {
        const referenceCode = fs.readFileSync(referencePath, "utf8");
        const refResult = await runCode(referenceCode, lang, stdinInput);
        refOut = (refResult.output ?? "").trim();
      }
    }

    const clean = (s = "") =>
      s
        .split("\n")
        .map((line) => line.trimEnd())
        .join("\n")
        .trim();

    const userOut = clean(userResult.output);
    const passed = refOut ? userOut === refOut : true;

    return res.json({
      mode: "manual",
      problem: problem || "manual_run",
      input: stdinInput,
      expected: refOut || userOut,
      output: userOut,
      verdict: passed ? "passed" : "failed",
      user_stderr: userResult.error || "",
    });
  } catch (err) {
    console.error("Execution error:", err);
    return res.status(500).json({ error: "Execution failed." });
  }
});

module.exports = router;