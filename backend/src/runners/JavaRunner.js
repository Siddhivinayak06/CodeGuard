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

    // Parse class name and package from the Node side for robust extraction
    const pkgMatch = code.match(/^\s*package\s+([a-zA-Z0-9_.]+)\s*;/m);
    const pkgName = pkgMatch ? pkgMatch[1] : null;

    let compileClassName = 'Main';
    const publicClassMatch = code.match(
      /^\s*public\s+class\s+([A-Za-z_][A-Za-z0-9_]*)/m
    );
    if (publicClassMatch) {
      compileClassName = publicClassMatch[1];
    } else {
      const classMatch = code.match(/^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)/m);
      if (classMatch) compileClassName = classMatch[1];
    }

    const hasMain = /public\s+static\s+void\s+main\s*\(/.test(code);
    let runClassName = compileClassName;

    if (hasMain) {
      const mainIndex = code.search(/\bpublic\s+static\s+void\s+main\s*\(/);
      if (mainIndex !== -1) {
        const classRegex = /(?:public\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)/g;
        const beforeMain = code.slice(0, mainIndex);
        let match;
        let lastClassBeforeMain = null;

        while ((match = classRegex.exec(beforeMain)) !== null) {
          lastClassBeforeMain = match[1];
        }

        if (lastClassBeforeMain) {
          runClassName = lastClassBeforeMain;
        }
      }
    }

    let wrapperCode = '';
    if (hasMain && runClassName !== 'Main') {
      wrapperCode = `
${pkgName ? `package ${pkgName};` : ''}
public class Main {
    public static void main(String[] args) {
        try {
            ${runClassName}.main(args);
        } catch (Throwable t) {
            t.printStackTrace();
            System.exit(1);
        }
    }
}
      `.trim();
    }

    return `
mkdir -p /tmp/${uniqueId} &&
${this.writeBase64FileCommand(code, `/tmp/${uniqueId}/${compileClassName}.java`)} &&
${wrapperCode ? this.writeBase64FileCommand(wrapperCode, `/tmp/${uniqueId}/Main.java`) + ' &&' : ''}
${this.writeBase64FileCommand(stdinInput, `/tmp/${uniqueId}/input.txt`)} &&
javac /tmp/${uniqueId}/*.java 2> /tmp/${uniqueId}/compile_err.txt || true &&
if [ -s /tmp/${uniqueId}/compile_err.txt ]; then
  cat /tmp/${uniqueId}/compile_err.txt 1>&2
  exit 1
else
  cat /tmp/${uniqueId}/input.txt | timeout ${timeoutSec} java -XX:+UseSerialGC -Xmx128M -cp /tmp/${uniqueId} Main
fi
    `.trim();
  }
}

module.exports = JavaRunner;
