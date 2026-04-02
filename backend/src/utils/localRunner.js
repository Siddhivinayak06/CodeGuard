const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('./logger');
const config = require('../config');
const {
  normalizeOutput,
  createSkippedResult,
  sortBatchResults,
  buildBatchErrorResults,
} = require('./execution/batchResultUtils');
const {
  shouldUseCompiledBatchHarness,
} = require('./execution/harnessSelectors');
const {
  COMPILED_BATCH_HARNESS_SCRIPT,
  buildHarnessTsvTestsPayload,
} = require('./execution/harnessScripts');
const {
  parseCompiledHarnessResults,
  buildOrderedCompiledResults,
} = require('./execution/harnessParsers');

function spawnWithTimeout(cmd, args, options, timeoutMs) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, options);
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    if (options.input) {
      proc.stdin.write(options.input);
    }
    proc.stdin.end();

    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
    }, timeoutMs);

    proc.on('close', (exitCode) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode, timedOut });
    });

    proc.on('error', () => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: 1, timedOut });
    });
  });
}

function compileLocally(code, lang, workDir) {
  if (lang === 'python' || lang === 'py') {
    const codeFile = path.join(workDir, 'code.py');
    fs.writeFileSync(codeFile, code);
    return spawnWithTimeout(
      'python3',
      ['-m', 'py_compile', codeFile],
      { stdio: ['pipe', 'pipe', 'pipe'], cwd: workDir, input: '' },
      10000
    );
  }

  if (lang === 'c') {
    const codeFile = path.join(workDir, 'code.c');
    const outFile = path.join(workDir, 'a.out');
    fs.writeFileSync(codeFile, code);
    return spawnWithTimeout(
      'gcc',
      ['-O2', codeFile, '-o', outFile, '-lm'],
      { stdio: ['pipe', 'pipe', 'pipe'], cwd: workDir, input: '' },
      10000
    );
  }

  if (lang === 'cpp' || lang === 'c++') {
    const codeFile = path.join(workDir, 'code.cpp');
    const outFile = path.join(workDir, 'a.out');
    fs.writeFileSync(codeFile, code);
    return spawnWithTimeout(
      'g++',
      ['-O2', codeFile, '-o', outFile, '-lm'],
      { stdio: ['pipe', 'pipe', 'pipe'], cwd: workDir, input: '' },
      10000
    );
  }

  if (lang === 'java') {
    const classMatch = code.match(
      /(?:public\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)/
    );
    const className = classMatch ? classMatch[1] : 'Main';
    const codeFile = path.join(workDir, `${className}.java`);
    fs.writeFileSync(codeFile, code);
    return spawnWithTimeout(
      'javac',
      [codeFile],
      { stdio: ['pipe', 'pipe', 'pipe'], cwd: workDir, input: '' },
      10000
    );
  }

  return Promise.resolve({
    stdout: '',
    stderr: 'Unsupported language',
    exitCode: 1,
  });
}

function execTestCaseLocally(tc, lang, workDir) {
  const {
    id,
    stdinInput = '',
    expectedOutput = '',
    time_limit_ms = 5000,
    is_hidden = false,
  } = tc;

  const timeoutMs = Math.max(1000, time_limit_ms);
  let cmd;
  let args;

  if (lang === 'python' || lang === 'py') {
    cmd = 'python3';
    args = [path.join(workDir, 'code.py')];
  } else if (lang === 'c' || lang === 'cpp' || lang === 'c++') {
    cmd = path.join(workDir, 'a.out');
    args = [];
  } else if (lang === 'java') {
    const classFiles = fs
      .readdirSync(workDir)
      .filter((fileName) => fileName.endsWith('.class'));
    let mainClass = 'Main';
    if (classFiles.length > 0) {
      mainClass = classFiles[0].replace('.class', '');
    }
    cmd = 'java';
    args = ['-cp', workDir, mainClass];
  }

  const startTime = Date.now();

  return spawnWithTimeout(
    cmd,
    args,
    { stdio: ['pipe', 'pipe', 'pipe'], cwd: workDir, input: stdinInput },
    timeoutMs
  ).then((result) => {
    const elapsed = Date.now() - startTime;
    return {
      test_case_id: id,
      input: stdinInput,
      expectedOutput,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
      exitCode: result.timedOut ? 124 : result.exitCode,
      is_hidden,
      cpuTime: elapsed / 1000,
      memoryKB: 0,
      time_ms: elapsed,
      memory_kb: 0,
    };
  });
}

