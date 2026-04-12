const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

/* ----------------------------- HELPERS ----------------------------- */

const buildSystemPrompt = (contextData) => {
  let codeContext = '';
  let meta = [];

  if (typeof contextData === 'string') {
    codeContext = contextData;
  } else if (contextData) {
    if (contextData.activeFile)
      meta.push(`Active File: ${contextData.activeFile}`);
    if (contextData.cursorPosition)
      meta.push(
        `Cursor: Ln ${contextData.cursorPosition.lineNumber}, Col ${contextData.cursorPosition.column}`
      );
    if (contextData.files?.length)
      meta.push(
        `Project Files: ${contextData.files.map((f) => f.name).join(', ')}`
      );

    codeContext = contextData.code || '';
  }

  return `
You are an expert software engineer and coding assistant.

${meta.length ? meta.join('\n') : ''}

Current Code Context:
\`\`\`
${codeContext || 'No code provided'}
\`\`\`

Guidelines:
- Give precise, correct solutions.
- IF the user asks for CODE:
  - CRITICAL: Output ONLY valid code wrapped in markdown code blocks (e.g., \`\`\`javascript ... \`\`\`).
  - CRITICAL: Do NOT include any text outside the code blocks. No "Here is the code", no conversational filler.
  - CRITICAL: Do NOT include any comments in the code. Remove all comments.
  - CRITICAL: Provide COMPLETELY EXECUTABLE code.
- IF the user asks for an EXPLANATION:
  - Provide a clear, concise explanation in PLAIN TEXT.
  - Do NOT wrap the explanation in markdown code blocks (no \`\`\`).
  - You may use markdown for formatting (bold, italic, lists).
- Default behavior should be code-only if the intent is ambiguous.
`.trim();
};

const normalizeMessages = (messages) =>
  messages.map((m) => ({
    role: m.role === 'model' ? 'assistant' : 'user',
    content: m.parts?.[0]?.text || '',
  }));

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseErrorStatusCode = (error) => {
  const directStatus = Number(
    error?.status || error?.statusCode || error?.response?.status
  );
  if (Number.isFinite(directStatus) && directStatus > 0) {
    return directStatus;
  }

  const message = String(error?.message || '');
  const statusMatch = message.match(/\[(\d{3})[^\]]*\]/);
  if (statusMatch) {
    return Number(statusMatch[1]);
  }

  return null;
};

const isRetryableGeminiError = (error) => {
  const statusCode = parseErrorStatusCode(error);
  if (statusCode && RETRYABLE_STATUS_CODES.has(statusCode)) {
    return true;
  }

  const message = String(error?.message || '').toLowerCase();
  const retryableHints = [
    'high demand',
    'service unavailable',
    'temporarily unavailable',
    'try again later',
    'resource exhausted',
    'rate limit',
    'deadline exceeded',
    'overloaded',
    'socket hang up',
    'econnreset',
    'etimedout',
    'fetch failed',
  ];

  return retryableHints.some((hint) => message.includes(hint));
};

const getGeminiModelCandidates = (primaryModel, configOverrides = {}) => {
  const configuredFallbacks = Array.isArray(configOverrides?.fallbackModels)
    ? configOverrides.fallbackModels
    : typeof configOverrides?.fallbackModels === 'string'
      ? configOverrides.fallbackModels.split(',')
      : [];

  const defaults = ['gemini-2.0-flash', 'gemini-1.5-flash'];

  return [primaryModel, ...configuredFallbacks, ...defaults]
    .map((model) => String(model || '').trim())
    .filter(Boolean)
    .filter((model, index, allModels) => allModels.indexOf(model) === index);
};

const computeBackoffMs = (attemptNumber) => {
  const exponential = Math.min(
    10000,
    800 * 2 ** Math.max(0, attemptNumber - 1)
  );
  const jitter = Math.floor(Math.random() * 350);
  return exponential + jitter;
};

/* ----------------------------- GEMINI ----------------------------- */

