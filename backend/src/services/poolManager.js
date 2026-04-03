const { spawn } = require('child_process');
const config = require('../config');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const {
  detectRuntimes,
  isLocalAvailable,
  isDockerAvailable,
} = require('../utils/runtimeDetector');

const isDev = config.isDevelopment;

class PoolManager {
  constructor() {
    this.pools = {
      cpp: [],
      python: [],
      java: [],
      c: [],
    };
    this.waiting = {
      cpp: [],
      python: [],
      java: [],
      c: [],
    };
    this.initialized = false;
    this.dockerAvailable = false;
    this.useLocal = false;
  }

  async initialize() {
    if (this.initialized) return;

    // Detect local runtimes first
    const runtimes = detectRuntimes();
    const localLangs = Object.keys(runtimes);
    if (localLangs.length > 0) {
      logger.info(
        `[PoolManager] Local runtimes available: ${localLangs.join(', ')}`
      );
    }

    // Check Docker availability
    this.dockerAvailable = isDockerAvailable();

    // In development mode, prefer local execution per-language.
    // Docker containers are only spun up for languages NOT installed locally.
    if (isDev) {
      const allSupported = ['python', 'c', 'cpp', 'java'];
      const locallyAvailable = allSupported.filter((l) => isLocalAvailable(l));
      const needDocker = allSupported.filter((l) => !isLocalAvailable(l));

      logger.info(
        `[PoolManager] 🛠️  DEV MODE — local-first execution strategy`
      );
      logger.info(
        `[PoolManager]   ✅ Local:  ${locallyAvailable.length > 0 ? locallyAvailable.join(', ') : 'none'}`
      );
      logger.info(
        `[PoolManager]   🐳 Docker: ${needDocker.length > 0 ? needDocker.join(', ') : 'none (all local!)'}`
      );

      if (needDocker.length === 0 || !this.dockerAvailable) {
        // All languages are local, or Docker is unavailable — skip pool init
        this.useLocal = true;
        this.initialized = true;

        if (needDocker.length > 0 && !this.dockerAvailable) {
          logger.warn(
            `[PoolManager] ⚠️  Docker unavailable. Languages without local runtime will fail: ${needDocker.join(', ')}`
          );
        }
        return;
      }

      // Only create Docker containers for languages missing locally
      logger.info(
        `🚀 Initializing Container Pool for docker-only languages: ${needDocker.join(', ')}...`
      );
      const promises = [];
      for (const lang of needDocker) {
        const poolSize = config.docker.pool[lang] || 0;
        for (let i = 0; i < poolSize; i++) {
          promises.push(this._createContainer(lang));
        }
      }
      await Promise.allSettled(promises);
      this.initialized = true;

      const totalContainers = Object.values(this.pools).flat().length;
      logger.info(
        `✅ DEV Pool Initialized (${totalContainers} containers for ${needDocker.join(', ')})`
      );
      return;
    }

    // --- Production / non-dev path ---
    if (!this.dockerAvailable) {
      logger.warn(
        '[PoolManager] ⚠️  Docker is not available. Using local execution only.'
      );
      this.useLocal = true;
      this.initialized = true;

      if (localLangs.length === 0) {
        logger.error(
          '[PoolManager] No local runtimes found and Docker unavailable!'
        );
      }
      return;
    }

    logger.info('🚀 Initializing Container Pool...');

    const promises = [];
    for (const [lang, size] of Object.entries(config.docker.pool)) {
      for (let i = 0; i < size; i++) {
        promises.push(this._createContainer(lang));
      }
    }

    await Promise.allSettled(promises);
    this.initialized = true;

    // Check if any containers were created
    const totalContainers = Object.values(this.pools).flat().length;
    if (totalContainers > 0) {
      logger.info(
        `✅ Container Pool Initialized (${totalContainers} containers)`
      );
    } else {
      logger.warn(
        '[PoolManager] No Docker containers created. Falling back to local execution.'
      );
      this.useLocal = true;
    }
  }

