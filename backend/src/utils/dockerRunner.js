// src/utils/runBatchCode.js
const { spawn } = require("child_process");
const { v4: uuidv4 } = require("uuid");

function escapeForPrintf(s = "") {
  return String(s).replace(/'/g, "'\\''");
}

module.exports = async function runBatchCode(code, lang = "python", batch = []) {
  const results = [];

  for (const tc of batch) {
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
          "--network",
          "none",
          "-m",
          `${memory_limit_kb}k`,
          "--cpus=0.5",
          "codeguard-python",
          "sh",
          "-c",
          cmd,
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
          "--network",
          "none",
          "-m",
          `${memory_limit_kb}k`,
          "--cpus=0.5",
          "codeguard-c",
          "sh",
          "-c",
          cmd,
        ],
        { stdio: ["ignore", "pipe", "pipe"] }
      );
    } else if (lang === "java") {
      // Robust Java handling:
      // 1) Save raw input to TempUserCode.java
      // 2) Detect package & public class name
      // 3) Move/rename to <ClassName>.java when found, else use UserCode.java
      // 4) Create Main wrapper only when needed
      cmd = `
mkdir -p /tmp/${uniqueId} &&

# Save user code for inspection
printf "%s" '${escapeForPrintf(escapedCode)}' > /tmp/${uniqueId}/TempUserCode.java || true &&

# detect package line (if any) and first top-level class name
pkg_line=$(grep -E '^[[:space:]]*package[[:space:]]+[a-zA-Z0-9_.]+' /tmp/${uniqueId}/TempUserCode.java | head -n1 | sed 's/;//') || true &&
class_name=$(grep -Eo '^[[:space:]]*(public[[:space:]]+)?class[[:space:]]+[A-Za-z_][A-Za-z0-9_]*' /tmp/${uniqueId}/TempUserCode.java | head -n1 | awk '{print $NF}') || true &&

# choose destination filename that matches public class if found
if [ -n "$class_name" ]; then
  code_file=/tmp/${uniqueId}/$class_name.java
else
  code_file=/tmp/${uniqueId}/UserCode.java
fi &&

# move the temp file to chosen filename (mv preferred, fallback to cp)
mv /tmp/${uniqueId}/TempUserCode.java "$code_file" || cp /tmp/${uniqueId}/TempUserCode.java "$code_file" &&

# detect presence of main method
if grep -q 'public[[:space:]]\\+static[[:space:]]\\+void[[:space:]]\\+main[[:space:]]*(' "$code_file"; then
  has_main=1
else
  has_main=0
fi &&

# if main exists and public class isn't Main, create wrapper Main.java
if [ "$has_main" -eq 1 ] && [ "$class_name" != "Main" ]; then
  wrapper_file=/tmp/${uniqueId}/Main.java
  if [ -n "$pkg_line" ]; then
    echo "$pkg_line;" > "$wrapper_file"
  else
    : > "$wrapper_file"
  fi
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

# compile all java files in temp dir and capture compile errors
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
          "--network",
          "none",
          "-m",
          `${memory_limit_kb}k`,
          "--cpus=0.5",
          "codeguard-java",
          "sh",
          "-c",
          cmd,
        ],
        { stdio: ["ignore", "pipe", "pipe"] }
      );
    } else {
      results.push({
        test_case_id: id,
        input: stdinInput,
        expectedOutput,
        stdout: "",
        stderr: "Unsupported language",
        exitCode: null,
        is_hidden,
      });
      continue;
    }

    // Collect output
    docker.stdout.on("data", (data) => (stdout += data.toString()));
    docker.stderr.on("data", (data) => (stderr += data.toString()));

    const exitCode = await new Promise((resolve) => {
      docker.on("close", (code) => resolve(typeof code === "number" ? code : null));
      docker.on("error", () => resolve(1));
    });

    // Trim results and push
    results.push({
      test_case_id: id,
      input: stdinInput,
      expectedOutput,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode,
      is_hidden,
    });

    // small debug log (optional)
    console.log(`✅ Test case done (id=${id}) exitCode=${exitCode} stdout_len=${stdout.trim().length} stderr_len=${stderr.trim().length}`);
  }

  console.log("📦 Final batch results:", results);
  return results;
};
