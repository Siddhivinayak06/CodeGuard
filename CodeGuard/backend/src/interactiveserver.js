
const WebSocket = require("ws");
const { spawn } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const pty = require("@lydell/node-pty");

const PORT = process.env.INTERACTIVE_PORT || 5001;
const wss = new WebSocket.Server({ port: PORT });

console.log(`WebSocket server running on ws://localhost:${PORT}`);

wss.on("connection", (ws) => {
  console.log("New client connected");

  const sessionId = uuidv4();
  let containerName = `interactive-${sessionId}`;
  let cProcess = null;       // for C wrapper
  let pythonProcess = null;  // for Python wrapper
  let lang = "python";       // default language
  let cCodeBuffer = [];      // buffer for C code collection
  let isCollectingCode = false;

  const startContainer = (newLang) => {
    console.log(`Starting container for language: ${newLang}`);

    // Cleanup previous containers/processes
    if (cProcess) {
      console.log("Killing previous C process");
      cProcess.kill();
      spawn("docker", ["rm", "-f", containerName]);
      cProcess = null;
    }
    if (pythonProcess) {
      pythonProcess.kill();
      spawn("docker", ["rm", "-f", containerName]);
      pythonProcess = null;
    }

    containerName = `interactive-${sessionId}-${newLang}`;
    cCodeBuffer = [];
    isCollectingCode = false;

    if (newLang === "python") {
      // Python remains unchanged
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

      setTimeout(() => {
        pythonProcess = spawn("docker", [
          "exec", "-i", containerName,
          "python", "-u", "/app/interactive_wrapper.py"
        ], { stdio: ["pipe", "pipe", "pipe"] });

        pythonProcess.stdout.on("data", data => ws.send(data.toString()));
        pythonProcess.stderr.on("data", data => ws.send(data.toString()));

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
          env: process.env
        });

        cProcess.onData(data => {
          ws.send(data);
        });

        cProcess.onExit(({ exitCode }) => {
          console.log(`C wrapper exited with code ${exitCode}`);
          ws.send(`\n⚠️ C wrapper process exited with code ${exitCode}\n`);
        });
      }, 1500);
    }

    // Don't send ready messages - wrapper will send its own
  };

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
          inputData.split("\n").forEach(line => pythonProcess.stdin.write(line + "\n"));
          pythonProcess.stdin.write("__RUN_CODE__\n");
        } else {
          pythonProcess.stdin.write(inputData + "\n");
        }
      } else if (lang === "c" && cProcess) {
        if (parsed.type === "execute") {
          console.log("[C] Sending code to compile");
          cProcess.write("__CODE_START__\r");
          inputData.split("\n").forEach(line => {
            cProcess.write(line + "\r");
          });
          cProcess.write("__RUN_CODE__\r");
        } else {
          console.log(`[C Input] ${inputData}`);
          cProcess.write(inputData + "\r");
        }
      }
    } else if (parsed.type === "code_start" && lang === "c" && cProcess) {
      isCollectingCode = true;
      cCodeBuffer = [];
      cProcess.write("__CODE_START__\r");
    } else if (parsed.type === "code_line" && lang === "c" && cProcess && isCollectingCode) {
      cCodeBuffer.push(parsed.data);
      cProcess.write(parsed.data + "\r");
    } else if (parsed.type === "run_code" && lang === "c" && cProcess && isCollectingCode) {
      isCollectingCode = false;
      cProcess.write("__RUN_CODE__\r");
    }
  });

  ws.on("close", () => {
    if (cProcess) cProcess.kill();
    if (pythonProcess) pythonProcess.kill();
    spawn("docker", ["rm", "-f", containerName]);
  });

  ws.on("error", (err) => {
    console.error(`WebSocket error: ${err}`);
  });
}); 