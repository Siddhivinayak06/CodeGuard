// src/routes/execute.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const config = require('../config');
const { z } = require('zod');
const { determineVerdict, VERDICTS } = require('../utils/execution/verdicts');
const { compareOutput } = require('../utils/execution/outputComparator');

// Validation Schema
const executeSchema = z.object({
  code: z.string().optional(),
  reference_code: z.string().optional(),
  reference_lang: z.string().optional(),
  mode: z.enum(['run', 'submit']).optional(),
  executionModel: z.enum(['stdin_legacy', 'wrapper_harness']).optional(),
  failFast: z.boolean().optional(),
  lang: z.enum(['c', 'cpp', 'python', 'py', 'java']).default('c'),
  batch: z
    .array(
      z.object({
        id: z.string().or(z.number()),
        stdinInput: z.string().optional(),
        input: z.string().optional(),
        expectedOutput: z.string().optional(),
        is_hidden: z.boolean().optional(),
        time_limit_ms: z.number().int().positive().optional(),
        memory_limit_kb: z.number().int().positive().optional(),
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
  const runner = require('../utils/localRunner');
  localBatchCode = runner.localBatchCode;
  localRunCode = runner.localRunCode;
} catch (e) {
  logger.warn('Failed to require local runners:', e && e.message);
}

// Pre-load these at module level to avoid per-request cache lookups
const {
  isLocalAvailable,
  isDockerAvailable,
} = require('../utils/runtimeDetector');
const poolManager = require('../services/poolManager');
const queueService = require('../services/queueService');

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

// Legacy normalizeOutput kept for backward compatibility
const { normalizeOutput } = require('../utils/execution/batchResultUtils');

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
      mode,
      executionModel,
      failFast,
      lang,
      batch,
      stdinInput,
      problem,
    } = parseResult.data;

    const effectiveExecutionModel =
      executionModel || config.execution.defaultExecutionModel;
    const effectiveFailFast =
      typeof failFast === 'boolean'
        ? failFast
        : config.execution.strictFailFast;

    const normalizedBatch = Array.isArray(batch)
      ? batch.map((tc) => ({
          ...tc,
          stdinInput: tc.stdinInput ?? tc.input ?? '',
          time_limit_ms: tc.time_limit_ms ?? 2000,
          memory_limit_kb:
            tc.memory_limit_kb ?? (lang === 'java' ? 262144 : 65536),
        }))
      : [];

    const runnerOptions = {
      earlyExit: effectiveFailFast,
      failFast: effectiveFailFast,
      executionModel: effectiveExecutionModel,
      mode: mode || 'run',
    };

    // runtimeDetector and poolManager are pre-loaded at module level

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
    const useQueue = Boolean(queueService.isEnabled);

    // ========================
    // 1️⃣ Batch mode (multiple test cases)
    // ========================
    if (normalizedBatch.length > 0) {
      try {
        let runnerResults;

        if (useDirectLocal) {
          // Direct local execution — no Redis/queue needed
          if (!localBatchCode) localBatchCode = require('../utils/localRunner');
          logger.info(`[Execute] Direct local batch execution for ${lang}`);
          runnerResults = await localBatchCode(
            code,
            lang,
            normalizedBatch,
            runnerOptions
          );
        } else if (!useQueue) {
          // Development mode fallback: run directly without Redis queue
          if (!runBatchCode) runBatchCode = require('../utils/dockerRunner');
          logger.info(
            `[Execute] Direct docker batch execution for ${lang} (queue disabled)`
          );
          runnerResults = await runBatchCode(
            code,
            lang,
            normalizedBatch,
            runnerOptions
          );
        } else {
          // Queue-based execution (requires Redis)
          logger.info(`Queuing batch execution for ${lang}...`);
          const job = await queueService.addJob({
            type: 'batch',
            code,
            lang,
            batch: normalizedBatch,
            problem,
            options: runnerOptions,
          });
          runnerResults = await job.waitUntilFinished(queueService.queueEvents);
        }

        for (const result of runnerResults) {
          const tc = normalizedBatch.find((b) => b.id === result.test_case_id);
          if (!tc) continue;
          const runnerStatus = String(result.status || '').toLowerCase();
          const hasExpectedOutput =
            typeof tc.expectedOutput === 'string' && tc.expectedOutput !== '';

          // Ensure field exists
          result.reference_stdout = result.reference_stdout ?? '';

          // If the runner already set a definitive verdict, preserve it
          if (
            runnerStatus === VERDICTS.SKIPPED ||
            runnerStatus === VERDICTS.COMPILE_ERROR ||
            runnerStatus === VERDICTS.TIME_LIMIT_EXCEEDED ||
            runnerStatus === VERDICTS.MEMORY_LIMIT_EXCEEDED ||
            runnerStatus === VERDICTS.OUTPUT_LIMIT_EXCEEDED ||
            runnerStatus === VERDICTS.RUNTIME_ERROR ||
            runnerStatus === VERDICTS.WRONG_ANSWER ||
            runnerStatus === VERDICTS.ACCEPTED
          ) {
            result.reference_stdout = tc.expectedOutput ?? '';
            continue;
          }

          // Prefer persisted expected output from the test case payload.
          // Only re-run reference code when expected output is unavailable.
          if (hasExpectedOutput) {
            result.reference_stdout = tc.expectedOutput;
          } else if (!tc.is_hidden && reference_code) {
            try {
              if (!localRunCode || !localBatchCode) {
                const runner = require('../utils/localRunner');
                localRunCode = runner.localRunCode;
                localBatchCode = runner.localBatchCode;
              }
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
          } else {
            result.reference_stdout = tc.expectedOutput ?? '';
          }

          // Use centralized verdict determination (exit-code-first, no regex)
          const refOut = result.reference_stdout ?? '';
          const compResult = compareOutput(
            result.stdout ?? '',
            refOut,
            tc.comparison_mode || 'ignore_trailing_whitespace',
            { floatTolerance: tc.float_tolerance }
          );

          result.status = determineVerdict({
            exitCode: result.exitCode,
            stderr: result.stderr ?? '',
            stdout: result.stdout ?? '',
            timedOut: result.exitCode === 124,
            isCompileError: false,
            outputMatch: compResult.match,
          });
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
        if (!localRunCode)
          localRunCode = require('../utils/localRunner').localRunCode;
        logger.info(`[Execute] Direct local single execution for ${lang}`);
        userResult = await localRunCode(code, lang, stdinInput);
      } else if (!useQueue) {
        // Development mode fallback: run directly without Redis queue
        if (!runCode) runCode = require('../utils/runCode');
        logger.info(
          `[Execute] Direct docker single execution for ${lang} (queue disabled)`
        );
        userResult = await runCode(code, lang, stdinInput);
      } else {
        // Queue-based execution (requires Redis)
        logger.info(`Queuing single execution for ${lang}...`);
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
              ? localRunCode || require('../utils/localRunCode')
              : runCode || require('../utils/runCode');
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

      // Use centralized verdict determination
      const hasRef = refOut && refOut.trim() !== '';
      const compResult = hasRef
        ? compareOutput(userOut, refOut, 'ignore_trailing_whitespace')
        : { match: true };

      const verdict = !userResult
        ? VERDICTS.RUNTIME_ERROR
        : determineVerdict({
            exitCode: userResult.exitCode,
            stderr: userResult.error || userResult.stderr || '',
            stdout: userOut,
            timedOut: userResult.exitCode === 124,
            isCompileError: false,
            outputMatch: compResult.match,
          });

      return res.json({
        mode: 'manual',
        problem: problem || 'manual_run',
        input: stdinInput,
        expected: expectedOut,
        output: userOut,
        verdict,
        user_stderr: userResult.error || userResult.stderr || '',
        time_ms: userResult.time_ms || 0,
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