  async _createContainer(lang) {
    const containerName = `pool-${lang}-${uuidv4().slice(0, 8)}`;
    const image =
      lang === 'java'
        ? 'codeguard-java'
        : lang === 'python'
          ? 'codeguard-python'
          : 'codeguard-c';
    const memoryLimit =
      lang === 'java' ? config.docker.javaMemory : config.docker.memory;
    const pidsLimit =
      lang === 'java' ? config.docker.javaPidsLimit : config.docker.pidsLimit;

    const runArgs = [
      'run',
      '--rm',
      ...(config.docker.runtime ? ['--runtime=' + config.docker.runtime] : []),
      '--name',
      containerName,
      '-d',
      '--network',
      'none',
      '--security-opt=no-new-privileges',
      '-m',
      memoryLimit,
      '--cpus=' + config.docker.cpus,
      '--pids-limit',
      pidsLimit,
    ];

    if (lang === 'python') {
      runArgs.push(
        '--read-only',
        '--tmpfs',
        '/tmp:exec,rw,size=128m',
        '--tmpfs',
        '/app/workspace:exec,rw,size=256m,uid=1000,gid=1000,mode=1777'
      );
    } else if (lang === 'java') {
      runArgs.push(
        '--tmpfs',
        '/tmp:exec,rw,size=128m',
        '--tmpfs',
        '/workspace:exec,rw,size=256m,uid=1000,gid=1000,mode=1777'
      );
    } else {
      // C / CPP
      runArgs.push(
        '--tmpfs',
        '/app/workspace:exec,rw,size=256m,uid=1000,gid=1000,mode=1777'
      );
    }

    runArgs.push(image, 'tail', '-f', '/dev/null');

    return new Promise((resolve, reject) => {
      const proc = spawn('docker', runArgs);
      let stderrOut = '';
      if (proc.stderr) {
        proc.stderr.on('data', (d) => {
          stderrOut += d.toString();
        });
      }
      proc.on('error', (err) => reject(err));
      proc.on('close', (code) => {
        if (code === 0) {
          this.pools[lang].push({ id: containerName, activeWorkers: 0 });
          resolve(containerName);
        } else {
          logger.error(
            `Failed to create container for ${lang}. Code: ${code}. Stderr: ${stderrOut}`
          );
          reject(
            new Error(
              `Docker run failed with code ${code}. Stderr: ${stderrOut}`
            )
          );
        }
      });
    });
  }

  async acquire(lang) {
    // DEV MODE: prefer local execution per-language before trying Docker
    if (isDev && config.allowLocalExecution && isLocalAvailable(lang)) {
      logger.info(`[PoolManager] 🛠️  DEV: Using local execution for ${lang}`);
      return 'local';
    }

    // Non-dev fallback: use local only when Docker is entirely unavailable
    if (this.useLocal && config.allowLocalExecution && isLocalAvailable(lang)) {
      logger.info(`[PoolManager] Using local execution for ${lang}`);
      return 'local';
    }

    const pool = this.pools[lang] || this.pools.cpp;
    const available = pool.find(
      (c) => c.activeWorkers < config.docker.workersPerContainer
    );

    if (available) {
      available.activeWorkers++;
      return available.id;
    }

    // No available containers - try to create a new one dynamically
    logger.info(
      `No available ${lang} containers, creating new one dynamically...`
    );

    try {
      // Create a new container with a timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Container creation timeout')), 15000)
      );

      const containerId = await Promise.race([
        this._createContainer(lang),
        timeoutPromise,
      ]);

      // Mark the newly created container as having one worker immediately
      const newContainer = pool.find((c) => c.id === containerId);
      if (newContainer) {
        newContainer.activeWorkers++;
      }

      return containerId;
    } catch (err) {
      logger.error(
        `Failed to create dynamic container for ${lang}:`,
        err.message
      );

      // Fallback: wait in queue with a timeout
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          // Remove from waiting queue
          const idx = this.waiting[lang].indexOf(resolveFunc);
          if (idx > -1) this.waiting[lang].splice(idx, 1);
          reject(new Error(`No container available for ${lang} after timeout`));
        }, 10000);

        const resolveFunc = (containerId) => {
          clearTimeout(timeout);
          resolve(containerId);
        };

        this.waiting[lang].push(resolveFunc);
      });
    }
  }

  async release(lang, containerId) {
    // No-op for local execution
    if (containerId === 'local') return;

    const pool = this.pools[lang];
    if (!pool) return;

    const container = pool.find((c) => c.id === containerId);
    const otherWorkersActive = container && container.activeWorkers > 1;

    await this.resetContainer(containerId, otherWorkersActive);

    if (container) {
      container.activeWorkers = Math.max(0, container.activeWorkers - 1);

      if (
        this.waiting[lang].length > 0 &&
        container.activeWorkers < config.docker.workersPerContainer
      ) {
        const next = this.waiting[lang].shift();
        container.activeWorkers++;
        next(containerId);
      }
    }
  }

  async resetContainer(containerId, hasOtherWorkers = false) {
    logger.info(`Cleaning up container ${containerId}...`);
    // In multi-worker mode, only do a lightweight cleanup if others are still running.
    // Full cleanup (pkill) only when no other workers are using the container.
    const resetCmd = hasOtherWorkers
      ? `rm -rf /tmp/*`
      : `rm -rf /tmp/* && (pkill -u 1000 -x python3 || pkill -u 1000 -x a.out || true)`;

    return new Promise((resolve) => {
      const proc = spawn('docker', ['exec', containerId, 'sh', '-c', resetCmd]);
      proc.on('close', resolve);
    });
  }

  async cleanup() {
    logger.info('Shutting down Container Pool...');
    const allContainers = Object.values(this.pools)
      .flat()
      .map((c) => c.id);
    for (const id of allContainers) {
      spawn('docker', ['rm', '-f', id]);
    }
  }
}

module.exports = new PoolManager();
