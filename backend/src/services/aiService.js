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
- Give precise, correct solutions
- Modify only what is necessary
- Prefer clean, production-ready code
- Explain briefly if required
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
    configOverrides?.model || config.ai.model || 'gemini-2.5-flash';

  if (!apiKey) throw new Error('Gemini API key missing');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

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
  const model = configOverrides?.model || config.ai.model || 'mistral';

  const payload = {
    model,
    stream: true,
    messages: [{ role: 'system', content: systemPrompt }, ...normalizeMessages(messages)],
  };

  try {
    const response = await axios.post(`${baseUrl}/api/chat`, payload, {
      responseType: 'stream',
      signal: abortSignal,
    });

    for await (const chunk of response.data) {
      const lines = chunk.toString().split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.message?.content) {
            onChunk(json.message.content);
          }
        } catch {
          /* ignore partial JSON */
        }
      }
    }
  } catch (err) {
    logger.error('Ollama error:', err.message);
    throw new Error(`Ollama not reachable at ${baseUrl}`);
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
  const provider = configOverrides?.provider || config.ai.provider || 'gemini';

  switch (provider) {
    case 'gemini':
      return chatWithGeminiStream(
        messages,
        systemPrompt,
        configOverrides,
        onChunk,
        abortSignal
      );
    case 'ollama':
      return chatWithOllamaStream(
        messages,
        systemPrompt,
        configOverrides,
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
