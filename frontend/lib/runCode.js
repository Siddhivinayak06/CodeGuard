const { spawn } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");

/**
 * Run user code inside Docker (Python or C)
 * Both use unique folders now.
 */
module.exports = function runCode(code, lang = "python", stdinInput = "") {
  return new Promise((resolve, reject) => {
    let docker;
    let stdout = "";
    let stderr = "";

    const MAX_OUTPUT = 10000; // 10 KB max output to prevent flooding
    let timedOut = false;

    if (lang === "python") {
      const uniqueId = uuidv4();
      const escapedCode = code.replace(/\r/g, "");

      const cmd = `
        mkdir -p /tmp/${uniqueId} &&
        printf "%s" '${escapedCode.replace(/'/g, "'\\''")}' > /tmp/${uniqueId}/code.py &&
        printf "%s" '${stdinInput.replace(/'/g, "'\\''")}' | timeout 5 python /tmp/${uniqueId}/code.py
      `;

      docker = spawn("docker", [
        "run",
        "--rm",
        "--network", "none",
        "-m", "128m",
        "--cpus=0.5",
        "codeguard-python",
        "sh",
        "-c",
        cmd,
      ], { shell: false });

    } else if (lang === "c") {
      const uniqueId = uuidv4();
      const escapedCode = code.replace(/\r/g, "");

      const cmd = `
        mkdir -p /tmp/${uniqueId} &&
        printf "%s" '${escapedCode.replace(/'/g, "'\\''")}' > /tmp/${uniqueId}/code.c &&
        gcc /tmp/${uniqueId}/code.c -o /tmp/${uniqueId}/a.out &&
        printf "%s" '${stdinInput.replace(/'/g, "'\\''")}' | timeout 5 /tmp/${uniqueId}/a.out
      `;

      docker = spawn("docker", [
        "run",
        "--rm",
        "--network", "none",
        "-m", "128m",
        "--cpus=0.5",
        "-u", "0:0",
        "gcc:latest",
        "sh",
        "-c",
        cmd,
      ], { shell: false });

    } else {
      return reject(new Error("Unsupported language"));
    }

    // ✅ Truncate stdout if it exceeds MAX_OUTPUT to prevent crashes
    docker.stdout.on("data", (data) => {
      stdout += data.toString();
      if (stdout.length > MAX_OUTPUT) {
        stdout = stdout.slice(0, MAX_OUTPUT) + "\n[Output truncated]";
        timedOut = true;
        docker.kill();
      }
    });

    docker.stderr.on("data", (data) => (stderr += data.toString()));

    docker.on("close", (exitCode) => {
      if (timedOut && stdout.includes("[Output truncated]")) {
        resolve({
          output: stdout.trim(),
          error: "Time Limit Exceeded (possible infinite loop)",
          exitCode: 124,
        });
        return;
      }

      let cleanError = stderr
        .replace(/\/tmp\/[a-f0-9-]+\/code\.(py|c)/g, "")
        .replace(/File ""(, )?/g, "");

      if (exitCode === 124) {
        cleanError = "Time Limit Exceeded (possible infinite loop)";
      }

      resolve({
        output: stdout.trim(),
        error: cleanError.trim(),
        exitCode,
      });
    });

    docker.on("error", (err) => {
      reject(new Error(`Docker failed: ${err.message}`));
    });
  });
};