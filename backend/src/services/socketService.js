const { v4: uuidv4 } = require('uuid');
const dockerService = require('./dockerService');
const config = require('../config');
const logger = require('../utils/logger');

const activeSessions = new Map();

const safeSend = (socket, data) => {
  try {
    if (socket && socket.readyState === 1) {
      // WebSocket.OPEN is 1
      socket.send(data);
    }
  } catch (err) {
    logger.error('Failed to send to client:', err);
  }
};

const cleanupAll = () => {
  logger.info('Cleaning up all active sessions...');
  for (const [sessionId, session] of activeSessions.entries()) {
    try {
      session.cleanup();
    } catch (e) {
      logger.error(`Error cleaning up session ${sessionId}:`, e);
    }
  }
  activeSessions.clear();
};

const handleConnection = (ws) => {
  if (activeSessions.size >= config.rateLimit.maxConcurrentConnections) {
    logger.warn('Max concurrent connections reached. Rejecting client.');
    ws.close(1008, 'Server busy');
    return;
  }

  logger.info('New client connected');

  const sessionId = uuidv4();
  let containerName = `interactive-${sessionId}`;
  let cProcess = null;
  let pythonProcess = null;
  let javaProcess = null;
  let lang = 'python';
  let suppressNextOutput = false;
  let fileBuffer = []; // Buffer to collect multiple files

  const cleanup = () => {
    dockerService.killIfExists(cProcess);
    dockerService.killIfExists(pythonProcess);
    dockerService.killIfExists(javaProcess);
    dockerService.removeContainer(containerName);
  };

  // Register session
  activeSessions.set(sessionId, { cleanup });

  const startSession = (newLang) => {
    cleanup();

    containerName = `interactive-${sessionId}-${newLang}`;
    suppressNextOutput = false;

    dockerService.launchContainer(newLang, containerName);

    if (newLang === 'python') {
      setTimeout(() => {
        pythonProcess = dockerService.execPython(
          containerName,
          (data) => safeSend(ws, data.toString()),
          (code) => logger.info(`Python wrapper exited with code ${code}`)
        );
      }, 1000);
    } else if (newLang === 'c') {
      setTimeout(() => {
        cProcess = dockerService.execC(
          containerName,
          (data) => {
            if (suppressNextOutput) {
              if (
                data.includes('✅') ||
                data.includes('❌') ||
                data.includes('...Program')
              ) {
                suppressNextOutput = false;
                safeSend(ws, data);
              }
              return;
            }
            safeSend(ws, data);
          },
          ({ exitCode }) => {
            logger.info(`C wrapper exited with code ${exitCode}`);
            suppressNextOutput = false;
          }
        );
      }, 1500);
    } else if (newLang === 'java') {
      setTimeout(() => {
        javaProcess = dockerService.execJava(
          containerName,
          (data) => safeSend(ws, data.toString()),
          (code) => logger.info(`Java wrapper exited with code ${code}`)
        );
      }, 1200);
    }
  };

  // Start default
  startSession(lang);

  ws.on('message', (msg) => {
    let parsed;
    try {
      parsed = JSON.parse(msg.toString());
    } catch {
      parsed = { type: 'stdin', data: msg.toString() };
    }

    if (parsed.type === 'lang') {
      lang = parsed.lang;
      startSession(lang);
    } else if (parsed.type === 'code') {
      // Multi-file support
      fileBuffer.push({
        name:
          parsed.filename ||
          'main' +
            (lang === 'python' ? '.py' : lang === 'java' ? '.java' : '.c'),
        content: parsed.data || '',
        isActive: parsed.activeFile || false,
      });

      // When we get the last file, execute
      if (parsed.isLast) {
        const activeFile = fileBuffer.find((f) => f.isActive) || fileBuffer[0];

        if (lang === 'python' && pythonProcess) {
          safeSend(ws, '\x1b[2J\x1b[H');
          // Send all files first, then execute the active file
          fileBuffer.forEach((file) => {
            file.content
              .split('\n')
              .forEach((line) => pythonProcess.stdin.write(line + '\n'));
          });
          pythonProcess.stdin.write('__RUN_CODE__\n');
        } else if (lang === 'c' && cProcess) {
          safeSend(ws, '\x1b[2J\x1b[H');
          suppressNextOutput = true;
          cProcess.write('__CODE_START__\r');
          activeFile.content
            .split('\n')
            .forEach((line) => cProcess.write(line + '\n'));
          cProcess.write('__RUN_CODE__\r');
        } else if (lang === 'java' && javaProcess) {
          safeSend(ws, '\x1b[2J\x1b[H');
          fileBuffer.forEach((file) => {
            file.content
              .split('\n')
              .forEach((line) => javaProcess.stdin.write(line + '\n'));
          });
          javaProcess.stdin.write('__RUN_CODE__\n');
        }

        fileBuffer = []; // Clear the buffer
      }
    } else if (parsed.type === 'stdin' || parsed.type === 'execute') {
      const inputData = parsed.data || parsed.code || '';

      if (lang === 'python' && pythonProcess) {
        if (parsed.type === 'execute') {
          safeSend(ws, '\x1b[2J\x1b[H');
          inputData
            .split('\n')
            .forEach((line) => pythonProcess.stdin.write(line + '\n'));
          pythonProcess.stdin.write('__RUN_CODE__\n');
        } else {
          pythonProcess.stdin.write(inputData + '\n');
        }
      } else if (lang === 'c' && cProcess) {
        if (parsed.type === 'execute') {
          safeSend(ws, '\x1b[2J\x1b[H');
          logger.info('[C] Sending code to compile');
          suppressNextOutput = true;
          cProcess.write('__CODE_START__\r');
          inputData.split('\n').forEach((line) => cProcess.write(line + '\n'));
          cProcess.write('__RUN_CODE__\r');
        } else {
          logger.info(`[C Input] ${inputData}`);
          cProcess.write(inputData + '\r');
        }
      } else if (lang === 'java' && javaProcess) {
        if (parsed.type === 'execute') {
          safeSend(ws, '\x1b[2J\x1b[H');
          inputData
            .split('\n')
            .forEach((line) => javaProcess.stdin.write(line + '\n'));
          javaProcess.stdin.write('__RUN_CODE__\n');
        } else {
          javaProcess.stdin.write(inputData + '\n');
        }
      } else {
        logger.warn('No process available for current language yet.');
      }
    }
  });

  ws.on('close', () => {
    logger.info('Client disconnected, cleaning up');
    cleanup();
    activeSessions.delete(sessionId);
  });

  ws.on('error', (err) => {
    logger.error(`WebSocket error: ${err}`);
    activeSessions.delete(sessionId);
  });
};

module.exports = { handleConnection, cleanupAll };
