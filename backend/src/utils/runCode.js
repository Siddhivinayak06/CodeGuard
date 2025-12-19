// src/utils/runCode.js
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

const DEFAULT_TIMEOUT_SEC = 5;
const MAX_OUTPUT = 64 * 1024; // 64 KB

function escapeForPrintf(s = '') {
  // escape single quotes safely for printf '%s' '...'
  return s.replace(/'/g, "'\\''");
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

  let cmd;

  if (lang === 'python' || lang === 'py') {
    cmd = `
mkdir -p /tmp/${uniqueId} &&
printf "%s" '${escapeForPrintf(escapedCode)}' > /tmp/${uniqueId}/code.py &&
printf "%s" '${escapeForPrintf(stdinInput)}' | timeout ${timeoutSec} python3 /tmp/${uniqueId}/code.py
`;
  } else if (lang === 'c') {
    cmd = `
mkdir -p /tmp/${uniqueId} &&
printf "%s" '${escapeForPrintf(escapedCode)}' > /tmp/${uniqueId}/code.c &&
 gcc /tmp/${uniqueId}/code.c -o /tmp/${uniqueId}/a.out -lm 2>/tmp/${uniqueId}/gcc_err.txt || true &&
cat /tmp/${uniqueId}/gcc_err.txt 1>&2 || true &&
printf "%s" '${escapeForPrintf(stdinInput)}' | timeout ${timeoutSec} /tmp/${uniqueId}/a.out
`;
  } else if (lang === 'cpp') {
    cmd = `
mkdir -p /tmp/${uniqueId} &&
printf "%s" '${escapeForPrintf(escapedCode)}' > /tmp/${uniqueId}/code.cpp &&
 g++ /tmp/${uniqueId}/code.cpp -o /tmp/${uniqueId}/a.out -lm 2>/tmp/${uniqueId}/gcc_err.txt || true &&
cat /tmp/${uniqueId}/gcc_err.txt 1>&2 || true &&
printf "%s" '${escapeForPrintf(stdinInput)}' | timeout ${timeoutSec} /tmp/${uniqueId}/a.out
`;
  } else if (lang === 'java') {
    cmd = `
mkdir -p /tmp/${uniqueId} &&

# Write the user code to a temp file for analysis
printf "%s" '${escapeForPrintf(escapedCode)}' > /tmp/${uniqueId}/TempUserCode.java || true &&

# Detect package line and class name
pkg_line=$(grep -E '^[[:space:]]*package[[:space:]]+[a-zA-Z0-9_.]+' /tmp/${uniqueId}/TempUserCode.java | head -n1 | sed 's/;//') || true &&
class_name=$(grep -Eo '^[[:space:]]*(public[[:space:]]+)?class[[:space:]]+[A-Za-z_][A-Za-z0-9_]*' /tmp/${uniqueId}/TempUserCode.java | head -n1 | awk '{print $NF}') || true &&

# Choose the right file name
if [ "$class_name" = "Main" ]; then
  code_file=/tmp/${uniqueId}/Main.java
else
  code_file=/tmp/${uniqueId}/\${class_name:-UserCode}.java
fi &&

# Write actual code to that file
mv /tmp/${uniqueId}/TempUserCode.java "$code_file" || cp /tmp/${uniqueId}/TempUserCode.java "$code_file" &&

# Detect if there's a main method
if grep -q 'public[[:space:]]\\+static[[:space:]]\\+void[[:space:]]\\+main[[:space:]]*(' "$code_file"; then
  has_main=1
else
  has_main=0
fi &&

# If user has main and the public class isn't Main, make a wrapper
if [ "$has_main" -eq 1 ] && [ "$class_name" != "Main" ]; then
  wrapper_file=/tmp/${uniqueId}/Main.java
  if [ -n "$pkg_line" ]; then
    echo "$pkg_line;" > "$wrapper_file"
  fi
  cat >> "$wrapper_file" <<WRAPPER
public class Main {
    public static void main(String[] args) {
        try {
            $class_name.main(args);
        } catch (Throwable t) {
            t.printStackTrace();
            System.exit(1);
        }
    }
}
WRAPPER
fi &&

# Compile and run
javac /tmp/${uniqueId}/*.java 2> /tmp/${uniqueId}/compile_err.txt || true &&
if [ -s /tmp/${uniqueId}/compile_err.txt ]; then
  cat /tmp/${uniqueId}/compile_err.txt 1>&2
  exit 1
else
  printf "%s" '${escapeForPrintf(stdinInput)}' | timeout ${timeoutSec} java -cp /tmp/${uniqueId} Main
fi
`;
  }

  // Which docker image to use per language
  const image =
    lang === 'python'
      ? 'codeguard-python'
      : lang === 'c' || lang === 'cpp'
        ? 'codeguard-c'
        : 'codeguard-java';

  // Determine resource limits
  const isJava = lang === 'java';
  const memLimit = isJava ? config.docker.javaMemory : config.docker.memory;
  const pidsLimit = isJava ? config.docker.javaPidsLimit : config.docker.pidsLimit;

  // Spawn docker - do not swallow spawn errors
  let docker;
  try {
    docker = spawn('docker', [
      'run',
      '--rm',
      '--network',
      'none',
      '-m',
      memLimit,
      '--cpus=' + config.docker.cpus,
      '--pids-limit',
      pidsLimit,
      image,
      'sh',
      '-c',
      cmd,
    ]);
  } catch (spawnErr) {
    // spawn can throw synchronously if 'docker' binary isn't found
    return {
      output: '',
      error: `Failed to spawn docker: ${spawnErr && spawnErr.message}`,
      stderr: String((spawnErr && spawnErr.stack) || spawnErr),
      exitCode: null,
    };
  }

  // collect output with truncation
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

  const result = await new Promise((resolve, reject) => {
    docker.on('error', (err) => {
      // typical reasons: docker CLI missing, permission denied to socket, etc.
      return reject(new Error(`docker spawn error: ${err && err.message}`));
    });

    docker.on('close', (code, signal) => {
      return resolve({
        code: typeof code === 'number' ? code : null,
        signal: signal || null,
      });
    });
  }).catch((err) => {
    // bubble up the spawn error with useful details
    return {
      spawnError: String(err && err.message ? err.message : err),
      code: null,
    };
  });

  // If spawn error occurred
  if (result && result.spawnError) {
    return {
      output: stdout.trim(),
      error: `Runner spawn error: ${result.spawnError}`,
      stderr: stderr.trim() || result.spawnError,
      exitCode: null,
    };
  }

  const exitCode =
    result && typeof result.code === 'number' ? result.code : null;

  // Normalize error output
  const cleanError = stderr.trim() || null;

  return {
    output: stdout.trim(),
    error: cleanError,
    stderr: stderr.trim(),
    exitCode,
  };
};
