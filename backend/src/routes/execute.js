// src/routes/execute.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const config = require('../config');
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

let localBatchCode;
let localRunCode;
try {
  localBatchCode = require('../utils/localRunner');
  localRunCode = require('../utils/localRunCode');
} catch (e) {
  logger.warn('Failed to require local runners:', e && e.message);
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

    const {
      code,
      reference_code,
      reference_lang,
      lang,
      batch,
      stdinInput,
      problem,
    } = parseResult.data;

    const { isLocalAvailable, isDockerAvailable } = require('../utils/runtimeDetector');
    const poolManager = require('../services/poolManager');

    // Determine if we should use direct local execution (bypass queue/Redis)
    const shouldUseDirectLocal = () => {
      const dockerUp = isDockerAvailable();
      const localOk = config.allowLocalExecution && isLocalAvailable(lang);
      // Use direct local if Docker is not available and local compilers exist
      if (!dockerUp && localOk) return true;
      // Also use direct local if poolManager flagged useLocal
      if (poolManager.useLocal && localOk) return true;
      return false;
    };

    const useDirectLocal = shouldUseDirectLocal();

    // ========================
    // 1️⃣ Batch mode (multiple test cases)
    // ========================
    if (Array.isArray(batch) && batch.length > 0) {
      try {
        let runnerResults;

        if (useDirectLocal) {
          // Direct local execution — no Redis/queue needed
          if (!localBatchCode) localBatchCode = require('../utils/localRunner');
          logger.info(`[Execute] Direct local batch execution for ${lang}`);
          runnerResults = await localBatchCode(code, lang, batch);
        } else {
          // Queue-based execution (requires Redis)
          logger.info(`Queuing batch execution for ${lang}...`);
          const queueService = require('../services/queueService');
          const job = await queueService.addJob({
            type: 'batch',
            code,
            lang,
            batch,
            problem,
          });
          runnerResults = await job.waitUntilFinished(queueService.queueEvents);
        }

        for (const result of runnerResults) {
          const tc = batch.find((b) => b.id === result.test_case_id);
          if (!tc) continue;

          // Ensure field exists
          result.reference_stdout = result.reference_stdout ?? '';

          if (!tc.is_hidden && reference_code) {
            try {
              if (!localRunCode) localRunCode = require('../utils/localRunCode');
              if (!runCode) runCode = require('../utils/runCode');
              const runner = useDirectLocal ? localRunCode : runCode;
              const refRes = await runner(
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
      let userResult;

      if (useDirectLocal) {
        // Direct local execution — no Redis/queue needed
        if (!localRunCode) localRunCode = require('../utils/localRunCode');
        logger.info(`[Execute] Direct local single execution for ${lang}`);
        userResult = await localRunCode(code, lang, stdinInput);
      } else {
        // Queue-based execution (requires Redis)
        logger.info(`Queuing single execution for ${lang}...`);
        const queueService = require('../services/queueService');
        const job = await queueService.addJob({
          type: 'single',
          code,
          lang,
          input: stdinInput,
          problem,
        });
        userResult = await job.waitUntilFinished(queueService.queueEvents);
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
            const runner = useDirectLocal
              ? (localRunCode || require('../utils/localRunCode'))
              : (runCode || require('../utils/runCode'));
            const referenceCode = fs.readFileSync(referencePath, 'utf8');
            const refResult = await runner(referenceCode, lang, stdinInput);
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
