const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { detectRuntimes } = require('./runtimeDetector');
const logger = require('./logger');

const isMacOS = process.platform === 'darwin';

class LocalRunner {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'codeguard-local');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Spawn a process and measure wall-clock time using hrtime.
   * On macOS, attempts to use /usr/bin/time -l for peak RSS.
   * Returns { stdout, stderr, exitCode, time_ms, memory_kb, timedOut }.
   */
  _spawnWithMetrics(cmd, args, options, timeoutMs) {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      const startTime = process.hrtime.bigint();

      const proc = spawn(cmd, args, {
        ...options,
        timeout: timeoutMs,
      });

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

      proc.on('error', (err) => {
        const endTime = process.hrtime.bigint();
        const time_ms = Number((endTime - startTime) / BigInt(1000000));
        resolve({
          stdout,
          stderr: stderr || err.message,
          exitCode: 1,
          time_ms,
          memory_kb: 0,
          timedOut: false,
        });
      });

      proc.on('close', (code, signal) => {
        const endTime = process.hrtime.bigint();
        const time_ms = Number((endTime - startTime) / BigInt(1000000));

        // Detect timeout: Node.js sets signal to 'SIGTERM' when timeout fires
        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          timedOut = true;
        }

        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: timedOut ? 124 : (signal === 'SIGKILL' ? 137 : code),
          time_ms,
          memory_kb: 0, // We'll measure memory separately for compiled languages
          timedOut,
        });
      });
    });
  }

  /**
   * Run compiled binary with /usr/bin/time for memory measurement.
   * Returns { stdout, stderr, exitCode, time_ms, memory_kb, timedOut }.
   */
  _runWithTimeMeasurement(runCmd, runArgs, workDir, stdinInput, timeoutMs) {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      const startTime = process.hrtime.bigint();

      // On macOS: /usr/bin/time -l; on Linux: /usr/bin/time -v
      const timeFlag = isMacOS ? '-l' : '-v';
      const timeCmd = '/usr/bin/time';
      const fullArgs = [timeFlag, runCmd, ...runArgs];

      const proc = spawn(timeCmd, fullArgs, {
        cwd: workDir,
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
        timeout: timeoutMs,
      });

      if (stdinInput) {
        proc.stdin.write(stdinInput);
      }
      proc.stdin.end();

      proc.stdout.on('data', (d) => {
        stdout += d.toString();
      });
      proc.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      proc.on('error', (err) => {
        // /usr/bin/time not available — fallback to basic execution
        const endTime = process.hrtime.bigint();
        const time_ms = Number((endTime - startTime) / BigInt(1000000));
        resolve({
          stdout,
          stderr: stderr || err.message,
          exitCode: 1,
          time_ms,
          memory_kb: 0,
          timedOut: false,
        });
      });

      proc.on('close', (code, signal) => {
        const endTime = process.hrtime.bigint();
        const time_ms = Number((endTime - startTime) / BigInt(1000000));

        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          timedOut = true;
        }

        // Parse memory from /usr/bin/time output
        let memory_kb = 0;
        if (isMacOS) {
          // macOS: "maximum resident set size" in bytes
          const memMatch = stderr.match(
            /(\d+)\s+maximum resident set size/
          );
          if (memMatch) {
            memory_kb = Math.round(parseInt(memMatch[1], 10) / 1024);
          }
        } else {
          // Linux: "Maximum resident set size (kbytes): NNNN"
          const memMatch = stderr.match(
            /Maximum resident set size.*?:\s*(\d+)/
          );
          if (memMatch) {
            memory_kb = parseInt(memMatch[1], 10);
          }
        }

        // Clean time output from stderr — keep only program's stderr
        let cleanStderr = stderr;
        if (isMacOS) {
          // macOS /usr/bin/time -l dumps stats after the program's stderr
          // Stats start with a line containing "real" and time value
          const timeOutputStart = cleanStderr.search(
            /\s+\d+\.\d+\s+real\s+\d+\.\d+\s+user/
          );
          if (timeOutputStart !== -1) {
            cleanStderr = cleanStderr.substring(0, timeOutputStart).trim();
          }
        } else {
          // Linux: GNU time prepends "Command being timed:"
          cleanStderr = cleanStderr
            .replace(/\s*Command being timed:.*\n?/g, '')
            .replace(/\s*User time.*\n?/g, '')
            .replace(/\s*System time.*\n?/g, '')
            .replace(/\s*Percent of CPU.*\n?/g, '')
            .replace(/\s*Elapsed.*\n?/g, '')
            .replace(/\s*Average.*\n?/g, '')
            .replace(/\s*Maximum resident.*\n?/g, '')
            .replace(/\s*Major.*\n?/g, '')
            .replace(/\s*Minor.*\n?/g, '')
            .replace(/\s*Voluntary.*\n?/g, '')
            .replace(/\s*Involuntary.*\n?/g, '')
            .replace(/\s*Swaps.*\n?/g, '')
            .replace(/\s*File system.*\n?/g, '')
            .replace(/\s*Socket.*\n?/g, '')
            .replace(/\s*Signals.*\n?/g, '')
            .replace(/\s*Page size.*\n?/g, '')
            .replace(/\s*Exit status.*\n?/g, '')
            .trim();
        }

        resolve({
          stdout: stdout.trim(),
          stderr: cleanStderr,
          exitCode: timedOut ? 124 : (signal === 'SIGKILL' ? 137 : code),
          time_ms,
          memory_kb,
          timedOut,
        });
      });
    });
  }

  async runCode(code, lang, stdinInput = '', timeoutSec = 5) {
    const runtimes = detectRuntimes();
    const runtime = runtimes[lang];
    if (!runtime) {
      throw new Error(`Runtime for ${lang} not found locally`);
    }

    const uniqueId = Math.random().toString(36).substring(7);
    const workDir = path.join(this.tempDir, uniqueId);
    fs.mkdirSync(workDir, { recursive: true });

    try {
      const isWindows = process.platform === 'win32';
      const timeoutMs = timeoutSec * 1000;

      if (lang === 'python') {
        const sourceFile = path.join(workDir, 'code.py');
        fs.writeFileSync(sourceFile, code);

        const result = await this._runWithTimeMeasurement(
          runtime.run,
          [sourceFile],
          workDir,
          stdinInput,
          timeoutMs
        );

        return result;
      } else if (lang === 'c' || lang === 'cpp') {
        const ext = lang === 'c' ? '.c' : '.cpp';
        const sourceFile = path.join(workDir, 'code' + ext);
        const executableFile = path.join(workDir, isWindows ? 'a.exe' : 'a.out');
        fs.writeFileSync(sourceFile, code);

        const compiler = runtime.compile;
        try {
          execSync(
            `"${compiler}" -O2 "${sourceFile}" -o "${executableFile}" -lm`,
            { stdio: 'pipe' }
          );
        } catch (err) {
          return {
            stdout: '',
            stderr: err.stderr ? err.stderr.toString() : err.message,
            exitCode: 1,
            error: 'Compilation Failed',
            time_ms: 0,
            memory_kb: 0,
            timedOut: false,
          };
        }

        return await this._runWithTimeMeasurement(
          executableFile,
          [],
          workDir,
          stdinInput,
          timeoutMs
        );
      } else if (lang === 'java') {
        let className = 'UserCode';
        const classMatch = code.match(
          /^\s*(?:public\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)/m
        );
        if (classMatch) className = classMatch[1];

        const sourceFile = path.join(workDir, `${className}.java`);
        fs.writeFileSync(sourceFile, code);

        try {
          execSync(`"${runtime.compile}" "${sourceFile}"`, {
            cwd: workDir,
            stdio: 'pipe',
          });
        } catch (err) {
          return {
            stdout: '',
            stderr: err.stderr ? err.stderr.toString() : err.message,
            exitCode: 1,
            error: 'Compilation Failed',
            time_ms: 0,
            memory_kb: 0,
            timedOut: false,
          };
        }

        return await this._runWithTimeMeasurement(
          runtime.run,
          ['-cp', workDir, className],
          workDir,
          stdinInput,
          timeoutMs
        );
      }
    } finally {
      try {
        setTimeout(() => {
          if (fs.existsSync(workDir)) {
            fs.rmSync(workDir, { recursive: true, force: true });
          }
        }, 1000);
      } catch (e) {
        logger.error(`Failed to cleanup workdir ${workDir}: ${e.message}`);
      }
    }
  }

  /**
   * Run batch of test cases. Compiles ONCE, then executes per test case.
   */
  async runBatchCode(code, lang, batch, options = {}) {
    const runtimes = detectRuntimes();
    const runtime = runtimes[lang];
    if (!runtime) {
      throw new Error(`Runtime for ${lang} not found locally`);
    }

    const results = [];
    const { failFast } = options;

    const uniqueId = Math.random().toString(36).substring(7);
    const workDir = path.join(this.tempDir, `batch-${uniqueId}`);
    fs.mkdirSync(workDir, { recursive: true });

    try {
      const isWindows = process.platform === 'win32';
      let runCmd = '';
      let runArgs = [];

      // ── Compile once ──────────────────────────────────────────────────
      if (lang === 'python') {
        const sourceFile = path.join(workDir, 'code.py');
        fs.writeFileSync(sourceFile, code);
        runCmd = runtime.run;
        runArgs = [sourceFile];
      } else if (lang === 'c' || lang === 'cpp') {
        const ext = lang === 'c' ? '.c' : '.cpp';
        const sourceFile = path.join(workDir, 'code' + ext);
        const executableFile = path.join(workDir, isWindows ? 'a.exe' : 'a.out');
        fs.writeFileSync(sourceFile, code);

        try {
          execSync(
            `"${runtime.compile}" -O2 "${sourceFile}" -o "${executableFile}" -lm`,
            { stdio: 'pipe' }
          );
        } catch (err) {
          // Return compile error for all test cases
          return batch.map((tc) => ({
            test_case_id: tc.id,
            stdout: '',
            stderr: err.stderr ? err.stderr.toString() : err.message,
            exitCode: 1,
            error: 'Compilation Failed',
            cpuTime: 0,
            memoryKB: 0,
            time_ms: 0,
            memory_kb: 0,
            status: 'compile_error',
          }));
        }
        runCmd = executableFile;
        runArgs = [];
      } else if (lang === 'java') {
        let className = 'UserCode';
        const classMatch = code.match(
          /^\s*(?:public\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)/m
        );
        if (classMatch) className = classMatch[1];

        const sourceFile = path.join(workDir, `${className}.java`);
        fs.writeFileSync(sourceFile, code);

        try {
          execSync(`"${runtime.compile}" "${sourceFile}"`, {
            cwd: workDir,
            stdio: 'pipe',
          });
        } catch (err) {
          return batch.map((tc) => ({
            test_case_id: tc.id,
            stdout: '',
            stderr: err.stderr ? err.stderr.toString() : err.message,
            exitCode: 1,
            error: 'Compilation Failed',
            cpuTime: 0,
            memoryKB: 0,
            time_ms: 0,
            memory_kb: 0,
            status: 'compile_error',
          }));
        }
        runCmd = runtime.run;
        runArgs = ['-cp', workDir, className];
      }

      // ── Execute per test case (binary already compiled) ────────────
      for (const tc of batch) {
        const timeoutMs = Math.max(1000, tc.time_limit_ms || 5000);

        const result = await this._runWithTimeMeasurement(
          runCmd,
          [...runArgs],
          workDir,
          tc.stdinInput,
          timeoutMs
        );

        results.push({
          test_case_id: tc.id,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          error: result.error,
          cpuTime: (result.time_ms || 0) / 1000,
          memoryKB: result.memory_kb || 0,
          time_ms: result.time_ms || 0,
          memory_kb: result.memory_kb || 0,
        });

        if (failFast && (result.exitCode !== 0 || result.error)) {
          break;
        }
      }

      return results;
    } finally {
      try {
        setTimeout(() => {
          if (fs.existsSync(workDir)) {
            fs.rmSync(workDir, { recursive: true, force: true });
          }
        }, 1000);
      } catch (e) {
        logger.error(`Failed to cleanup batch workdir ${workDir}: ${e.message}`);
      }
    }
  }
}

const runner = new LocalRunner();

module.exports = runner.runBatchCode.bind(runner);
module.exports.localRunCode = runner.runCode.bind(runner);
module.exports.localBatchCode = runner.runBatchCode.bind(runner);
module.exports.runCode = runner.runCode.bind(runner);
