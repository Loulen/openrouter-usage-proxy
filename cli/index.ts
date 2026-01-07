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
 * Closes all services and exits cleanly
 */
function shutdown(signal: string): void {
  process.stdout.write(`\n[cli] Received ${signal}, shutting down gracefully...\n`);

  // TODO: Close HTTP servers gracefully (implemented in subtask-2-4)

  // Force exit if graceful shutdown takes too long
  const forceExitTimeout = setTimeout(() => {
    process.stderr.write('[cli] Forcing shutdown after timeout\n');
    process.exit(1);
  }, 10000);

  // Clear the timeout if we exit normally
  forceExitTimeout.unref();

  // For now, just exit cleanly
  // Full implementation in subtask-2-4 will handle server cleanup
  process.stdout.write('[cli] Shutdown complete\n');
  process.exit(0);
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

    // TODO: Start server (implemented in subtask-2-2)
    // TODO: Start static file server (implemented in subtask-2-3)

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
