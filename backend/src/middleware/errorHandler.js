/**
 * Centralized Error Handler Middleware
 * Handles all errors and sends consistent JSON responses
 */

const logger = require('../utils/logger');
const { AppError } = require('../utils/AppError');

/**
 * Async handler wrapper to catch errors in async routes
 * @param {Function} fn - Async route handler
 * @returns {Function} Express middleware
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Not Found handler for undefined routes
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(
    `Route not found: ${req.originalUrl}`,
    404,
    'ROUTE_NOT_FOUND'
  );
  next(error);
};

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, _next) => {
  // Default values
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'An unexpected error occurred';

  // Log the error
  const logData = {
    message: err.message,
    code,
    statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  };

  if (err.isOperational) {
    // Operational errors - expected errors we can handle
    logger.warn('Operational error', logData);
  } else {
    // Programming or unknown errors - these are bugs
    logger.error('Unexpected error', { ...logData, stack: err.stack });

    // Don't leak error details in production
    if (process.env.NODE_ENV === 'production') {
      message = 'An unexpected error occurred';
      code = 'INTERNAL_ERROR';
    }
  }

  // Handle specific error types
  if (err.name === 'ZodError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    return res.status(statusCode).json({
      error: {
        message,
        code,
        details: err.errors,
      },
    });
  }

  if (err.name === 'SyntaxError' && err.status === 400) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Invalid JSON in request body';
  }

  // Send error response
  const response = {
    error: {
      message,
      code,
      ...(err.details && { details: err.details }),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  };

  res.status(statusCode).json(response);
};

module.exports = {
  asyncHandler,
  notFoundHandler,
  errorHandler,
};
