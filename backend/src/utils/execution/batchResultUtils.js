const { VERDICTS } = require('./verdicts');
const {
  normalizeTrailingWhitespace,
} = require('./outputComparator');

/**
 * Normalize output (legacy compatibility wrapper).
 * New code should use outputComparator.compareOutput() instead.
 */
function normalizeOutput(text = '') {
  return normalizeTrailingWhitespace(text);
}

function createSkippedResult(tc, reason = 'Skipped due to fail-fast') {
  return {
    test_case_id: tc.id,
    input: tc.stdinInput ?? tc.input ?? '',
    expectedOutput: tc.expectedOutput ?? '',
    stdout: '',
    stderr: reason,
    exitCode: 125,
    is_hidden: tc.is_hidden ?? false,
    cpuTime: 0,
    memoryKB: 0,
    time_ms: 0,
    memory_kb: 0,
    status: VERDICTS.SKIPPED,
  };
}

function sortBatchResults(results, batch) {
  return [...results].sort(
    (a, b) =>
      batch.findIndex((tc) => String(tc.id) === String(a.test_case_id)) -
      batch.findIndex((tc) => String(tc.id) === String(b.test_case_id))
  );
}

/**
 * Check whether a status/verdict is a failing one.
 */
function isFailStatus(status = '') {
  const normalizedStatus = String(status || '').toLowerCase();
  return [
    VERDICTS.COMPILE_ERROR,
    VERDICTS.RUNTIME_ERROR,
    VERDICTS.TIME_LIMIT_EXCEEDED,
    VERDICTS.MEMORY_LIMIT_EXCEEDED,
    VERDICTS.OUTPUT_LIMIT_EXCEEDED,
    VERDICTS.WRONG_ANSWER,
    'failed', // Legacy compatibility
  ].includes(normalizedStatus);
}

function buildBatchErrorResults(
  batch,
  message,
  exitCode = 1,
  status = VERDICTS.RUNTIME_ERROR
) {
  return batch.map((tc) => ({
    test_case_id: tc.id,
    input: tc.stdinInput ?? tc.input ?? '',
    expectedOutput: tc.expectedOutput ?? '',
    stdout: '',
    stderr: message,
    exitCode,
    is_hidden: tc.is_hidden ?? false,
    cpuTime: 0,
    memoryKB: 0,
    time_ms: 0,
    memory_kb: 0,
    status,
  }));
}

module.exports = {
  normalizeOutput,
  createSkippedResult,
  sortBatchResults,
  isFailStatus,
  buildBatchErrorResults,
};
