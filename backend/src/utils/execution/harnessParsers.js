const { createSkippedResult, sortBatchResults } = require('./batchResultUtils');

function parseCompiledHarnessResults(rawOutput = '', batch = []) {
  const resultById = new Map();
  const lines = String(rawOutput || '')
    .split('\n')
    .filter((line) => line.startsWith('__RESULT__'));

  for (const line of lines) {
    const payload = line.slice('__RESULT__'.length);
    const parts = payload.split('|');
    if (parts.length < 7) continue;

    const [
      rawId,
      rawExitCode,
      status,
      rawHidden,
      rawTimeMs,
      stdoutB64,
      stderrB64,
    ] = parts;

    const tc = batch.find((item) => String(item.id) === rawId);
    const stdout = Buffer.from(stdoutB64 || '', 'base64').toString('utf8');
    const stderr = Buffer.from(stderrB64 || '', 'base64').toString('utf8');
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
      memoryKB: 0,
      time_ms: timeMs,
      memory_kb: 0,
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
      if (!firstFailureFound && existing.status !== 'passed') {
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
      status: 'runtime_error',
    });
  }

  return sortBatchResults(orderedResults, batch);
}

module.exports = {
  parseCompiledHarnessResults,
  buildOrderedCompiledResults,
};