async function runCompiledHarnessLocally(batch, workDir, lang, options = {}) {
  const { failFast = true } = options;
  const normalizedLang = String(lang || '').toLowerCase();
  const harnessLang =
    normalizedLang === 'java'
      ? 'java'
      : normalizedLang === 'c'
        ? 'c'
        : 'python';
  const harnessPath = path.join(workDir, 'batch_harness.sh');
  const testsPath = path.join(workDir, 'tests.tsv');
  const testsPayload = buildHarnessTsvTestsPayload(batch);

  const totalTimeMs = batch.reduce(
    (sum, tc) => sum + (tc.time_limit_ms ?? 2000),
    0
  );
  const hardTimeoutMs = Math.max(5000, totalTimeMs + 5000);

  fs.writeFileSync(harnessPath, COMPILED_BATCH_HARNESS_SCRIPT, {
    mode: 0o755,
  });
  fs.writeFileSync(testsPath, testsPayload);

  const harnessResult = await spawnWithTimeout(
    'sh',
    [harnessPath, testsPath, harnessLang, workDir, failFast ? '1' : '0'],
    { stdio: ['pipe', 'pipe', 'pipe'], cwd: workDir, input: '' },
    hardTimeoutMs
  );

  const resultById = parseCompiledHarnessResults(harnessResult.stdout, batch);

  return buildOrderedCompiledResults({
    batch,
    resultById,
    failFast,
    timedOut: Boolean(harnessResult.timedOut),
    stderr: harnessResult.stderr,
    exitCode: harnessResult.exitCode,
  });
}

module.exports = async function localBatchCode(
  code,
  lang = 'python',
  batch = [],
  options = {}
) {
  const CONCURRENCY_LIMIT = 5;
  const {
    earlyExit = true,
    failFast = earlyExit,
    executionModel = config.execution?.defaultExecutionModel,
  } = options;

  const uniqueId = uuidv4();
  const workDir = path.join(os.tmpdir(), `codeguard-${uniqueId}`);
  fs.mkdirSync(workDir, { recursive: true });

  const normalizedLang = String(lang || '').toLowerCase();
  const effectiveFailFast =
    typeof failFast === 'boolean' ? failFast : Boolean(earlyExit);

  const useCompiledBatchHarness = shouldUseCompiledBatchHarness(
    normalizedLang,
    executionModel,
    config.execution
  );

  const poolLang =
    normalizedLang === 'cpp' || normalizedLang === 'c++'
      ? 'cpp'
      : normalizedLang === 'c'
        ? 'c'
        : normalizedLang === 'py'
          ? 'python'
          : normalizedLang;

  try {
    logger.info(`[LocalRunner] Compiling ${poolLang} locally...`);
    const compileResult = await compileLocally(code, normalizedLang, workDir);

    if (compileResult.exitCode !== 0) {
      logger.warn('[LocalRunner] Compilation failed');
      return buildBatchErrorResults(
        batch,
        compileResult.stderr || 'Compilation failed',
        compileResult.exitCode || 1,
        'compile_error'
      );
    }

    if (useCompiledBatchHarness) {
      logger.info(
        `[LocalRunner] Executing ${batch.length} test cases via shell harness for ${normalizedLang}...`
      );
      const harnessResults = await runCompiledHarnessLocally(
        batch,
        workDir,
        normalizedLang,
        { failFast: effectiveFailFast }
      );
      logger.info(
        `[LocalRunner] Final batch results: ${harnessResults.length}`
      );
      return sortBatchResults(harnessResults, batch);
    }

    const results = [];
    let hasFailed = false;
    const queue = [...batch];

    const runWorker = async () => {
      while (queue.length > 0) {
        if (effectiveFailFast && hasFailed) break;
        const tc = queue.shift();
        if (!tc) break;

        const result = await execTestCaseLocally(tc, normalizedLang, workDir);
        results.push(result);

        const hasExpectedOutput = typeof tc.expectedOutput === 'string';
        const outputMismatch =
          hasExpectedOutput &&
          normalizeOutput(result.stdout) !== normalizeOutput(tc.expectedOutput);

        if (result.exitCode !== 0 || outputMismatch) {
          hasFailed = true;
        }
      }
    };

    const workers = [];
    const numWorkers = effectiveFailFast
      ? 1
      : Math.min(CONCURRENCY_LIMIT, batch.length);
    for (let i = 0; i < numWorkers; i++) {
      workers.push(runWorker());
    }

    await Promise.all(workers);

    if (effectiveFailFast && hasFailed && results.length < batch.length) {
      const executedIds = new Set(results.map((r) => String(r.test_case_id)));
      for (const tc of batch) {
        if (!executedIds.has(String(tc.id))) {
          results.push(createSkippedResult(tc));
        }
      }
    }

    logger.info(`[LocalRunner] Final batch results: ${results.length}`);
    return sortBatchResults(results, batch);
  } catch (e) {
    logger.error(`[LocalRunner] Batch execution failed: ${e.message}`);
    throw e;
  } finally {
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors.
    }
  }
};
