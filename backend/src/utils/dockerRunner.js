const { spawn } = require("child_process");
const { v4: uuidv4 } = require("uuid");

module.exports = async function runBatchCode(code, lang = "python", batch = []) {
  const results = [];

  for (const tc of batch) {
    const {
      id,
      stdinInput = "",
      expectedOutput = "",
      time_limit_ms = 5000,
      memory_limit_kb = 65536,
    } = tc;

    let docker;
    let stdout = "";
    let stderr = "";
    const uniqueId = uuidv4();
    const escapedCode = code.replace(/\r/g, "");

    const timeoutSec = Math.ceil(time_limit_ms / 1000);

    let cmd;
    if (lang === "python") {
      cmd = `
mkdir -p /tmp/${uniqueId} &&
printf "%s" '${escapedCode.replace(/'/g, "'\\''")}' > /tmp/${uniqueId}/code.py &&
printf "%s" '${stdinInput.replace(/'/g, "'\\''")}' | timeout ${timeoutSec} python3 /tmp/${uniqueId}/code.py
`;
      docker = spawn("docker", ["run", "--rm", "--network", "none", "-m", `${memory_limit_kb}k`, "--cpus=0.5", "codeguard-python", "sh", "-c", cmd]);
    } else if (lang === "c") {
      cmd = `
mkdir -p /tmp/${uniqueId} &&
printf "%s" '${escapedCode.replace(/'/g, "'\\''")}' > /tmp/${uniqueId}/code.c &&
gcc /tmp/${uniqueId}/code.c -o /tmp/${uniqueId}/a.out -lm &&
printf "%s" '${stdinInput.replace(/'/g, "'\\''")}' | timeout ${timeoutSec} /tmp/${uniqueId}/a.out
`;
      docker = spawn("docker", ["run", "--rm", "--network", "none", "-m", `${memory_limit_kb}k`, "--cpus=0.5", "codeguard-c", "sh", "-c", cmd]);
    } else {
      results.push({ test_case_id: id, stdout: "", stderr: "Unsupported language", exitCode: null });
      continue;
    }

    docker.stdout.on("data", (data) => (stdout += data.toString()));
    docker.stderr.on("data", (data) => (stderr += data.toString()));

    const exitCode = await new Promise((resolve) => {
      docker.on("close", (code) => resolve(code));
      docker.on("error", () => resolve(1));
    });

    console.log(`✅ Test case done (id=${id}, input="${stdinInput}")`);
    console.log(`stdout: ${stdout.trim()}`);
    if (stderr.trim()) console.log(`stderr: ${stderr.trim()}`);

    results.push({
      test_case_id: id,
      input: stdinInput,
      expectedOutput,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode,
      is_hidden: tc.is_hidden,
    });
  }

  console.log("📦 Final results:", results);
  return results;
};
