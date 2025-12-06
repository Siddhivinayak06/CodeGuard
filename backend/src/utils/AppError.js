/**
 * Custom Error Classes for CodeGuard
 * Provides structured error handling with proper status codes and error codes
 */

/**
 * Base application error class
 */
class AppError extends Error {
  /**
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {string} code - Error code for client identification
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        ...(process.env.NODE_ENV === 'development' && { stack: this.stack }),
      },
    };
  }
}

/**
 * Validation error for invalid input
 */
class ValidationError extends AppError {
  /**
   * @param {string} message - Error message
   * @param {Array} details - Validation error details
   */
  constructor(message, details = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        details: this.details,
      },
    };
  }
}

/**
 * Error during code execution
 */
class ExecutionError extends AppError {
  /**
   * @param {string} message - Error message
   * @param {string} language - Programming language
   * @param {Object} details - Execution details (stdout, stderr, etc.)
   */
  constructor(message, language = 'unknown', details = {}) {
    super(message, 500, 'EXECUTION_ERROR');
    this.language = language;
    this.details = details;
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        language: this.language,
        details: this.details,
      },
    };
  }
}

/**
 * Error when a resource is not found
 */
class NotFoundError extends AppError {
  /**
   * @param {string} resource - Resource type (e.g., 'Problem', 'User')
   * @param {string} identifier - Resource identifier
   */
  constructor(resource, identifier) {
    super(`${resource} not found: ${identifier}`, 404, 'NOT_FOUND');
    this.resource = resource;
    this.identifier = identifier;
  }
}

/**
 * Error for unsupported operations
 */
class UnsupportedError extends AppError {
  /**
   * @param {string} message - Error message
   */
  constructor(message) {
    super(message, 400, 'UNSUPPORTED_OPERATION');
  }
}

/**
 * Error for timeout scenarios
 */
class TimeoutError extends AppError {
  /**
   * @param {string} operation - Operation that timed out
   * @param {number} timeoutMs - Timeout duration in milliseconds
   */
  constructor(operation, timeoutMs) {
    super(`${operation} timed out after ${timeoutMs}ms`, 408, 'TIMEOUT');
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Error for Docker-related issues
 */
class DockerError extends AppError {
  /**
   * @param {string} message - Error message
   * @param {Object} details - Docker error details
   */
  constructor(message, details = {}) {
    super(message, 500, 'DOCKER_ERROR');
    this.details = details;
  }
}

module.exports = {
  AppError,
  ValidationError,
  ExecutionError,
  NotFoundError,
  UnsupportedError,
  TimeoutError,
  DockerError,
};
