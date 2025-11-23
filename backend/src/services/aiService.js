const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const config = require("../config");

let genAI;
let model;

// Initialize Gemini if configured
try {
    if (config.ai.provider === "gemini" && config.ai.apiKey) {
        genAI = new GoogleGenerativeAI(config.ai.apiKey);
        model = genAI.getGenerativeModel({ model: config.ai.model });
    } else if (config.ai.provider === "gemini") {
        console.warn("AI_API_KEY is missing for Gemini provider.");
    }
} catch (e) {
    console.error("Failed to initialize GoogleGenerativeAI:", e);
}

const chatWithGeminiStream = async (messages, systemPrompt, configOverrides, onChunk) => {
    const apiKey = configOverrides?.apiKey || config.ai.apiKey;
    const modelName = configOverrides?.model || config.ai.model;

    if (!apiKey) throw new Error("Gemini API Key is missing. Please set it in Settings.");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    const chatSession = model.startChat({
        history: [
            {
                role: "user",
                parts: [{ text: systemPrompt }],
            },
            {
                role: "model",
                parts: [{ text: "Understood. I am ready to help with the code." }],
            },
            ...messages.slice(0, -1),
        ],
    });

    const lastMsg = messages[messages.length - 1];
    const result = await chatSession.sendMessageStream(lastMsg.parts[0].text);

    for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) onChunk(chunkText);
    }
    return "";
};

const chatWithOllamaStream = async (messages, systemPrompt, configOverrides, onChunk) => {
    const baseUrl = configOverrides?.ollamaUrl || config.ai.ollamaUrl;
    const modelName = configOverrides?.model || config.ai.model || "mistral";
    const ollamaUrl = `${baseUrl}/api/chat`;

    const ollamaMessages = [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({
            role: m.role === "model" ? "assistant" : "user",
            content: m.parts[0].text
        }))
    ];

    try {
        const response = await axios.post(ollamaUrl, {
            model: modelName,
            messages: ollamaMessages,
            stream: true,
        }, {
            responseType: 'stream'
        });

        for await (const chunk of response.data) {
            const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
            for (const line of lines) {
                try {
                    const json = JSON.parse(line);
                    if (json.message && json.message.content) {
                        onChunk(json.message.content);
                    }
                } catch (e) {
                    // ignore partial JSON
                }
            }
        }
    } catch (error) {
        console.error("Ollama Stream Error:", error.message);
        throw new Error(`Failed to connect to Ollama at ${baseUrl}. Is it running?`);
    }
};

const chatWithMockStream = async (onChunk) => {
    const mockText = "This is a mock response from the AI Assistant. Streaming is simulated. 🤖";
    const chunks = mockText.split(" ");
    for (const chunk of chunks) {
        onChunk(chunk + " ");
        await new Promise(r => setTimeout(r, 100)); // Simulate delay
    }
};

const chatStream = async (messages, contextData, configOverrides, onChunk) => {
    // Handle optional configOverrides argument
    if (typeof configOverrides === 'function') {
        onChunk = configOverrides;
        configOverrides = {};
    }

    // contextData can be a string (old way) or object (new way)
    let codeContext = "";
    let extraContext = "";

    if (typeof contextData === 'string') {
        codeContext = contextData;
    } else if (contextData) {
        codeContext = contextData.code || "";
        if (contextData.activeFile) extraContext += `Active File: ${contextData.activeFile}\n`;
        if (contextData.cursorPosition) extraContext += `Cursor: Ln ${contextData.cursorPosition.lineNumber}, Col ${contextData.cursorPosition.column}\n`;
        if (contextData.files) extraContext += `Project Files: ${contextData.files.map(f => f.name).join(", ")}\n`;
    }

    const systemPrompt = `You are an expert coding assistant. 
  ${extraContext}
  Current Code Context:
  \`\`\`
  ${codeContext || "No code provided"}
  \`\`\`
  
  Answer the user's question based on this context. Be concise and helpful.`;

    const provider = configOverrides?.provider || config.ai.provider;

    if (provider === "gemini") {
        await chatWithGeminiStream(messages, systemPrompt, configOverrides, onChunk);
    } else if (provider === "ollama") {
        await chatWithOllamaStream(messages, systemPrompt, configOverrides, onChunk);
    } else if (provider === "mock") {
        await chatWithMockStream(onChunk);
    } else {
        throw new Error(`Unknown AI provider: ${provider}`);
    }
};

module.exports = { chat: chatStream }; // Export as chat for compatibility, but it now expects onChunk
