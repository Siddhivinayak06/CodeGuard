const { z } = require('zod');
const aiService = require('./aiService');
const logger = require('../utils/logger');
const config = require('../config');
const {
  isLocalAvailable,
  isDockerAvailable,
} = require('../utils/runtimeDetector');
const poolManager = require('./poolManager');

let runBatchCode;
let localBatchCode;
try {
  runBatchCode = require('../utils/dockerRunner');
} catch (e) {
  logger.error('Failed to load docker batch runner for fuzzer', {
    error: e.message,
  });
}

try {
  localBatchCode = require('../utils/localRunner');
} catch (e) {
  logger.warn('Failed to load local batch runner for fuzzer', {
    error: e.message,
  });
}

const fuzzSchema = z.object({
  description: z.string().min(10),
  referenceCode: z.string().min(1),
  language: z.enum(['c', 'cpp', 'python', 'py', 'java']).default('c'),
  count: z.number().int().min(1).max(100).default(100),
  existingInputs: z.array(z.string()).max(1000).optional(),
  timeLimitMs: z.number().int().positive().max(30000).optional(),
  memoryLimitKb: z.number().int().positive().max(1048576).optional(),
  config: z.record(z.string(), z.any()).optional(),
});

function normalizeInput(value = '') {
  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\0')
    .join('')
    .trimEnd();
}

function normalizeExpectedOutput(value = '') {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trimEnd();
}

function buildAttemptCandidateCounts(requestedCount) {
  if (requestedCount >= 80) {
    return [110, 100, 70, 50];
  }

  if (requestedCount >= 40) {
    return [70, 60, 50, 40];
  }

  return [60, 45, 35];
}

function buildCandidateInputPrompt({
  description,
  referenceCode,
  language,
  candidateCount,
  existingInputs,
}) {
  const existingSnippet = existingInputs.length
    ? existingInputs
        .slice(-40)
        .map((input, idx) => `${idx + 1}. ${JSON.stringify(input)}`)
        .join('\n')
    : 'None';

  return `You are a strict stdin fuzzer generator for coding problems.
Generate diverse and valid stdin inputs for this problem and reference solution.

Return ONLY valid JSON (no markdown, no commentary) in this exact shape:
{"inputs": ["...", "..."]}

Rules:
1. Generate exactly ${candidateCount} candidate inputs.
2. Each entry must be a complete stdin payload as a JSON string.
3. Follow the input format implied by the problem and reference code.
4. Include edge cases, boundary values, random cases, and stress-style cases.
5. Avoid duplicates and avoid the existing inputs listed below.
6. Do not include expected outputs.
7. Keep each input concise but valid.

Language: ${language}

Problem description:
${description}

Reference solution:
\`\`\`
${referenceCode}
\`\`\`

Existing inputs to avoid:
${existingSnippet}`;
}

function buildCandidateRepairPrompt({
  language,
  candidateCount,
  previousResponse,
}) {
  return `You previously returned an invalid format for test inputs.

Task: Convert your previous response into STRICT valid JSON only.

Return exactly this shape:
{"inputs":["...","..."]}

Rules:
1. Exactly ${candidateCount} entries in "inputs".
2. Each entry must be a complete stdin payload string.
3. No markdown, no comments, no explanation.
4. Do not include expected outputs.

Language: ${language}

Previous response to repair:
${previousResponse}`;
}

function collectInputsFromParsed(parsed) {
  if (Array.isArray(parsed)) {
    return parsed.map((item) => String(item ?? ''));
  }

  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.inputs)) {
      return parsed.inputs.map((item) => String(item ?? ''));
    }

    if (Array.isArray(parsed.testCases)) {
      return parsed.testCases.map((item) => String(item?.input ?? ''));
    }

    if (Array.isArray(parsed.cases)) {
      return parsed.cases.map((item) => String(item?.input ?? item ?? ''));
    }
  }

  return [];
}

