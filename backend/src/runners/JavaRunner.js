/**
 * Java Code Runner
 */

const BaseRunner = require('./BaseRunner');
const config = require('../config');

class JavaRunner extends BaseRunner {
  get language() {
    return 'java';
  }

  get image() {
    return 'codeguard-java';
  }

  get memoryLimit() {
    return config.docker.javaMemory;
  }

  get pidsLimit() {
    return config.docker.javaPidsLimit;
  }

  /**
   * Build Java execution command (compile + run)
   * Handles class name detection and Main wrapper generation
   * @param {string} code - Java source code
   * @param {Object} testCase - Test case data
   * @param {string} uniqueId - Unique identifier for temp files
   * @param {number} timeoutSec - Timeout in seconds
   * @returns {string}
   */
  buildCommand(code, testCase, uniqueId, timeoutSec) {
    const { stdinInput = '' } = testCase;

    return `
mkdir -p /tmp/${uniqueId} &&
printf "%s" '${this.escapeForPrintf(code)}' > /tmp/${uniqueId}/TempUserCode.java || true &&
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
  printf "%s" '${this.escapeForPrintf(stdinInput)}' | timeout ${timeoutSec} java -cp /tmp/${uniqueId} Main
fi
    `.trim();
  }
}

module.exports = JavaRunner;
