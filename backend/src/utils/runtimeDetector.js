// src/utils/runtimeDetector.js
// Detects locally installed compilers/interpreters at startup.
const { execSync } = require('child_process');
const logger = require('./logger');

const RUNTIME_COMMANDS = {
    python: ['python3', 'python'],
    c: ['gcc'],
    cpp: ['g++'],
    java: ['javac'],
};

// Additional commands required to RUN (not just compile)
const RUNTIME_RUN_COMMANDS = {
    java: ['java'], // Need both javac and java
};

let detectedRuntimes = null;

/**
 * Check if a command exists on the system.
 * @param {string} cmd
 * @returns {string|null} Full path if found, null otherwise
 */
function whichCommand(cmd) {
    try {
        const result = execSync(`which ${cmd} 2>/dev/null`, {
            encoding: 'utf-8',
            timeout: 5000,
        }).trim();
        return result || null;
    } catch {
        return null;
    }
}

/**
 * Detect all available local runtimes.
 * @returns {Object} Map of language -> { compile: path, run: path }
 */
function detectRuntimes() {
    if (detectedRuntimes) return detectedRuntimes;

    detectedRuntimes = {};

    for (const [lang, commands] of Object.entries(RUNTIME_COMMANDS)) {
        let compilerPath = null;

        for (const cmd of commands) {
            const path = whichCommand(cmd);
            if (path) {
                compilerPath = path;
                break;
            }
        }

        if (!compilerPath) {
            logger.info(`[RuntimeDetector] ${lang}: not found locally`);
            continue;
        }

        // Check additional run commands (e.g., java needs both javac and java)
        let runPath = compilerPath;
        const runCommands = RUNTIME_RUN_COMMANDS[lang];
        if (runCommands) {
            let allFound = true;
            for (const cmd of runCommands) {
                const rPath = whichCommand(cmd);
                if (!rPath) {
                    allFound = false;
                    break;
                }
                runPath = rPath;
            }
            if (!allFound) {
                logger.info(
                    `[RuntimeDetector] ${lang}: compiler found but runner missing`
                );
                continue;
            }
        }

        detectedRuntimes[lang] = { compile: compilerPath, run: runPath };
        logger.info(
            `[RuntimeDetector] ${lang}: ✅ available (${compilerPath})`
        );
    }

    return detectedRuntimes;
}

/**
 * Check if a specific language can be run locally.
 * @param {string} lang
 * @returns {boolean}
 */
function isLocalAvailable(lang) {
    const runtimes = detectRuntimes();
    const normalizedLang =
        lang === 'py' ? 'python' : lang === 'c++' ? 'cpp' : lang;
    return !!runtimes[normalizedLang];
}

/**
 * Check if Docker is available and running.
 * @returns {boolean}
 */
function isDockerAvailable() {
    try {
        execSync('docker info 2>/dev/null', {
            encoding: 'utf-8',
            timeout: 5000,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        return true;
    } catch {
        return false;
    }
}

/**
 * Reset cached runtimes (for testing).
 */
function resetCache() {
    detectedRuntimes = null;
}

module.exports = {
    detectRuntimes,
    isLocalAvailable,
    isDockerAvailable,
    resetCache,
};
