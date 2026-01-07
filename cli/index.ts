/**
 * OpenRouter Usage Proxy - CLI Entry Point
 *
 * This CLI executable launches both the Express backend server and serves
 * the React frontend as static files. It provides configurable port parameters
 * for easy deployment.
 *
 * Usage:
 *   openrouter-proxy [options]
 *
 * Options:
 *   --server-port <port>  Port for the API server (default: 3000)
 *   --client-port <port>  Port for the static file server (default: same as server-port)
 *   --help               Display help information
 */

import { Command, Option } from 'commander';
import type { Server } from 'http';
import { startServer, type ServerInstance } from './server-runner.js';
import { startStaticServer, type StaticServerInstance } from './static-server.js';

// =============================================================================
// SERVICE REGISTRY
// =============================================================================

/**
 * Registry of running services for graceful shutdown
 * Services are closed in the order they were registered
 */
interface RegisteredService {
  name: string;
  server: Server;
}

const runningServices: RegisteredService[] = [];

/**
 * Register a service for graceful shutdown
 * @param name - Human-readable name for logging
 * @param server - HTTP server instance to close on shutdown
 */
export function registerService(name: string, server: Server): void {
  runningServices.push({ name, server });
}

/**
 * Check if shutdown is in progress
 */
let isShuttingDown = false;

/**
 * Server instance for cleanup during shutdown
 */
let serverInstance: ServerInstance | null = null;

/**
 * Static server instance (for separate port mode)
 */
let staticServerInstance: StaticServerInstance | null = null;

/**
 * Default port for the API server
 */
const DEFAULT_SERVER_PORT = 3000;

/**
 * Validates that a port number is within valid range (1-65535)
 * @param value - The port value to validate
 * @param optionName - Name of the option for error messages
 * @returns The validated port number
 * @throws Error if port is invalid
 */
function validatePort(value: string, optionName: string): number {
  const port = parseInt(value, 10);

  if (isNaN(port)) {
    throw new Error(`${optionName} must be a valid number, got: ${value}`);
  }

  if (port < 1 || port > 65535) {
    throw new Error(`${optionName} must be between 1 and 65535, got: ${port}`);
  }

  return port;
}

/**
 * CLI options interface
 */
export interface CliOptions {
  serverPort: number;
  clientPort: number;
}

/**
 * Parse command line arguments and return validated options
 */
export function parseArgs(argv: string[] = process.argv): CliOptions {
  const program = new Command();

  program
    .name('openrouter-proxy')
    .description('OpenRouter Usage Proxy - API proxy with usage logging and dashboard')
    .version('1.0.0')
    .addOption(
      new Option('--server-port <port>', 'Port for the API server')
        .default(DEFAULT_SERVER_PORT.toString())
        .argParser((value) => validatePort(value, '--server-port').toString())
    )
    .addOption(
      new Option('--client-port <port>', 'Port for the static file server (defaults to server-port)')
        .argParser((value) => validatePort(value, '--client-port').toString())
    );

  program.parse(argv);

  const opts = program.opts();

  const serverPort = parseInt(opts.serverPort, 10);
  // If client-port not specified, use server-port (unified server)
  const clientPort = opts.clientPort ? parseInt(opts.clientPort, 10) : serverPort;

  return {
    serverPort,
    clientPort,
  };
}

/**
 * Graceful shutdown handler
 * Closes all registered services and exits cleanly
 */
function shutdown(signal: string): void {
  // Prevent multiple shutdown attempts
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  process.stdout.write(`\n[cli] Received ${signal}, shutting down gracefully...\n`);

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    process.stderr.write('[cli] Forcing shutdown after timeout\n');
    process.exit(1);
  }, 10000);

  // If no services registered, exit immediately
  if (runningServices.length === 0) {
    process.stdout.write('[cli] No services to close, shutdown complete\n');
    process.exit(0);
  }

  // Close all registered services
  let closedCount = 0;
  const totalServices = runningServices.length;

  for (const service of runningServices) {
    service.server.close(() => {
      process.stdout.write(`[cli] ${service.name} closed\n`);
      closedCount++;

      // Exit when all services are closed
      if (closedCount === totalServices) {
        // Clean up database if server was started
        if (serverInstance) {
          serverInstance.cleanup();
        }
        process.stdout.write('[cli] All services closed, shutdown complete\n');
        process.exit(0);
      }
    });
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Register shutdown handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    const options = parseArgs();

    process.stdout.write('[cli] OpenRouter Usage Proxy starting...\n');
    process.stdout.write(`[cli] Server port: ${options.serverPort}\n`);
    process.stdout.write(`[cli] Client port: ${options.clientPort}\n`);

    // Determine mode: unified (same port) or separate (different ports)
    const unifiedMode = options.serverPort === options.clientPort;

    // Start the API server (with static file serving if unified mode)
    serverInstance = await startServer(options.serverPort, {
      serveStaticFiles: unifiedMode,
    });
    registerService('API Server', serverInstance.server);

    if (unifiedMode) {
      // Unified mode: static files served by the API server
      process.stdout.write(`[cli] Unified mode: Dashboard at http://localhost:${options.serverPort}/\n`);
    } else {
      // Separate port mode: start static server on different port
      staticServerInstance = await startStaticServer(options.clientPort, options.serverPort);
      registerService('Static Server', staticServerInstance.server);
    }

    process.stdout.write('[cli] Ready! Press Ctrl+C to stop.\n');
  } catch (error) {
    if (error instanceof Error) {
      process.stderr.write(`[cli] Error: ${error.message}\n`);
    } else {
      process.stderr.write(`[cli] Unknown error occurred\n`);
    }
    process.exit(1);
  }
}

// Run main function
main();
