// src/utils/dockerRunner.js
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');

function escapeForPrintf(s = '') {
  return String(s).replace(/'/g, "'\\''");
}

async function runCommand(args, options = {}) {
  const proc = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
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

async function startBatchContainer(containerName, lang) {
  const image = lang === 'java' ? 'codeguard-java' : (lang === 'python' ? 'codeguard-python' : 'codeguard-c');
  const memoryLimit = (lang === 'java' ? config.docker.javaMemory : config.docker.memory);
  const pidsLimit = (lang === 'java' ? config.docker.javaPidsLimit : config.docker.pidsLimit);

  const runArgs = [
    'run',
    '--rm',
    '--name', containerName,
    '-d',
    '--network', 'none',
    '--read-only',
    '--tmpfs', `/tmp:exec,rw,size=${memoryLimit}`,
    '-m', memoryLimit,
    '--cpus=' + config.docker.cpus,
    '--pids-limit', pidsLimit,
    image,
    'tail', '-f', '/dev/null'
  ];

  await runCommand(runArgs);
}

async function compileInContainer(containerName, code, lang, uniqueId) {
  const escapedCode = code.replace(/\r/g, '');
  let cmd = '';

  if (lang === 'python') {
    cmd = `mkdir -p /tmp/${uniqueId} && printf "%s" '${escapeForPrintf(escapedCode)}' > /tmp/${uniqueId}/code.py`;
  } else if (lang === 'c') {
    cmd = `mkdir -p /tmp/${uniqueId} && printf "%s" '${escapeForPrintf(escapedCode)}' > /tmp/${uniqueId}/code.c && gcc -O2 /tmp/${uniqueId}/code.c -o /tmp/${uniqueId}/a.out -lm 2>/tmp/${uniqueId}/gcc_err.txt || (cat /tmp/${uniqueId}/gcc_err.txt 1>&2 && exit 1)`;
  } else if (lang === 'cpp' || lang === 'c++') {
    cmd = `mkdir -p /tmp/${uniqueId} && printf "%s" '${escapeForPrintf(escapedCode)}' > /tmp/${uniqueId}/code.cpp && g++ -O2 /tmp/${uniqueId}/code.cpp -o /tmp/${uniqueId}/a.out -lm 2>/tmp/${uniqueId}/gcc_err.txt || (cat /tmp/${uniqueId}/gcc_err.txt 1>&2 && exit 1)`;
  } else if (lang === 'java') {
    cmd = `
mkdir -p /tmp/${uniqueId} &&
printf "%s" '${escapeForPrintf(escapedCode)}' > /tmp/${uniqueId}/TempUserCode.java &&
class_name=$(grep -Eo '^[[:space:]]*(public[[:space:]]+)?class[[:space:]]+[A-Za-z_][A-Za-z0-9_]*' /tmp/${uniqueId}/TempUserCode.java | head -n1 | awk '{print $NF}') &&
if [ -n "$class_name" ]; then code_file=/tmp/${uniqueId}/$class_name.java; else code_file=/tmp/${uniqueId}/UserCode.java; fi &&
mv /tmp/${uniqueId}/TempUserCode.java "$code_file" &&
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

  // Use /usr/bin/time -p for basic POSIX timing (real, user, sys)
  // For Java, we might have GNU time which supports -f for memory
  const timeCmd = (lang === 'java') ? '/usr/bin/time -f "CPU:%U|%S MEM:%M"' : '/usr/bin/time -p';
  const runCmd = `printf "%s" '${escapeForPrintf(stdinInput)}' | timeout ${timeoutSec} ${timeCmd} sh -c '${baseRunCmd.trim().replace(/'/g, "'\\''")}'`;

  const result = await runCommand(['exec', containerName, 'sh', '-c', runCmd]);

  let cpuTime = 0;
  let memoryKB = 0;

  if (lang === 'java') {
    // Parse GNU time format: "CPU:0.01|0.02 MEM:1234"
    const match = result.stderr.match(/CPU:([\d.]+)\|([\d.]+) MEM:(\d+)/);
    if (match) {
      cpuTime = parseFloat(match[1]) + parseFloat(match[2]);
      memoryKB = parseInt(match[3]);
    }
  } else {
    // Parse POSIX time format:
    // real 0.00
    // user 0.00
    // sys 0.00
    const userMatch = result.stderr.match(/user ([\d.]+)/);
    const sysMatch = result.stderr.match(/sys ([\d.]+)/);
    if (userMatch && sysMatch) {
      cpuTime = parseFloat(userMatch[1]) + parseFloat(sysMatch[1]);
    }
  }

  // Clean stderr from time output to avoid cluttering user errors
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
    memoryKB
  };
}

module.exports = async function runBatchCode(code, lang = 'python', batch = [], options = {}) {
  const CONCURRENCY_LIMIT = 1; // Serial execution inside container for better timing consistency
  const { earlyExit = true } = options;
  const uniqueId = uuidv4();
  const containerName = `batch-${uniqueId}`;

  try {
    logger.info(`Starting batch container ${containerName} for ${lang}...`);
    await startBatchContainer(containerName, lang);

    logger.info(`Compiling code in container ${containerName}...`);
    const compileResult = await compileInContainer(containerName, code, lang, uniqueId);

    if (compileResult.exitCode !== 0) {
      logger.warn(`Compilation failed for ${containerName}`);
      return batch.map(tc => ({
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

    // Helper for concurrency with early exit support
    const runWithEarlyExit = async () => {
      const queue = [...batch];

      const runWorker = async () => {
        while (queue.length > 0) {
          if (earlyExit && hasFailed) break;
          const tc = queue.shift();
          if (!tc) break;

          const result = await execTestCase(containerName, tc, lang, uniqueId);
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

    logger.info(`Executing ${batch.length} test cases in ${containerName} (earlyExit: ${earlyExit})...`);
    const batchResults = await runWithEarlyExit();

    logger.info(`📦 Final batch results: ${batchResults.length}`);
    return batchResults.sort((a, b) => batch.findIndex(tc => tc.id === a.test_case_id) - batch.findIndex(tc => tc.id === b.test_case_id));
  } catch (e) {
    logger.error(`Batch execution failed: ${e.message}`);
    throw e;
  } finally {
    // Always cleanup
    spawn('docker', ['rm', '-f', containerName]);
  }
};
