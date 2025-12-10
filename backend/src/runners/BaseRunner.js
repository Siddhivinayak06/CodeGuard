/**
 * Base Runner Class
 * Abstract base class for all language runners
 */

const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');
const { TimeoutError, DockerError } = require('../utils/AppError');

/**
 * @typedef {Object} TestCase
 * @property {string|number} id - Test case ID
 * @property {string} [stdinInput] - Standard input
 * @property {string} [input] - Alias for stdinInput
 * @property {string} [expectedOutput] - Expected output
 * @property {number} [time_limit_ms] - Time limit in milliseconds
 * @property {number} [memory_limit_kb] - Memory limit in KB
 * @property {boolean} [is_hidden] - Whether test case is hidden
 */

/**
 * @typedef {Object} ExecutionResult
 * @property {string|number} test_case_id - Test case ID
 * @property {string} input - Input provided
 * @property {string} expectedOutput - Expected output
 * @property {string} stdout - Standard output
 * @property {string} stderr - Standard error
 * @property {number|null} exitCode - Exit code
 * @property {boolean} is_hidden - Whether test case is hidden
 */

class BaseRunner {
  constructor() {
    if (this.constructor === BaseRunner) {
      throw new Error(
        'BaseRunner is abstract and cannot be instantiated directly'
      );
    }
  }

  /**
   * Get the language name
   * @returns {string}
   */
  get language() {
    throw new Error('Must implement language getter');
  }

  /**
   * Get the Docker image name
   * @returns {string}
   */
  get image() {
    throw new Error('Must implement image getter');
  }

  /**
   * Get memory limit for this language
   * @returns {string}
   */
  get memoryLimit() {
    return config.docker.memory;
  }

  /**
   * Get PIDs limit for this language
   * @returns {string}
   */
  get pidsLimit() {
    return config.docker.pidsLimit;
  }

  /**
   * Escape string for printf
   * @param {string} s - String to escape
   * @returns {string}
   */
  escapeForPrintf(s = '') {
    return String(s).replace(/'/g, "'\\'");
  }

  /**
   * Build the command to execute
   * @param {string} code - Source code
   * @param {TestCase} testCase - Test case data
   * @param {string} uniqueId - Unique ID for temp files
   * @returns {string}
   */
  buildCommand(_code, _testCase, _uniqueId) {
    throw new Error('Must implement buildCommand');
  }

  /**
   * Run a single test case
   * @param {TestCase} testCase - Test case to run
   * @param {string} code - Source code
   * @returns {Promise<ExecutionResult>}
   */
  async runTestCase(testCase, code) {
    const {
      id,
      stdinInput = '',
      input = '',
      expectedOutput = '',
      time_limit_ms = 5000,
      memory_limit_kb = 65536,
      is_hidden = false,
    } = testCase;

    const actualInput = stdinInput || input;
    const uniqueId = uuidv4();
    const escapedCode = code.replace(/\r/g, '');
    const timeoutSec = Math.max(1, Math.ceil(time_limit_ms / 1000));
    const memoryLimit = memory_limit_kb + 'k';

    logger.debug(`Running test case ${id} for ${this.language}`, {
      timeoutSec,
      memoryLimit,
    });

    const cmd = this.buildCommand(
      escapedCode,
      { ...testCase, stdinInput: actualInput },
      uniqueId,
      timeoutSec
    );

    try {
      const result = await this.executeInDocker(cmd, memoryLimit, timeoutSec);

      return {
        test_case_id: id,
        input: actualInput,
        expectedOutput,
        stdout: result.stdout.trim(),
        stderr: result.stderr.trim(),
        exitCode: result.exitCode,
        is_hidden,
      };
    } catch (error) {
      logger.error(`Execution failed for test case ${id}`, {
        language: this.language,
        error: error.message,
      });

      return {
        test_case_id: id,
        input: actualInput,
        expectedOutput,
        stdout: '',
        stderr: error.message,
        exitCode: 1,
        is_hidden,
      };
    }
  }

  /**
   * Execute command in Docker container
   * @param {string} cmd - Command to execute
   * @param {string} memoryLimit - Memory limit
   * @param {number} timeoutSec - Timeout in seconds
   * @returns {Promise<{stdout: string, stderr: string, exitCode: number|null}>}
   */
  async executeInDocker(cmd, memoryLimit, timeoutSec) {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const docker = spawn(
        'docker',
        [
          'run',
          '--rm',
          '--network',
          'none',
          '--cap-drop=ALL',
          '-m',
          memoryLimit,
          '--cpus=' + config.docker.cpus,
          '--pids-limit',
          this.pidsLimit,
          this.image,
          'sh',
          '-c',
          cmd,
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] }
      );

      docker.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      docker.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      docker.on('close', (exitCode) => {
        resolve({
          stdout,
          stderr,
          exitCode: typeof exitCode === 'number' ? exitCode : null,
        });
      });

      docker.on('error', (error) => {
        reject(new DockerError(`Failed to execute Docker: ${error.message}`));
      });

      // Handle timeout
      const timeout = setTimeout(
        () => {
          docker.kill();
          reject(new TimeoutError('Code execution', timeoutSec * 1000));
        },
        (timeoutSec + 5) * 1000
      ); // Extra buffer for Docker overhead

      docker.on('close', () => clearTimeout(timeout));
    });
  }

  /**
   * Run multiple test cases
   * @param {string} code - Source code
   * @param {TestCase[]} testCases - Array of test cases
   * @param {number} [concurrency=5] - Max concurrent executions
   * @returns {Promise<ExecutionResult[]>}
   */
  async runBatch(code, testCases, concurrency = 5) {
    logger.info(
      `Running batch of ${testCases.length} test cases for ${this.language}`,
      {
        concurrency,
      }
    );

    const results = [];
    const executing = [];

    for (const testCase of testCases) {
      const promise = this.runTestCase(testCase, code).then((result) => {
        results.push(result);
        executing.splice(executing.indexOf(promise), 1);
        return result;
      });

      executing.push(promise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);

    logger.info(`Batch execution complete`, {
      language: this.language,
      totalTests: testCases.length,
      completed: results.length,
    });

    return results;
  }
}

module.exports = BaseRunner;
