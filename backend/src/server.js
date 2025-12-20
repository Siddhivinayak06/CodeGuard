// server.js
const http = require('http');
const WebSocket = require('ws');
const app = require('./app');
const socketService = require('./services/socketService');
const config = require('./config');
const logger = require('./utils/logger');
const poolManager = require('./services/poolManager');

const PORT = config.port;
const server = http.createServer(app);

// Attach a WebSocket server to the same HTTP server
const wss = new WebSocket.Server({ server });

logger.info(`Initializing CodeGuard server`, {
  port: PORT,
  nodeEnv: config.nodeEnv,
});

wss.on('connection', socketService.handleConnection);

// Initialize Pool
poolManager.initialize().catch((err) => {
  logger.error('Failed to initialize container pool', { error: err.message });
});

// Start the server
server.listen(PORT, () => {
  logger.info(`Server started successfully`, {
    http: `http://localhost:${PORT}`,
    ws: `ws://localhost:${PORT}`,
  });
});

// Graceful Shutdown
const shutdown = (signal) => {
  logger.warn(`Received ${signal}, shutting down gracefully`);

  server.close(async () => {
    logger.info('HTTP server closed');
    socketService.cleanupAll();
    logger.info('WebSocket connections cleaned up');
    await poolManager.cleanup();
    process.exit(0);
  });

  setTimeout(() => {
    logger.error(
      'Could not close connections in time, forcefully shutting down'
    );
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});
