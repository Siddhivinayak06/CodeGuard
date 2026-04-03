const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const poolManager = require('../services/poolManager');
const localRunner = require('./localRunner');
const config = require('../config');
const {
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
const { determineVerdict, VERDICTS } = require('./execution/verdicts');
const { compareOutput } = require('./execution/outputComparator');

function writeBase64FileCommand(content = '', filePath) {
  const b64 = Buffer.from(content).toString('base64');
  return `echo "${b64}" | base64 -d > ${filePath}`;
}

async function runCommand(args, options = {}) {
  const proc = spawn('docker', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  let stdout = '';
  let stderr = '';

  proc.stdout.on('data', (data) => {
    stdout += data.toString();
  });
  proc.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  const exitCode = await new Promise((resolve) => {
    proc.on('close', resolve);
    proc.on('error', () => resolve(1));
  });

  return { stdout, stderr, exitCode };
}

async function compileInContainer(containerName, code, lang, uniqueId) {
  const escapedCode = code.replace(/\r/g, '');
  const normalizedLang = String(lang || '').toLowerCase();
  let cmd = '';

  if (normalizedLang === 'python' || normalizedLang === 'py') {
    cmd = `mkdir -p /tmp/${uniqueId} && ${writeBase64FileCommand(
      escapedCode,
      `/tmp/${uniqueId}/code.py`
    )} && python3 -m py_compile /tmp/${uniqueId}/code.py 2>/tmp/${uniqueId}/py_compile_err.txt || (cat /tmp/${uniqueId}/py_compile_err.txt 1>&2 && exit 1)`;
  } else if (normalizedLang === 'c') {
    cmd = `mkdir -p /tmp/${uniqueId} && ${writeBase64FileCommand(
      escapedCode,
      `/tmp/${uniqueId}/code.c`
    )} && gcc -O2 /tmp/${uniqueId}/code.c -o /tmp/${uniqueId}/a.out -lm 2>/tmp/${uniqueId}/gcc_err.txt || (cat /tmp/${uniqueId}/gcc_err.txt 1>&2 && exit 1)`;
  } else if (normalizedLang === 'cpp' || normalizedLang === 'c++') {
    cmd = `mkdir -p /tmp/${uniqueId} && ${writeBase64FileCommand(
      escapedCode,
      `/tmp/${uniqueId}/code.cpp`
    )} && g++ -O2 /tmp/${uniqueId}/code.cpp -o /tmp/${uniqueId}/a.out -lm 2>/tmp/${uniqueId}/gcc_err.txt || (cat /tmp/${uniqueId}/gcc_err.txt 1>&2 && exit 1)`;
  } else if (normalizedLang === 'java') {
    let className = 'UserCode';
    const publicClassMatch = escapedCode.match(
      /^\s*public\s+class\s+([A-Za-z_][A-Za-z0-9_]*)/m
    );
    if (publicClassMatch) {
      className = publicClassMatch[1];
    } else {
      const classMatch = escapedCode.match(
        /^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)/m
      );
      if (classMatch) className = classMatch[1];
    }

    cmd = `
mkdir -p /tmp/${uniqueId} &&
${writeBase64FileCommand(escapedCode, `/tmp/${uniqueId}/${className}.java`)} &&
javac /tmp/${uniqueId}/*.java 2> /tmp/${uniqueId}/compile_err.txt || (cat /tmp/${uniqueId}/compile_err.txt 1>&2 && exit 1)
`;
  }

  return runCommand(['exec', containerName, 'sh', '-c', cmd]);
}

async function execTestCase(containerName, tc, lang, uniqueId) {
  const {
    id,
    stdinInput = '',
    expectedOutput = '',
    time_limit_ms = 5000,
    is_hidden = false,
  } = tc;

  const timeoutSec = Math.max(1, Math.ceil(time_limit_ms / 1000));
  const normalizedLang = String(lang || '').toLowerCase();
  let baseRunCmd = '';

  if (normalizedLang === 'python' || normalizedLang === 'py') {
    baseRunCmd = `python3 /tmp/${uniqueId}/code.py`;
  } else if (
    normalizedLang === 'c' ||
    normalizedLang === 'cpp' ||
    normalizedLang === 'c++'
  ) {
    baseRunCmd = `/tmp/${uniqueId}/a.out`;
  } else if (normalizedLang === 'java') {
    baseRunCmd = `
MAIN_CLASS=$(grep -l "public static void main" /tmp/${uniqueId}/*.java | head -n1 | xargs basename -s .java)
if [ -z "$MAIN_CLASS" ]; then MAIN_CLASS=$(ls /tmp/${uniqueId}/*.class | head -n1 | xargs basename -s .class); fi
java -cp /tmp/${uniqueId} $MAIN_CLASS
`;
  }

  // Use GNU time -v for memory measurement when available, with nanosecond timing
  const timeWrapper = `/usr/bin/time -v`;
  const runCmd = `${writeBase64FileCommand(
    stdinInput,
    `/tmp/${uniqueId}/input.txt`
  )} && START_NS=$(date +%s%N 2>/dev/null || echo "$(date +%s)000000000") && cat /tmp/${uniqueId}/input.txt | timeout ${timeoutSec} ${timeWrapper} sh -c '${baseRunCmd
    .trim()
    .replace(
      /'/g,
      "'\\''"
    )}' 2>/tmp/${uniqueId}/time_stderr.txt; EC=$?; END_NS=$(date +%s%N 2>/dev/null || echo "$(date +%s)000000000"); echo "__METRICS__|$EC|$START_NS|$END_NS" 1>&2; cat /tmp/${uniqueId}/time_stderr.txt 1>&2; exit $EC`;

  const result = await runCommand(['exec', containerName, 'sh', '-c', runCmd]);

  // Parse metrics from stderr
  let cpuTime = 0;
  let memoryKB = 0;
  let timeMs = 0;
  let cleanedStderr = result.stderr;

  // Extract our metrics line
  const metricsMatch = result.stderr.match(/__METRICS__\|(\d+)\|(\d+)\|(\d+)/);
  if (metricsMatch) {
    const startNs = BigInt(metricsMatch[2]);
    const endNs = BigInt(metricsMatch[3]);
    timeMs = Number((endNs - startNs) / BigInt(1000000));
    if (timeMs < 0) timeMs = 0;
    cpuTime = timeMs / 1000;
  }

  // Extract memory from GNU time verbose output
  const memMatch = result.stderr.match(/Maximum resident set size.*?:\s*(\d+)/);
  if (memMatch) {
    memoryKB = parseInt(memMatch[1], 10);
  }

  // Clean stderr: remove GNU time output and our metrics line
  cleanedStderr = result.stderr
    .replace(/__METRICS__\|\d+\|\d+\|\d+\n?/, '')
    .replace(/\s*Command being timed:.*\n?/g, '')
    .replace(/\s*User time.*\n?/g, '')
    .replace(/\s*System time.*\n?/g, '')
    .replace(/\s*Percent of CPU.*\n?/g, '')
    .replace(/\s*Elapsed \(wall clock\).*\n?/g, '')
    .replace(/\s*Average shared.*\n?/g, '')
    .replace(/\s*Average unshared.*\n?/g, '')
    .replace(/\s*Average stack.*\n?/g, '')
    .replace(/\s*Average total.*\n?/g, '')
    .replace(/\s*Maximum resident.*\n?/g, '')
    .replace(/\s*Average resident.*\n?/g, '')
    .replace(/\s*Major.*page faults.*\n?/g, '')
    .replace(/\s*Minor.*page faults.*\n?/g, '')
    .replace(/\s*Voluntary.*\n?/g, '')
    .replace(/\s*Involuntary.*\n?/g, '')
    .replace(/\s*Swaps.*\n?/g, '')
    .replace(/\s*File system.*\n?/g, '')
    .replace(/\s*Socket.*\n?/g, '')
    .replace(/\s*Signals.*\n?/g, '')
    .replace(/\s*Page size.*\n?/g, '')
    .replace(/\s*Exit status.*\n?/g, '')
    .trim();

  return {
    test_case_id: id,
    input: stdinInput,
    expectedOutput,
    stdout: result.stdout.trim(),
    stderr: cleanedStderr,
    exitCode: result.exitCode,
    is_hidden,
    cpuTime,
    memoryKB,
    time_ms: timeMs,
    memory_kb: memoryKB,
  };
}

async function runCompiledHarnessInContainer(
  containerName,
  batch,
  uniqueId,
  lang,
  options = {}
) {
  const { failFast = true } = options;
  const normalizedLang = String(lang || '').toLowerCase();
  const harnessLang =
    normalizedLang === 'java'
      ? 'java'
      : normalizedLang === 'c'
        ? 'c'
        : 'python';
  const harnessPath = `/tmp/${uniqueId}/batch_harness.sh`;
  const testsPath = `/tmp/${uniqueId}/tests.tsv`;
  const testsPayload = buildHarnessTsvTestsPayload(batch);

  const totalTimeMs = batch.reduce(
    (sum, tc) => sum + (tc.time_limit_ms ?? 2000),
    0
  );
  const hardTimeoutSec = Math.max(5, Math.ceil(totalTimeMs / 1000) + 5);

  const cmd = [
    `mkdir -p /tmp/${uniqueId}`,
    writeBase64FileCommand(COMPILED_BATCH_HARNESS_SCRIPT, harnessPath),
    writeBase64FileCommand(testsPayload, testsPath),
    `timeout ${hardTimeoutSec} sh ${harnessPath} ${testsPath} ${harnessLang} /tmp/${uniqueId} ${failFast ? 1 : 0}`,
  ].join(' && ');

  const harnessResult = await runCommand([
    'exec',
    containerName,
    'sh',
    '-c',
    cmd,
  ]);

  const resultById = parseCompiledHarnessResults(harnessResult.stdout, batch);

  return buildOrderedCompiledResults({
    batch,
    resultById,
    failFast,
    timedOut: harnessResult.exitCode === 124,
    stderr: harnessResult.stderr,
    exitCode: harnessResult.exitCode,
  });
}

module.exports = async function runBatchCode(
  code,
  lang = 'python',
  batch = [],
  options = {}
) {
  const CONCURRENCY_LIMIT = config.docker.workersPerContainer || 15;
  const {
    earlyExit = true,
    failFast = earlyExit,
    executionModel = config.execution?.defaultExecutionModel,
  } = options;
  const uniqueId = uuidv4();
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
        : normalizedLang === 'python' || normalizedLang === 'py'
          ? 'python'
          : 'java';

  let containerId = null;

  try {
    logger.info(`Acquiring container from pool for ${lang}...`);
    containerId = await poolManager.acquire(poolLang);
    logger.info(`Acquired container ${containerId}`);

    if (containerId === 'local') {
      logger.info(`Using local execution for batch on ${normalizedLang}`);
      const results = [];
      for (const tc of batch) {
        const timeoutSec = Math.max(
          1,
          Math.ceil((tc.time_limit_ms || 5000) / 1000)
        );
        const result = await localRunner.runCode(
          code,
          poolLang,
          tc.stdinInput,
          timeoutSec
        );

        // Use centralized verdict logic
        const compResult = compareOutput(
          result.stdout,
          tc.expectedOutput,
          tc.comparison_mode || 'ignore_trailing_whitespace',
          { floatTolerance: tc.float_tolerance }
        );

        const verdict = determineVerdict({
          exitCode: result.exitCode,
          stderr: result.stderr,
          stdout: result.stdout,
          timedOut: result.exitCode === 124,
          isCompileError: false,
          outputMatch:
            typeof tc.expectedOutput === 'string' ? compResult.match : true,
        });

        results.push({
          test_case_id: tc.id,
          input: tc.stdinInput,
          expectedOutput: tc.expectedOutput,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          is_hidden: tc.is_hidden,
          cpuTime: (result.time_ms || 0) / 1000,
          memoryKB: result.memory_kb || 0,
          time_ms: result.time_ms || 0,
          memory_kb: result.memory_kb || 0,
          status: verdict,
        });

        if (effectiveFailFast && verdict !== VERDICTS.ACCEPTED) {
          break;
        }
      }

      // If early exit, fill remaining with skipped
      if (results.length < batch.length) {
        const executedIds = new Set(results.map((r) => String(r.test_case_id)));
        for (const tc of batch) {
          if (!executedIds.has(String(tc.id))) {
            results.push(createSkippedResult(tc));
          }
        }
      }

      return sortBatchResults(results, batch);
    }

    logger.info(`Compiling code in container ${containerId}...`);
    const compileResult = await compileInContainer(
      containerId,
      code,
      normalizedLang,
      uniqueId
    );

    if (compileResult.exitCode !== 0) {
      logger.warn(`Compilation failed for ${containerId}`);
      return buildBatchErrorResults(
        batch,
        compileResult.stderr || 'Compilation failed',
        compileResult.exitCode || 1,
        VERDICTS.COMPILE_ERROR
      );
    }

    if (useCompiledBatchHarness) {
      logger.info(
        `Executing ${batch.length} test cases via shell batch harness for ${normalizedLang} in ${containerId}...`
      );
      const harnessResults = await runCompiledHarnessInContainer(
        containerId,
        batch,
        uniqueId,
        normalizedLang,
        { failFast: effectiveFailFast }
      );
      logger.info(`Final batch results: ${harnessResults.length}`);
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

        const result = await execTestCase(
          containerId,
          tc,
          normalizedLang,
          uniqueId
        );

        // Use centralized verdict logic
        const hasExpectedOutput = typeof tc.expectedOutput === 'string';
        const compResult = hasExpectedOutput
          ? compareOutput(
              result.stdout,
              tc.expectedOutput,
              tc.comparison_mode || 'ignore_trailing_whitespace',
              { floatTolerance: tc.float_tolerance }
            )
          : { match: true };

        const verdict = determineVerdict({
          exitCode: result.exitCode,
          stderr: result.stderr,
          stdout: result.stdout,
          timedOut: result.exitCode === 124,
          isCompileError: false,
          outputMatch: compResult.match,
        });

        result.status = verdict;
        results.push(result);

        if (verdict !== VERDICTS.ACCEPTED) {
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

    logger.info(`Final batch results: ${results.length}`);
    return sortBatchResults(results, batch);
  } catch (e) {
    logger.error(`Batch execution failed: ${e.message}`);
    throw e;
  } finally {
    if (containerId) {
      logger.info(`Releasing container ${containerId} back to pool...`);
      await poolManager.release(poolLang, containerId);
    }
  }
};
