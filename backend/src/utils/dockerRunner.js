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
    } else if (lang === "java") {
      // Best-effort wrapper logic:
      // - write user's code to UserCode.java
      // - detect package, first top-level class name, and presence of `public static void main`
      // - if main exists and class != Main, create Main.java wrapper that forwards to ThatClass.main(args)
      // - compile all .java files and either show compile errors on stderr or run `java -cp /tmp/<id> Main`
      cmd = `
mkdir -p /tmp/${uniqueId} &&
# Save user code
printf "%s" '${escapedCode.replace(/'/g, "'\\''")}' > /tmp/${uniqueId}/UserCode.java &&

# Detect package (if any)
pkg_line=$(grep -E '^[[:space:]]*package[[:space:]]+[a-zA-Z0-9_.]+' /tmp/${uniqueId}/UserCode.java | head -n1 | sed 's/;//') || true &&

# Detect first top-level class name (best-effort; matches "class Name" occurrences)
class_name=$(grep -Eo '^[[:space:]]*(public[[:space:]]+)?class[[:space:]]+[A-Za-z_][A-Za-z0-9_]*' /tmp/${uniqueId}/UserCode.java | head -n1 | awk '{print $NF}' ) || true &&

# Detect whether a public static void main exists anywhere in the file
if grep -q 'public[[:space:]]\\+static[[:space:]]\\+void[[:space:]]\\+main[[:space:]]*(' /tmp/${uniqueId}/UserCode.java; then
  has_main=1
else
  has_main=0
fi &&

# If we found a main and the class_name isn't Main, create a wrapper Main.java that calls <class_name>.main(args)
if [ "$has_main" -eq 1 ]; then
  if [ -z "$class_name" ]; then
    # no class detected; try to compile as-is (maybe code contains a public top-level class with no 'class' token found)
    :
  elif [ "$class_name" != "Main" ]; then
    wrapper_file=/tmp/${uniqueId}/Main.java
    # write package line if it exists
    if [ -n "$pkg_line" ]; then
      echo "$pkg_line;" > $wrapper_file
    else
      : > $wrapper_file
    fi
    # Append wrapper class
    cat >> $wrapper_file <<'WRAPPER'
public class Main {
    public static void main(String[] args) {
        try {
            %CLASS_NAME%.main(args);
        } catch (Throwable t) {
            t.printStackTrace();
            // propagate non-zero exit via System.exit to indicate runtime error
            System.exit(1);
        }
    }
}
WRAPPER
    # replace placeholder with actual class name
    sed -i "s/%CLASS_NAME%/$class_name/g" $wrapper_file
  fi
fi &&

# Compile all java files in the temp dir
javac /tmp/${uniqueId}/*.java 2> /tmp/${uniqueId}/compile_err.txt || true &&

# If compile_err.txt is non-empty, print it to stderr and exit non-zero; else run Main
if [ -s /tmp/${uniqueId}/compile_err.txt ]; then
  cat /tmp/${uniqueId}/compile_err.txt 1>&2
  exit 1
else
  printf "%s" '${stdinInput.replace(/'/g, "'\\''")}' | timeout ${timeoutSec} java -cp /tmp/${uniqueId} Main
fi
`;
      docker = spawn("docker", ["run", "--rm", "--network", "none", "-m", `${memory_limit_kb}k`, "--cpus=0.5", "codeguard-java", "sh", "-c", cmd]);
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
