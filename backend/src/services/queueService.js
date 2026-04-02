const { Queue, Worker, QueueEvents } = require('bullmq');
const Redis = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');
const { isLocalAvailable } = require('../utils/runtimeDetector');
let runBatchCode;
let runCode;
let localBatchCode;
let localRunCode;

// Lazy load runners to avoid circular dependencies if any
try {
  runBatchCode = require('../utils/dockerRunner');
  runCode = require('../utils/runCode');
  localBatchCode = require('../utils/localRunner');
  localRunCode = require('../utils/localRunCode');
} catch (error) {
  logger.error('Failed to load runners in queueService', error);
}

const QUEUE_NAME = 'code-execution';
const isEnabled = !config.isDevelopment;

let executeQueue = null;
let queueEvents = null;
let worker = null;
let workerConnection = null;

if (isEnabled) {
  // Create connection options
  const redisConfig = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  // Queue connection
  const queueConnection = new Redis(config.redis.url, redisConfig);

  // Worker connection - needs to be separate for blocking commands
  workerConnection = new Redis(config.redis.url, redisConfig);

  // QueueEvents connection - needs to be separate for Pub/Sub
  const eventsConnection = new Redis(config.redis.url, redisConfig);

  executeQueue = new Queue(QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: true,
    },
  });

  queueEvents = new QueueEvents(QUEUE_NAME, {
    connection: eventsConnection,
  });
} else {
  logger.warn(
    'Queue service disabled in development mode; Redis/BullMQ will not be used'
  );
}

const processor = async (job) => {
  const { type, code, lang, batch, input, options = {} } = job.data;
  logger.info(`Processing job ${job.id} type=${type} lang=${lang}`);

  // Determine whether to use local or Docker execution
  const poolManager = require('./poolManager');
  const useLocal =
    poolManager.useLocal &&
    config.allowLocalExecution &&
    isLocalAvailable(lang);

  try {
    if (type === 'batch') {
      if (useLocal) {
        if (!localBatchCode) localBatchCode = require('../utils/localRunner');
        logger.info(`[Queue] Using local batch runner for ${lang}`);
        return await localBatchCode(code, lang, batch, options);
      }
      if (!runBatchCode) runBatchCode = require('../utils/dockerRunner');
      return await runBatchCode(code, lang, batch, options);
    } else {
      if (useLocal) {
        if (!localRunCode) localRunCode = require('../utils/localRunCode');
        logger.info(`[Queue] Using local single runner for ${lang}`);
        return await localRunCode(code, lang, input);
      }
      if (!runCode) runCode = require('../utils/runCode');
      // For problem based runs (reference code), the logic resides mostly in the route
      // but if we are just running code:
      return await runCode(code, lang, input);
    }
  } catch (error) {
    logger.error(`Job ${job.id} failed: ${error.message}`);
    throw error;
  }
};

if (isEnabled) {
  worker = new Worker(QUEUE_NAME, processor, {
    connection: workerConnection,
    concurrency: Math.max(1, Number(config.queue.maxConcurrentJobs) || 20),
    limiter: {
      max: Math.max(1, Number(config.queue.maxConcurrentJobs) || 20),
      duration: 1000,
    },
  });

  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job.id} failed with ${err.message}`);
  });
}

const addJob = async (data) => {
  if (!isEnabled || !executeQueue) {
    throw new Error('Queue service is disabled in development mode');
  }

  return executeQueue.add('execute', data);
};

module.exports = {
  isEnabled,
  addJob,
  executeQueue,
  queueEvents,
  worker,
};
