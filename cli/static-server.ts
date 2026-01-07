/**
 * Static File Server Module
 *
 * This module serves the built React client assets as static files.
 * It can either integrate with the main Express app (unified server mode)
 * or run as a separate server (separate port mode).
 *
 * Features:
 * - Serves client/dist as static files
 * - Handles SPA routing (fallback to index.html)
 * - Sets proper MIME types and caching headers
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import serveStatic from 'serve-static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import type { Server } from 'http';

/**
 * Get the package root directory.
 * Uses import.meta.url to find the actual package installation location,
 * which works correctly when installed globally via npm.
 */
function getPackageDir(): string {
  // Get the directory of this file (cli/)
  const currentFileDir = path.dirname(fileURLToPath(import.meta.url));
  // Go up one level to get the package root
  return path.dirname(currentFileDir);
}

/**
 * Default path to client dist directory (relative to package root)
 */
const DEFAULT_CLIENT_DIST_PATH = path.resolve(getPackageDir(), 'client/dist');

/**
 * Static server configuration options
 */
export interface StaticServerOptions {
  /** Path to the client dist directory */
  distPath?: string;
  /** Enable caching headers for production */
  enableCaching?: boolean;
}

/**
 * Static server result containing the server instance
 */
export interface StaticServerInstance {
  /** HTTP server instance for graceful shutdown */
  server: Server;
}

/**
 * Check if the client dist directory exists and contains index.html
 *
 * @param distPath - Path to the dist directory
 * @returns true if valid, false otherwise
 */
function validateDistDirectory(distPath: string): boolean {
  try {
    const indexPath = path.join(distPath, 'index.html');
    return fs.existsSync(distPath) && fs.existsSync(indexPath);
  } catch {
    return false;
  }
}

/**
 * Configure static file serving middleware on an Express app
 *
 * This function adds middleware to serve built client assets and handle
 * SPA routing. It should be called after API routes are configured.
 *
 * @param app - Express application to configure
 * @param options - Static server configuration options
 * @throws Error if dist directory is not found or invalid
 */
export function configureStaticServing(
  app: Express,
  options: StaticServerOptions = {}
): void {
  const distPath = options.distPath || DEFAULT_CLIENT_DIST_PATH;
  const enableCaching = options.enableCaching ?? true;

  // Validate dist directory exists
  if (!validateDistDirectory(distPath)) {
    throw new Error(
      `Client dist directory not found or missing index.html at: ${distPath}. ` +
      'Please run "npm run build:client" first to build the client assets.'
    );
  }

  process.stdout.write(`[static] Serving static files from: ${distPath}\n`);

  // =============================================================================
  // STATIC FILE MIDDLEWARE
  // =============================================================================

  /**
   * Configure serve-static middleware with proper options
   */
  const staticMiddleware = serveStatic(distPath, {
    // Disable index file handling (we handle it in SPA fallback)
    index: false,
    // Set max-age for caching (1 day for production assets)
    maxAge: enableCaching ? '1d' : 0,
    // Enable etag for cache validation
    etag: true,
    // Set Last-Modified header
    lastModified: true,
    // Don't fall through to next middleware if file not found
    // (we want to handle SPA routing ourselves)
    fallthrough: true,
  });

  // Serve static assets first (JS, CSS, images, etc.)
  app.use(staticMiddleware as express.RequestHandler);

  // =============================================================================
  // SPA FALLBACK ROUTING
  // =============================================================================

  /**
   * SPA fallback - serve index.html for all unmatched routes
   *
   * This handles client-side routing by serving index.html for any
   * request that:
   * 1. Is a GET request
   * 2. Accepts HTML
   * 3. Doesn't match a static file or API route
   */
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    // Skip API routes (they should be handled before this middleware)
    if (req.path.startsWith('/api') || req.path.startsWith('/openrouter')) {
      return next();
    }

    // Serve index.html for SPA routing
    const indexPath = path.join(distPath, 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        process.stderr.write(`[static] Error serving index.html: ${err.message}\n`);
        next(err);
      }
    });
  });

  process.stdout.write('[static] SPA routing configured (fallback to index.html)\n');
}

/**
 * Start a standalone static file server on a separate port
 *
 * Use this when you want the client to run on a different port than the
 * API server. The static server will proxy API requests to the main server.
 *
 * @param port - Port number to listen on
 * @param apiServerPort - Port of the API server (for proxy configuration)
 * @param options - Static server configuration options
 * @returns Promise resolving to StaticServerInstance
 */
export async function startStaticServer(
  port: number,
  apiServerPort: number,
  options: StaticServerOptions = {}
): Promise<StaticServerInstance> {
  const distPath = options.distPath || DEFAULT_CLIENT_DIST_PATH;

  // Validate dist directory exists
  if (!validateDistDirectory(distPath)) {
    throw new Error(
      `Client dist directory not found or missing index.html at: ${distPath}. ` +
      'Please run "npm run build:client" first to build the client assets.'
    );
  }

  const app = express();

  // =============================================================================
  // API PROXY (for separate server mode)
  // =============================================================================

  /**
   * Proxy API requests to the main server
   * This allows the static server to forward /api/* and /openrouter/* requests
   */
  const proxyHandler = async (req: Request, res: Response) => {
    try {
      const targetUrl = `http://localhost:${apiServerPort}${req.originalUrl}`;

      // Forward the request using native fetch
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: {
          ...Object.fromEntries(
            Object.entries(req.headers)
              .filter(([key]) => !['host', 'connection'].includes(key.toLowerCase()))
              .map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value || ''])
          ),
        },
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
      });

      // Copy response headers
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      // Send response
      res.status(response.status);
      const data = await response.text();
      res.send(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      process.stderr.write(`[static] Proxy error: ${errorMessage}\n`);
      res.status(502).json({
        error: true,
        message: `Failed to proxy request to API server: ${errorMessage}`,
        code: 'PROXY_ERROR',
      });
    }
  };

  // Parse JSON bodies for proxied requests
  app.use(express.json());

  // Proxy API routes to main server
  app.use('/api', proxyHandler);
  app.use('/openrouter', proxyHandler);
  app.use('/health', proxyHandler);

  // =============================================================================
  // STATIC FILE SERVING
  // =============================================================================

  // Configure static file serving and SPA routing
  configureStaticServing(app, options);

  // =============================================================================
  // SERVER STARTUP
  // =============================================================================

  return new Promise<StaticServerInstance>((resolve, reject) => {
    const server = app.listen(port);

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use. Please choose a different port with --client-port`));
      } else if (err.code === 'EACCES') {
        reject(new Error(`Port ${port} requires elevated privileges. Use a port number above 1024`));
      } else {
        reject(new Error(`Failed to start static server: ${err.message}`));
      }
    });

    server.on('listening', () => {
      process.stdout.write(`[static] Static file server running on http://localhost:${port}\n`);
      process.stdout.write(`[static] Dashboard available at http://localhost:${port}/\n`);
      process.stdout.write(`[static] API requests proxied to http://localhost:${apiServerPort}\n`);
      resolve({ server });
    });
  });
}

/**
 * Stop the static server gracefully
 *
 * @param serverInstance - The server instance returned by startStaticServer
 * @returns Promise that resolves when server is fully stopped
 */
export async function stopStaticServer(serverInstance: StaticServerInstance): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    serverInstance.server.close((err) => {
      if (err) {
        process.stderr.write(`[static] Error closing static server: ${err.message}\n`);
        reject(err);
        return;
      }
      process.stdout.write('[static] Static server closed\n');
      resolve();
    });
  });
}
