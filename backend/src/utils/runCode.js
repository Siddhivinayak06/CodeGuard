// src/utils/runCode.js
const { spawn } = require("child_process");
const { v4: uuidv4 } = require("uuid");

const DEFAULT_TIMEOUT_SEC = 5;
const MAX_OUTPUT = 64 * 1024; // 64 KB

function escapeForPrintf(s = "") {
  // escape single quotes safely for printf '%s' '...'
  return s.replace(/'/g, "'\\''");
}

module.exports = async function runCode(code, lang = "python", stdinInput = "") {
  if (!code || typeof code !== "string") {
    throw new Error("No code provided");
  }

  const supported = ["python", "py", "c", "java"];
  if (!supported.includes(lang)) {
    return {
      output: "",
      error: `Unsupported language: ${lang}`,
      stderr: `Unsupported language: ${lang}`,
      exitCode: null,
    };
  }

  const uniqueId = uuidv4();
  const escapedCode = code.replace(/\r/g, "");
  const timeoutSec = DEFAULT_TIMEOUT_SEC;

  let cmd;
  if (lang === "python" || lang === "py") {
    cmd = `
mkdir -p /tmp/${uniqueId} &&
printf "%s" '${escapeForPrintf(escapedCode)}' > /tmp/${uniqueId}/code.py &&
printf "%s" '${escapeForPrintf(stdinInput)}' | timeout ${timeoutSec} python3 /tmp/${uniqueId}/code.py
`;
  } else if (lang === "c") {
    cmd = `
mkdir -p /tmp/${uniqueId} &&
printf "%s" '${escapeForPrintf(escapedCode)}' > /tmp/${uniqueId}/code.c &&
 gcc /tmp/${uniqueId}/code.c -o /tmp/${uniqueId}/a.out -lm 2>/tmp/${uniqueId}/gcc_err.txt || true &&
cat /tmp/${uniqueId}/gcc_err.txt 1>&2 || true &&
printf "%s" '${escapeForPrintf(stdinInput)}' | timeout ${timeoutSec} /tmp/${uniqueId}/a.out
`;
  } else if (lang === "java") {
    // The Java handling below:
    // 1) write the user's code to a temp file
    // 2) detect package line and public class name
    // 3) if public class name == Main -> save file as Main.java
    // 4) if public class name != Main -> keep file as UserCode.java and create a Main wrapper
    // 5) compile and run Main
    cmd = `
mkdir -p /tmp/${uniqueId} &&
printf "%s" '${escapeForPrintf(escapedCode)}' > /tmp/${uniqueId}/UserCode.java &&

# detect package and public class name from the saved file
pkg_line=$(grep -E '^[[:space:]]*package[[:space:]]+[a-zA-Z0-9_.]+' /tmp/${uniqueId}/UserCode.java | head -n1 | sed 's/;//') || true &&
class_name=$(grep -Eo '^[[:space:]]*(public[[:space:]]+)?class[[:space:]]+[A-Za-z_][A-Za-z0-9_]*' /tmp/${uniqueId}/UserCode.java | head -n1 | awk '{print $NF}' ) || true &&

# If the public class is Main, rename the file to Main.java to satisfy javac
if [ "$class_name" = "Main" ]; then
  mv /tmp/${uniqueId}/UserCode.java /tmp/${uniqueId}/Main.java || true
  code_file=/tmp/${uniqueId}/Main.java
else
  code_file=/tmp/${uniqueId}/UserCode.java
fi &&

# Check whether there's a main method in the code file
if grep -q 'public[[:space:]]\\+static[[:space:]]\\+void[[:space:]]\\+main[[:space:]]*(' "$code_file"; then
  has_main=1
else
  has_main=0
fi &&

# If user has a main and the public class isn't Main, create a Main wrapper that calls it
if [ "$has_main" -eq 1 ] && [ "$class_name" != "Main" ]; then
  wrapper_file=/tmp/${uniqueId}/Main.java
  if [ -n "$pkg_line" ]; then
    echo "$pkg_line;" > $wrapper_file
  else
    : > $wrapper_file
  fi
  cat >> $wrapper_file <<'WRAPPER'
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
  # Substitute the placeholder with the shell variable $class_name — escape $ for JS so shell gets $class_name
  sed -i "s/%CLASS_NAME%/\\$class_name/g" $wrapper_file
fi &&

javac /tmp/${uniqueId}/*.java 2> /tmp/${uniqueId}/compile_err.txt || true &&

if [ -s /tmp/${uniqueId}/compile_err.txt ]; then
  cat /tmp/${uniqueId}/compile_err.txt 1>&2
  exit 1
else
  printf "%s" '${escapeForPrintf(stdinInput)}' | timeout ${timeoutSec} java -cp /tmp/${uniqueId} Main
fi
`;
  }

  // Which docker image to use per language
  const image = lang === "python" ? "codeguard-python"
    : lang === "c" ? "codeguard-c"
    : "codeguard-java";

  // Spawn docker - do not swallow spawn errors
  let docker;
  try {
    docker = spawn("docker", [
      "run",
      "--rm",
      "--network", "none",
      "-m", "65536k",
      "--cpus=0.5",
      image,
      "sh",
      "-c",
      cmd,
    ]);
  } catch (spawnErr) {
    // spawn can throw synchronously if 'docker' binary isn't found
    return {
      output: "",
      error: `Failed to spawn docker: ${spawnErr && spawnErr.message}`,
      stderr: String(spawnErr && spawnErr.stack || spawnErr),
      exitCode: null,
    };
  }

  // collect output with truncation
  let stdout = "";
  let stderr = "";
  let truncated = false;

  docker.stdout.on("data", (data) => {
    stdout += data.toString();
    if (stdout.length > MAX_OUTPUT && !truncated) {
      stdout = stdout.slice(0, MAX_OUTPUT) + "\n[Output truncated]";
      truncated = true;
    }
  });

  docker.stderr.on("data", (data) => {
    stderr += data.toString();
    if (stderr.length > MAX_OUTPUT && !truncated) {
      stderr = stderr.slice(0, MAX_OUTPUT) + "\n[Error truncated]";
      truncated = true;
    }
  });

  const result = await new Promise((resolve, reject) => {
    docker.on("error", (err) => {
      // typical reasons: docker CLI missing, permission denied to socket, etc.
      return reject(new Error(`docker spawn error: ${err && err.message}`));
    });

    docker.on("close", (code, signal) => {
      return resolve({ code: typeof code === "number" ? code : null, signal: signal || null });
    });
  }).catch((err) => {
    // bubble up the spawn error with useful details
    return { spawnError: String(err && err.message ? err.message : err), code: null };
  });

  // If spawn error occurred
  if (result && result.spawnError) {
    return {
      output: stdout.trim(),
      error: `Runner spawn error: ${result.spawnError}`,
      stderr: stderr.trim() || result.spawnError,
      exitCode: null,
    };
  }

  const exitCode = result && typeof result.code === "number" ? result.code : null;

  // Normalize error output
  const cleanError = stderr.trim() || null;

  return {
    output: stdout.trim(),
    error: cleanError,
    stderr: stderr.trim(),
    exitCode,
  };
};
