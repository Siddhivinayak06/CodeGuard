// src/routes/execute.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { z } = require('zod');

// Validation Schema
const executeSchema = z.object({
  code: z.string().optional(),
  reference_code: z.string().optional(),
  lang: z.enum(['c', 'cpp', 'python', 'py', 'java']).default('c'),
  batch: z
    .array(
      z.object({
        id: z.string().or(z.number()),
        stdinInput: z.string().optional(),
        input: z.string().optional(),
        expectedOutput: z.string().optional(),
        is_hidden: z.boolean().optional(),
      })
    )
    .optional(),
  stdinInput: z.string().optional(),
  problem: z
    .string()
    .regex(/^[a-zA-Z0-9_]*$/, 'Invalid problem ID')
    .optional(),
});

// IMPORTANT: adjust these paths if your utils live in a different folder
let runBatchCode;
let runCode;
try {
  runBatchCode = require('../utils/dockerRunner');
} catch (e) {
  console.error('Failed to require ../utils/dockerRunner:', e && e.message);
}
try {
  runCode = require('../utils/runCode');
} catch (e) {
  console.error('Failed to require ../utils/runCode:', e && e.message);
}

// sanity checks: ensure modules are functions
if (typeof runBatchCode !== 'function') {
  console.warn('Warning: runBatchCode is not a function:', typeof runBatchCode);
}
if (typeof runCode !== 'function') {
  console.warn('Warning: runCode is not a function:', typeof runCode);
}

// map language -> reference file extension
const LANG_EXT = {
  c: 'c',
  cpp: 'cpp',
  python: 'py',
  py: 'py',
  java: 'java',
};

function normalizeOutput(s = '') {
  return (s ?? '')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

// small helper to ensure a function is provided to router
function ensureCallable(fn, name) {
  if (typeof fn !== 'function') {
    const err = new Error(
      `${name} is not a function (type=${typeof fn}). Check require path / module.exports.`
    );
    err.code = 'NOT_CALLABLE';
    throw err;
  }
}

// Wrap main handler into a true function reference (avoids "callback required" mistakes)
router.post('/', async (req, res) => {
  try {
    // defensive: check required util functions at runtime before using
    ensureCallable(runBatchCode, 'runBatchCode');
    ensureCallable(runCode, 'runCode');

    // Validate input
    const parseResult = executeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: parseResult.error.errors,
      });
    }

    const { code, reference_code, lang, batch, stdinInput, problem } =
      parseResult.data;

    // ========================
    // 1️⃣ Batch mode (multiple test cases)
    // ========================
    if (Array.isArray(batch) && batch.length > 0) {
      console.log(`Executing ${batch.length} test cases for ${lang}...`);

      let runnerResults;
      try {
        runnerResults = await runBatchCode(code, lang, batch);
      } catch (e) {
        console.error('runBatchCode threw:', e && e.stack ? e.stack : e);
        return res.status(500).json({
          error: 'Runner failed',
          detail: String(e && e.message ? e.message : e),
        });
      }

      for (const result of runnerResults) {
        const tc = batch.find((b) => b.id === result.test_case_id);
        if (!tc) continue;

        // Ensure field exists
        result.reference_stdout = result.reference_stdout ?? '';

        if (!tc.is_hidden && reference_code) {
          try {
            const refRes = await runCode(
              reference_code,
              lang,
              tc.stdinInput ?? tc.input ?? ''
            );
            result.reference_stdout = (refRes.output ?? '').trimEnd();
          } catch (e) {
            console.error('Reference runCode error:', e);
            result.reference_stdout = tc.expectedOutput ?? '';
            result.reference_error = String(e && e.message ? e.message : e);
          }
        } else if (tc.is_hidden) {
          result.reference_stdout = tc.expectedOutput ?? '';
        }

        // Useful logs for debugging
        console.log('Test case:', tc.id);
        console.log('Student stdout:', result.stdout);
        console.log('Expected (reference_stdout):', result.reference_stdout);

        const userOut = (result.stdout ?? '').trimEnd();
        const refOut = (result.reference_stdout ?? '').trimEnd();

        const lowErr = (result.stderr ?? '').toLowerCase();
        if (
          lowErr.includes('compile') ||
          lowErr.includes('javac') ||
          lowErr.includes('error:')
        ) {
          result.status = 'compile_error';
        } else if (lowErr.includes('timeout') || lowErr.includes('timed out')) {
          result.status = 'time_limit_exceeded';
        } else if (result.stderr && result.stderr !== '') {
          result.status = 'runtime_error';
        } else {
          result.status = userOut === refOut ? 'passed' : 'failed';
        }
      }

      return res.json({ verdict: 'evaluated', details: runnerResults });
    }

    // ========================
    // 2️⃣ Single input / normal static terminal mode
    // ========================
    if (!code) return res.status(400).json({ error: 'No code provided.' });

    // Run user's code
    let userResult;
    try {
      userResult = await runCode(code, lang, stdinInput);
    } catch (e) {
      console.error('runCode threw:', e && e.stack ? e.stack : e);
      return res.status(500).json({
        error: 'Runner failed',
        detail: String(e && e.message ? e.message : e),
      });
    }

    // If a problem is provided, compare with reference code
    let refOut = '';
    if (problem) {
      const ext = LANG_EXT[lang] || 'c';
      const referencePath = path.join(
        process.cwd(),
        'reference',
        `${problem}.${ext}`
      );
      if (fs.existsSync(referencePath)) {
        try {
          const referenceCode = fs.readFileSync(referencePath, 'utf8');
          const refResult = await runCode(referenceCode, lang, stdinInput);
          refOut = (refResult.output ?? '').trim();
        } catch (e) {
          console.error('Reference runCode error:', e);
        }
      } else {
        console.warn(`Reference file not found: ${referencePath}`);
      }
    }

    const userOut = normalizeOutput(userResult.output);
    const expectedOut = normalizeOutput(refOut || userOut);
    const passed = refOut ? userOut === refOut : true;

    // compute verdict and capture stderr/error message
    let verdict = passed ? 'passed' : 'failed';
    if (!userResult) {
      verdict = 'failed';
    } else if (
      userResult.exitCode === 124 ||
      (userResult.error && userResult.error.toLowerCase().includes('timeout'))
    ) {
      verdict = 'time_limit_exceeded';
    } else if (
      userResult.error &&
      /compile|javac|error:/i.test(userResult.error)
    ) {
      verdict = 'compile_error';
    } else if (userResult.error && userResult.error.trim() !== '') {
      verdict = 'runtime_error';
    }

    return res.json({
      mode: 'manual',
      problem: problem || 'manual_run',
      input: stdinInput,
      expected: expectedOut,
      output: userOut,
      verdict,
      user_stderr: userResult.error || userResult.stderr || '',
    });
  } catch (err) {
    console.error(
      'Execution handler error:',
      err && err.stack ? err.stack : err
    );
    if (err && err.code === 'NOT_CALLABLE') {
      return res.status(500).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Execution failed.' });
  }
});

module.exports = router;
