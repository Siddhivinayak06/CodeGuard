const { spawn } = require('child_process');
const pty = require('@lydell/node-pty');
const config = require('../config');
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

const removeContainer = (name) => {
  try {
    spawn('docker', ['rm', '-f', name]);
  } catch (_e) {
    // ignore
  }
};

const launchContainer = (lang, containerName) => {
  logger.info(`Starting container for language: ${lang}`);

  let runArgs = [];
  if (lang === 'python') {
    runArgs = [
      'run',
      '--rm',
      '--name',
      containerName,
      '-d',
      '--network',
      'none',
      '-m',
      config.docker.memory,
      '--cpus=' + config.docker.cpus,
      '--pids-limit',
      config.docker.pidsLimit,
      '--security-opt=no-new-privileges',
      '--read-only',
      '--tmpfs',
      '/tmp:exec,rw,size=128m',
      '--tmpfs',
      '/app/workspace:exec,rw,size=256m,uid=1000,gid=1000,mode=1777',
      'codeguard-python',
      'tail',
      '-f',
      '/dev/null',
    ];
  } else if (lang === 'c' || lang === 'cpp') {
    // C and C++ share the same container (has both gcc and g++)
    runArgs = [
      'run',
      '--rm',
      '--name',
      containerName,
      '-d',
      '--network',
      'none',
      '-m',
      config.docker.memory,
      '--cpus=' + config.docker.cpus,
      '--pids-limit',
      config.docker.pidsLimit,
      '--security-opt=no-new-privileges',
      '--tmpfs',
      '/app/workspace:exec,rw,size=256m,uid=1000,gid=1000,mode=1777',
      '-e',
      `LANG_MODE=${lang}`, // Pass language mode to container
      'codeguard-c',
      'tail',
      '-f',
      '/dev/null',
    ];
  } else if (lang === 'java') {
    runArgs = [
      'run',
      '--rm',
      '--name',
      containerName,
      '-d',
      '--network',
      'none',
      '-m',
      config.docker.javaMemory,
      '--cpus=' + config.docker.cpus,
      '--pids-limit',
      config.docker.javaPidsLimit,
      '--security-opt=no-new-privileges',
      '--tmpfs',
      '/tmp:exec,rw,size=128m',
      '--tmpfs',
      '/workspace:exec,rw,size=256m,uid=1000,gid=1000,mode=1777',
      'codeguard-java',
      'tail',
      '-f',
      '/dev/null',
    ];
  }

  if (runArgs.length > 0) {
    try {
      const proc = spawn('docker', runArgs);
      proc.on('error', (err) => {
        logger.error(`Failed to spawn docker for ${lang}:`, err);
      });
    } catch (e) {
      logger.error(`Exception spawning docker for ${lang}:`, e);
    }
  }
};

const execPython = (containerName, onData, onExit) => {
  const pythonProcess = spawn(
    'docker',
    [
      'exec',
      '-i',
      containerName,
      'python3',
      '-u',
      '/app/interactive_wrapper.py',
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] }
  );

  pythonProcess.stdout.on('data', onData);
  pythonProcess.stderr.on('data', (data) => {
    logger.error(`Python stderr: ${data.toString()}`);
    onData(data);
  });

  if (onExit) {
    pythonProcess.on('exit', (code) => {
      if (code !== 0) {
        logger.error(`Python process exited with non-zero code: ${code}`);
      }
      onExit(code);
    });
  }

  return pythonProcess;
};

const execJava = (containerName, onData, onExit) => {
  const javaProcess = spawn(
    'docker',
    [
      'exec',
      '-i',
      '-u',
      'runner',
      containerName,
      'java',
      '-jar',
      '/app/interactive_wrapper.jar',
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] }
  );

  javaProcess.stdout.on('data', onData);
  javaProcess.stderr.on('data', onData);

  if (onExit) {
    javaProcess.on('exit', onExit);
  }

  return javaProcess;
};

const execC = (containerName, onData, onExit) => {
  logger.info('Starting C wrapper process inside container');

  // Use child_process.spawn instead of pty to avoid TTY issues in Docker
  const cProcess = spawn(
    'docker',
    [
      'exec',
      '-i',
      '-u',
      'runner',
      '-e',
      'COMPILER=gcc',
      containerName,
      '/app/interactive_wrapper.out',
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] }
  );

  cProcess.stdout.on('data', (data) => onData(data.toString()));
  cProcess.stderr.on('data', (data) => onData(data.toString()));

  if (onExit) {
    cProcess.on('exit', (code) => onExit({ exitCode: code }));
  }

  cProcess.on('error', (err) => {
    logger.error('C process error:', err.message);
    if (onExit) onExit({ exitCode: 1 });
  });

  // Add a write method to match the interface used in socketService
  cProcess.write = (data) => {
    if (cProcess.stdin && cProcess.stdin.writable) {
      cProcess.stdin.write(data);
    }
  };

  return cProcess;
};

const execCpp = (containerName, onData, onExit) => {
  logger.info('Starting C++ wrapper process inside container');

  // Use child_process.spawn instead of pty to avoid TTY issues in Docker
  const cppProcess = spawn(
    'docker',
    [
      'exec',
      '-i',
      '-u',
      'runner',
      '-e',
      'COMPILER=g++',
      containerName,
      '/app/interactive_wrapper.out',
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] }
  );

  cppProcess.stdout.on('data', (data) => onData(data.toString()));
  cppProcess.stderr.on('data', (data) => onData(data.toString()));

  if (onExit) {
    cppProcess.on('exit', (code) => onExit({ exitCode: code }));
  }

  cppProcess.on('error', (err) => {
    logger.error('C++ process error:', err.message);
    if (onExit) onExit({ exitCode: 1 });
  });

  // Add a write method to match the interface used in socketService
  cppProcess.write = (data) => {
    if (cppProcess.stdin && cppProcess.stdin.writable) {
      cppProcess.stdin.write(data);
    }
  };

  return cppProcess;
};

module.exports = {
  killIfExists,
  removeContainer,
  launchContainer,
  execPython,
  execJava,
  execC,
  execCpp,
};
