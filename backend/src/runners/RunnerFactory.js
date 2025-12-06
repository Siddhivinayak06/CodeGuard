/**
 * Runner Factory
 * Factory pattern for creating language-specific runners
 */

const PythonRunner = require('./PythonRunner');
const CRunner = require('./CRunner');
const JavaRunner = require('./JavaRunner');
const { UnsupportedError } = require('../utils/AppError');
const logger = require('../utils/logger');

// Singleton instances
const runners = {
  python: new PythonRunner(),
  py: null, // Alias, set below
  c: new CRunner(),
  cpp: null, // Use C runner for now (can create CppRunner later)
  java: new JavaRunner(),
};

// Set up aliases
runners.py = runners.python;
runners.cpp = runners.c; // CPP uses same runner for now

/**
 * Get a runner for the specified language
 * @param {string} language - Programming language
 * @returns {import('./BaseRunner')} Runner instance
 * @throws {UnsupportedError} If language is not supported
 */
function getRunner(language) {
  const lang = language.toLowerCase().trim();
  const runner = runners[lang];

  if (!runner) {
    const supported = Object.keys(runners).filter((k) => runners[k] !== null);
    throw new UnsupportedError(
      `Unsupported language: ${language}. Supported: ${supported.join(', ')}`
    );
  }

  logger.debug(`Using ${runner.constructor.name} for language: ${language}`);
  return runner;
}

/**
 * Check if a language is supported
 * @param {string} language - Programming language
 * @returns {boolean}
 */
function isSupported(language) {
  const lang = language.toLowerCase().trim();
  return runners[lang] != null;
}

/**
 * Get list of supported languages
 * @returns {string[]}
 */
function getSupportedLanguages() {
  return Object.keys(runners).filter((k) => runners[k] !== null);
}

/**
 * Run code for a specific language
 * @param {string} code - Source code
 * @param {string} language - Programming language
 * @param {import('./BaseRunner').TestCase[]} testCases - Test cases to run
 * @returns {Promise<import('./BaseRunner').ExecutionResult[]>}
 */
async function runCode(code, language, testCases) {
  const runner = getRunner(language);
  return runner.runBatch(code, testCases);
}

module.exports = {
  getRunner,
  isSupported,
  getSupportedLanguages,
  runCode,
};
