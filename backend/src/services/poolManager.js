const { spawn } = require('child_process');
const config = require('../config');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const {
  detectRuntimes,
  isLocalAvailable,
  isDockerAvailable,
} = require('../utils/runtimeDetector');

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
      proc.on('close', (code) => {
        if (code === 0) {
          this.pools[lang].push({ id: containerName, busy: false });
          resolve(containerName);
        } else {
          logger.error(`Failed to create container for ${lang}`);
          reject(new Error(`Docker run failed with code ${code}`));
        }
      });
    });
  }

  async acquire(lang) {
    // If Docker is unavailable and local execution is allowed, return local token
    if (this.useLocal && config.allowLocalExecution && isLocalAvailable(lang)) {
      logger.info(`[PoolManager] Using local execution for ${lang}`);
      return 'local';
    }

    const pool = this.pools[lang] || this.pools.cpp; // fallback to cpp/c if lang mismatch
    const available = pool.find((c) => !c.busy);

    if (available) {
      available.busy = true;
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

      // Mark the newly created container as busy immediately
      const newContainer = pool.find((c) => c.id === containerId);
      if (newContainer) {
        newContainer.busy = true;
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

    await this.resetContainer(containerId);

    const container = pool.find((c) => c.id === containerId);
    if (container) {
      if (this.waiting[lang].length > 0) {
        const next = this.waiting[lang].shift();
        next(containerId);
      } else {
        container.busy = false;
      }
    }
  }

  async resetContainer(containerId) {
    logger.info(`Cleaning up container ${containerId}...`);
    // 1. Wipe /tmp (the tmpfs)
    // 2. Kill stray user processes (UID 1000 is 'runner')
    // We do this inside the pooled container to ensure a clean slate.
    const resetCmd = `rm -rf /tmp/* && (pkill -u 1000 -x python3 || pkill -u 1000 -x a.out || true)`;

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
