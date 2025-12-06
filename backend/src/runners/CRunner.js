/**
 * C Code Runner
 */

const BaseRunner = require('./BaseRunner');

class CRunner extends BaseRunner {
  get language() {
    return 'c';
  }

  get image() {
    return 'codeguard-c';
  }

  /**
   * Build C execution command (compile + run)
   * @param {string} code - C source code
   * @param {Object} testCase - Test case data
   * @param {string} uniqueId - Unique identifier for temp files
   * @param {number} timeoutSec - Timeout in seconds
   * @returns {string}
   */
  buildCommand(code, testCase, uniqueId, timeoutSec) {
    const { stdinInput = '' } = testCase;

    return `
mkdir -p /tmp/${uniqueId} &&
printf "%s" '${this.escapeForPrintf(code)}' > /tmp/${uniqueId}/code.c &&
gcc /tmp/${uniqueId}/code.c -o /tmp/${uniqueId}/a.out -lm 2>/tmp/${uniqueId}/gcc_err.txt || true &&
cat /tmp/${uniqueId}/gcc_err.txt 1>&2 || true &&
if [ -f /tmp/${uniqueId}/a.out ]; then
  printf "%s" '${this.escapeForPrintf(stdinInput)}' | timeout ${timeoutSec} /tmp/${uniqueId}/a.out
else
  exit 1
fi
    `.trim();
  }
}

module.exports = CRunner;
