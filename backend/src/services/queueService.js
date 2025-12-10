const { Queue, Worker, QueueEvents } = require('bullmq');
const Redis = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');
let runBatchCode;
let runCode;

// Lazy load runners to avoid circular dependencies if any
try {
    runBatchCode = require('../utils/dockerRunner');
    runCode = require('../utils/runCode');
} catch (error) {
    logger.error('Failed to load runners in queueService', error);
}

// Create connection options
const redisConfig = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
};

// Queue connection 
const queueConnection = new Redis(config.redis.url, redisConfig);

// Worker connection - needs to be separate for blocking commands
const workerConnection = new Redis(config.redis.url, redisConfig);

// QueueEvents connection - needs to be separate for Pub/Sub
const eventsConnection = new Redis(config.redis.url, redisConfig);

const QUEUE_NAME = 'code-execution';

const executeQueue = new Queue(QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: {
        attempts: 1,
        removeOnComplete: {
            age: 3600, // keep for 1 hour
            count: 1000,
        },
        removeOnFail: {
            age: 24 * 3600, // keep for 24 hours
        },
    },
});

const queueEvents = new QueueEvents(QUEUE_NAME, {
    connection: eventsConnection,
});

const processor = async (job) => {
    const { type, code, lang, batch, input, problem } = job.data;
    logger.info(`Processing job ${job.id} type=${type} lang=${lang}`);

    try {
        if (type === 'batch') {
            if (!runBatchCode) runBatchCode = require('../utils/dockerRunner');
            return await runBatchCode(code, lang, batch);
        } else {
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

const worker = new Worker(QUEUE_NAME, processor, {
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

const addJob = async (data) => {
    return await executeQueue.add('execute', data);
};

module.exports = {
    addJob,
    executeQueue,
    queueEvents,
};
