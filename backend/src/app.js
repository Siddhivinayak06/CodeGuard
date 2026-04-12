const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const { randomUUID } = require('crypto');
const config = require('./config');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/authMiddleware');
const executeRoute = require('./routes/execute');

const app = express();

app.disable('x-powered-by');
if (config.security.trustProxy) {
  app.set('trust proxy', 1);
}

app.use((req, res, next) => {
  const candidate =
    typeof req.headers['x-request-id'] === 'string'
      ? req.headers['x-request-id'].trim()
      : '';
  const requestId = /^[A-Za-z0-9_-]{8,128}$/.test(candidate)
    ? candidate
    : randomUUID();

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

// Security Headers
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: config.isProduction ? undefined : false,
  })
);

morgan.token('id', (req) => req.id || '-');
morgan.token('safe-url', (req) => {
  const url = req.originalUrl || req.url || '/';
  return url.split('?')[0];
});

// Logging - use Winston stream
app.use(
  morgan(
    '[:id] :remote-addr :method :safe-url :status :res[content-length] - :response-time ms',
    {
      stream: { write: (message) => logger.http(message.trim()) },
      skip: (req) => req.path === '/health',
    }
  )
);

// Compression
app.use(compression());

// Rate Limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({
      error: {
        message: 'Too many requests, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
      },
    });
  },
});
app.use(limiter);

const executeLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.executeMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Execute route rate limit exceeded', {
      requestId: req.id,
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json({
      error: {
        message: 'Too many code execution requests. Please retry later.',
        code: 'EXECUTE_RATE_LIMIT_EXCEEDED',
      },
    });
  },
});

const aiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.aiMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('AI route rate limit exceeded', {
      requestId: req.id,
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json({
      error: {
        message: 'Too many AI requests, please try again later.',
        code: 'AI_RATE_LIMIT_EXCEEDED',
      },
    });
  },
});

const allowedOrigins = new Set(config.cors.originList);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      logger.warn('Blocked CORS origin', {
        origin,
      });
      callback(new Error('CORS_ORIGIN_NOT_ALLOWED'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'X-Requested-With',
      'X-Request-Id',
    ],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 60 * 60 * 24,
  })
);

app.use((err, req, res, next) => {
  if (err && err.message === 'CORS_ORIGIN_NOT_ALLOWED') {
    logger.warn('CORS rejected request', {
      requestId: req.id,
      ip: req.ip,
      origin: req.headers.origin,
      path: req.path,
    });

    return res.status(403).json({
      error: {
        message: 'Origin is not allowed by CORS policy.',
        code: 'CORS_ORIGIN_REJECTED',
      },
    });
  }

  next(err);
});

app.use(
  express.json({
    limit: '2mb',
    type: ['application/json', 'application/*+json'],
  })
);
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// Routes (protected by auth middleware)
app.use('/execute', executeLimiter, authMiddleware, executeRoute);
app.use('/ai', aiLimiter, authMiddleware, require('./routes/ai'));

// Health check
app.get('/health', (req, res) =>
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
);

// 404 handler
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
