/**
 * Server Runner Module
 *
 * This module spawns and runs the Express server for the CLI.
 * It exports a startServer function that configures and starts the Express app
 * on the specified port, and returns the server instance for graceful shutdown.
 */

import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

import type { Server } from 'http';
import type { ApiErrorResponse } from '../server/src/types/index.js';
import { configureStaticServing } from './static-server.js';

// Load environment variables first (before other imports that may use them)
dotenv.config();

// Lazy-loaded imports (will be loaded after dotenv.config())
let logsRouter: typeof import('../server/src/routes/logs.js').default;
let proxyMiddleware: typeof import('../server/src/middleware/proxy.js').proxyMiddleware;
let closeDatabase: typeof import('../server/src/db/index.js').closeDatabase;

/**
 * Server runner result containing the server instance and cleanup function
 */
export interface ServerInstance {
  /** HTTP server instance for graceful shutdown */
  server: Server;
  /** Cleanup function to close database and release resources */
  cleanup: () => void;
}

/**
 * Server startup options
 */
export interface ServerOptions {
  /** Enable static file serving for unified mode (default: true) */
  serveStaticFiles?: boolean;
}

/**
 * Start the Express server on the specified port
 *
 * This function creates and configures the Express application with:
 * - CORS middleware for cross-origin requests
 * - JSON body parser for request bodies
 * - API routes for dashboard data (/api/logs)
 * - Health check endpoint (/health)
 * - Proxy middleware for OpenRouter API (/openrouter/api/v1)
 * - Static file serving (optional, for unified mode)
 * - Error handling middleware
 *
 * @param port - Port number to listen on (1-65535)
 * @param options - Server configuration options
 * @returns Promise resolving to ServerInstance with server and cleanup function
 * @throws Error if port is already in use or server fails to start
 */
export async function startServer(port: number, options: ServerOptions = {}): Promise<ServerInstance> {
  const { serveStaticFiles = true } = options;
  // Dynamically import server modules (ensures dotenv is loaded first)
  const [logsModule, proxyModule, dbModule] = await Promise.all([
    import('../server/src/routes/logs.js'),
    import('../server/src/middleware/proxy.js'),
    import('../server/src/db/index.js'),
  ]);

  logsRouter = logsModule.default;
  proxyMiddleware = proxyModule.proxyMiddleware;
  closeDatabase = dbModule.closeDatabase;

  // Create Express application
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
   */
  app.use(express.json());

  // =============================================================================
  // API ROUTES
  // =============================================================================

  /**
   * 3. Logs API Routes - Dashboard data endpoints
   * Mounted BEFORE proxy so /api/* requests are handled here
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
   * Catches all /openrouter/api/v1/* requests and proxies them
   */
  app.use('/openrouter/api/v1', proxyMiddleware);

  // =============================================================================
  // STATIC FILE SERVING (Unified Mode)
  // =============================================================================

  /**
   * 5. Static File Serving - Serve built client assets
   * Only enabled if serveStaticFiles option is true and client/dist exists
   */
  if (serveStaticFiles) {
    try {
      configureStaticServing(app);
      process.stdout.write('[server] Static file serving enabled (unified mode)\n');
    } catch (err) {
      // In development mode, client assets may not be built - this is OK
      if (err instanceof Error && err.message.includes('Client dist directory not found')) {
        process.stdout.write('[server] Note: Client assets not built. Dashboard will not be served.\n');
        process.stdout.write('[server] Run "npm run build:client" to enable dashboard in unified mode.\n');
      } else {
        throw err;
      }
    }
  }

  // =============================================================================
  // ERROR HANDLING
  // =============================================================================

  /**
   * 6. Error Handler - Handle all errors
   * Must be registered LAST after all other middleware and routes
   */
  app.use((err: Error, req: Request, res: Response<ApiErrorResponse>, next: NextFunction) => {
    process.stderr.write(`[server] Error: ${err.stack || err.message}\n`);

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

  return new Promise<ServerInstance>((resolve, reject) => {
    const server = app.listen(port);

    /**
     * Handle server error (e.g., port in use)
     */
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use. Please choose a different port with --server-port`));
      } else if (err.code === 'EACCES') {
        reject(new Error(`Port ${port} requires elevated privileges. Use a port number above 1024`));
      } else {
        reject(new Error(`Failed to start server: ${err.message}`));
      }
    });

    /**
     * Handle successful server start
     */
    server.on('listening', () => {
      process.stdout.write(`[server] OpenRouter Usage Proxy running on http://localhost:${port}\n`);
      process.stdout.write(`[server] Dashboard API: http://localhost:${port}/api/logs\n`);
      process.stdout.write(`[server] Proxy endpoint: http://localhost:${port}/openrouter/api/v1/chat/completions\n`);

      resolve({
        server,
        cleanup: () => {
          try {
            closeDatabase();
            process.stdout.write('[server] Database connection closed\n');
          } catch (err) {
            process.stderr.write(`[server] Error closing database: ${err}\n`);
          }
        },
      });
    });
  });
}

/**
 * Stop the server gracefully
 *
 * @param serverInstance - The server instance returned by startServer
 * @returns Promise that resolves when server is fully stopped
 */
export async function stopServer(serverInstance: ServerInstance): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const { server, cleanup } = serverInstance;

    server.close((err) => {
      if (err) {
        process.stderr.write(`[server] Error closing HTTP server: ${err.message}\n`);
        reject(err);
        return;
      }

      process.stdout.write('[server] HTTP server closed\n');

      // Run cleanup (close database, etc.)
      cleanup();

      resolve();
    });
  });
}
