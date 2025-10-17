const { spawn } = require("child_process");
const { v4: uuidv4 } = require("uuid");

/**
 * Run batch of test cases inside Docker (Python or C)
 */
module.exports = async function runBatchCode(code, lang = "python", batch = []) {
  const results = [];

  for (const tc of batch) {
    const { stdinInput = "", time_limit_ms = 5000, memory_limit_kb = 65536 } = tc;
    let docker;
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const uniqueId = uuidv4();
    const escapedCode = code.replace(/\r/g, "");

    if (lang === "python") {
      const cmd = `
mkdir -p /tmp/${uniqueId} &&
printf "%s" '${escapedCode.replace(/'/g, "'\\''")}' > /tmp/${uniqueId}/code.py &&
printf "%s" '${stdinInput.replace(/'/g, "'\\''")}' | timeout ${Math.ceil(time_limit_ms / 1000)} python /tmp/${uniqueId}/code.py
`;

      docker = spawn("docker", [
        "run", "--rm", "--network", "none", "-m", `${memory_limit_kb}k`,
        "--cpus=0.5", "codeguard-python", "sh", "-c", cmd
      ]);

    } else if (lang === "c") {
      const cmd = `
mkdir -p /tmp/${uniqueId} &&
printf "%s" '${escapedCode.replace(/'/g, "'\\''")}' > /tmp/${uniqueId}/code.c &&
gcc /tmp/${uniqueId}/code.c -o /tmp/${uniqueId}/a.out -lm &&
printf "%s" '${stdinInput.replace(/'/g, "'\\''")}' | timeout ${Math.ceil(time_limit_ms / 1000)} /tmp/${uniqueId}/a.out
`;

      docker = spawn("docker", [
        "run", "--rm", "--network", "none", "-m", `${memory_limit_kb}k`,
        "--cpus=0.5", "-u", "0:0", "codeguard-c", "sh", "-c", cmd
      ]);

    } else {
      results.push({ stdout: "", stderr: "Unsupported language", exitCode: null });
      continue;
    }

    docker.stdout.on("data", (data) => { stdout += data.toString(); });
    docker.stderr.on("data", (data) => { stderr += data.toString(); });

    const exitCode = await new Promise((resolve) => {
      docker.on("close", (code) => {
        if (timedOut) resolve(124);
        else resolve(code);
      });
      docker.on("error", () => resolve(1));
    });

    results.push({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode });
  }

  return results;
};