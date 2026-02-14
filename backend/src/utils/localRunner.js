// src/utils/localRunner.js
// Batch code execution using locally installed compilers (no Docker).
// Mirror of dockerRunner.js but runs via child_process.spawn directly.
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('./logger');

/**
 * Spawn a process with a Node.js-based timeout.
 */
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

    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));

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
    // Python has no compilation step
    return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 });
  } else if (lang === 'c') {
    const codeFile = path.join(workDir, 'code.c');
    const outFile = path.join(workDir, 'a.out');
    fs.writeFileSync(codeFile, code);
    return spawnWithTimeout(
      'gcc',
      ['-O2', codeFile, '-o', outFile, '-lm'],
      { stdio: ['pipe', 'pipe', 'pipe'], cwd: workDir, input: '' },
      10000
    );
  } else if (lang === 'cpp' || lang === 'c++') {
    const codeFile = path.join(workDir, 'code.cpp');
    const outFile = path.join(workDir, 'a.out');
    fs.writeFileSync(codeFile, code);
    return spawnWithTimeout(
      'g++',
      ['-O2', codeFile, '-o', outFile, '-lm'],
      { stdio: ['pipe', 'pipe', 'pipe'], cwd: workDir, input: '' },
      10000
    );
  } else if (lang === 'java') {
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

  let cmd, args;

  if (lang === 'python' || lang === 'py') {
    cmd = 'python3';
    args = [path.join(workDir, 'code.py')];
  } else if (lang === 'c' || lang === 'cpp' || lang === 'c++') {
    cmd = path.join(workDir, 'a.out');
    args = [];
  } else if (lang === 'java') {
    // Find main class from compiled .class files
    const classFiles = fs
      .readdirSync(workDir)
      .filter((f) => f.endsWith('.class'));
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
    };
  });
}

module.exports = async function localBatchCode(
  code,
  lang = 'python',
  batch = [],
  options = {}
) {
  const CONCURRENCY_LIMIT = 5;
  const { earlyExit = true } = options;
  const uniqueId = uuidv4();
  const workDir = path.join(os.tmpdir(), `codeguard-${uniqueId}`);
  fs.mkdirSync(workDir, { recursive: true });

  const poolLang =
    lang === 'cpp' || lang === 'c++'
      ? 'cpp'
      : lang === 'c'
        ? 'c'
        : lang === 'py'
          ? 'python'
          : lang;

  try {
    logger.info(`[LocalRunner] Compiling ${poolLang} locally...`);
    const compileResult = await compileLocally(code, lang, workDir);

    if (compileResult.exitCode !== 0) {
      logger.warn(`[LocalRunner] Compilation failed`);
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

    const queue = [...batch];

    const runWorker = async () => {
      while (queue.length > 0) {
        if (earlyExit && hasFailed) break;
        const tc = queue.shift();
        if (!tc) break;

        const result = await execTestCaseLocally(tc, lang, workDir);
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

    logger.info(`[LocalRunner] 📦 Batch results: ${results.length}`);
    return results.sort(
      (a, b) =>
        batch.findIndex((tc) => tc.id === a.test_case_id) -
        batch.findIndex((tc) => tc.id === b.test_case_id)
    );
  } catch (e) {
    logger.error(`[LocalRunner] Batch execution failed: ${e.message}`);
    throw e;
  } finally {
    // Cleanup temp directory
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
};
