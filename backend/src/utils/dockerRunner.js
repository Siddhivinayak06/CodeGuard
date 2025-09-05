// backend/src/utils/dockerRunner.js
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const DOCKER_BIN =
  process.platform === "win32"
    ? "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe"
    : "docker";

module.exports = function runPythonCode(code) {
  return new Promise((resolve, reject) => {
    // Always use /tmp inside backend container
    const tmpDir = "/tmp";
    const codeFile = path.join(tmpDir, "code.py");

    // Write Python code to /tmp/code.py
    fs.writeFileSync(codeFile, code);

    const args = [
      "run",
      "--rm",
      "--network", "none",
      "-m", "128m",
      "--cpus=0.5",
      "-v", `${tmpDir}:/tmp`,  // ✅ mount host /tmp to container /tmp
      "python:3",
      "python", "/tmp/code.py" // ✅ run file inside container
    ];

    console.log("🔹 Running command:", DOCKER_BIN, args.join(" "));

    const docker = spawn(DOCKER_BIN, args, { shell: false });

    let stdout = "";
    let stderr = "";

    docker.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    docker.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    docker.on("close", (code) => {
      console.log("🔹 Docker exited with code:", code);
      console.log("🔹 STDOUT:", stdout);
      console.log("🔹 STDERR:", stderr);

      if (code !== 0) {
        return reject(new Error(stderr || "Unknown Docker error"));
      }

      resolve({ output: stdout, error: stderr });
    });

    docker.on("error", (err) => {
      console.error("❌ Failed to run Docker:", err);
      reject(new Error(`Failed to run Docker: ${err.message}`));
    });
  });
};
