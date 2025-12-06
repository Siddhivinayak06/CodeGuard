/**
 * Python Code Runner
 */

const BaseRunner = require('./BaseRunner');

class PythonRunner extends BaseRunner {
  get language() {
    return 'python';
  }

  get image() {
    return 'codeguard-python';
  }

  /**
   * Build Python execution command
   * @param {string} code - Python source code
   * @param {Object} testCase - Test case data
   * @param {string} uniqueId - Unique identifier for temp files
   * @param {number} timeoutSec - Timeout in seconds
   * @returns {string}
   */
  buildCommand(code, testCase, uniqueId, timeoutSec) {
    const { stdinInput = '' } = testCase;

    return `
mkdir -p /tmp/${uniqueId} &&
printf "%s" '${this.escapeForPrintf(code)}' > /tmp/${uniqueId}/code.py &&
printf "%s" '${this.escapeForPrintf(stdinInput)}' | timeout ${timeoutSec} python3 /tmp/${uniqueId}/code.py
    `.trim();
  }
}

module.exports = PythonRunner;
