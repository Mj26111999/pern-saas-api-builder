const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const morgan = require('morgan');
const { Pool } = require('pg');
const { Server } = require('socket.io');
const http = require('http');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const winston = require('winston');
require('express-async-errors');
require('dotenv').config();

// Import routes
const tenantRoutes = require('./routes/tenants');
const databaseRoutes = require('./routes/databases');
const endpointRoutes = require('./routes/endpoints');
const codeGenRoutes = require('./routes/codeGeneration');
const analyticsRoutes = require('./routes/analytics');
const webhookRoutes = require('./routes/webhooks');

// Import middleware
const authMiddleware = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

class PERNAPIBuilder {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new Server(this.server, {
            cors: {
                origin: process.env.FRONTEND_URL || "http://localhost:3000",
                methods: ["GET", "POST"],
                credentials: true
            }
        });
        
        // PostgreSQL connection pool
        this.pool = new Pool({
            user: process.env.DB_USER || 'postgres',
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME || 'api_builder',
            password: process.env.DB_PASSWORD || 'password',
            port: process.env.DB_PORT || 5432,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.setupErrorHandling();
        this.testDatabaseConnection();
    }
    
    setupMiddleware() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                },
            },
        }));
        
        // CORS configuration
        this.app.use(cors({
            origin: process.env.FRONTEND_URL || "http://localhost:3000",
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
        }));
        
        // Compression
        this.app.use(compression());
        
        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // Logging
        if (process.env.NODE_ENV !== 'test') {
            this.app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
        }
        
        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: {
                error: 'Too many requests from this IP, please try again later.',
                retryAfter: '15 minutes'
            },
            standardHeaders: true,
            legacyHeaders: false,
        });
        this.app.use('/api/', limiter);
        
        // Slow down repeated requests
        const speedLimiter = slowDown({
            windowMs: 15 * 60 * 1000, // 15 minutes
            delayAfter: 50, // allow 50 requests per 15 minutes, then...
            delayMs: 500 // begin adding 500ms of delay per request above 50
        });
        this.app.use('/api/', speedLimiter);
        
        // Make pool available to routes
        this.app.locals.pool = this.pool;
        this.app.locals.io = this.io;
    }
    
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                timestamp: new Date().toISOString(),
                version: process.env.npm_package_version || '1.0.0',
                environment: process.env.NODE_ENV || 'development'
            });
        });
        
        // API documentation
        this.app.get('/api', (req, res) => {
            res.json({
                name: 'PERN Stack SaaS API Builder',
                version: '1.0.0',
                description: 'Multi-tenant API builder with real-time database connections',
                endpoints: {
                    tenants: '/api/tenants',
                    databases: '/api/tenant/databases',
                    endpoints: '/api/tenant/endpoints',
                    generation: '/api/tenant/generate',
                    analytics: '/api/tenant/analytics',
                    webhooks: '/api/tenant/webhooks'
                },
                documentation: 'https://github.com/Mj26111999/pern-saas-api-builder'
            });
        });
        
        // Public routes (no authentication required)
        this.app.use('/api/tenants', tenantRoutes);
        
        // Protected routes (require authentication)
        this.app.use('/api/tenant/databases', authMiddleware, databaseRoutes);
        this.app.use('/api/tenant/endpoints', authMiddleware, endpointRoutes);
        this.app.use('/api/tenant/generate', authMiddleware, codeGenRoutes);
        this.app.use('/api/tenant/analytics', authMiddleware, analyticsRoutes);
        this.app.use('/api/tenant/webhooks', authMiddleware, webhookRoutes);
        
        // Catch-all route for undefined endpoints
        this.app.all('*', (req, res) => {
            res.status(404).json({
                error: 'Endpoint not found',
                message: `Cannot ${req.method} ${req.path}`,
                availableEndpoints: [
                    'GET /health',
                    'GET /api',
                    'POST /api/tenants',
                    'GET /api/tenant/*'
                ]
            });
        });
    }
    
    setupWebSocket() {
        this.io.on('connection', (socket) => {
            logger.info(`Client connected: ${socket.id}`);
            
            socket.on('join-tenant', async (data) => {
                const { tenantId, apiKey } = data;
                
                try {
                    // Verify tenant
                    const result = await this.pool.query(
                        'SELECT * FROM tenants WHERE id = $1 AND api_key = $2 AND is_active = true',
                        [tenantId, apiKey]
                    );
                    
                    if (result.rows.length > 0) {
                        socket.join(`tenant-${tenantId}`);
                        socket.tenantId = tenantId;
                        socket.tenant = result.rows[0];
                        
                        // Store connection in database
                        await this.pool.query(
                            'INSERT INTO realtime_connections (tenant_id, connection_id, socket_id, user_info) VALUES ($1, $2, $3, $4) ON CONFLICT (connection_id) DO UPDATE SET last_ping_at = CURRENT_TIMESTAMP, is_active = true',
                            [tenantId, socket.id, socket.id, JSON.stringify({ connectedAt: new Date() })]
                        );
                        
                        socket.emit('joined', { 
                            tenantId, 
                            status: 'connected',
                            tenant: result.rows[0]
                        });
                        
                        logger.info(`Tenant ${tenantId} joined room: tenant-${tenantId}`);
                    } else {
                        socket.emit('error', { message: 'Invalid tenant credentials' });
                        logger.warn(`Invalid tenant credentials for socket ${socket.id}`);
                    }
                } catch (error) {
                    logger.error('WebSocket join-tenant error:', error);
                    socket.emit('error', { message: 'Connection failed' });
                }
            });
            
            socket.on('execute-query', async (data) => {
                if (!socket.tenantId) {
                    socket.emit('error', { message: 'Not authenticated' });
                    return;
                }
                
                try {
                    const result = await this.executeQueryRealtime(socket.tenantId, data);
                    socket.emit('query-result', result);
                    
                    // Broadcast to other clients in the same tenant room
                    socket.to(`tenant-${socket.tenantId}`).emit('query-executed', {
                        executedBy: socket.id,
                        query: data.query,
                        timestamp: new Date().toISOString()
                    });
                } catch (error) {
                    logger.error('WebSocket execute-query error:', error);
                    socket.emit('query-error', { error: error.message });
                }
            });
            
            socket.on('test-connection', async (data) => {
                if (!socket.tenantId) {
                    socket.emit('error', { message: 'Not authenticated' });
                    return;
                }
                
                try {
                    const result = await this.testDatabaseConnectionRealtime(socket.tenantId, data.connectionId);
                    socket.emit('connection-test-result', result);
                } catch (error) {
                    logger.error('WebSocket test-connection error:', error);
                    socket.emit('connection-test-error', { error: error.message });
                }
            });
            
            socket.on('ping', () => {
                socket.emit('pong');
                
                // Update last ping time
                if (socket.tenantId) {
                    this.pool.query(
                        'UPDATE realtime_connections SET last_ping_at = CURRENT_TIMESTAMP WHERE socket_id = $1',
                        [socket.id]
                    ).catch(err => logger.error('Error updating ping time:', err));
                }
            });
            
            socket.on('disconnect', async (reason) => {
                logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
                
                // Remove connection from database
                try {
                    await this.pool.query(
                        'UPDATE realtime_connections SET is_active = false WHERE socket_id = $1',
                        [socket.id]
                    );
                } catch (error) {
                    logger.error('Error updating connection status on disconnect:', error);
                }
            });
        });
        
        // Cleanup inactive connections every 5 minutes
        setInterval(async () => {
            try {
                await this.pool.query(
                    'DELETE FROM realtime_connections WHERE last_ping_at < NOW() - INTERVAL \'10 minutes\' OR is_active = false'
                );
            } catch (error) {
                logger.error('Error cleaning up inactive connections:', error);
            }
        }, 5 * 60 * 1000);
    }
    
    setupErrorHandling() {
        // Global error handler
        this.app.use(errorHandler);
        
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (err) => {
            logger.error('Unhandled Promise Rejection:', err);
            process.exit(1);
        });
        
        // Handle uncaught exceptions
        process.on('uncaughtException', (err) => {
            logger.error('Uncaught Exception:', err);
            process.exit(1);
        });
        
        // Graceful shutdown
        process.on('SIGTERM', () => {
            logger.info('SIGTERM received, shutting down gracefully');
            this.server.close(() => {
                this.pool.end();
                process.exit(0);
            });
        });
        
        process.on('SIGINT', () => {
            logger.info('SIGINT received, shutting down gracefully');
            this.server.close(() => {
                this.pool.end();
                process.exit(0);
            });
        });
    }
    
    async testDatabaseConnection() {
        try {
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();
            logger.info('✅ Database connection successful');
        } catch (error) {
            logger.error('❌ Database connection failed:', error.message);
            process.exit(1);
        }
    }
    
    async executeQueryRealtime(tenantId, data) {
        // Implementation for real-time query execution
        // This would integrate with the database handlers
        return {
            success: true,
            data: [],
            message: 'Query executed successfully',
            timestamp: new Date().toISOString()
        };
    }
    
    async testDatabaseConnectionRealtime(tenantId, connectionId) {
        // Implementation for real-time connection testing
        return {
            success: true,
            message: 'Connection test successful',
            timestamp: new Date().toISOString()
        };
    }
    
    start(port = process.env.PORT || 5000) {
        this.server.listen(port, () => {
            logger.info(`🚀 PERN API Builder Server running on port ${port}`);
            logger.info(`📡 WebSocket server ready for real-time connections`);
            logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`📊 Database: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);
        });
    }
}

// Start the server
if (require.main === module) {
    const apiBuilder = new PERNAPIBuilder();
    apiBuilder.start();
}

module.exports = PERNAPIBuilder;