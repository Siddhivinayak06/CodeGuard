// src/utils/dockerRunner.js
const { spawn } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const config = require("../config");

function escapeForPrintf(s = "") {
  return String(s).replace(/'/g, "'\\''");
}

async function runTestCase(tc, code, lang) {
  const {
    id,
    stdinInput = "",
    expectedOutput = "",
    time_limit_ms = 5000,
    memory_limit_kb = 65536,
    is_hidden = false,
  } = tc;

  let docker;
  let stdout = "";
  let stderr = "";
  const uniqueId = uuidv4();
  const escapedCode = code.replace(/\r/g, "");
  const timeoutSec = Math.max(1, Math.ceil(time_limit_ms / 1000));

  // Use config limits if not overridden by test case (though test case usually takes precedence or we clamp it)
  // For now, we'll stick to the test case's limit or default, but ensuring we use the config's CPU/PIDs limits.
  const memoryLimit = memory_limit_kb + "k";

  let cmd;
  if (lang === "python") {
    cmd = `
mkdir -p /tmp/${uniqueId} &&
printf "%s" '${escapeForPrintf(escapedCode)}' > /tmp/${uniqueId}/code.py &&
printf "%s" '${escapeForPrintf(stdinInput)}' | timeout ${timeoutSec} python3 /tmp/${uniqueId}/code.py
`;
    docker = spawn(
      "docker",
      [
        "run",
        "--rm",
        "--network", "none",
        "-m", memoryLimit,
        "--cpus=" + config.docker.cpus,
        "--pids-limit", config.docker.pidsLimit,
        "codeguard-python",
        "sh", "-c", cmd,
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
  } else if (lang === "c") {
    cmd = `
mkdir -p /tmp/${uniqueId} &&
printf "%s" '${escapeForPrintf(escapedCode)}' > /tmp/${uniqueId}/code.c &&
gcc /tmp/${uniqueId}/code.c -o /tmp/${uniqueId}/a.out -lm 2>/tmp/${uniqueId}/gcc_err.txt || true &&
cat /tmp/${uniqueId}/gcc_err.txt 1>&2 || true &&
printf "%s" '${escapeForPrintf(stdinInput)}' | timeout ${timeoutSec} /tmp/${uniqueId}/a.out
`;
    docker = spawn(
      "docker",
      [
        "run",
        "--rm",
        "--network", "none",
        "-m", memoryLimit,
        "--cpus=" + config.docker.cpus,
        "--pids-limit", config.docker.pidsLimit,
        "codeguard-c",
        "sh", "-c", cmd,
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
  } else if (lang === "java") {
    cmd = `
mkdir -p /tmp/${uniqueId} &&
printf "%s" '${escapeForPrintf(escapedCode)}' > /tmp/${uniqueId}/TempUserCode.java || true &&
pkg_line=$(grep -E '^[[:space:]]*package[[:space:]]+[a-zA-Z0-9_.]+' /tmp/${uniqueId}/TempUserCode.java | head -n1 | sed 's/;//') || true &&
class_name=$(grep -Eo '^[[:space:]]*(public[[:space:]]+)?class[[:space:]]+[A-Za-z_][A-Za-z0-9_]*' /tmp/${uniqueId}/TempUserCode.java | head -n1 | awk '{print $NF}') || true &&
if [ -n "$class_name" ]; then code_file=/tmp/${uniqueId}/$class_name.java; else code_file=/tmp/${uniqueId}/UserCode.java; fi &&
mv /tmp/${uniqueId}/TempUserCode.java "$code_file" || cp /tmp/${uniqueId}/TempUserCode.java "$code_file" &&
if grep -q 'public[[:space:]]\\+static[[:space:]]\\+void[[:space:]]\\+main[[:space:]]*(' "$code_file"; then has_main=1; else has_main=0; fi &&
if [ "$has_main" -eq 1 ] && [ "$class_name" != "Main" ]; then
  wrapper_file=/tmp/${uniqueId}/Main.java
  if [ -n "$pkg_line" ]; then echo "$pkg_line;" > "$wrapper_file"; else : > "$wrapper_file"; fi
  cat >> "$wrapper_file" <<'WRAPPER'
public class Main {
    public static void main(String[] args) {
        try {
            %CLASS_NAME%.main(args);
        } catch (Throwable t) {
            t.printStackTrace();
            System.exit(1);
        }
    }
}
WRAPPER
  sed -i "s/%CLASS_NAME%/$class_name/g" "$wrapper_file"
fi &&
javac /tmp/${uniqueId}/*.java 2> /tmp/${uniqueId}/compile_err.txt || true &&
if [ -s /tmp/${uniqueId}/compile_err.txt ]; then
  cat /tmp/${uniqueId}/compile_err.txt 1>&2
  exit 1
else
  printf "%s" '${escapeForPrintf(stdinInput)}' | timeout ${timeoutSec} java -cp /tmp/${uniqueId} Main
fi
`;
    docker = spawn(
      "docker",
      [
        "run",
        "--rm",
        "--network", "none",
        "-m", memoryLimit,
        "--cpus=" + config.docker.cpus,
        "--pids-limit", config.docker.javaPidsLimit,
        "codeguard-java",
        "sh", "-c", cmd,
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
  } else {
    return {
      test_case_id: id,
      input: stdinInput,
      expectedOutput,
      stdout: "",
      stderr: "Unsupported language",
      exitCode: null,
      is_hidden,
    };
  }

  // Collect output
  docker.stdout.on("data", (data) => (stdout += data.toString()));
  docker.stderr.on("data", (data) => (stderr += data.toString()));

  const exitCode = await new Promise((resolve) => {
    docker.on("close", (code) => resolve(typeof code === "number" ? code : null));
    docker.on("error", () => resolve(1));
  });

  // Trim results
  const result = {
    test_case_id: id,
    input: stdinInput,
    expectedOutput,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    exitCode,
    is_hidden,
  };

  // console.log(`✅ Test case done (id=${id})`);
  return result;
}

module.exports = async function runBatchCode(code, lang = "python", batch = []) {
  const results = [];
  const CONCURRENCY_LIMIT = 5;

  // Helper for concurrency
  const runWithLimit = async (tasks) => {
    const executing = [];
    const finalResults = [];

    for (const task of tasks) {
      const p = Promise.resolve().then(() => task());
      finalResults.push(p);

      if (CONCURRENCY_LIMIT <= tasks.length) {
        const e = p.then(() => executing.splice(executing.indexOf(e), 1));
        executing.push(e);
        if (executing.length >= CONCURRENCY_LIMIT) {
          await Promise.race(executing);
        }
      }
    }
    return Promise.all(finalResults);
  };

  const tasks = batch.map((tc) => () => runTestCase(tc, code, lang));

  console.log(`Executing ${batch.length} test cases with concurrency ${CONCURRENCY_LIMIT}...`);
  const batchResults = await runWithLimit(tasks);

  console.log("📦 Final batch results:", batchResults.length);
  return batchResults;
};
