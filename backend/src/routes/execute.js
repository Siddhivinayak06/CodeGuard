// src/routes/execute.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { z } = require('zod');

// Validation Schema
const executeSchema = z.object({
  code: z.string().optional(),
  reference_code: z.string().optional(),
  reference_lang: z.string().optional(),
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
  logger.error('Failed to require ../utils/dockerRunner:', e && e.message);
}
try {
  runCode = require('../utils/runCode');
} catch (e) {
  logger.error('Failed to require ../utils/runCode:', e && e.message);
}

// sanity checks: ensure modules are functions
if (typeof runBatchCode !== 'function') {
  logger.warn('Warning: runBatchCode is not a function:', typeof runBatchCode);
}
if (typeof runCode !== 'function') {
  logger.warn('Warning: runCode is not a function:', typeof runCode);
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

// small helper function removed (ensureCallable)

// Wrap main handler into a true function reference (avoids "callback required" mistakes)
router.post('/', async (req, res) => {
  try {
    // Validate input
    const parseResult = executeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: parseResult.error.errors,
      });
    }

    const { code, reference_code, reference_lang, lang, batch, stdinInput, problem } =
      parseResult.data;

    const queueService = require('../services/queueService');

    // ========================
    // 1️⃣ Batch mode (multiple test cases)
    // ========================
    if (Array.isArray(batch) && batch.length > 0) {
      logger.info(`Queuing batch execution for ${lang}...`);

      try {
        // Enqueue job and wait for result (simulating synchronous API for now)
        const job = await queueService.addJob({
          type: 'batch',
          code,
          lang,
          batch,
          problem,
        });

        const runnerResults = await job.waitUntilFinished(
          queueService.queueEvents
        );

        for (const result of runnerResults) {
          const tc = batch.find((b) => b.id === result.test_case_id);
          if (!tc) continue;

          // Ensure field exists
          result.reference_stdout = result.reference_stdout ?? '';

          if (!tc.is_hidden && reference_code) {
            // If reference code needs to be run, we might need another job or run it here.
            // For simplicity/perf, let's run it here if it's light, OR we should have sent ref code to worker.
            // Current design: Run ref code HERE (server side) or assume it was done.
            // BETTER: Let's assume we can run ref code here for now to avoid complexity,
            // BUT ideally ref code should also run in the worker to be safe.
            // Given keeping it simple: Run ref code using direct runner (careful of load)
            // OR send ref code to worker.
            // Let's stick to the previous pattern: Ref code run is separate?
            // Actually, the previous code ran ref code AFTER student code.
            // We will keep running ref code directly here for now to minimize refactor risk,
            // but strictly speaking it should be queued too.
            // A better approach for scalability: The worker should handle reference code too.
            // For this task, we will focus on student code queuing.

            try {
              // We need runCode for reference.
              if (!runCode) runCode = require('../utils/runCode');
              const refRes = await runCode(
                reference_code,
                reference_lang || lang,
                tc.stdinInput ?? tc.input ?? ''
              );
              result.reference_stdout = (refRes.output ?? '').trimEnd();
            } catch (e) {
              logger.error('Reference runCode error:', e);
              result.reference_stdout = tc.expectedOutput ?? '';
            }
          } else if (tc.is_hidden) {
            result.reference_stdout = tc.expectedOutput ?? '';
          }

          const userOut = (result.stdout ?? '').trimEnd();
          const refOut = (result.reference_stdout ?? '').trimEnd();
          const lowErr = (result.stderr ?? '').toLowerCase();

          // Verdict logic
          if (
            lowErr.includes('compile') ||
            lowErr.includes('javac') ||
            lowErr.includes('error:')
          ) {
            result.status = 'compile_error';
          } else if (
            lowErr.includes('timeout') ||
            lowErr.includes('timed out')
          ) {
            result.status = 'time_limit_exceeded';
          } else if (result.stderr && result.stderr !== '') {
            result.status = 'runtime_error';
          } else {
            result.status = userOut === refOut ? 'passed' : 'failed';
          }
        }
        return res.json({ verdict: 'evaluated', details: runnerResults });
      } catch (e) {
        logger.error('Queue/Execution failed', e);
        return res.status(500).json({
          error: 'Execution failed',
          detail: e.message,
        });
      }
    }

    // ========================
    // 2️⃣ Single input / normal static terminal mode
    // ========================
    if (!code) return res.status(400).json({ error: 'No code provided.' });

    try {
      logger.info(`Queuing single execution for ${lang}...`);
      const job = await queueService.addJob({
        type: 'single',
        code,
        lang,
        input: stdinInput,
        problem,
      });

      const userResult = await job.waitUntilFinished(queueService.queueEvents);

      // If a problem is provided, compare with reference code
      let refOut = '';
      if (problem) {
        // Ref code logic... keeping it local for now as per minimal change strategy
        // Ideally: Queue this too.
        const ext = LANG_EXT[lang] || 'c';
        const referencePath = path.join(
          process.cwd(),
          'reference',
          `${problem}.${ext}`
        );
        if (fs.existsSync(referencePath)) {
          try {
            if (!runCode) runCode = require('../utils/runCode');
            const referenceCode = fs.readFileSync(referencePath, 'utf8');
            const refResult = await runCode(referenceCode, lang, stdinInput);
            refOut = (refResult.output ?? '').trim();
          } catch (e) {
            logger.error(e);
          }
        }
      }

      const userOut = normalizeOutput(userResult.output);
      const expectedOut = normalizeOutput(refOut || userOut);
      const passed = refOut ? userOut === refOut : true;

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
    } catch (e) {
      logger.error('Single execution failed:', e);
      return res.status(500).json({
        error: 'Runner failed',
        detail: e.message,
      });
    }
  } catch (err) {
    logger.error(
      'Execution handler error:',
      err && err.stack ? err.stack : err
    );
    return res.status(500).json({
      error: 'Execution failed.',
      detail: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
});

module.exports = router;
