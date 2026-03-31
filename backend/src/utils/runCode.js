// src/utils/runCode.js
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const poolManager = require('../services/poolManager');
const logger = require('./logger');

const DEFAULT_TIMEOUT_SEC = 5;
const MAX_OUTPUT = 64 * 1024; // 64 KB

function writeBase64FileCommand(content = '', filePath) {
  const b64 = Buffer.from(content).toString('base64');
  return `echo "${b64}" | base64 -d > ${filePath}`;
}

async function execInContainer(containerName, cmd) {
  return new Promise((resolve, reject) => {
    const docker = spawn('docker', ['exec', containerName, 'sh', '-c', cmd]);
    let stdout = '';
    let stderr = '';
    let truncated = false;

    docker.stdout.on('data', (data) => {
      stdout += data.toString();
      if (stdout.length > MAX_OUTPUT && !truncated) {
        stdout = stdout.slice(0, MAX_OUTPUT) + '\n[Output truncated]';
        truncated = true;
      }
    });

    docker.stderr.on('data', (data) => {
      stderr += data.toString();
      if (stderr.length > MAX_OUTPUT && !truncated) {
        stderr = stderr.slice(0, MAX_OUTPUT) + '\n[Error truncated]';
        truncated = true;
      }
    });

    docker.on('error', reject);
    docker.on('close', (code) => {
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: typeof code === 'number' ? code : null });
    });
  });
}

module.exports = async function runCode(
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
  const escapedCode = code.replace(/\r/g, '');
  const timeoutSec = DEFAULT_TIMEOUT_SEC;
  
  const poolLang =
    lang === 'cpp' || lang === 'c++'
      ? 'cpp'
      : lang === 'c'
        ? 'c'
        : lang === 'python' || lang === 'py'
          ? 'python'
          : 'java';

  let containerId = null;

  try {
    containerId = await poolManager.acquire(poolLang);

    let compileCmd = '';
    let baseRunCmd = '';

    if (poolLang === 'python') {
      compileCmd = `mkdir -p /tmp/${uniqueId} && ${writeBase64FileCommand(escapedCode, `/tmp/${uniqueId}/code.py`)}`;
      baseRunCmd = `python3 /tmp/${uniqueId}/code.py`;
    } else if (poolLang === 'c') {
      compileCmd = `mkdir -p /tmp/${uniqueId} && ${writeBase64FileCommand(escapedCode, `/tmp/${uniqueId}/code.c`)} && gcc -O2 /tmp/${uniqueId}/code.c -o /tmp/${uniqueId}/a.out -lm 2>/tmp/${uniqueId}/gcc_err.txt || (cat /tmp/${uniqueId}/gcc_err.txt 1>&2 && exit 1)`;
      baseRunCmd = `/tmp/${uniqueId}/a.out`;
    } else if (poolLang === 'cpp') {
      compileCmd = `mkdir -p /tmp/${uniqueId} && ${writeBase64FileCommand(escapedCode, `/tmp/${uniqueId}/code.cpp`)} && g++ -O2 /tmp/${uniqueId}/code.cpp -o /tmp/${uniqueId}/a.out -lm 2>/tmp/${uniqueId}/gcc_err.txt || (cat /tmp/${uniqueId}/gcc_err.txt 1>&2 && exit 1)`;
      baseRunCmd = `/tmp/${uniqueId}/a.out`;
    } else if (poolLang === 'java') {
      let className = 'UserCode';
      const publicClassMatch = escapedCode.match(/^\s*public\s+class\s+([A-Za-z_][A-Za-z0-9_]*)/m);
      if (publicClassMatch) {
        className = publicClassMatch[1];
      } else {
        const classMatch = escapedCode.match(/^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)/m);
        if (classMatch) className = classMatch[1];
      }
      compileCmd = `
mkdir -p /tmp/${uniqueId} &&
${writeBase64FileCommand(escapedCode, `/tmp/${uniqueId}/${className}.java`)} &&
javac /tmp/${uniqueId}/*.java 2> /tmp/${uniqueId}/compile_err.txt || (cat /tmp/${uniqueId}/compile_err.txt 1>&2 && exit 1)
`;
      baseRunCmd = `
MAIN_CLASS=$(grep -l "public static void main" /tmp/${uniqueId}/*.java | head -n1 | xargs basename -s .java)
if [ -z "$MAIN_CLASS" ]; then MAIN_CLASS=$(ls /tmp/${uniqueId}/*.class | head -n1 | xargs basename -s .class); fi
java -cp /tmp/${uniqueId} $MAIN_CLASS
`;
    }

    const compileResult = await execInContainer(containerId, compileCmd);
    if (compileResult.exitCode !== 0) {
      return {
        output: '',
        error: compileResult.stderr || 'Compilation Failed',
        stderr: compileResult.stderr,
        exitCode: compileResult.exitCode
      };
    }

    const runCmd = `${writeBase64FileCommand(stdinInput, `/tmp/${uniqueId}/input.txt`)} && cat /tmp/${uniqueId}/input.txt | timeout ${timeoutSec} sh -c '${baseRunCmd.trim()}'`;
    
    const testResult = await execInContainer(containerId, runCmd);
    const cleanError = testResult.stderr.trim() || null;
    return {
       output: testResult.stdout,
       error: cleanError,
       stderr: testResult.stderr,
       exitCode: testResult.exitCode
    };

  } catch (err) {
     logger.error(`runCode execution failed: ${err.message}`);
     return {
        output: '',
        error: `Runner failed: ${err.message}`,
        stderr: err.message,
        exitCode: null,
     };
  } finally {
     if (containerId && containerId !== 'local') {
        const poolLangStr = (lang === 'java') ? 'java' : (lang === 'c') ? 'c' : (lang === 'cpp' || lang === 'c++') ? 'cpp' : 'python';
        await poolManager.release(poolLangStr, containerId);
     }
  }
};
