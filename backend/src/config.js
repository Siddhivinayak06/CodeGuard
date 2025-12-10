require('dotenv').config();
const { z } = require('zod');

// Environment variable schema with validation
const envSchema = z.object({
  PORT: z.string().transform(Number).default('5002'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  DOCKER_MEMORY_LIMIT: z.string().default('128m'),
  DOCKER_CPU_LIMIT: z.string().default('0.5'),
  DOCKER_PIDS_LIMIT: z.string().default('64'),
  DOCKER_JAVA_MEMORY_LIMIT: z.string().default('256m'),
  DOCKER_JAVA_PIDS_LIMIT: z.string().default('128'),
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  AI_PROVIDER: z.enum(['gemini', 'ollama', 'mock']).default('gemini'),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('gemini-1.5-flash'),
  OLLAMA_URL: z.string().default('http://127.0.0.1:11434'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  MAX_CONCURRENT_JOBS: z.string().transform(Number).default('20'),
});

// Validate environment variables
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment variables:');
  const errors = parsed.error.flatten().fieldErrors;
  Object.entries(errors).forEach(([key, messages]) => {
    // eslint-disable-next-line no-console
    console.error(`  ${key}: ${messages.join(', ')}`);
  });
  process.exit(1);
}

const env = parsed.data;

/**
 * Application configuration
 * @type {Object}
 */
module.exports = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  docker: {
    memory: env.DOCKER_MEMORY_LIMIT,
    cpus: env.DOCKER_CPU_LIMIT,
    pidsLimit: env.DOCKER_PIDS_LIMIT,
    javaMemory: env.DOCKER_JAVA_MEMORY_LIMIT,
    javaPidsLimit: env.DOCKER_JAVA_PIDS_LIMIT,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: env.RATE_LIMIT_MAX,
  },
  cors: {
    origin: env.CORS_ORIGIN,
  },
  ai: {
    provider: env.AI_PROVIDER,
    apiKey: env.AI_API_KEY,
    model: env.AI_MODEL,
    ollamaUrl: env.OLLAMA_URL,
  },
  logging: {
    level: env.LOG_LEVEL,
  },
  redis: {
    url: env.REDIS_URL,
  },
  queue: {
    maxConcurrentJobs: env.MAX_CONCURRENT_JOBS,
  },
};