function extractJsonCandidate(raw = '') {
  const cleaned = String(raw || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const firstObject = cleaned.indexOf('{');
  const lastObject = cleaned.lastIndexOf('}');

  if (firstObject !== -1 && lastObject !== -1 && lastObject > firstObject) {
    return cleaned.slice(firstObject, lastObject + 1);
  }

  const firstArray = cleaned.indexOf('[');
  const lastArray = cleaned.lastIndexOf(']');
  if (firstArray !== -1 && lastArray !== -1 && lastArray > firstArray) {
    return cleaned.slice(firstArray, lastArray + 1);
  }

  return cleaned;
}

function tryParseJsonWithRepairs(raw = '') {
  const candidates = [];
  const base = extractJsonCandidate(raw);

  if (base) {
    candidates.push(base);
    candidates.push(base.replace(/,\s*([}\]])/g, '$1'));

    const singleQuoteFixed = base
      .replace(/([{,]\s*)'([^'\\]+)'\s*:/g, '$1"$2":')
      .replace(/:\s*'((?:[^'\\]|\\.)*)'/g, ': "$1"')
      .replace(/,\s*([}\]])/g, '$1');
    candidates.push(singleQuoteFixed);
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // keep trying repairs
    }
  }

  return null;
}

function decodeEscapedJsonString(value = '') {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value;
  }
}

function extractInputsByRegex(raw = '') {
  const text = String(raw || '');
  const inputs = [];

  const objectInputMatches = text.matchAll(
    /"input"\s*:\s*"((?:\\.|[^"\\])*)"/g
  );

  for (const match of objectInputMatches) {
    inputs.push(decodeEscapedJsonString(match[1] || ''));
  }

  if (inputs.length > 0) {
    return inputs;
  }

  const arrayMatch = text.match(/"inputs"\s*:\s*\[((?:.|\n|\r)*?)\]/i);
  if (arrayMatch?.[1]) {
    const itemMatches = arrayMatch[1].matchAll(/"((?:\\.|[^"\\])*)"/g);
    for (const match of itemMatches) {
      const decoded = decodeEscapedJsonString(match[1] || '');
      if (decoded.trim().length > 0) {
        inputs.push(decoded);
      }
    }
  }

  return inputs;
}

function parseCandidateInputs(rawResponse = '') {
  const parsed = tryParseJsonWithRepairs(rawResponse);
  if (parsed !== null) {
    const extracted = collectInputsFromParsed(parsed);
    if (extracted.length > 0) {
      return extracted;
    }
  }

  const regexFallbackInputs = extractInputsByRegex(rawResponse);
  if (regexFallbackInputs.length > 0) {
    return regexFallbackInputs;
  }

  logger.warn('Failed to parse AI fuzzer response into candidate inputs');
  return [];
}

async function verifyGeneratedTestCases({
  referenceCode,
  language,
  testCases,
  timeLimitMs,
  memoryLimitKb,
}) {
  if (!Array.isArray(testCases) || testCases.length === 0) {
    return { verifiedCases: [], rejected: 0 };
  }

  const verificationResults = await executeReferenceBatch({
    referenceCode,
    language,
    inputs: testCases.map((tc) => String(tc.input ?? '')),
    timeLimitMs,
    memoryLimitKb,
    executionModel: 'stdin_legacy',
  });

  const byId = new Map();
  verificationResults.forEach((result) => {
    byId.set(String(result.test_case_id), result);
  });

  const verifiedCases = [];
  let rejected = 0;

  for (let index = 0; index < testCases.length; index++) {
    const id = String(index + 1);
    const existingCase = testCases[index];
    const verification = byId.get(id);

    if (!verification) {
      rejected += 1;
      continue;
    }

    const status = String(verification.status || '').toLowerCase();
    if (status === 'compile_error') {
      throw new Error(
        verification.stderr ||
          'Reference code failed while verifying generated test cases'
      );
    }

    if (
      status === 'runtime_error' ||
      status === 'time_limit_exceeded' ||
      Number(verification.exitCode || 0) !== 0
    ) {
      rejected += 1;
      continue;
    }

    const expected = normalizeExpectedOutput(existingCase.expected_output);
    const actual = normalizeExpectedOutput(verification.stdout);

    if (expected !== actual) {
      rejected += 1;
      continue;
    }

    verifiedCases.push(existingCase);
  }

  return { verifiedCases, rejected };
}

