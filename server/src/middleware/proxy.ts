/**
 * Proxy middleware for OpenRouter API
 * Intercepts requests to /v1/*, proxies them to OpenRouter,
 * and logs usage data from responses
 */

import { createProxyMiddleware, responseInterceptor, fixRequestBody } from 'http-proxy-middleware';
import type { ClientRequest, IncomingMessage } from 'http';
import type { Request, Response } from 'express';
import { insertLog } from '../db/index.js';
import type { OpenRouterChatResponse, UsageLogInput } from '../types/index.js';

/**
 * OpenRouter API base URL
 */
const OPENROUTER_TARGET = 'https://openrouter.ai';

/**
 * Create the proxy middleware for OpenRouter API requests
 *
 * Key features:
 * - Proxies /v1/* requests to https://openrouter.ai/api/v1/*
 * - Injects API key from server environment (secure, never exposed to clients)
 * - Injects usage: { include: true } to get cost data in response
 * - Intercepts responses to extract and log usage data
 * - Uses fixRequestBody for compatibility with body-parser middleware
 */
export const proxyMiddleware = createProxyMiddleware<Request, Response>({
  target: OPENROUTER_TARGET,
  changeOrigin: true,

  // REQUIRED: selfHandleResponse must be true to use responseInterceptor
  selfHandleResponse: true,

  // Rewrite path: /v1/* -> /api/v1/*
  pathRewrite: {
    '^/v1': '/api/v1',
  },

  on: {
    /**
     * Handle outgoing proxy request
     * - Injects Authorization header with API key from environment
     * - Injects usage: { include: true } into request body for cost data
     * - Fixes request body when body-parser middleware runs before proxy
     */
    proxyReq: (proxyReq: ClientRequest, req: Request, res: Response) => {
      // Inject API key securely from server environment
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (apiKey) {
        proxyReq.setHeader('Authorization', `Bearer ${apiKey}`);
      }

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
     * - Parses response to extract usage data (model, tokens, cost)
     * - Logs usage data to database
     * - Returns original response buffer to client unchanged
     */
    proxyRes: responseInterceptor(
      async (
        responseBuffer: Buffer,
        proxyRes: IncomingMessage,
        req: Request,
        res: Response
      ): Promise<Buffer | string> => {
        const responseString = responseBuffer.toString('utf8');
        const timestamp = new Date().toISOString();

        try {
          const data: OpenRouterChatResponse = JSON.parse(responseString);

          // Extract usage data from response
          const logEntry: UsageLogInput = {
            timestamp,
            model: data.model || 'unknown',
            prompt_tokens: data.usage?.prompt_tokens ?? null,
            completion_tokens: data.usage?.completion_tokens ?? null,
            total_tokens: data.usage?.total_tokens ?? null,
            cost: data.usage?.cost ?? null,
            request_path: req.originalUrl || req.url,
            status_code: proxyRes.statusCode ?? null,
          };

          // Log usage data to database
          insertLog(logEntry);
        } catch (err) {
          // Log parsing errors but don't block the response
          // This handles non-JSON responses (errors, streaming, etc.)
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

        // Return original response buffer unchanged to client
        return responseBuffer;
      }
    ),

    /**
     * Handle proxy errors
     * Logs errors and sends appropriate error response to client
     */
    error: (err: Error, req: Request, res: Response) => {
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
      if (!res.headersSent) {
        res.status(502).json({
          error: true,
          message: 'Proxy error: Unable to reach OpenRouter API',
          code: 'PROXY_ERROR',
        });
      }
    },
  },
});

export default proxyMiddleware;
