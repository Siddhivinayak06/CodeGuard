require('dotenv').config();
const { z } = require('zod');

// Environment variable schema with validation
const envSchema = z.object({
  PORT: z.string().transform(Number).default('5002'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  DOCKER_MEMORY_LIMIT: z.string().default('64m'),
  DOCKER_CPU_LIMIT: z.string().default('0.1'),
  DOCKER_PIDS_LIMIT: z.string().default('64'),
  DOCKER_JAVA_MEMORY_LIMIT: z.string().default('128m'),
  DOCKER_JAVA_PIDS_LIMIT: z.string().default('64'),
  RATE_LIMIT_MAX: z.string().transform(Number).default('500'),
  MAX_CONCURRENT_CONNECTIONS: z.string().transform(Number).default('200'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  AI_PROVIDER: z.enum(['gemini', 'ollama', 'mock']).default('gemini'),
  AI_API_KEY: z.string().optional(),
  AI_API_KEY_2: z.string().optional(),
  AI_MODEL: z.string().default('gemini-1.5-flash'),
  OLLAMA_URL: z.string().default('http://127.0.0.1:11434'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  DOCKER_POOL_SIZE_CPP: z.string().transform(Number).default('5'),
  DOCKER_POOL_SIZE_PYTHON: z.string().transform(Number).default('5'),
  DOCKER_POOL_SIZE_JAVA: z.string().transform(Number).default('5'),
  DOCKER_POOL_SIZE_C: z.string().transform(Number).default('5'),
  WORKERS_PER_CONTAINER: z.string().transform(Number).default('10'),
  USE_PROCESS_POOL: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
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
    pool: {
      cpp: env.DOCKER_POOL_SIZE_CPP,
      python: env.DOCKER_POOL_SIZE_PYTHON,
      java: env.DOCKER_POOL_SIZE_JAVA,
      c: env.DOCKER_POOL_SIZE_C,
    },
    workersPerContainer: env.WORKERS_PER_CONTAINER,
    useProcessPool: env.USE_PROCESS_POOL,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: env.RATE_LIMIT_MAX,
    maxConcurrentConnections: env.MAX_CONCURRENT_CONNECTIONS,
  },
  cors: {
    origin: env.CORS_ORIGIN,
  },
  ai: {
    provider: env.AI_PROVIDER,
    apiKey: env.AI_API_KEY,
    apiKey2: env.AI_API_KEY_2,
    model: env.AI_MODEL,
    ollamaUrl: env.OLLAMA_URL,
  },
  executionTimeout: parseInt(process.env.EXECUTION_TIMEOUT || '15', 10),
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
