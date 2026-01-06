/**
 * OpenRouter Usage Proxy - Express Server Entry Point
 *
 * This server acts as a middleware proxy between clients and OpenRouter API.
 * It intercepts all API calls, logs usage data to SQLite, and exposes
 * a REST API for querying logged data.
 *
 * CRITICAL: Middleware order is important!
 * 1. CORS - Handle cross-origin requests first
 * 2. express.json() - Parse JSON bodies before routes
 * 3. API routes (/api/*) - Handle dashboard API requests
 * 4. Proxy middleware (/v1/*) - Proxy remaining requests to OpenRouter
 * 5. Error handler - Catch and handle all errors last
 */

import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

// Load environment variables first (before other imports that may use them)
dotenv.config();

// Import after dotenv.config() so environment variables are available
import logsRouter from './routes/logs.js';
import { proxyMiddleware } from './middleware/proxy.js';
import { closeDatabase } from './db/index.js';
import type { ApiErrorResponse } from './types/index.js';

/**
 * Server port from environment or default to 3000
 */
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

/**
 * Create Express application
 */
const app = express();

// =============================================================================
// MIDDLEWARE SETUP (Order is critical!)
// =============================================================================

/**
 * 1. CORS Middleware - Handle cross-origin requests
 * Allows the frontend dashboard to make API requests to the backend
 */
app.use(cors());

/**
 * 2. JSON Body Parser - Parse JSON request bodies
 * Must come BEFORE routes that need to access req.body
 * Note: This runs before proxy, so fixRequestBody is needed in proxy middleware
 */
app.use(express.json());

// =============================================================================
// API ROUTES
// =============================================================================

/**
 * 3. Logs API Routes - Dashboard data endpoints
 * Mounted BEFORE proxy so /api/* requests are handled here
 *
 * Endpoints:
 * - GET /api/logs - Returns all usage logs
 * - GET /api/logs/stats - Returns aggregated statistics
 */
app.use('/api/logs', logsRouter);

/**
 * Health check endpoint for monitoring
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// =============================================================================
// PROXY MIDDLEWARE
// =============================================================================

/**
 * 4. Proxy Middleware - Forward API requests to OpenRouter
 * Catches all /v1/* requests and proxies them to https://openrouter.ai/api/v1/*
 *
 * Features:
 * - Injects Authorization header with API key from environment
 * - Injects usage: { include: true } for cost data
 * - Intercepts responses to log usage data to database
 */
app.use('/v1', proxyMiddleware);

// =============================================================================
// ERROR HANDLING
// =============================================================================

/**
 * 5. Error Handler - Handle all errors
 * Must be registered LAST after all other middleware and routes
 */
app.use((err: Error, req: Request, res: Response<ApiErrorResponse>, next: NextFunction) => {
  // Log error to stderr (not console.log)
  process.stderr.write(`[error] ${err.stack || err.message}\n`);

  // Send error response
  res.status(500).json({
    error: true,
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    code: 'INTERNAL_ERROR',
  });
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

/**
 * Start the server and listen for requests
 */
const server = app.listen(PORT, () => {
  process.stdout.write(`[server] OpenRouter Usage Proxy running on http://localhost:${PORT}\n`);
  process.stdout.write(`[server] Dashboard API: http://localhost:${PORT}/api/logs\n`);
  process.stdout.write(`[server] Proxy endpoint: http://localhost:${PORT}/v1/chat/completions\n`);
});

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

/**
 * Handle graceful shutdown
 * Close database connection and stop accepting new connections
 */
function shutdown(signal: string): void {
  process.stdout.write(`\n[server] Received ${signal}, shutting down gracefully...\n`);

  server.close(() => {
    process.stdout.write('[server] HTTP server closed\n');

    // Close database connection
    try {
      closeDatabase();
      process.stdout.write('[server] Database connection closed\n');
    } catch (err) {
      process.stderr.write(`[server] Error closing database: ${err}\n`);
    }

    process.exit(0);
  });

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    process.stderr.write('[server] Forcing shutdown after timeout\n');
    process.exit(1);
  }, 10000);
}

// Register shutdown handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
