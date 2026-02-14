// src/services/localService.js
// Local interactive execution service — mirrors dockerService.js but
// runs code directly on the host machine via child_process.spawn.
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const killIfExists = (proc) => {
  try {
    if (proc && typeof proc.kill === 'function') {
      proc.kill();
    }
  } catch (_e) {
    // ignore
  }
};

/**
 * Create the Python interactive wrapper script file once (reusable).
 */
let pythonWrapperPath = null;
function getPythonWrapperPath() {
  if (pythonWrapperPath && fs.existsSync(pythonWrapperPath)) {
    return pythonWrapperPath;
  }

  const wrapperDir = path.join(os.tmpdir(), 'codeguard-wrappers');
  fs.mkdirSync(wrapperDir, { recursive: true });
  pythonWrapperPath = path.join(wrapperDir, 'python_interactive.py');

  // Write the Python wrapper script as a raw string (no template interpolation issues)
  const script = [
    'import sys, os, traceback',
    '',
    'workspace = sys.argv[1] if len(sys.argv) > 1 else "/tmp/codeguard-py"',
    'os.makedirs(workspace, exist_ok=True)',
    'files = {}',
    'current_file = None',
    '',
    'for line in sys.stdin:',
    '    line = line.rstrip("\\n")',
    '    if line.startswith("__FILE_START__"):',
    '        filename = line.split(" ", 1)[1].strip()',
    '        current_file = filename',
    '        files[filename] = []',
    '    elif line == "__RUN_CODE__":',
    '        for fname, flines in files.items():',
    '            fpath = os.path.join(workspace, fname)',
    '            with open(fpath, "w") as f:',
    '                f.write("\\n".join(flines) + "\\n")',
    '        main_file = None',
    '        for fname in files:',
    '            if fname.endswith(".py"):',
    '                main_file = fname',
    '                break',
    '        if main_file:',
    '            fpath = os.path.join(workspace, main_file)',
    '            try:',
    '                with open(fpath) as f:',
    '                    code = f.read()',
    '                exec(compile(code, fpath, "exec"), {"__name__": "__main__"})',
    '            except SystemExit:',
    '                pass',
    '            except Exception:',
    '                traceback.print_exc()',
    '        files = {}',
    '        current_file = None',
    '        sys.stdout.flush()',
    '        sys.stderr.flush()',
    '    elif current_file is not None:',
    '        files[current_file].append(line)',
    '',
  ].join('\n');

  fs.writeFileSync(pythonWrapperPath, script, { mode: 0o755 });
  logger.info(`[LocalService] Python wrapper written to ${pythonWrapperPath}`);
  return pythonWrapperPath;
}

/**
 * Execute Python interactively (local).
 * Spawns python3 with the interactive wrapper.
 */
const execPython = (onData, onExit) => {
  const workDir = path.join(os.tmpdir(), `codeguard-local-${uuidv4()}`);
  fs.mkdirSync(workDir, { recursive: true });

  const wrapperPath = getPythonWrapperPath();

  const pythonProcess = spawn('python3', ['-u', wrapperPath, workDir], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: workDir,
  });

  pythonProcess.stdout.on('data', onData);
  pythonProcess.stderr.on('data', (data) => {
    logger.error(`[Local Python] stderr: ${data.toString()}`);
    onData(data);
  });

  if (onExit) {
    pythonProcess.on('exit', (code) => {
      if (code !== 0) {
        logger.error(`[Local Python] exited with code: ${code}`);
      }
      onExit(code);
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch { }
    });
  }

  return pythonProcess;
};

/**
 * Create a bash wrapper script for compiled languages (C, C++, Java).
 * Returns the path to the wrapper script.
 */
