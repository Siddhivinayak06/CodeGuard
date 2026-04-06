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

const MAIN_METHOD_RE = /\\bpublic\\s+static\\s+void\\s+main\\s*\\(/;
const PACKAGE_RE = /^\\s*package\\s+([a-zA-Z0-9_.]+)\\s*;/m;
const APPLET_CLASS_RE =
  /(?:public\\s+)?class\\s+([A-Za-z_][A-Za-z0-9_]*)\\s+extends\\s+(?:java\\.applet\\.Applet|javax\\.swing\\.JApplet|Applet|JApplet)\\b/;

function normalizeRelPath(fileName) {
  return String(fileName || '').replace(/\\\\/g, '/').replace(/^[/]+/, '');
}

function resolveSafePath(baseDir, relativePath) {
  const normalized = normalizeRelPath(relativePath);
  const absoluteBase = path.resolve(baseDir);
  const absoluteTarget = path.resolve(baseDir, normalized);

  if (
    absoluteTarget !== absoluteBase &&
    !absoluteTarget.startsWith(absoluteBase + path.sep)
  ) {
    throw new Error('Invalid path: ' + relativePath);
  }

  return absoluteTarget;
}

function writeBufferedFile(baseDir, fileName, contentLines) {
  const relative = normalizeRelPath(fileName);
  if (!relative) return;

  const targetPath = resolveSafePath(baseDir, relative);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, contentLines.join('\\n'));
}

function listFilesRecursive(rootDir, extension) {
  const stack = [rootDir];
  const files = [];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else if (entry.isFile() && entry.name.endsWith(extension)) {
        files.push(entryPath);
      }
    }
  }

  files.sort((a, b) => a.localeCompare(b));
  return files;
}

function resolveMainClassFromSource(source) {
  if (!MAIN_METHOD_RE.test(source)) {
    return null;
  }

  const mainMatch = source.match(MAIN_METHOD_RE);
  const mainIndex = mainMatch && typeof mainMatch.index === 'number'
    ? mainMatch.index
    : -1;

  const classRegex = /^(?:public\\s+)?class\\s+([A-Za-z_][A-Za-z0-9_]*)/gm;
  const beforeMain = mainIndex >= 0 ? source.slice(0, mainIndex) : source;

  let className = null;
  let classMatch;
  while ((classMatch = classRegex.exec(beforeMain)) !== null) {
    className = classMatch[1];
  }

  if (!className) {
    const anyClassMatch = source.match(
      /^(?:public\\s+)?class\\s+([A-Za-z_][A-Za-z0-9_]*)/m
    );
    className = anyClassMatch ? anyClassMatch[1] : null;
  }

  if (!className) {
    return null;
  }

  const pkgMatch = source.match(PACKAGE_RE);
  return pkgMatch ? pkgMatch[1] + '.' + className : className;
}

function resolveJavaMainClass(baseDir, preferredFile) {
  const preferred = normalizeRelPath(preferredFile);
  if (preferred) {
    try {
      const preferredPath = resolveSafePath(baseDir, preferred);
      if (fs.existsSync(preferredPath)) {
        const source = fs.readFileSync(preferredPath, 'utf-8');
        const className = resolveMainClassFromSource(source);
        if (className) {
          return className;
        }
      }
    } catch (_err) {
      // Fall through and search all files.
    }
  }

  const javaFiles = listFilesRecursive(baseDir, '.java');
  for (const javaFile of javaFiles) {
    try {
      const source = fs.readFileSync(javaFile, 'utf-8');
      const className = resolveMainClassFromSource(source);
      if (className) {
        return className;
      }
    } catch (_err) {
      // Ignore unreadable files and continue.
    }
  }

  return '';
}

function resolveAppletClassFromSource(source) {
  const appletMatch = source.match(APPLET_CLASS_RE);
  if (!appletMatch) return null;

  const className = appletMatch[1];
  const pkgMatch = source.match(PACKAGE_RE);
  const packageName = pkgMatch ? pkgMatch[1] : null;
  const fqcn = packageName ? packageName + '.' + className : className;

  return { className, packageName, fqcn };
}

function resolveJavaAppletTarget(baseDir, preferredFile) {
  const preferred = normalizeRelPath(preferredFile);
  if (preferred) {
    try {
      const preferredPath = resolveSafePath(baseDir, preferred);
      if (fs.existsSync(preferredPath)) {
        const source = fs.readFileSync(preferredPath, 'utf-8');
        const appletTarget = resolveAppletClassFromSource(source);
        if (appletTarget) {
          return appletTarget;
        }
      }
    } catch (_err) {
      // Fall through and search all files.
    }
  }

  const javaFiles = listFilesRecursive(baseDir, '.java');
  for (const javaFile of javaFiles) {
    try {
      const source = fs.readFileSync(javaFile, 'utf-8');
      const appletTarget = resolveAppletClassFromSource(source);
      if (appletTarget) {
        return appletTarget;
      }
    } catch (_err) {
      // Ignore unreadable files and continue.
    }
  }

  return null;
}

