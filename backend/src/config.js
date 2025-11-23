require("dotenv").config();

module.exports = {
    port: process.env.PORT || 5002,
    docker: {
        memory: process.env.DOCKER_MEMORY_LIMIT || "128m",
        cpus: process.env.DOCKER_CPU_LIMIT || "0.5",
        pidsLimit: process.env.DOCKER_PIDS_LIMIT || "64",
        javaMemory: process.env.DOCKER_JAVA_MEMORY_LIMIT || "256m",
        javaPidsLimit: process.env.DOCKER_JAVA_PIDS_LIMIT || "128",
    },
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100, // Limit each IP to 100 requests per windowMs
    },
    cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    },
    ai: {
        provider: process.env.AI_PROVIDER || "gemini", // 'gemini', 'ollama', 'mock'
        apiKey: process.env.AI_API_KEY,
        model: process.env.AI_MODEL || "gemini-1.5-flash",
        ollamaUrl: process.env.OLLAMA_URL || "http://127.0.0.1:11434",
    },
};
