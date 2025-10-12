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
      const inputLines = stdinInput.split("\n").map(l => l.replace(/'/g, "'\\''"));
      const wrappedCode = `
_inputs = ${JSON.stringify(inputLines)}
_input_index = 0
def input(prompt=""):
    global _input_index
    if prompt: print(prompt, end="")
    if _input_index < len(_inputs):
        val = _inputs[_input_index]
        print(val)
        _input_index += 1
        return val
    return ""
${escapedCode}
`;

      const cmd = `
mkdir -p /tmp/${uniqueId} &&
printf "%s" '${wrappedCode.replace(/'/g, "'\\''")}' > /tmp/${uniqueId}/code.py &&
timeout ${Math.ceil(time_limit_ms / 1000)} python /tmp/${uniqueId}/code.py
`;

      docker = spawn("docker", [
        "run", "--rm", "--network", "none", "-m", `${memory_limit_kb}k`,
        "--cpus=0.5", "codeguard-python", "sh", "-c", cmd
      ]);

    } else if (lang === "c") {
      const inputLines = stdinInput.split("\n").map(l => l.replace(/"/g, '\\"'));
      const wrappedCode = `
#include <stdio.h>
#include <stdarg.h>

int _input_index = 0;
char *_inputs[] = { ${inputLines.map(l => `"${l}"`).join(", ")} };

int my_scanf(const char *fmt, ...) {
    va_list args;
    va_start(args, fmt);
    int ret = 0;
    if (_input_index < sizeof(_inputs)/sizeof(_inputs[0])) {
        printf("%s\\n", _inputs[_input_index]);
        ret = vsscanf(_inputs[_input_index], fmt, args);
        _input_index++;
    }
    va_end(args);
    return ret;
}
#define scanf my_scanf

${escapedCode}
`;

      const cmd = `
mkdir -p /tmp/${uniqueId} &&
printf "%s" '${wrappedCode.replace(/'/g, "'\\''")}' > /tmp/${uniqueId}/code.c &&
gcc /tmp/${uniqueId}/code.c -o /tmp/${uniqueId}/a.out -lm &&
timeout ${Math.ceil(time_limit_ms / 1000)} /tmp/${uniqueId}/a.out
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
