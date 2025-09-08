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

    if (lang === "python") {
      // Python part (unique folder per execution)
      const uniqueId = uuidv4();
      const escapedCode = code.replace(/\r/g, ""); // remove CR from Windows endings

      // ✅ Pipe stdinInput directly into python process
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

      console.log("🔹 Running Python code with Docker in unique folder");
    } else if (lang === "c") {
      // C part (unique folder, root user)
      const uniqueId = uuidv4();
      const escapedCode = code.replace(/\r/g, "");

      // ✅ Pipe stdinInput directly into compiled C program
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

      console.log("🔹 Running C code with Docker");
    } else {
      return reject(new Error("Unsupported language"));
    }

    docker.stdout.on("data", (data) => (stdout += data.toString()));
    docker.stderr.on("data", (data) => (stderr += data.toString()));

    docker.on("close", (exitCode) => {
      // ✅ Remove temp folder/file references from error
      const cleanError = stderr.replace(/\/tmp\/[a-f0-9\-]+\/code\.(py|c)/g, "");

      resolve({
        output: stdout.trim(),
        error: cleanError.trim(),
        exitCode,
      });

      // optional cleanup (disabled if you want to debug)
      // try {
      //   fs.rmSync(`/tmp/${uniqueId}`, { recursive: true, force: true });
      // } catch {}
    });

    docker.on("error", (err) => {
      reject(new Error(`Docker failed: ${err.message}`));
    });
  });
};
