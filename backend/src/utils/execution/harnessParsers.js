const { createSkippedResult, sortBatchResults } = require('./batchResultUtils');

/**
 * Parse the 8-field protocol emitted by the batch harness script.
 * Protocol: __RESULT__<id>|<exitCode>|<status>|<hidden>|<time_ms>|<memory_kb>|<stdout_b64>|<stderr_b64>
 */
function parseCompiledHarnessResults(rawOutput = '', batch = []) {
  const resultById = new Map();
  const lines = String(rawOutput || '')
    .split('\n')
    .filter((line) => line.startsWith('__RESULT__'));

  for (const line of lines) {
    const payload = line.slice('__RESULT__'.length);
    const parts = payload.split('|');
    // Support both 7-field (legacy) and 8-field (new) protocol
    if (parts.length < 7) continue;

    const [
      rawId,
      rawExitCode,
      status,
      rawHidden,
      rawTimeMs,
      rawMemoryOrStdout, // field 5: memory_kb (8-field) or stdout_b64 (7-field legacy)
      field6, // field 6: stdout_b64 (8-field) or stderr_b64 (7-field legacy)
      field7, // field 7: stderr_b64 (8-field only)
    ] = parts;

    // Detect protocol version: if field7 exists, it's 8-field
    const is8Field = field7 !== undefined;

    let memoryKB, stdoutB64, stderrB64;
    if (is8Field) {
      memoryKB = Number(rawMemoryOrStdout) || 0;
      stdoutB64 = field6 || '';
      stderrB64 = field7 || '';
    } else {
      // Legacy 7-field: no memory field
      memoryKB = 0;
      stdoutB64 = rawMemoryOrStdout || '';
      stderrB64 = field6 || '';
    }

    const tc = batch.find((item) => String(item.id) === rawId);
    const stdout = Buffer.from(stdoutB64, 'base64').toString('utf8');
    const stderr = Buffer.from(stderrB64, 'base64').toString('utf8');
    const timeMs = Number(rawTimeMs) || 0;

    resultById.set(rawId, {
      test_case_id: tc ? tc.id : rawId,
      input: tc ? (tc.stdinInput ?? tc.input ?? '') : '',
      expectedOutput: tc ? (tc.expectedOutput ?? '') : '',
      stdout,
      stderr,
      exitCode: Number(rawExitCode),
      is_hidden: tc ? (tc.is_hidden ?? false) : rawHidden === '1',
      cpuTime: timeMs / 1000,
      memoryKB,
      time_ms: timeMs,
      memory_kb: memoryKB,
      status,
    });
  }

  return resultById;
}

function buildOrderedCompiledResults({
  batch,
  resultById,
  failFast,
  timedOut,
  stderr,
  exitCode,
}) {
  const orderedResults = [];
  let firstFailureFound = false;

  for (const tc of batch) {
    const existing = resultById.get(String(tc.id));
    if (existing) {
      orderedResults.push(existing);
      if (!firstFailureFound && existing.status !== 'passed' && existing.status !== 'accepted') {
        firstFailureFound = true;
      }
      continue;
    }

    if (failFast && firstFailureFound) {
      orderedResults.push(createSkippedResult(tc));
      continue;
    }

    orderedResults.push({
      test_case_id: tc.id,
      input: tc.stdinInput ?? tc.input ?? '',
      expectedOutput: tc.expectedOutput ?? '',
      stdout: '',
      stderr: timedOut
        ? 'Harness timed out'
        : stderr || 'Harness execution failed',
      exitCode: timedOut ? 124 : exitCode || 1,
      is_hidden: tc.is_hidden ?? false,
      cpuTime: 0,
      memoryKB: 0,
      time_ms: 0,
      memory_kb: 0,
      status: timedOut ? 'time_limit_exceeded' : 'runtime_error',
    });
  }

  return sortBatchResults(orderedResults, batch);
}

module.exports = {
  parseCompiledHarnessResults,
  buildOrderedCompiledResults,
};
