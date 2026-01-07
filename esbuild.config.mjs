/**
 * esbuild Configuration for OpenRouter Usage Proxy CLI
 *
 * This configuration bundles the CLI entry point and server code into a single
 * CommonJS file suitable for Node.js Single Executable Application (SEA) packaging.
 *
 * Features:
 * - Bundles all TypeScript/JavaScript code into a single file
 * - Converts ESM to CommonJS for SEA compatibility
 * - Marks native modules (better-sqlite3) as external
 * - Copies native modules to dist/ for runtime availability
 * - Generates source maps for debugging
 *
 * Usage:
 *   node esbuild.config.mjs
 *
 * Native Module Handling:
 *   better-sqlite3 contains platform-specific native bindings (.node files)
 *   that cannot be bundled by esbuild. This configuration:
 *   1. Marks better-sqlite3 as external (not bundled)
 *   2. Copies the native module to dist/node_modules/ after bundling
 *   3. The bundled application resolves better-sqlite3 from the dist directory
 */

import * as esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Native modules that require special handling
 * These modules have platform-specific native bindings (.node files)
 * and cannot be bundled by esbuild
 */
const NATIVE_MODULES = [
  'better-sqlite3',
];

/**
 * Recursively copy a directory
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 */
function copyDirectorySync(src, dest) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectorySync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Copy native modules to dist/node_modules for runtime availability
 * This is necessary because native modules cannot be bundled and must
 * be available in node_modules relative to the bundled script
 */
function copyNativeModules() {
  const distNodeModules = path.resolve(__dirname, 'dist/node_modules');

  // Create dist/node_modules if it doesn't exist
  if (!fs.existsSync(distNodeModules)) {
    fs.mkdirSync(distNodeModules, { recursive: true });
  }

  for (const moduleName of NATIVE_MODULES) {
    // Try to find the module in server/node_modules first (primary location)
    // Then fall back to root node_modules
    const possiblePaths = [
      path.resolve(__dirname, 'server/node_modules', moduleName),
      path.resolve(__dirname, 'node_modules', moduleName),
    ];

    let sourcePath = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        sourcePath = p;
        break;
      }
    }

    if (!sourcePath) {
      process.stderr.write(`[esbuild] Warning: Native module '${moduleName}' not found\n`);
      process.stderr.write(`[esbuild] Searched in: ${possiblePaths.join(', ')}\n`);
      continue;
    }

    const destPath = path.join(distNodeModules, moduleName);

    // Remove existing copy if present
    if (fs.existsSync(destPath)) {
      fs.rmSync(destPath, { recursive: true, force: true });
    }

    process.stdout.write(`[esbuild] Copying native module: ${moduleName}\n`);
    process.stdout.write(`[esbuild]   From: ${sourcePath}\n`);
    process.stdout.write(`[esbuild]   To: ${destPath}\n`);

    copyDirectorySync(sourcePath, destPath);

    // Also copy any bindings/dependencies the module needs
    // better-sqlite3 depends on bindings and file-uri-to-path
    const dependencies = ['bindings', 'file-uri-to-path'];
    for (const dep of dependencies) {
      const depPaths = [
        path.resolve(__dirname, 'server/node_modules', dep),
        path.resolve(__dirname, 'node_modules', dep),
      ];

      for (const depPath of depPaths) {
        if (fs.existsSync(depPath)) {
          const depDest = path.join(distNodeModules, dep);
          if (!fs.existsSync(depDest)) {
            copyDirectorySync(depPath, depDest);
            process.stdout.write(`[esbuild]   + dependency: ${dep}\n`);
          }
          break;
        }
      }
    }
  }
}

/**
 * Build configuration
 */
const buildConfig = {
  // Entry point - main CLI file
  entryPoints: [path.resolve(__dirname, 'cli/index.ts')],

  // Output configuration
  outfile: path.resolve(__dirname, 'dist/bundle.cjs'),

  // Bundle all dependencies into a single file
  bundle: true,

  // CommonJS format for Node.js SEA compatibility
  // Node.js SEA requires CommonJS modules
  format: 'cjs',

  // Target Node.js platform
  platform: 'node',

  // Target Node.js 20 (minimum version for SEA and Commander v14)
  target: 'node20',

  // Mark native modules as external
  // better-sqlite3 has native bindings that cannot be bundled
  // These are copied to dist/node_modules after bundling
  external: NATIVE_MODULES,

  // Generate source maps for debugging
  sourcemap: true,

  // Minify for smaller bundle size (optional, can disable for debugging)
  minify: false,

  // Keep names for better stack traces
  keepNames: true,

  // Define process.env.NODE_ENV for production builds
  define: {
    'process.env.NODE_ENV': '"production"',
  },

  // Log level for build output
  logLevel: 'info',

  // Banner to identify the bundle
  banner: {
    js: `/**
 * OpenRouter Usage Proxy - Bundled CLI
 * Generated by esbuild
 *
 * This is a bundled CommonJS module for Node.js SEA packaging.
 * Native modules (better-sqlite3) must be available at runtime.
 */
`,
  },
};

/**
 * Run the build
 */
async function build() {
  try {
    process.stdout.write('[esbuild] Building CLI bundle...\n');
    process.stdout.write(`[esbuild] Entry: ${buildConfig.entryPoints[0]}\n`);
    process.stdout.write(`[esbuild] Output: ${buildConfig.outfile}\n`);

    const result = await esbuild.build(buildConfig);

    if (result.errors.length > 0) {
      process.stderr.write('[esbuild] Build failed with errors:\n');
      for (const error of result.errors) {
        process.stderr.write(`  ${error.text}\n`);
      }
      process.exit(1);
    }

    if (result.warnings.length > 0) {
      process.stdout.write('[esbuild] Build completed with warnings:\n');
      for (const warning of result.warnings) {
        process.stdout.write(`  ${warning.text}\n`);
      }
    }

    process.stdout.write('[esbuild] Build completed successfully!\n');
    process.stdout.write(`[esbuild] Bundle created at: ${buildConfig.outfile}\n`);

    // Copy native modules to dist/node_modules
    process.stdout.write('\n[esbuild] Copying native modules...\n');
    copyNativeModules();
    process.stdout.write('[esbuild] Native modules copied successfully!\n');
  } catch (error) {
    process.stderr.write(`[esbuild] Build failed: ${error.message}\n`);
    process.exit(1);
  }
}

// Run build
build();
