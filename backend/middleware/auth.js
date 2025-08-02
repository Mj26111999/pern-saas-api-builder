const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Authentication middleware for tenant API key validation
 * Supports both API key and JWT token authentication
 */
const authenticateTenant = async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        
        // Extract API key from headers
        const apiKey = req.headers['x-api-key'] || 
                      req.headers['authorization']?.replace('Bearer ', '') ||
                      req.query.api_key;
        
        if (!apiKey) {
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'API key must be provided in X-API-Key header, Authorization header, or api_key query parameter'
            });
        }
        
        // Check if it's a JWT token
        if (apiKey.startsWith('eyJ')) {
            try {
                const decoded = jwt.verify(apiKey, process.env.JWT_SECRET);
                const result = await pool.query(
                    'SELECT * FROM tenants WHERE id = $1 AND is_active = true',
                    [decoded.tenantId]
                );
                
                if (result.rows.length === 0) {
                    return res.status(401).json({ 
                        error: 'Invalid token',
                        message: 'Tenant not found or inactive'
                    });
                }
                
                req.tenant = result.rows[0];
                req.authMethod = 'jwt';
                return next();
            } catch (jwtError) {
                return res.status(401).json({ 
                    error: 'Invalid token',
                    message: 'JWT token is invalid or expired'
                });
            }
        }
        
        // Validate API key
        const result = await pool.query(
            `SELECT t.*, ak.permissions, ak.rate_limit as api_key_rate_limit, ak.expires_at
             FROM tenants t 
             LEFT JOIN api_keys ak ON t.id = ak.tenant_id AND ak.api_key = $1
             WHERE (t.api_key = $1 OR ak.api_key = $1) AND t.is_active = true`,
            [apiKey]
        );
        
        if (result.rows.length === 0) {
            logger.warn(`Invalid API key attempt: ${apiKey.substring(0, 10)}...`);
            return res.status(401).json({ 
                error: 'Invalid API key',
                message: 'The provided API key is not valid or the tenant is inactive'
            });
        }
        
        const tenant = result.rows[0];
        
        // Check if API key has expired
        if (tenant.expires_at && new Date(tenant.expires_at) < new Date()) {
            return res.status(401).json({ 
                error: 'API key expired',
                message: 'The provided API key has expired'
            });
        }
        
        // Update last used timestamp for API key
        if (tenant.api_key_rate_limit) {
            await pool.query(
                'UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE api_key = $1',
                [apiKey]
            );
        }
        
        // Check rate limits
        const rateLimitResult = await checkRateLimit(pool, tenant.id, tenant.api_key_rate_limit || tenant.max_requests_per_day);
        if (!rateLimitResult.allowed) {
            return res.status(429).json({
                error: 'Rate limit exceeded',
                message: `Rate limit of ${rateLimitResult.limit} requests per day exceeded`,
                resetTime: rateLimitResult.resetTime
            });
        }
        
        // Add tenant info to request
        req.tenant = {
            id: tenant.id,
            name: tenant.name,
            subdomain: tenant.subdomain,
            plan: tenant.plan,
            max_endpoints: tenant.max_endpoints,
            max_requests_per_day: tenant.max_requests_per_day,
            permissions: tenant.permissions || {},
            rate_limit: tenant.api_key_rate_limit || tenant.max_requests_per_day
        };
        
        req.authMethod = 'api_key';
        req.apiKey = apiKey;
        
        // Log API usage
        await logAPIUsage(pool, req);
        
        next();
        
    } catch (error) {
        logger.error('Authentication error:', error);
        res.status(500).json({ 
            error: 'Authentication failed',
            message: 'Internal server error during authentication'
        });
    }
};

/**
 * Check rate limits for tenant
 */
const checkRateLimit = async (pool, tenantId, dailyLimit) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const result = await pool.query(
            `SELECT COUNT(*) as request_count 
             FROM api_usage_logs 
             WHERE tenant_id = $1 AND created_at >= $2`,
            [tenantId, today]
        );
        
        const currentCount = parseInt(result.rows[0].request_count);
        const allowed = currentCount < dailyLimit;
        
        return {
            allowed,
            current: currentCount,
            limit: dailyLimit,
            resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };
    } catch (error) {
        logger.error('Rate limit check error:', error);
        return { allowed: true, current: 0, limit: dailyLimit };
    }
};

/**
 * Log API usage for analytics
 */
const logAPIUsage = async (pool, req) => {
    try {
        const startTime = Date.now();
        
        // Store start time for response time calculation
        req.startTime = startTime;
        
        // Log the request (response details will be logged in response middleware)
        await pool.query(
            `INSERT INTO api_usage_logs 
             (tenant_id, request_method, request_path, request_headers, ip_address, user_agent, api_key_used)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                req.tenant.id,
                req.method,
                req.path,
                JSON.stringify({
                    'content-type': req.headers['content-type'],
                    'user-agent': req.headers['user-agent'],
                    'x-forwarded-for': req.headers['x-forwarded-for']
                }),
                req.ip || req.connection.remoteAddress,
                req.headers['user-agent'],
                req.apiKey?.substring(0, 10) + '...'
            ]
        );
    } catch (error) {
        logger.error('API usage logging error:', error);
    }
};

/**
 * Middleware to check specific permissions
 */
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.tenant) {
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'Must be authenticated to access this resource'
            });
        }
        
        const permissions = req.tenant.permissions || {};
        
        if (!permissions[permission] && req.tenant.plan !== 'enterprise') {
            return res.status(403).json({ 
                error: 'Permission denied',
                message: `This action requires '${permission}' permission or enterprise plan`
            });
        }
        
        next();
    };
};

/**
 * Middleware to check plan requirements
 */
const requirePlan = (requiredPlan) => {
    const planHierarchy = { basic: 1, pro: 2, enterprise: 3 };
    
    return (req, res, next) => {
        if (!req.tenant) {
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'Must be authenticated to access this resource'
            });
        }
        
        const userPlanLevel = planHierarchy[req.tenant.plan] || 0;
        const requiredPlanLevel = planHierarchy[requiredPlan] || 0;
        
        if (userPlanLevel < requiredPlanLevel) {
            return res.status(403).json({ 
                error: 'Plan upgrade required',
                message: `This feature requires ${requiredPlan} plan or higher. Current plan: ${req.tenant.plan}`
            });
        }
        
        next();
    };
};

/**
 * Generate JWT token for tenant
 */
const generateToken = (tenant) => {
    return jwt.sign(
        { 
            tenantId: tenant.id,
            plan: tenant.plan,
            iat: Math.floor(Date.now() / 1000)
        },
        process.env.JWT_SECRET,
        { 
            expiresIn: process.env.JWT_EXPIRES_IN || '7d',
            issuer: 'pern-api-builder',
            audience: tenant.subdomain
        }
    );
};

/**
 * Verify JWT token
 */
const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
};

module.exports = {
    authenticateTenant,
    requirePermission,
    requirePlan,
    generateToken,
    verifyToken,
    checkRateLimit,
    logAPIUsage
};