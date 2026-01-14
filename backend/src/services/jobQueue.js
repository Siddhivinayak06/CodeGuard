const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Job Queue Service using Redis
 * Manages code execution jobs for process pool workers
 */
class JobQueue {
  constructor() {
    this.redis = null;
    this.subscriber = null;
    this.publisher = null;
    this.pendingJobs = new Map(); // jobId -> { resolve, reject, timeout }
  }

  async initialize() {
    const redisUrl = config.redis.url;

    // Main Redis client for queue operations
    this.redis = new Redis(redisUrl);

    // Separate client for pub/sub (required by Redis)
    this.subscriber = new Redis(redisUrl);
    this.publisher = new Redis(redisUrl);

    // Subscribe to result channel
    await this.subscriber.subscribe('job-results');

    this.subscriber.on('message', (channel, message) => {
      if (channel === 'job-results') {
        this._handleJobResult(message);
      }
    });

    logger.info('✅ Job Queue initialized');
  }

  /**
   * Enqueue a code execution job
   * @param {string} lang - Language (python, java, c, cpp)
   * @param {string} code - Source code to execute
   * @param {string} sessionId - WebSocket session ID
   * @param {object} options - Additional options (stdin, timeout, etc.)
   * @returns {Promise<object>} - Execution result
   */
  async enqueue(lang, code, sessionId, options = {}) {
    const jobId = uuidv4();
    const queueName = `queue:${lang}`;

    const job = {
      id: jobId,
      sessionId,
      code,
      lang,
      stdin: options.stdin || '',
      timeout: options.timeout || 10000,
      createdAt: Date.now(),
    };

    // Add job to language-specific queue
    await this.redis.lpush(queueName, JSON.stringify(job));

    logger.info(`Job ${jobId} enqueued for ${lang}`);

    // Return a promise that resolves when worker completes the job
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingJobs.delete(jobId);
        reject(
          new Error(
            `Job ${jobId} timed out after ${options.timeout || 30000}ms`
          )
        );
      }, options.timeout || 30000);

      this.pendingJobs.set(jobId, { resolve, reject, timeout, sessionId });
    });
  }

  /**
   * Enqueue job and stream output via callback (for WebSocket streaming)
   */
  async enqueueWithStream(lang, code, sessionId, onOutput, options = {}) {
    const jobId = uuidv4();
    const queueName = `queue:${lang}`;
    const streamChannel = `stream:${jobId}`;

    const job = {
      id: jobId,
      sessionId,
      code,
      lang,
      stdin: options.stdin || '',
      timeout: options.timeout || 10000,
      streamChannel,
      createdAt: Date.now(),
    };

    // Subscribe to streaming output
    const streamSub = new Redis(config.redis.url);
    await streamSub.subscribe(streamChannel);

    streamSub.on('message', (channel, message) => {
      if (channel === streamChannel) {
        try {
          const data = JSON.parse(message);
          if (data.type === 'output') {
            onOutput(data.data);
          } else if (data.type === 'done') {
            streamSub.unsubscribe(streamChannel);
            streamSub.quit();
          }
        } catch (_e) {
          onOutput(message);
        }
      }
    });

    // Add job to queue
    await this.redis.lpush(queueName, JSON.stringify(job));
    logger.info(`Streaming job ${jobId} enqueued for ${lang}`);

    return jobId;
  }

  /**
   * Dequeue a job (called by workers)
   * @param {string} lang - Language to dequeue for
   * @returns {Promise<object|null>} - Job or null if queue empty
   */
  async dequeue(lang) {
    const queueName = `queue:${lang}`;
    const result = await this.redis.brpop(queueName, 5); // 5 second timeout

    if (result) {
      return JSON.parse(result[1]);
    }
    return null;
  }

  /**
   * Publish job result (called by workers)
   */
  async publishResult(jobId, result) {
    const message = JSON.stringify({ jobId, result, completedAt: Date.now() });
    await this.publisher.publish('job-results', message);
  }

  /**
   * Stream output to job (called by workers)
   */
  async streamOutput(streamChannel, data) {
    await this.publisher.publish(
      streamChannel,
      JSON.stringify({ type: 'output', data })
    );
  }

  /**
   * Mark stream as done
   */
  async streamDone(streamChannel) {
    await this.publisher.publish(
      streamChannel,
      JSON.stringify({ type: 'done' })
    );
  }

  /**
   * Handle incoming job result
   */
  _handleJobResult(message) {
    try {
      const { jobId, result } = JSON.parse(message);
      const pending = this.pendingJobs.get(jobId);

      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingJobs.delete(jobId);
        pending.resolve(result);
      }
    } catch (e) {
      logger.error('Error handling job result:', e);
    }
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    const stats = {};
    for (const lang of ['python', 'java', 'c', 'cpp']) {
      stats[lang] = await this.redis.llen(`queue:${lang}`);
    }
    return stats;
  }

  async cleanup() {
    if (this.subscriber) await this.subscriber.quit();
    if (this.publisher) await this.publisher.quit();
    if (this.redis) await this.redis.quit();
  }
}

module.exports = new JobQueue();
