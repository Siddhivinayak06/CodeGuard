const logger = require('../utils/logger');

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    // req.user is dynamically populated by authMiddleware.js
    if (!req.user) {
      return res.status(401).json({
        error: {
          message: 'Authentication required. No user specific data found.',
        },
      });
    }

    const role =
      req.user.app_metadata?.role || req.user.user_metadata?.role || 'student';

    if (!allowedRoles.includes(role)) {
      logger.warn(
        `User ${req.user.id} (role: ${role}) denied access to ${req.originalUrl}. Required roles: ${allowedRoles.join(', ')}`
      );
      return res.status(403).json({
        error: {
          message: 'Permission denied. Insufficient role for this action.',
        },
      });
    }

    next();
  };
};

module.exports = { requireRole };
