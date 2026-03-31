// src/utils/dockerRunner.js
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const poolManager = require('../services/poolManager');
const config = require('../config');

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

  proc.stdout.on('data', (data) => (stdout += data.toString()));
  proc.stderr.on('data', (data) => (stderr += data.toString()));

  const exitCode = await new Promise((resolve) => {
    proc.on('close', resolve);
    proc.on('error', () => resolve(1));
  });

  return { stdout, stderr, exitCode };
}

async function compileInContainer(containerName, code, lang, uniqueId) {
  const escapedCode = code.replace(/\r/g, '');
  let cmd = '';

  // Pooled containers use /tmp/${uniqueId} for isolation
  if (lang === 'python') {
    cmd = `mkdir -p /tmp/${uniqueId} && ${writeBase64FileCommand(escapedCode, `/tmp/${uniqueId}/code.py`)}`;
  } else if (lang === 'c') {
    cmd = `mkdir -p /tmp/${uniqueId} && ${writeBase64FileCommand(escapedCode, `/tmp/${uniqueId}/code.c`)} && gcc -O2 /tmp/${uniqueId}/code.c -o /tmp/${uniqueId}/a.out -lm 2>/tmp/${uniqueId}/gcc_err.txt || (cat /tmp/${uniqueId}/gcc_err.txt 1>&2 && exit 1)`;
  } else if (lang === 'cpp' || lang === 'c++') {
    cmd = `mkdir -p /tmp/${uniqueId} && ${writeBase64FileCommand(escapedCode, `/tmp/${uniqueId}/code.cpp`)} && g++ -O2 /tmp/${uniqueId}/code.cpp -o /tmp/${uniqueId}/a.out -lm 2>/tmp/${uniqueId}/gcc_err.txt || (cat /tmp/${uniqueId}/gcc_err.txt 1>&2 && exit 1)`;
  } else if (lang === 'java') {
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

  return await runCommand(['exec', containerName, 'sh', '-c', cmd]);
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
  let baseRunCmd = '';

  if (lang === 'python') {
    baseRunCmd = `python3 /tmp/${uniqueId}/code.py`;
  } else if (lang === 'c' || lang === 'cpp' || lang === 'c++') {
    baseRunCmd = `/tmp/${uniqueId}/a.out`;
  } else if (lang === 'java') {
    baseRunCmd = `
MAIN_CLASS=$(grep -l "public static void main" /tmp/${uniqueId}/*.java | head -n1 | xargs basename -s .java)
if [ -z "$MAIN_CLASS" ]; then MAIN_CLASS=$(ls /tmp/${uniqueId}/*.class | head -n1 | xargs basename -s .class); fi
java -cp /tmp/${uniqueId} $MAIN_CLASS
`;
  }

  const timeCmd =
    lang === 'java'
      ? '/usr/bin/time -f "CPU:%U|%S MEM:%M"'
      : '/usr/bin/time -p';
  const runCmd = `${writeBase64FileCommand(stdinInput, `/tmp/${uniqueId}/input.txt`)} && cat /tmp/${uniqueId}/input.txt | timeout ${timeoutSec} ${timeCmd} sh -c '${baseRunCmd.trim().replace(/'/g, "'\\''")}'`;

  const result = await runCommand(['exec', containerName, 'sh', '-c', runCmd]);

  let cpuTime = 0;
  let memoryKB = 0;

  if (lang === 'java') {
    const match = result.stderr.match(/CPU:([\d.]+)\|([\d.]+) MEM:(\d+)/);
    if (match) {
      cpuTime = parseFloat(match[1]) + parseFloat(match[2]);
      memoryKB = parseInt(match[3]);
    }
  } else {
    const userMatch = result.stderr.match(/user ([\d.]+)/);
    const sysMatch = result.stderr.match(/sys ([\d.]+)/);
    if (userMatch && sysMatch) {
      cpuTime = parseFloat(userMatch[1]) + parseFloat(sysMatch[1]);
    }
  }

  const cleanedStderr = result.stderr
    .replace(/CPU:[\d.]+\|[\d.]+ MEM:\d+/, '')
    .replace(/real [\d.]+\nuser [\d.]+\nsys [\d.]+/, '')
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
  };
}

module.exports = async function runBatchCode(
  code,
  lang = 'python',
  batch = [],
  options = {}
) {
  const CONCURRENCY_LIMIT = config.docker.workersPerContainer || 15;
  const { earlyExit = true } = options;
  const uniqueId = uuidv4();

  let containerId = null;
  const poolLang =
    lang === 'cpp' || lang === 'c++'
      ? 'cpp'
      : lang === 'c'
        ? 'c'
        : lang === 'python'
          ? 'python'
          : 'java';

  try {
    logger.info(`Acquiring container from pool for ${lang}...`);
    containerId = await poolManager.acquire(poolLang);
    logger.info(`Acquired container ${containerId}`);

    logger.info(`Compiling code in container ${containerId}...`);
    const compileResult = await compileInContainer(
      containerId,
      code,
      lang,
      uniqueId
    );

    if (compileResult.exitCode !== 0) {
      logger.warn(`Compilation failed for ${containerId}`);
      return batch.map((tc) => ({
        test_case_id: tc.id,
        input: tc.stdinInput,
        expectedOutput: tc.expectedOutput,
        stdout: '',
        stderr: compileResult.stderr,
        exitCode: compileResult.exitCode,
        is_hidden: tc.is_hidden,
      }));
    }

    const results = [];
    let hasFailed = false;

    const runWithEarlyExit = async () => {
      const queue = [...batch];

      const runWorker = async () => {
        while (queue.length > 0) {
          if (earlyExit && hasFailed) break;
          const tc = queue.shift();
          if (!tc) break;

          const result = await execTestCase(containerId, tc, lang, uniqueId);
          results.push(result);

          if (result.exitCode !== 0) {
            hasFailed = true;
          }
        }
      };

      const workers = [];
      const numWorkers = Math.min(CONCURRENCY_LIMIT, batch.length);
      for (let i = 0; i < numWorkers; i++) {
        workers.push(runWorker());
      }

      await Promise.all(workers);
      return results;
    };

    logger.info(`Executing ${batch.length} test cases in ${containerId}...`);
    const batchResults = await runWithEarlyExit();

    logger.info(`📦 Final batch results: ${batchResults.length}`);
    return batchResults.sort(
      (a, b) =>
        batch.findIndex((tc) => tc.id === a.test_case_id) -
        batch.findIndex((tc) => tc.id === b.test_case_id)
    );
  } catch (e) {
    logger.error(`Batch execution failed: ${e.message}`);
    throw e;
  } finally {
    if (containerId) {
      logger.info(`Releasing container ${containerId} back to pool...`);
      // Use fire-and-forget release or await it?
      // PoolManager.release handles its own internal cleanup.
      await poolManager.release(poolLang, containerId);
    }
  }
};