async function collectAiResponse(prompt, aiConfig = {}) {
  const messages = [{ role: 'user', parts: [{ text: prompt }] }];
  let fullResponse = '';

  await aiService.chat(messages, null, aiConfig, (chunk) => {
    fullResponse += chunk;
  });

  return fullResponse;
}

function shouldUseDirectLocal(language) {
  const dockerUp = isDockerAvailable();
  const localOk = config.allowLocalExecution && isLocalAvailable(language);

  if (!dockerUp && localOk) return true;
  if (poolManager.useLocal && localOk) return true;
  return false;
}

async function executeReferenceBatch({
  referenceCode,
  language,
  inputs,
  timeLimitMs,
  memoryLimitKb,
  executionModel = 'stdin_legacy',
}) {
  const useLocal = shouldUseDirectLocal(language);
  const runner = useLocal ? localBatchCode : runBatchCode;

  if (typeof runner !== 'function') {
    throw new Error('No execution runner available for test case generation');
  }

  const batch = inputs.map((input, index) => ({
    id: index + 1,
    stdinInput: input,
    expectedOutput: '',
    is_hidden: false,
    time_limit_ms: timeLimitMs,
    memory_limit_kb: memoryLimitKb,
  }));

  const options = {
    executionModel,
    failFast: false,
    earlyExit: false,
    mode: 'run',
  };

  return runner(referenceCode, language, batch, options);
}

function hasAnyNonEmptyStdout(results = []) {
  return results.some(
    (result) => String(result?.stdout ?? '').trim().length > 0
  );
}

function hasCompileError(results = []) {
  return results.some(
    (result) => String(result?.status || '').toLowerCase() === 'compile_error'
  );
}

