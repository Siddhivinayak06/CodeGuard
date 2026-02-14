/**
 * Authentication Middleware
 * Validates Supabase JWT tokens from the Authorization header.
 * Attaches the verified user to `req.user` for downstream handlers.
 */

const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');
const { AppError } = require('../utils/AppError');

// Lazily initialize the Supabase client (singleton)
let supabase = null;

const getSupabaseClient = () => {
    if (!supabase) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!url || !anonKey) {
            logger.warn('Supabase credentials not configured — auth middleware will reject all requests');
            return null;
        }

        supabase = createClient(url, anonKey);
    }
    return supabase;
};

/**
 * Express middleware that verifies the Supabase access token.
 * - Extracts `Bearer <token>` from the `Authorization` header.
 * - Validates it via `supabase.auth.getUser(token)`.
 * - Attaches `req.user` on success.
 * - Returns 401 on missing/invalid token.
 */
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: {
                message: 'Authentication required. Provide a valid Bearer token.',
                code: 'AUTH_REQUIRED',
            },
        });
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix

    try {
        const client = getSupabaseClient();

        if (!client) {
            logger.error('Supabase client not available — cannot verify token');
            return res.status(503).json({
                error: {
                    message: 'Authentication service unavailable.',
                    code: 'AUTH_SERVICE_UNAVAILABLE',
                },
            });
        }

        const { data: { user }, error } = await client.auth.getUser(token);

        if (error || !user) {
            logger.warn('Token verification failed', {
                error: error?.message,
                path: req.path,
                ip: req.ip,
            });

            return res.status(401).json({
                error: {
                    message: 'Invalid or expired token.',
                    code: 'AUTH_INVALID_TOKEN',
                },
            });
        }

        // Attach verified user to request
        req.user = user;
        next();
    } catch (err) {
        logger.error('Auth middleware error', {
            error: err.message,
            path: req.path,
        });

        return res.status(500).json({
            error: {
                message: 'Authentication verification failed.',
                code: 'AUTH_ERROR',
            },
        });
    }
};

module.exports = { authMiddleware };
