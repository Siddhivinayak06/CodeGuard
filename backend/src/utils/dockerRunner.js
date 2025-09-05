const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const DOCKER_BIN =
  process.platform === "win32"
    ? "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe"
    : "docker";

/**
 * Run user code in Docker (Python or C)
 * @param {string} code - Source code
 * @param {string} lang - "python" | "c"
 * @param {string} stdinInput - Optional user input (for scanf/input)
 */
module.exports = function runCode(code, lang = "python", stdinInput = "") {
  return new Promise((resolve, reject) => {
    const tmpDir = "/tmp"; // ✅ shared volume between host & container
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    let codeFile;
    let args;

    if (lang === "python") {
      codeFile = path.join(tmpDir, "code.py");
      fs.writeFileSync(codeFile, code);

      args = [
        "run",
        "--rm",
        "--network", "none",
        "-m", "128m",
        "--cpus=0.5",
        "-v", "/tmp:/tmp",
        "codeguard-python",
        "timeout", "5", // ⏱️ kill if runs longer than 5 sec
        "python", "/tmp/code.py",
      ];
    } else if (lang === "c") {
      codeFile = path.join(tmpDir, "code.c");
      fs.writeFileSync(codeFile, code);

      args = [
        "run",
        "--rm",
        "--network", "none",
        "-m", "128m",
        "--cpus=0.5",
        "-v", "/tmp:/tmp",
        "codeguard-c",
        "sh", "-c",
        "gcc /tmp/code.c -o /tmp/a.out && timeout 5 /tmp/a.out",
      ];
    } else {
      return reject(new Error("Unsupported language"));
    }

    console.log("🔹 Running command:", DOCKER_BIN, args.join(" "));

    const docker = spawn(DOCKER_BIN, args, { shell: false });

    let stdout = "";
    let stderr = "";

    // ✅ Pipe input if provided
    if (stdinInput) {
      docker.stdin.write(stdinInput + "\n");
      docker.stdin.end();
    }

    docker.stdout.on("data", (data) => (stdout += data.toString()));
    docker.stderr.on("data", (data) => (stderr += data.toString()));

    docker.on("close", (code) => {
      console.log("🔹 Docker exited with code:", code);
      console.log("🔹 STDOUT:", stdout);
      console.log("🔹 STDERR:", stderr);

      if (code !== 0) {
        return reject(new Error(stderr || "Execution error"));
      }

      resolve({ output: stdout.trim(), error: stderr.trim() });
    });

    docker.on("error", (err) => {
      console.error("❌ Failed to run Docker:", err);
      reject(new Error(`Failed to run Docker: ${err.message}`));
    });
  });
};