function buildMainLauncherSource(mainFqcn) {
  const lastDot = mainFqcn.lastIndexOf('.');
  const packageName = lastDot > 0 ? mainFqcn.slice(0, lastDot) : null;
  const packageDecl = packageName ? 'package ' + packageName + ';\\n' : '';
  return (
    packageDecl +
    'public class __RunnerLauncher {\\n' +
    '  public static void main(String[] args) {\\n' +
    '    try {\\n' +
    '      java.lang.reflect.Method mainMethod = Class.forName("' + mainFqcn + '").getMethod("main", String[].class);\\n' +
    '      mainMethod.invoke(null, (Object) args);\\n' +
    '    } catch (Throwable t) {\\n' +
    '      Throwable cause = (t instanceof java.lang.reflect.InvocationTargetException && t.getCause() != null) ? t.getCause() : t;\\n' +
    '      if (cause instanceof java.awt.HeadlessException) {\\n' +
    '        System.out.println("GUI execution skipped in headless environment.");\\n' +
    '        return;\\n' +
    '      }\\n' +
    '      cause.printStackTrace();\\n' +
    '      System.exit(1);\\n' +
    '    }\\n' +
    '  }\\n' +
    '}\\n'
  );
}

function buildAppletLauncherSource(packageName, appletFqcn) {
  const packageDecl = packageName ? 'package ' + packageName + ';\\n' : '';
  return (
    packageDecl +
    'public class __RunnerLauncher {\\n' +
    '  public static void main(String[] args) {\\n' +
    '    System.setProperty("java.awt.headless", "true");\\n' +
    '    try {\\n' +
    '      Object instance = Class.forName("' + appletFqcn + '").getDeclaredConstructor().newInstance();\\n' +
    '      if (instance instanceof java.applet.Applet) {\\n' +
    '        java.applet.Applet applet = (java.applet.Applet) instance;\\n' +
    '        applet.init();\\n' +
    '        applet.start();\\n' +
    '        java.awt.image.BufferedImage canvas = new java.awt.image.BufferedImage(1, 1, java.awt.image.BufferedImage.TYPE_INT_ARGB);\\n' +
    '        java.awt.Graphics2D g = canvas.createGraphics();\\n' +
    '        applet.paint(g);\\n' +
    '        g.dispose();\\n' +
    '      }\\n' +
    '      System.out.println("Applet executed in headless mode.");\\n' +
    '    } catch (Throwable t) {\\n' +
    '      Throwable cause = (t instanceof java.lang.reflect.InvocationTargetException && t.getCause() != null) ? t.getCause() : t;\\n' +
    '      if (cause instanceof java.awt.HeadlessException) {\\n' +
    '        System.out.println("Applet compiled successfully (headless runtime skipped).");\\n' +
    '        return;\\n' +
    '      }\\n' +
    '      t.printStackTrace();\\n' +
    '      System.exit(1);\\n' +
    '    }\\n' +
    '  }\\n' +
    '}\\n'
  );
}

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false
});

let currentFile = null;
let files = {};

rl.on('line', (line) => {
  if (line.startsWith('__FILE_START__ ')) {
    currentFile = normalizeRelPath(line.substring(15).trim());
    files[currentFile] = [];
  } else if (line === '__RUN_CODE__') {
    const mainFileHint = currentFile;

    // Write files
    for (const [fname, contentLines] of Object.entries(files)) {
      try {
        writeBufferedFile(workDir, fname, contentLines);
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
          stdio: ['inherit', 'inherit', 'inherit'], 
          cwd: workDir,
          shell: isWindows 
        });
        if (comp.status === 0) {
          spawnSync(exeFile, [], { stdio: ['inherit', 'inherit', 'inherit'], cwd: workDir });
        }
      }
    } else if (lang === 'java') {
      const javaFiles = listFilesRecursive(workDir, '.java');
      if (javaFiles.length === 0) {
        console.error('No Java files found to compile');
      } else {
        const relativeJavaFiles = javaFiles.map((f) => path.relative(workDir, f));
        const comp = spawnSync('javac', ['-g:none', ...relativeJavaFiles], {
          stdio: ['inherit', 'inherit', 'inherit'],
          cwd: workDir,
          shell: isWindows,
        });

        if (comp.status === 0) {
          let runClass = resolveJavaMainClass(workDir, mainFileHint);

          if (runClass) {
            const launcherFile = path.join(workDir, '__RunnerLauncher.java');
            fs.writeFileSync(launcherFile, buildMainLauncherSource(runClass));

            const launcherComp = spawnSync('javac', ['-cp', '.', '__RunnerLauncher.java'], {
              stdio: ['inherit', 'inherit', 'inherit'],
              cwd: workDir,
              shell: isWindows,
            });

            if (launcherComp.status === 0) {
              const pkgName = runClass.includes('.')
                ? runClass.slice(0, runClass.lastIndexOf('.'))
                : '';
              runClass = pkgName ? pkgName + '.__RunnerLauncher' : '__RunnerLauncher';
            }
          } else {
            const appletTarget = resolveJavaAppletTarget(workDir, mainFileHint);
            if (appletTarget) {
              const launcherFile = path.join(workDir, '__RunnerLauncher.java');
              fs.writeFileSync(
                launcherFile,
                buildAppletLauncherSource(appletTarget.packageName, appletTarget.fqcn)
              );

              const launcherComp = spawnSync('javac', ['-cp', '.', '__RunnerLauncher.java'], {
                stdio: ['inherit', 'inherit', 'inherit'],
                cwd: workDir,
                shell: isWindows,
              });

              if (launcherComp.status === 0) {
                runClass = appletTarget.packageName
                  ? appletTarget.packageName + '.__RunnerLauncher'
                  : '__RunnerLauncher';
              }
            }
          }

          if (runClass) {
            spawnSync('java', ['-XX:+UseSerialGC', '-Xmx128M', '-cp', '.', runClass], {
              stdio: ['inherit', 'inherit', 'inherit'],
              cwd: workDir,
            });
          } else {
            console.error('No class with a main method or applet entry was found');
          }
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
