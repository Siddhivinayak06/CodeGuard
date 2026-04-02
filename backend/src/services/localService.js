// src/services/localService.js
// Local interactive execution service — mirrors dockerService.js but
// runs code directly on the host machine via child_process.spawn.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { detectRuntimes } = require('../utils/runtimeDetector');

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

  const pythonPath = detectRuntimes().python?.run || 'python3';
  const wrapperPath = getPythonWrapperPath();

  const pythonProcess = spawn(pythonPath, ['-u', wrapperPath, workDir], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: workDir,
    shell: process.platform === 'win32',
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
      } catch {
        // ignore cleanup errors
      }
    });
  }

  pythonProcess.on('error', (err) => {
    logger.error(`[Local Python] process error: ${err.message}`);
    if (onExit) onExit(1);
  });

  return pythonProcess;
};

/**
 * Create a Node.js wrapper script for compiled languages (C, C++, Java).
 * Returns the path to the wrapper script.
 */
let nodeWrapperPath = null;
function getNodeWrapperPath() {
  if (nodeWrapperPath && fs.existsSync(nodeWrapperPath)) {
    return nodeWrapperPath;
  }

  const wrapperDir = path.join(os.tmpdir(), 'codeguard-wrappers');
  fs.mkdirSync(wrapperDir, { recursive: true });
  nodeWrapperPath = path.join(wrapperDir, 'interactive_wrapper.js');

  const script = `
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const readline = require('readline');

const workDir = process.argv[2];
const lang = process.argv[3];
const isWindows = process.platform === 'win32';

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false
});

let currentFile = null;
let files = {};

rl.on('line', (line) => {
  if (line.startsWith('__FILE_START__ ')) {
    currentFile = line.substring(15).trim();
    files[currentFile] = [];
  } else if (line === '__RUN_CODE__') {
    // Write files
    for (const [fname, contentLines] of Object.entries(files)) {
      try {
        fs.writeFileSync(path.join(workDir, fname), contentLines.join('\\n'));
      } catch (err) {
        console.error('Failed to write file ' + fname + ': ' + err.message);
      }
    }
    
    // Compile & Run
    if (lang === 'c' || lang === 'cpp') {
      const ext = (lang === 'c') ? '.c' : '.cpp';
      const compiler = (lang === 'c') ? 'gcc' : 'g++';
      const srcFile = Object.keys(files).find(f => f.endsWith(ext));
      const exeFile = path.join(workDir, isWindows ? 'a.exe' : 'a.out');
      
      if (srcFile) {
        const comp = spawnSync(compiler, ['-O2', path.join(workDir, srcFile), '-o', exeFile, '-lm'], { 
          stdio: ['ignore', 'inherit', 'inherit'], 
          cwd: workDir,
          shell: isWindows 
        });
        if (comp.status === 0) {
          spawnSync(exeFile, [], { stdio: ['ignore', 'inherit', 'inherit'], cwd: workDir });
        }
      }
    } else if (lang === 'java') {
      const comp = spawnSync('javac', ['*.java'], { 
        stdio: ['ignore', 'inherit', 'inherit'], 
        cwd: workDir, 
        shell: true 
      });
      if (comp.status === 0) {
        let mainClass = '';
        try {
          const javaFiles = fs.readdirSync(workDir).filter(f => f.endsWith('.java'));
          for (const f of javaFiles) {
            const content = fs.readFileSync(path.join(workDir, f), 'utf-8');
            if (content.includes('public static void main')) {
              mainClass = path.basename(f, '.java');
              break;
            }
          }
          if (!mainClass) {
            const classes = fs.readdirSync(workDir).filter(f => f.endsWith('.class'));
            if (classes.length > 0) mainClass = path.basename(classes[0], '.class');
          }
        } catch (err) {
          console.error('Error finding main class: ' + err.message);
        }
        
        if (mainClass) {
          spawnSync('java', ['-XX:+UseSerialGC', '-Xmx128M', '-cp', '.', mainClass], { 
            stdio: ['ignore', 'inherit', 'inherit'], 
            cwd: workDir 
          });
        }
      }
    }
    
    files = {};
    currentFile = null;
    // Signal completion if needed or just flush
  } else if (currentFile !== null) {
    files[currentFile].push(line);
  }
});
`;

  fs.writeFileSync(nodeWrapperPath, script);
  return nodeWrapperPath;
}

/**
 * Execute C code interactively (local).
 */
const execC = (onData, onExit) => {
  const workDir = path.join(os.tmpdir(), `codeguard-local-${uuidv4()}`);
  fs.mkdirSync(workDir, { recursive: true });

  const wrapperPath = getNodeWrapperPath();

  const cProcess = spawn('node', [wrapperPath, workDir, 'c'], {
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
      } catch {
        // ignore cleanup errors
      }
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

  const wrapperPath = getNodeWrapperPath();

  const cppProcess = spawn('node', [wrapperPath, workDir, 'cpp'], {
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
      } catch {
        // ignore cleanup errors
      }
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

  const wrapperPath = getNodeWrapperPath();

  const javaProcess = spawn('node', [wrapperPath, workDir, 'java'], {
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
      } catch {
        // ignore cleanup errors
      }
    });
  }

  javaProcess.on('error', (err) => {
    logger.error(`[Local Java] process error: ${err.message}`);
    if (onExit) onExit(1);
  });

  return javaProcess;
};

module.exports = {
  killIfExists,
  execPython,
  execJava,
  execC,
  execCpp,
};
