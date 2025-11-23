// server.js
const http = require("http");
const WebSocket = require("ws");
const app = require("./app");
const socketService = require("./services/socketService");
const config = require("./config");

const PORT = config.port;
const server = http.createServer(app);

// Attach a WebSocket server to the same HTTP server
const wss = new WebSocket.Server({ server });

console.log(`HTTP server + WebSocket will run on port ${PORT}`);

wss.on("connection", socketService.handleConnection);

// Start the server
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`WebSocket available at ws://localhost:${PORT}`);
});

// Graceful Shutdown
const shutdown = () => {
  console.log("Received kill signal, shutting down gracefully");
  server.close(() => {
    console.log("Closed out remaining connections");
    socketService.cleanupAll();
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
