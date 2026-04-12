const path = require('path');
const dotenv = require('dotenv');

// Prefer backend/.env for local backend runs, then fall back to repo-root .env.
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const { z } = require('zod');

// Environment variable schema with validation
const envSchema = z.object({
  PORT: z.string().transform(Number).default('5002'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  DOCKER_MEMORY_LIMIT: z.string().default('64m'),
  DOCKER_CPU_LIMIT: z.string().default('1.0'),
  DOCKER_PIDS_LIMIT: z.string().default('256'),
  DOCKER_JAVA_MEMORY_LIMIT: z.string().default('128m'),
  DOCKER_JAVA_PIDS_LIMIT: z.string().default('512'),
  DOCKER_RUNTIME: z.string().default(''),
  RATE_LIMIT_MAX: z.string().transform(Number).default('500'),
  RATE_LIMIT_AI_MAX: z.string().transform(Number).default('120'),
  RATE_LIMIT_EXECUTE_MAX: z.string().transform(Number).default('300'),
  MAX_CONCURRENT_CONNECTIONS: z.string().transform(Number).default('200'),
  MAX_CONCURRENT_JOBS: z.string().transform(Number).default('50'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  TRUST_PROXY: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  WS_MAX_PAYLOAD_BYTES: z.string().transform(Number).default('1048576'),
  WS_REQUIRE_ORIGIN: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  AI_PROVIDER: z.enum(['gemini', 'ollama', 'mock']).default('ollama'),
  AI_API_KEY: z.string().optional(),
  AI_API_KEY_2: z.string().optional(),
  AI_MODEL: z.string().default('qwen3.5:9b'),
  OLLAMA_URL: z.string().default('http://127.0.0.1:11434'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  DOCKER_POOL_SIZE_CPP: z.string().transform(Number).default('5'),
  DOCKER_POOL_SIZE_PYTHON: z.string().transform(Number).default('5'),
  DOCKER_POOL_SIZE_JAVA: z.string().transform(Number).default('5'),
  DOCKER_POOL_SIZE_C: z.string().transform(Number).default('5'),
  WORKERS_PER_CONTAINER: z.string().transform(Number).default('15'),
  USE_PROCESS_POOL: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  ENABLE_WRAPPER_HARNESS: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  DEFAULT_EXECUTION_MODEL: z
    .enum(['stdin_legacy', 'wrapper_harness'])
    .default('stdin_legacy'),
  STRICT_FAIL_FAST: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  WRAPPER_HARNESS_LANGS: z.string().default('python,py,c,java'),
  ALLOW_LOCAL_EXECUTION: z
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
const corsOriginList = env.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

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
    runtime: env.DOCKER_RUNTIME,
    pool: {
      cpp: env.DOCKER_POOL_SIZE_CPP,
      python: env.DOCKER_POOL_SIZE_PYTHON,
      java: env.DOCKER_POOL_SIZE_JAVA,
      c: env.DOCKER_POOL_SIZE_C,
    },
    workersPerContainer: env.WORKERS_PER_CONTAINER,
    useProcessPool: env.USE_PROCESS_POOL,
  },
  execution: {
    enableWrapperHarness: env.ENABLE_WRAPPER_HARNESS,
    defaultExecutionModel: env.DEFAULT_EXECUTION_MODEL,
    strictFailFast: env.STRICT_FAIL_FAST,
    wrapperHarnessLangs: env.WRAPPER_HARNESS_LANGS.split(',')
      .map((lang) => lang.trim().toLowerCase())
      .filter(Boolean),
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: env.RATE_LIMIT_MAX,
    aiMax: env.RATE_LIMIT_AI_MAX,
    executeMax: env.RATE_LIMIT_EXECUTE_MAX,
    maxConcurrentConnections: env.MAX_CONCURRENT_CONNECTIONS,
  },
  cors: {
    origin: env.CORS_ORIGIN,
    originList: corsOriginList,
  },
  security: {
    trustProxy: env.TRUST_PROXY,
    wsMaxPayloadBytes: env.WS_MAX_PAYLOAD_BYTES,
    wsRequireOrigin: env.WS_REQUIRE_ORIGIN,
  },
  ai: {
    provider: env.AI_PROVIDER,
    apiKey: env.AI_API_KEY,
    apiKey2: env.AI_API_KEY_2,
    model: env.AI_MODEL,
    ollamaUrl: env.OLLAMA_URL,
  },
  executionTimeout: parseInt(process.env.EXECUTION_TIMEOUT || '15', 10),
  allowLocalExecution: env.ALLOW_LOCAL_EXECUTION,
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
