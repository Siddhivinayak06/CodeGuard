/**
 * Runners Module
 * Barrel export for all runner-related functionality
 */

const BaseRunner = require('./BaseRunner');
const PythonRunner = require('./PythonRunner');
const CRunner = require('./CRunner');
const JavaRunner = require('./JavaRunner');
const {
  getRunner,
  isSupported,
  getSupportedLanguages,
  runCode,
} = require('./RunnerFactory');

module.exports = {
  // Factory functions
  getRunner,
  isSupported,
  getSupportedLanguages,
  runCode,

  // Runner classes (for testing/extension)
  BaseRunner,
  PythonRunner,
  CRunner,
  JavaRunner,
};