async function generateFuzzTestCases(payload = {}) {
  const parsed = fuzzSchema.parse(payload);
  const normalizedLanguage =
    parsed.language === 'py' ? 'python' : parsed.language;
  const requestedCount = parsed.count;
  const attemptCandidateCounts = buildAttemptCandidateCounts(requestedCount);

  const existingInputs = (parsed.existingInputs || [])
    .map(normalizeInput)
    .filter((item) => item.length > 0);

  const timeLimitMs = parsed.timeLimitMs || 2000;
  const memoryLimitKb =
    parsed.memoryLimitKb || (normalizedLanguage === 'java' ? 262144 : 65536);

  const incomingConfig = parsed.config || {};
  const envProvider = config.ai.provider || 'gemini';

  const aiConfig = {
    provider: envProvider,
    model: config.ai.model || incomingConfig.model,
    ollamaUrl: config.ai.ollamaUrl || incomingConfig.ollamaUrl,
    requestTimeoutMs:
      Number(incomingConfig.requestTimeoutMs) > 0
        ? Number(incomingConfig.requestTimeoutMs)
        : 300000,
    maxOutputTokens:
      Number(incomingConfig.maxOutputTokens) > 0
        ? Number(incomingConfig.maxOutputTokens)
        : requestedCount >= 80
          ? 12288
          : 8192,
  };

  if (envProvider === 'gemini') {
    aiConfig.apiKey =
      config.ai.apiKey2 || config.ai.apiKey || incomingConfig.apiKey;
  }

  let lastRawResponse = '';
  let parsedCandidateInputs = [];

  for (let attempt = 0; attempt < attemptCandidateCounts.length; attempt++) {
    const attemptCandidateCount = attemptCandidateCounts[attempt];
    const prompt =
      attempt === 0 || !lastRawResponse.trim()
        ? buildCandidateInputPrompt({
            description: parsed.description,
            referenceCode: parsed.referenceCode,
            language: normalizedLanguage,
            candidateCount: attemptCandidateCount,
            existingInputs,
          })
        : buildCandidateRepairPrompt({
            language: normalizedLanguage,
            candidateCount: attemptCandidateCount,
            previousResponse: lastRawResponse.slice(0, 12000),
          });

    try {
      const aiRaw = await collectAiResponse(prompt, aiConfig);
      lastRawResponse = aiRaw;
      parsedCandidateInputs = parseCandidateInputs(aiRaw)
        .map(normalizeInput)
        .filter((item) => item.length > 0);

      logger.info('Fuzzer AI candidate parse attempt', {
        attempt: attempt + 1,
        parsedCount: parsedCandidateInputs.length,
        requestedCandidateCount: attemptCandidateCount,
      });

      if (parsedCandidateInputs.length > 0) {
        break;
      }
    } catch (error) {
      logger.warn('Fuzzer AI candidate generation attempt failed', {
        attempt: attempt + 1,
        requestedCandidateCount: attemptCandidateCount,
        error: error.message,
      });

      if (attempt === attemptCandidateCounts.length - 1) {
        throw error;
      }
    }
  }

  // When large requests fail to parse, fall back to smaller fresh prompts.
  if (parsedCandidateInputs.length === 0 && requestedCount >= 80) {
    const fallbackCounts = [45, 35, 25];

    for (let attempt = 0; attempt < fallbackCounts.length; attempt++) {
      const attemptCandidateCount = fallbackCounts[attempt];
      const prompt = buildCandidateInputPrompt({
        description: parsed.description,
        referenceCode: parsed.referenceCode,
        language: normalizedLanguage,
        candidateCount: attemptCandidateCount,
        existingInputs,
      });

      try {
        const aiRaw = await collectAiResponse(prompt, aiConfig);
        parsedCandidateInputs = parseCandidateInputs(aiRaw)
          .map(normalizeInput)
          .filter((item) => item.length > 0);

        logger.info('Fuzzer AI fallback parse attempt', {
          attempt: attempt + 1,
          parsedCount: parsedCandidateInputs.length,
          requestedCandidateCount: attemptCandidateCount,
        });

        if (parsedCandidateInputs.length > 0) {
          break;
        }
      } catch (error) {
        logger.warn('Fuzzer AI fallback generation attempt failed', {
          attempt: attempt + 1,
          requestedCandidateCount: attemptCandidateCount,
          error: error.message,
        });
      }
    }
  }

  const candidateInputs = parsedCandidateInputs;

  const existingSet = new Set(existingInputs);
  const seen = new Set(existingInputs);
  const uniqueCandidates = [];

  for (const input of candidateInputs) {
    if (seen.has(input)) continue;
    seen.add(input);
    uniqueCandidates.push(input);
  }

  if (uniqueCandidates.length < requestedCount) {
    const shortfall = requestedCount - uniqueCandidates.length;
    const topUpCounts = [
      Math.min(80, shortfall + 25),
      Math.min(60, shortfall + 10),
    ];

    for (let attempt = 0; attempt < topUpCounts.length; attempt++) {
      const attemptCandidateCount = topUpCounts[attempt];
      if (attemptCandidateCount <= 0) continue;

      const prompt = buildCandidateInputPrompt({
        description: parsed.description,
        referenceCode: parsed.referenceCode,
        language: normalizedLanguage,
        candidateCount: attemptCandidateCount,
        existingInputs: [...uniqueCandidates, ...existingInputs],
      });

      try {
        const aiRaw = await collectAiResponse(prompt, aiConfig);
        const topUpInputs = parseCandidateInputs(aiRaw)
          .map(normalizeInput)
          .filter((item) => item.length > 0);

        let addedCount = 0;
        for (const input of topUpInputs) {
          if (seen.has(input)) continue;
          seen.add(input);
          uniqueCandidates.push(input);
          addedCount += 1;
        }

        logger.info('Fuzzer AI top-up attempt', {
          attempt: attempt + 1,
          requestedCandidateCount: attemptCandidateCount,
          parsedCount: topUpInputs.length,
          addedCount,
          totalCandidates: uniqueCandidates.length,
        });

        if (uniqueCandidates.length >= requestedCount) {
          break;
        }
      } catch (error) {
        logger.warn('Fuzzer AI top-up generation attempt failed', {
          attempt: attempt + 1,
          requestedCandidateCount: attemptCandidateCount,
          error: error.message,
        });
      }
    }
  }

  if (uniqueCandidates.length === 0) {
    throw new Error('Could not generate valid candidate inputs from AI');
  }

  let runnerResults = await executeReferenceBatch({
    referenceCode: parsed.referenceCode,
    language: normalizedLanguage,
    inputs: uniqueCandidates,
    timeLimitMs,
    memoryLimitKb,
    executionModel: 'stdin_legacy',
  });

  // If legacy mode yields empty stdout everywhere, retry wrapper harness once.
  if (
    !hasAnyNonEmptyStdout(runnerResults) &&
    !hasCompileError(runnerResults) &&
    ['python', 'c', 'java', 'py'].includes(normalizedLanguage)
  ) {
    logger.warn(
      'Fuzzer legacy execution produced empty stdout; retrying wrapper harness model',
      {
        language: normalizedLanguage,
        candidateCount: uniqueCandidates.length,
      }
    );

    runnerResults = await executeReferenceBatch({
      referenceCode: parsed.referenceCode,
      language: normalizedLanguage,
      inputs: uniqueCandidates,
      timeLimitMs,
      memoryLimitKb,
      executionModel: 'wrapper_harness',
    });
  }

  const byId = new Map();
  runnerResults.forEach((result) => {
    byId.set(String(result.test_case_id), result);
  });

  const testCases = [];
  let compileError = null;
  let runtimeRejected = 0;
  let timeoutRejected = 0;
  let emptyOutputRejected = 0;

  for (let index = 0; index < uniqueCandidates.length; index++) {
    const id = String(index + 1);
    const input = uniqueCandidates[index];
    const result = byId.get(id);

    if (!result) continue;

    const status = String(result.status || '').toLowerCase();
    if (status === 'compile_error') {
      compileError = result.stderr || 'Reference code failed to compile';
      break;
    }

    if (status === 'time_limit_exceeded') {
      timeoutRejected += 1;
      continue;
    }

    if (status === 'runtime_error' || Number(result.exitCode || 0) !== 0) {
      runtimeRejected += 1;
      continue;
    }

    if (existingSet.has(input)) continue;

    const normalizedExpectedOutput = normalizeExpectedOutput(result.stdout);
    if (normalizedExpectedOutput.length === 0) {
      emptyOutputRejected += 1;
      continue;
    }

    testCases.push({
      input,
      expected_output: normalizedExpectedOutput,
      is_hidden: false,
      time_limit_ms: timeLimitMs,
      memory_limit_kb: memoryLimitKb,
    });

    if (testCases.length >= requestedCount) {
      break;
    }
  }

  if (compileError) {
    throw new Error(compileError);
  }

  if (testCases.length === 0 && emptyOutputRejected > 0) {
    throw new Error(
      'Reference code produced empty stdout for all valid inputs. Ensure it reads stdin and prints output to stdout.'
    );
  }

  const { verifiedCases, rejected: verificationRejected } =
    await verifyGeneratedTestCases({
      referenceCode: parsed.referenceCode,
      language: normalizedLanguage,
      testCases,
      timeLimitMs,
      memoryLimitKb,
    });

  return {
    testCases: verifiedCases,
    meta: {
      requestedCount,
      generatedCount: verifiedCases.length,
      candidateCount: uniqueCandidates.length,
      runtimeRejected,
      timeoutRejected,
      emptyOutputRejected,
      verificationRejected,
    },
  };
}

module.exports = {
  generateFuzzTestCases,
  fuzzSchema,
};
