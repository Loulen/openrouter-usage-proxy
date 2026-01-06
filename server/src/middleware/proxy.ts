/**
 * Proxy middleware for OpenRouter API
 * Intercepts requests to /openrouter/api/v1/*, proxies them to OpenRouter,
 * and logs usage data from responses
 *
 * This is a TRANSPARENT proxy - it passes through the client's Authorization
 * header unchanged. Clients must provide their own OpenRouter API keys.
 *
 * STREAMING SUPPORT: This middleware handles both streaming and non-streaming
 * requests. For streaming, it pipes responses directly while parsing SSE chunks
 * to extract usage data from the final chunk.
 */

import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import type { ClientRequest, IncomingMessage } from 'http';
import type { Request, Response } from 'express';
import { insertLog } from '../db/index.js';
import type { OpenRouterChatResponse, UsageLogInput } from '../types/index.js';

/**
 * OpenRouter API base URL
 */
const OPENROUTER_TARGET = 'https://openrouter.ai';

/**
 * Parse SSE data to extract JSON from streaming responses
 * OpenRouter sends usage data in the final SSE chunk with "usage" field
 */
function parseSSEChunk(chunk: string): OpenRouterChatResponse | null {
  const lines = chunk.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        return JSON.parse(data);
      } catch {
        // Not valid JSON, skip
      }
    }
  }
  return null;
}

/**
 * Extract usage data from SSE stream buffer
 * Scans through all chunks to find usage data (usually in final chunk)
 */
function extractUsageFromStream(buffer: string): { model?: string; usage?: OpenRouterChatResponse['usage'] } {
  const result: { model?: string; usage?: OpenRouterChatResponse['usage'] } = {};

  // Split by double newlines (SSE format) and parse each chunk
  const chunks = buffer.split('\n\n');
  for (const chunk of chunks) {
    const parsed = parseSSEChunk(chunk);
    if (parsed) {
      if (parsed.model) result.model = parsed.model;
      if (parsed.usage) result.usage = parsed.usage;
    }
  }

  return result;
}

/**
 * Create the proxy middleware for OpenRouter API requests
 *
 * Key features:
 * - Proxies /openrouter/api/v1/* requests to https://openrouter.ai/api/v1/*
 * - Passes through client's Authorization header unchanged (transparent proxy)
 * - Injects usage: { include: true } to get cost data in response
 * - Supports STREAMING responses (pipes directly to client)
 * - Intercepts responses to extract and log usage data
 * - Uses fixRequestBody for compatibility with body-parser middleware
 */
