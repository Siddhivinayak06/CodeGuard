// server.js
const http = require("http");
const WebSocket = require("ws");
const { spawn } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const pty = require("@lydell/node-pty");

const app = require("./app"); // your express app (the file you showed exports `app`)

const PORT = process.env.INTERACTIVE_PORT || process.env.PORT || 5002;
const server = http.createServer(app);

// Attach a WebSocket server to the same HTTP server
const wss = new WebSocket.Server({ server });

console.log(`HTTP server + WebSocket will run on port ${PORT}`);

wss.on("connection", (ws, req) => {
  console.log("New client connected");

  const sessionId = uuidv4();
  let containerName = `interactive-${sessionId}`;
  let cProcess = null;       // for C wrapper (pty)
  let pythonProcess = null;  // for Python wrapper
  let lang = "python";       // default language
  let cCodeBuffer = [];      // buffer for C code collection (if needed)
  let isCollectingCode = false;
  let suppressNextOutput = false;

  const safeSend = (socket, data) => {
    try {
      if (socket && socket.readyState === WebSocket.OPEN) socket.send(data);
    } catch (err) {
      console.error("Failed to send to client:", err);
    }
  };

  const startContainer = (newLang) => {
    console.log(`Starting container for language: ${newLang}`);

    // Cleanup previous processes/containers
    try {
      if (cProcess) {
        console.log("Killing previous C process");
        try { cProcess.kill(); } catch(e){/*ignore*/ }
        spawn("docker", ["rm", "-f", containerName]);
        cProcess = null;
      }
      if (pythonProcess) {
        try { pythonProcess.kill(); } catch(e){/*ignore*/ }
        spawn("docker", ["rm", "-f", containerName]);
        pythonProcess = null;
      }
    } catch (cleanupErr) {
      console.error("Error during cleanup:", cleanupErr);
    }

    containerName = `interactive-${sessionId}-${newLang}`;
    cCodeBuffer = [];
    isCollectingCode = false;
    suppressNextOutput = false;

    if (newLang === "python") {
      const runArgs = [
        "run",
        "--rm",
        "--name", containerName,
        "-d",
        "--network", "none",
        "-m", "128m",
        "--cpus=0.5",
        "--pids-limit", "64",
        "--read-only",
        "--tmpfs", "/tmp:exec,rw,size=128m",
        "codeguard-python",
        "tail", "-f", "/dev/null"
      ];
      spawn("docker", runArgs);

      // small delay so container is up before exec
      setTimeout(() => {
        pythonProcess = spawn("docker", [
          "exec", "-i", containerName,
          "python", "-u", "/app/interactive_wrapper.py"
        ], { stdio: ["pipe", "pipe", "pipe"] });

        pythonProcess.stdout.on("data", data => safeSend(ws, data.toString()));
        pythonProcess.stderr.on("data", data => safeSend(ws, data.toString()));

        pythonProcess.on("exit", (code) => {
          console.log(`Python wrapper exited with code ${code}`);
        });
      }, 1000);
    } else if (newLang === "c") {
      console.log("Launching C container in detached mode");

      const runArgs = [
        "run",
        "--rm",
        "--name", containerName,
        "-d",
        "--network", "none",
        "-m", "128m",
        "--cpus=0.5",
        "--pids-limit", "64",
        "--tmpfs", "/app/workspace:exec,rw,size=64m,uid=1000,gid=1000,mode=1777",
        "codeguard-c",
        "tail", "-f", "/dev/null"
      ];

      spawn("docker", runArgs);

      setTimeout(() => {
        console.log("Starting C wrapper process inside container with node-pty");

        cProcess = pty.spawn("docker", [
          "exec",
          "-it",
          "-u", "runner",
          containerName,
          "/app/interactive_wrapper.out"
        ], {
          name: "xterm-color",
          cols: 80,
          rows: 24,
          cwd: process.cwd(),
          env: process.env,
        });

        cProcess.onData(data => {
          // If suppressNextOutput is true, skip echoed code lines but allow compilation/program output.
          if (suppressNextOutput) {
            // Allow compilation messages and program output through when wrapper sends markers
            if (data.includes("✅") || data.includes("❌") || data.includes("...Program")) {
              suppressNextOutput = false; // stop suppressing on result markers
              safeSend(ws, data);
            }
            // otherwise skip echoed code lines
            return;
          }
          safeSend(ws, data);
        });

        cProcess.onExit(({ exitCode }) => {
          console.log(`C wrapper exited with code ${exitCode}`);
          suppressNextOutput = false;
        });
      }, 1500);
    }

    // wrapper process will send its own ready messages
  };

  // start default language container
  startContainer(lang);

  ws.on("message", (msg) => {
    let parsed;
    try {
      parsed = JSON.parse(msg.toString());
    } catch {
      parsed = { type: "stdin", data: msg.toString() };
    }

    if (parsed.type === "lang") {
      lang = parsed.lang;
      startContainer(lang);
    } else if (parsed.type === "stdin" || parsed.type === "execute") {
      const inputData = parsed.data || parsed.code || "";

      if (lang === "python" && pythonProcess) {
        if (parsed.type === "execute") {
          // Send clear screen ANSI code before executing
          safeSend(ws, "\x1b[2J\x1b[H");
          inputData.split("\n").forEach(line => pythonProcess.stdin.write(line + "\n"));
          pythonProcess.stdin.write("__RUN_CODE__\n");
        } else {
          pythonProcess.stdin.write(inputData + "\n");
        }
      } else if (lang === "c" && cProcess) {
        if (parsed.type === "execute") {
          safeSend(ws, "\x1b[2J\x1b[H");
          console.log("[C] Sending code to compile");

          suppressNextOutput = true; // prevent echo of code lines
          cProcess.write("__CODE_START__\r");
          inputData.split("\n").forEach(line => {
            // pty expects \r for enter on many terminals; keep newline as well for wrappers that expect it
            cProcess.write(line + "\n");
          });
          cProcess.write("__RUN_CODE__\r");
        } else {
          console.log(`[C Input] ${inputData}`);
          cProcess.write(inputData + "\r");
        }
      } else {
        console.warn("No process available for current language yet.");
      }
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected, cleaning up");
    try { if (cProcess) cProcess.kill(); } catch(e){}
    try { if (pythonProcess) pythonProcess.kill(); } catch(e){}
    spawn("docker", ["rm", "-f", containerName]);
  });

  ws.on("error", (err) => {
    console.error(`WebSocket error: ${err}`);
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`WebSocket available at ws://localhost:${PORT}`);
});
