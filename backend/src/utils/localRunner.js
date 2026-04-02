const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { detectRuntimes } = require('./runtimeDetector');
const logger = require('./logger');

class LocalRunner {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'codeguard-local');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
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
      let sourceFile = '';
      let executableFile = '';
      let compileCmd = '';
      let runCmd = '';
      let runArgs = [];

      const isWindows = process.platform === 'win32';

      if (lang === 'python') {
        sourceFile = path.join(workDir, 'code.py');
        fs.writeFileSync(sourceFile, code);
        runCmd = runtime.run;
        runArgs = [sourceFile];
      } else if (lang === 'c' || lang === 'cpp') {
        const ext = lang === 'c' ? '.c' : '.cpp';
        sourceFile = path.join(workDir, 'code' + ext);
        executableFile = path.join(workDir, isWindows ? 'a.exe' : 'a.out');
        fs.writeFileSync(sourceFile, code);

        const compiler = runtime.compile;
        // Basic compilation
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
          };
        }
        runCmd = executableFile;
      } else if (lang === 'java') {
        let className = 'UserCode';
        const classMatch = code.match(
          /^\s*(?:public\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)/m
        );
        if (classMatch) className = classMatch[1];

        sourceFile = path.join(workDir, `${className}.java`);
        fs.writeFileSync(sourceFile, code);

        // Compile
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
          };
        }
        runCmd = runtime.run;
        runArgs = ['-cp', '.', className];
      }

      // Execute with timeout and stdin
      return await new Promise((resolve) => {
        const proc = spawn(runCmd, runArgs, {
          cwd: workDir,
          env: { ...process.env, PYTHONUNBUFFERED: '1' },
          timeout: timeoutSec * 1000,
        });

        let stdout = '';
        let stderr = '';

        if (stdinInput) {
          proc.stdin.write(stdinInput);
          proc.stdin.end();
        }

        proc.stdout.on('data', (d) => {
          stdout += d.toString();
        });
        proc.stderr.on('data', (d) => {
          stderr += d.toString();
        });

        proc.on('error', (err) => {
          resolve({ stdout, stderr, exitCode: 1, error: err.message });
        });

        proc.on('close', (code) => {
          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: code,
          });
        });
      });
    } finally {
      // Cleanup
      try {
        // We delay cleanup slightly or handle it asynchronously to avoid locking issues on Windows
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

  async runBatchCode(code, lang, batch, options = {}) {
    const results = [];
    const { failFast } = options;

    for (const tc of batch) {
      const timeoutSec = Math.max(
        1,
        Math.ceil((tc.time_limit_ms || 5000) / 1000)
      );
      const result = await this.runCode(code, lang, tc.stdinInput, timeoutSec);

      results.push({
        test_case_id: tc.id,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        error: result.error,
        cpuTime: 0,
        memoryKB: 0,
      });

      if (failFast && (result.exitCode !== 0 || result.error)) {
        break;
      }
    }
    return results;
  }
}

const runner = new LocalRunner();

module.exports = runner.runBatchCode.bind(runner);
module.exports.localRunCode = runner.runCode.bind(runner);
module.exports.localBatchCode = runner.runBatchCode.bind(runner);