export const proxyMiddleware = createProxyMiddleware<Request, Response>({
  target: OPENROUTER_TARGET,
  changeOrigin: true,

  // IMPORTANT: selfHandleResponse must be FALSE for streaming to work
  // We handle response logging in proxyRes event instead
  selfHandleResponse: false,

  // Rewrite path: /openrouter/api/v1/* -> /api/v1/*
  // The middleware is mounted at /openrouter/api/v1, so incoming path is just /*
  // We need to prepend /api/v1 to get the full OpenRouter path
  pathRewrite: {
    '^/': '/api/v1/',
  },

  on: {
    /**
     * Handle outgoing proxy request
     * - Passes through client's Authorization header unchanged (transparent proxy)
     * - Injects usage: { include: true } into request body for cost data
     * - Fixes request body when body-parser middleware runs before proxy
     */
    proxyReq: (proxyReq: ClientRequest, req: Request, res: Response) => {
      // Store whether this is a streaming request for later use
      const isStreaming = req.body?.stream === true;
      (req as any)._isStreaming = isStreaming;

      // Handle requests with JSON body (POST, PUT, PATCH)
      // Inject usage: { include: true } for chat completions to get cost data
      const hasBody = req.body && Object.keys(req.body).length > 0;
      const contentType = req.headers['content-type'] || '';
      const isJson = contentType.includes('application/json');

      if (hasBody && isJson) {
        // Add usage include flag if not already present (for cost data)
        if (!req.body.usage) {
          req.body.usage = { include: true };
        } else if (typeof req.body.usage === 'object' && !req.body.usage.include) {
          req.body.usage.include = true;
        }

        // Serialize the modified body
        const modifiedBody = JSON.stringify(req.body);

        // Update Content-Length header to match new body size
        proxyReq.setHeader('Content-Length', Buffer.byteLength(modifiedBody));

        // Write the modified body to the proxy request
        proxyReq.write(modifiedBody);
      } else {
        // For requests without body, use fixRequestBody
        // REQUIRED when express.json() body-parser runs before proxy
        fixRequestBody(proxyReq, req);
      }
    },

    /**
     * Handle incoming proxy response
     * - For streaming: collects chunks to extract usage from final SSE data
     * - For non-streaming: parses JSON response for usage data
     * - Logs usage data to database
     */
    proxyRes: (proxyRes: IncomingMessage, req: Request, res: Response) => {
      const timestamp = new Date().toISOString();
      const isStreaming = (req as any)._isStreaming === true;

      let responseBuffer = '';

      // Collect response data for logging
      proxyRes.on('data', (chunk: Buffer) => {
        responseBuffer += chunk.toString('utf8');
      });

      // When response ends, extract and log usage data
      proxyRes.on('end', () => {
        try {
          let logEntry: UsageLogInput;

          if (isStreaming) {
            // Parse SSE stream to extract usage data
            const { model, usage } = extractUsageFromStream(responseBuffer);

            logEntry = {
              timestamp,
              model: model || 'unknown',
              prompt_tokens: usage?.prompt_tokens ?? null,
              completion_tokens: usage?.completion_tokens ?? null,
              total_tokens: usage?.total_tokens ?? null,
              cost: usage?.cost ?? null,
              request_path: req.originalUrl || req.url,
              status_code: proxyRes.statusCode ?? null,
            };
          } else {
            // Parse JSON response
            const data: OpenRouterChatResponse = JSON.parse(responseBuffer);

            logEntry = {
              timestamp,
              model: data.model || 'unknown',
              prompt_tokens: data.usage?.prompt_tokens ?? null,
              completion_tokens: data.usage?.completion_tokens ?? null,
              total_tokens: data.usage?.total_tokens ?? null,
              cost: data.usage?.cost ?? null,
              request_path: req.originalUrl || req.url,
              status_code: proxyRes.statusCode ?? null,
            };
          }

          // Log usage data to database
          insertLog(logEntry);
        } catch (err) {
          // Log parsing errors but don't block the response
          if (err instanceof SyntaxError) {
            // Non-JSON response - log with minimal data
            const logEntry: UsageLogInput = {
              timestamp,
              model: 'unknown',
              request_path: req.originalUrl || req.url,
              status_code: proxyRes.statusCode ?? null,
            };

            // Only log if it's an error response (4xx, 5xx)
            if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
              insertLog(logEntry);
            }
          } else {
            // Other errors - log to stderr for debugging
            process.stderr.write(`[proxy] Failed to parse response for logging: ${err}\n`);
          }
        }
      });
    },

    /**
     * Handle proxy errors
     * Logs errors and sends appropriate error response to client
     */
    error: (err: Error, req: Request, res: Response | import('net').Socket) => {
      process.stderr.write(`[proxy] Proxy error: ${err.message}\n`);

      // Log the error request
      const timestamp = new Date().toISOString();
      const logEntry: UsageLogInput = {
        timestamp,
        model: 'error',
        request_path: req.originalUrl || req.url,
        status_code: 502,
      };

      try {
        insertLog(logEntry);
      } catch (dbErr) {
        process.stderr.write(`[proxy] Failed to log error: ${dbErr}\n`);
      }

      // Send error response to client if headers not already sent
      // Check if res is an Express Response (not a raw Socket)
      if ('headersSent' in res && !res.headersSent && 'status' in res) {
        (res as Response).status(502).json({
          error: true,
          message: 'Proxy error: Unable to reach OpenRouter API',
          code: 'PROXY_ERROR',
        });
      }
    },
  },
});

export default proxyMiddleware;
