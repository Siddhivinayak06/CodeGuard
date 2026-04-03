/**
 * Centralized verdict constants and verdict determination logic.
 *
 * LeetCode-style verdicts — every code path in the system should use
 * determineVerdict() instead of ad-hoc regex matching on stderr.
 */

// ─── Verdict constants ───────────────────────────────────────────────────────
const VERDICTS = Object.freeze({
  ACCEPTED: 'accepted',
  WRONG_ANSWER: 'wrong_answer',
  TIME_LIMIT_EXCEEDED: 'time_limit_exceeded',
  MEMORY_LIMIT_EXCEEDED: 'memory_limit_exceeded',
  RUNTIME_ERROR: 'runtime_error',
  COMPILE_ERROR: 'compile_error',
  OUTPUT_LIMIT_EXCEEDED: 'output_limit_exceeded',
  SKIPPED: 'skipped_fail_fast',
});

// Exit codes with special meaning (POSIX signals = 128 + signal_number)
const EXIT_CODES = Object.freeze({
  OK: 0,
  TIMEOUT: 124, // GNU timeout sends this
  SIGKILL_OOM: 137, // 128 + 9 (SIGKILL — typically OOM killer or cgroup)
  SIGSEGV: 139, // 128 + 11 (segmentation fault)
  SIGABRT: 134, // 128 + 6  (abort / assertion failure)
  SIGFPE: 136, // 128 + 8  (floating-point exception)
});

/**
 * Map marks percentage to a college-grade submission status.
 * Returns one of: 'excellent', 'very_good', 'good', 'needs_improvement', 'poor'
 *
 * @param {number} obtained - Marks obtained
 * @param {number} total    - Maximum possible marks
 * @returns {string} Grade string
 */
function marksToGrade(obtained, total) {
  if (total <= 0) return 'poor';
  const pct = (obtained / total) * 100;
  if (pct >= 90) return 'excellent';
  if (pct >= 75) return 'very_good';
  if (pct >= 60) return 'good';
  if (pct >= 40) return 'needs_improvement';
  return 'poor';
}

/**
 * Map a verdict to a database-safe status.
 * We now store granular grades instead of binary passed/failed.
 * Backwards compatible — old code checking 'passed'/'failed' still works
 * because marksToGrade() is used at the submission level.
 */
function verdictToDbStatus(verdict) {
  if (verdict === VERDICTS.ACCEPTED) return 'passed';
  return 'failed';
}

/**
 * Check whether a verdict is a failing verdict.
 */
function isFailVerdict(verdict) {
  return verdict !== VERDICTS.ACCEPTED && verdict !== VERDICTS.SKIPPED;
}

/**
 * Determine the verdict for a single test case execution.
 *
 * Priority order (first match wins):
 *   1. Compile-phase failure (explicit flag)
 *   2. Timeout (exit code 124 or timedOut flag)
 *   3. Memory limit exceeded (exit code 137)
 *   4. Output limit exceeded (truncation marker in stdout)
 *   5. Runtime error (any non-zero exit code)
 *   6. Output comparison (using the provided comparator result)
 *   7. Accepted
 *
 * @param {Object} params
 * @param {number|null} params.exitCode     - Process exit code
 * @param {string}      params.stderr       - Standard error output
 * @param {string}      params.stdout       - Standard output
 * @param {boolean}     [params.timedOut]    - Whether the process was killed for timeout
 * @param {boolean}     [params.isCompileError] - Whether this came from a compile phase
 * @param {boolean}     [params.outputMatch] - Result of output comparison (pre-computed)
 * @returns {string} One of the VERDICTS constants
 */
function determineVerdict({
  exitCode,
  stderr = '',
  stdout = '',
  timedOut = false,
  isCompileError = false,
  outputMatch = true,
}) {
  // 1. Explicit compile error (set by the caller when the compile phase failed)
  if (isCompileError) {
    return VERDICTS.COMPILE_ERROR;
  }

  // 2. Timeout
  if (timedOut || exitCode === EXIT_CODES.TIMEOUT) {
    return VERDICTS.TIME_LIMIT_EXCEEDED;
  }

  // 3. OOM / memory limit (cgroup OOM killer sends SIGKILL → exit 137)
  if (exitCode === EXIT_CODES.SIGKILL_OOM) {
    return VERDICTS.MEMORY_LIMIT_EXCEEDED;
  }

  // 4. Output limit exceeded (truncation marker injected by runner)
  if (
    stdout.includes('[Output truncated]') ||
    stderr.includes('[Output truncated]')
  ) {
    return VERDICTS.OUTPUT_LIMIT_EXCEEDED;
  }

  // 5. Runtime error (any non-zero exit code that wasn't timeout/OOM)
  if (exitCode !== null && exitCode !== 0) {
    return VERDICTS.RUNTIME_ERROR;
  }

  // 6. Output comparison
  if (!outputMatch) {
    return VERDICTS.WRONG_ANSWER;
  }

  // 7. All good
  return VERDICTS.ACCEPTED;
}

module.exports = {
  VERDICTS,
  EXIT_CODES,
  determineVerdict,
  verdictToDbStatus,
  isFailVerdict,
  marksToGrade,
};
