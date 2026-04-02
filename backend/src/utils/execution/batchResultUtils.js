function normalizeOutput(text = '') {
  return String(text)
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
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
    status: 'skipped_fail_fast',
  };
}

function sortBatchResults(results, batch) {
  return [...results].sort(
    (a, b) =>
      batch.findIndex((tc) => String(tc.id) === String(a.test_case_id)) -
      batch.findIndex((tc) => String(tc.id) === String(b.test_case_id))
  );
}

function isFailStatus(status = '') {
  const normalizedStatus = String(status || '').toLowerCase();
  return [
    'compile_error',
    'runtime_error',
    'time_limit_exceeded',
    'failed',
  ].includes(normalizedStatus);
}

function buildBatchErrorResults(
  batch,
  message,
  exitCode = 1,
  status = 'runtime_error'
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