const chatWithGeminiStream = async (
  messages,
  systemPrompt,
  configOverrides,
  onChunk,
  abortSignal
) => {
  const apiKey = configOverrides?.apiKey || config.ai.apiKey;
  const primaryModelName =
    configOverrides?.model || config.ai.model || 'gemini-1.5-flash';
  const maxRetries =
    Number.isFinite(Number(configOverrides?.maxRetries)) &&
    Number(configOverrides?.maxRetries) > 0
      ? Math.min(5, Math.floor(Number(configOverrides.maxRetries)))
      : 3;

  if (!apiKey) throw new Error('Gemini API key missing');

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelCandidates = getGeminiModelCandidates(
    primaryModelName,
    configOverrides
  );
  const generationConfig = {};
  if (configOverrides?.maxOutputTokens) {
    generationConfig.maxOutputTokens = configOverrides.maxOutputTokens;
  }

  const lastMessage = messages[messages.length - 1]?.parts?.[0]?.text;
  if (!lastMessage) return;

  let lastError = null;

  for (let modelIndex = 0; modelIndex < modelCandidates.length; modelIndex++) {
    const modelName = modelCandidates[modelIndex];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let emittedChunks = 0;
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig,
        });

        const chat = model.startChat({
          history: [
            { role: 'user', parts: [{ text: systemPrompt }] },
            { role: 'model', parts: [{ text: 'Ready.' }] },
            ...messages.slice(0, -1),
          ],
        });

        const result = await chat.sendMessageStream(lastMessage, {
          signal: abortSignal,
        });

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (!text) continue;
          emittedChunks += 1;
          onChunk(text);
        }

        return;
      } catch (error) {
        lastError = error;

        const statusCode = parseErrorStatusCode(error);
        const retryable = isRetryableGeminiError(error);
        const hasMoreModels = modelIndex < modelCandidates.length - 1;
        const hasMoreAttemptsForModel = attempt < maxRetries;

        logger.warn('Gemini stream attempt failed', {
          model: modelName,
          attempt,
          maxRetries,
          statusCode,
          retryable,
          emittedChunks,
          error: error?.message,
        });

        // Avoid replaying partial output if streaming already started.
        if (emittedChunks > 0) {
          throw error;
        }

        if (!retryable) {
          throw error;
        }

        if (!hasMoreAttemptsForModel && !hasMoreModels) {
          break;
        }

        const backoffMs = hasMoreAttemptsForModel
          ? computeBackoffMs(attempt)
          : 300;
        await sleep(backoffMs);
      }
    }
  }

  if (lastError && isRetryableGeminiError(lastError)) {
    throw new Error(
      'AI provider is currently under high demand. Please retry in a few moments.'
    );
  }

  if (lastError) {
    throw lastError;
  }
};

/* ----------------------------- OLLAMA ----------------------------- */

const chatWithOllamaStream = async (
  messages,
  systemPrompt,
  configOverrides,
  onChunk,
  abortSignal
) => {
  const baseUrl = configOverrides?.ollamaUrl || config.ai.ollamaUrl;
  const model = configOverrides?.model || config.ai.model || 'qwen2.5-coder';
  const requestedTimeoutMs = Number(configOverrides?.requestTimeoutMs);
  const timeoutMs =
    Number.isFinite(requestedTimeoutMs) && requestedTimeoutMs > 0
      ? requestedTimeoutMs
      : 300000;

  const payload = {
    model,
    stream: true,
    options: {
      num_ctx: 4096,
      num_thread: 8,
      keep_alive: '30m',
    },
    messages: [
      { role: 'system', content: systemPrompt },
      ...normalizeMessages(messages),
    ],
  };

  try {
    const response = await axios.post(`${baseUrl}/api/chat`, payload, {
      responseType: 'stream',
      signal: abortSignal,
      timeout: timeoutMs,
    });

    const emitLine = (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const json = JSON.parse(trimmed);
        if (json.error) {
          throw new Error(String(json.error));
        }
        if (json.message?.content) {
          onChunk(json.message.content);
          return;
        }
        if (typeof json.response === 'string') {
          onChunk(json.response);
        }
      } catch {
        // Ignore malformed or partial lines and continue streaming.
      }
    };

    let pending = '';

    for await (const chunk of response.data) {
      pending += chunk.toString('utf8');
      const lines = pending.split('\n');
      pending = lines.pop() || '';

      for (const line of lines) {
        emitLine(line);
      }
    }

    if (pending.trim()) {
      emitLine(pending);
    }
  } catch (err) {
    logger.error('Ollama error details:', {
      message: err.message,
      code: err.code,
      status: err.response?.status,
      statusText: err.response?.statusText,
      timeoutMs,
    });
    throw new Error(`Ollama request failed: ${err.message}`);
  }
};

/* ----------------------------- MOCK ----------------------------- */

const chatWithMockStream = async (onChunk) => {
  const text = 'Mock AI streaming response.';
  for (const word of text.split(' ')) {
    onChunk(word + ' ');
    await new Promise((r) => setTimeout(r, 80));
  }
};

/* ----------------------------- MAIN API ----------------------------- */

const chatStream = async (
  messages = [],
  contextData,
  configOverrides = {},
  onChunk,
  abortSignal
) => {
  if (typeof configOverrides === 'function') {
    onChunk = configOverrides;
    configOverrides = {};
  }

  if (!messages.length) return;

  const systemPrompt = buildSystemPrompt(contextData);
  const provider = config.ai.provider || configOverrides?.provider || 'gemini';
  const effectiveConfig = {
    ...configOverrides,
    provider,
  };

  if (provider === 'gemini') {
    effectiveConfig.model = config.ai.model || configOverrides?.model;
    effectiveConfig.apiKey =
      config.ai.apiKey2 || config.ai.apiKey || configOverrides?.apiKey;
  } else if (provider === 'ollama') {
    effectiveConfig.model = config.ai.model || configOverrides?.model;
    effectiveConfig.ollamaUrl =
      config.ai.ollamaUrl || configOverrides?.ollamaUrl;
  }

  logger.info(`AI Chat Request: Provider=${provider}`, {
    model: effectiveConfig.model,
  });

  switch (provider) {
    case 'gemini':
      return chatWithGeminiStream(
        messages,
        systemPrompt,
        effectiveConfig,
        onChunk,
        abortSignal
      );
    case 'ollama':
      return chatWithOllamaStream(
        messages,
        systemPrompt,
        effectiveConfig,
        onChunk,
        abortSignal
      );
    case 'mock':
      return chatWithMockStream(onChunk);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
};

module.exports = { chat: chatStream };
