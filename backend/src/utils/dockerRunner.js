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

      // Prepare stdin lines
      const inputLines = stdinInput.split("\n").map(l => l.replace(/'/g, "'\\''"));

      // Wrap code to simulate input echo
      const wrappedCode = `
_inputs = ${JSON.stringify(inputLines)}
_input_index = 0
def input(prompt=""):
    global _input_index
    if prompt:
        print(prompt, end="")
    if _input_index < len(_inputs):
        val = _inputs[_input_index]
        print(val)
        _input_index += 1
        return val
    return ""
${escapedCode}
`;

      // Docker command
      const cmd = `
mkdir -p /tmp/${uniqueId} &&
printf "%s" '${wrappedCode.replace(/'/g, "'\\''")}' > /tmp/${uniqueId}/code.py &&
timeout 5 python /tmp/${uniqueId}/code.py
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

  // 👇 Split stdin into lines
  const inputLines = stdinInput.split("\n").map(l => l.replace(/"/g, '\\"'));

  // 👇 Wrap user code: redefine scanf
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
        // Echo input like the user typed it
        printf("%s\\n", _inputs[_input_index]);

        // Parse input string into variables
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
    timeout 5 /tmp/${uniqueId}/a.out
  `;

  docker = spawn("docker", [
    "run",
    "--rm",
    "--network", "none",
    "-m", "128m",
    "--cpus=0.5",
    "-u", "0:0",
    "codeguard-c",
    "sh",
    "-c",
    cmd,
  ], { shell: false });
}

    else {
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
        .replace(/\/tmp\/[a-f0-9\-]+\/code\.(py|c)/g, "")
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
