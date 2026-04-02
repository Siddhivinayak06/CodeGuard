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

/* ----------------------------- GEMINI ----------------------------- */

const chatWithGeminiStream = async (
  messages,
  systemPrompt,
  configOverrides,
  onChunk,
  abortSignal
) => {
  const apiKey = configOverrides?.apiKey || config.ai.apiKey;
  const modelName =
    configOverrides?.model || config.ai.model || 'gemini-1.5-flash';

  if (!apiKey) throw new Error('Gemini API key missing');

  const genAI = new GoogleGenerativeAI(apiKey);
  const generationConfig = {};
  if (configOverrides?.maxOutputTokens) {
    generationConfig.maxOutputTokens = configOverrides.maxOutputTokens;
  }
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

  const lastMessage = messages[messages.length - 1]?.parts?.[0]?.text;
  if (!lastMessage) return;

  const result = await chat.sendMessageStream(lastMessage, {
    signal: abortSignal,
  });

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) onChunk(text);
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