function createCompileRunWrapper(workDir, lang) {
  let script;

  if (lang === 'c') {
    script = `#!/bin/bash
WORKDIR="${workDir}"
current_file=""
file_content=""

while IFS= read -r line; do
  if [[ "$line" == __FILE_START__* ]]; then
    # Save previous file if any
    if [ -n "$current_file" ] && [ -n "$file_content" ]; then
      printf '%s' "$file_content" > "$current_file"
    fi
    filename=\${line#__FILE_START__ }
    current_file="$WORKDIR/$filename"
    file_content=""
  elif [[ "$line" == "__RUN_CODE__" ]]; then
    # Save current file
    if [ -n "$current_file" ] && [ -n "$file_content" ]; then
      printf '%s' "$file_content" > "$current_file"
    fi
    # Find and compile
    src_file=$(find "$WORKDIR" -maxdepth 1 -name "*.c" | head -1)
    if [ -n "$src_file" ]; then
      gcc "$src_file" -o "$WORKDIR/a.out" -lm 2>&1
      if [ $? -eq 0 ]; then
        "$WORKDIR/a.out"
      fi
    fi
    current_file=""
    file_content=""
  elif [ -n "$current_file" ]; then
    if [ -z "$file_content" ]; then
      file_content="$line"
    else
      file_content="$file_content
$line"
    fi
  fi
done
`;
  } else if (lang === 'cpp') {
    script = `#!/bin/bash
WORKDIR="${workDir}"
current_file=""
file_content=""

while IFS= read -r line; do
  if [[ "$line" == __FILE_START__* ]]; then
    if [ -n "$current_file" ] && [ -n "$file_content" ]; then
      printf '%s' "$file_content" > "$current_file"
    fi
    filename=\${line#__FILE_START__ }
    current_file="$WORKDIR/$filename"
    file_content=""
  elif [[ "$line" == "__RUN_CODE__" ]]; then
    if [ -n "$current_file" ] && [ -n "$file_content" ]; then
      printf '%s' "$file_content" > "$current_file"
    fi
    src_file=$(find "$WORKDIR" -maxdepth 1 -name "*.cpp" | head -1)
    if [ -n "$src_file" ]; then
      g++ "$src_file" -o "$WORKDIR/a.out" -lm 2>&1
      if [ $? -eq 0 ]; then
        "$WORKDIR/a.out"
      fi
    fi
    current_file=""
    file_content=""
  elif [ -n "$current_file" ]; then
    if [ -z "$file_content" ]; then
      file_content="$line"
    else
      file_content="$file_content
$line"
    fi
  fi
done
`;
  } else if (lang === 'java') {
    script = `#!/bin/bash
WORKDIR="${workDir}"
current_file=""
file_content=""

while IFS= read -r line; do
  if [[ "$line" == __FILE_START__* ]]; then
    if [ -n "$current_file" ] && [ -n "$file_content" ]; then
      printf '%s' "$file_content" > "$current_file"
    fi
    filename=\${line#__FILE_START__ }
    current_file="$WORKDIR/$filename"
    file_content=""
  elif [[ "$line" == "__RUN_CODE__" ]]; then
    if [ -n "$current_file" ] && [ -n "$file_content" ]; then
      printf '%s' "$file_content" > "$current_file"
    fi
    javac "$WORKDIR"/*.java 2>&1
    if [ $? -eq 0 ]; then
      MAIN_CLASS=$(grep -rl "public static void main" "$WORKDIR"/*.java 2>/dev/null | head -1 | xargs basename -s .java 2>/dev/null)
      if [ -z "$MAIN_CLASS" ]; then
        MAIN_CLASS=$(ls "$WORKDIR"/*.class 2>/dev/null | head -1 | xargs basename -s .class 2>/dev/null)
      fi
      if [ -n "$MAIN_CLASS" ]; then
        java -cp "$WORKDIR" "$MAIN_CLASS"
      fi
    fi
    current_file=""
    file_content=""
  elif [ -n "$current_file" ]; then
    if [ -z "$file_content" ]; then
      file_content="$line"
    else
      file_content="$file_content
$line"
    fi
  fi
done
`;
  }

  const wrapperPath = path.join(workDir, '_wrapper.sh');
  fs.writeFileSync(wrapperPath, script, { mode: 0o755 });
  return wrapperPath;
}

/**
 * Execute C code interactively (local).
 */
const execC = (onData, onExit) => {
  const workDir = path.join(os.tmpdir(), `codeguard-local-${uuidv4()}`);
  fs.mkdirSync(workDir, { recursive: true });

  const wrapperPath = createCompileRunWrapper(workDir, 'c');

  const cProcess = spawn('bash', [wrapperPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: workDir,
  });

  cProcess.stdout.on('data', (data) => onData(data.toString()));
  cProcess.stderr.on('data', (data) => onData(data.toString()));

  if (onExit) {
    cProcess.on('exit', (code) => {
      onExit({ exitCode: code });
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch { }
    });
  }

  cProcess.on('error', (err) => {
    logger.error('[Local C] process error:', err.message);
    if (onExit) onExit({ exitCode: 1 });
  });

  // Add write method to match the interface used in socketService
  cProcess.write = (data) => {
    if (cProcess.stdin && cProcess.stdin.writable) {
      cProcess.stdin.write(data);
    }
  };

  return cProcess;
};

/**
 * Execute C++ code interactively (local).
 */
const execCpp = (onData, onExit) => {
  const workDir = path.join(os.tmpdir(), `codeguard-local-${uuidv4()}`);
  fs.mkdirSync(workDir, { recursive: true });

  const wrapperPath = createCompileRunWrapper(workDir, 'cpp');

  const cppProcess = spawn('bash', [wrapperPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: workDir,
  });

  cppProcess.stdout.on('data', (data) => onData(data.toString()));
  cppProcess.stderr.on('data', (data) => onData(data.toString()));

  if (onExit) {
    cppProcess.on('exit', (code) => {
      onExit({ exitCode: code });
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch { }
    });
  }

  cppProcess.on('error', (err) => {
    logger.error('[Local C++] process error:', err.message);
    if (onExit) onExit({ exitCode: 1 });
  });

  cppProcess.write = (data) => {
    if (cppProcess.stdin && cppProcess.stdin.writable) {
      cppProcess.stdin.write(data);
    }
  };

  return cppProcess;
};

/**
 * Execute Java interactively (local).
 */
const execJava = (onData, onExit) => {
  const workDir = path.join(os.tmpdir(), `codeguard-local-${uuidv4()}`);
  fs.mkdirSync(workDir, { recursive: true });

  const wrapperPath = createCompileRunWrapper(workDir, 'java');

  const javaProcess = spawn('bash', [wrapperPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: workDir,
  });

  javaProcess.stdout.on('data', onData);
  javaProcess.stderr.on('data', onData);

  if (onExit) {
    javaProcess.on('exit', (code) => {
      onExit(code);
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch { }
    });
  }

  return javaProcess;
};

module.exports = {
  killIfExists,
  execPython,
  execJava,
  execC,
  execCpp,
};
