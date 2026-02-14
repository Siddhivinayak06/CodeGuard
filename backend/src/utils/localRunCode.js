// src/utils/localRunCode.js
// Single code execution using locally installed compilers (no Docker).
// Mirror of runCode.js but runs via child_process.spawn directly.
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('./logger');

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_OUTPUT = 64 * 1024; // 64 KB

/**
 * Spawn a process with a timeout that kills it if it exceeds the limit.
 * Returns { stdout, stderr, exitCode, timedOut }.
 */
function spawnWithTimeout(cmd, args, options, timeoutMs) {
    return new Promise((resolve) => {
        const proc = spawn(cmd, args, options);
        let stdout = '';
        let stderr = '';
        let truncated = false;
        let timedOut = false;

        // Write stdin if provided
        if (options.input) {
            proc.stdin.write(options.input);
        }
        proc.stdin.end();

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
            if (stdout.length > MAX_OUTPUT && !truncated) {
                stdout = stdout.slice(0, MAX_OUTPUT) + '\n[Output truncated]';
                truncated = true;
            }
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
            if (stderr.length > MAX_OUTPUT && !truncated) {
                stderr = stderr.slice(0, MAX_OUTPUT) + '\n[Error truncated]';
                truncated = true;
            }
        });

        const timer = setTimeout(() => {
            timedOut = true;
            proc.kill('SIGKILL');
        }, timeoutMs);

        proc.on('error', (err) => {
            clearTimeout(timer);
            logger.error(`Local spawn error: ${err.message}`);
            resolve({ stdout, stderr: stderr || err.message, exitCode: 1, timedOut });
        });

        proc.on('close', (code) => {
            clearTimeout(timer);
            resolve({ stdout, stderr, exitCode: code, timedOut });
        });
    });
}

module.exports = async function localRunCode(
    code,
    lang = 'python',
    stdinInput = ''
) {
    if (!code || typeof code !== 'string') {
        throw new Error('No code provided');
    }

    const supported = ['python', 'py', 'c', 'cpp', 'java'];
    if (!supported.includes(lang)) {
        return {
            output: '',
            error: `Unsupported language: ${lang}`,
            stderr: `Unsupported language: ${lang}`,
            exitCode: null,
        };
    }

    const uniqueId = uuidv4();
    const workDir = path.join(os.tmpdir(), `codeguard-${uniqueId}`);
    fs.mkdirSync(workDir, { recursive: true });

    try {
        if (lang === 'python' || lang === 'py') {
            const codeFile = path.join(workDir, 'code.py');
            fs.writeFileSync(codeFile, code);

            const result = await spawnWithTimeout(
                'python3', [codeFile],
                { stdio: ['pipe', 'pipe', 'pipe'], cwd: workDir, input: stdinInput },
                DEFAULT_TIMEOUT_MS
            );

            return {
                output: result.stdout.trim(),
                error: result.timedOut ? 'Time limit exceeded' : (result.stderr.trim() || null),
                stderr: result.stderr.trim(),
                exitCode: result.timedOut ? 124 : result.exitCode,
            };

        } else if (lang === 'c' || lang === 'cpp') {
            const ext = lang === 'c' ? 'c' : 'cpp';
            const compiler = lang === 'c' ? 'gcc' : 'g++';
            const codeFile = path.join(workDir, `code.${ext}`);
            const outFile = path.join(workDir, 'a.out');
            fs.writeFileSync(codeFile, code);

            // Compile first
            const compileResult = await spawnWithTimeout(
                compiler, [codeFile, '-o', outFile, '-lm'],
                { stdio: ['pipe', 'pipe', 'pipe'], cwd: workDir, input: '' },
                DEFAULT_TIMEOUT_MS
            );

            if (compileResult.exitCode !== 0) {
                return {
                    output: '',
                    error: compileResult.stderr.trim() || 'Compilation failed',
                    stderr: compileResult.stderr.trim(),
                    exitCode: compileResult.exitCode,
                };
            }

            // Run
            const result = await spawnWithTimeout(
                outFile, [],
                { stdio: ['pipe', 'pipe', 'pipe'], cwd: workDir, input: stdinInput },
                DEFAULT_TIMEOUT_MS
            );

            return {
                output: result.stdout.trim(),
                error: result.timedOut ? 'Time limit exceeded' : (result.stderr.trim() || null),
                stderr: result.stderr.trim(),
                exitCode: result.timedOut ? 124 : result.exitCode,
            };

        } else if (lang === 'java') {
            // Detect class name from code
            const classMatch = code.match(
                /(?:public\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)/
            );
            const className = classMatch ? classMatch[1] : 'Main';
            const codeFile = path.join(workDir, `${className}.java`);
            fs.writeFileSync(codeFile, code);

            // Compile
            const compileResult = await spawnWithTimeout(
                'javac', [codeFile],
                { stdio: ['pipe', 'pipe', 'pipe'], cwd: workDir, input: '' },
                DEFAULT_TIMEOUT_MS
            );

            if (compileResult.exitCode !== 0) {
                return {
                    output: '',
                    error: compileResult.stderr.trim() || 'Compilation failed',
                    stderr: compileResult.stderr.trim(),
                    exitCode: compileResult.exitCode,
                };
            }

            // Run
            const result = await spawnWithTimeout(
                'java', ['-cp', workDir, className],
                { stdio: ['pipe', 'pipe', 'pipe'], cwd: workDir, input: stdinInput },
                DEFAULT_TIMEOUT_MS
            );

            return {
                output: result.stdout.trim(),
                error: result.timedOut ? 'Time limit exceeded' : (result.stderr.trim() || null),
                stderr: result.stderr.trim(),
                exitCode: result.timedOut ? 124 : result.exitCode,
            };
        }
    } finally {
        // Cleanup temp directory
        try {
            fs.rmSync(workDir, { recursive: true, force: true });
        } catch {
            // ignore cleanup errors
        }
    }
};
