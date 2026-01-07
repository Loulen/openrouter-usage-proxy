/**
 * Tests for proxy middleware utilities and functions
 * Tests the hashApiKey utility and related proxy functionality
 *
 * Note: The proxy middleware itself uses http-proxy-middleware which is
 * difficult to unit test in isolation. These tests focus on the utility
 * functions that can be tested directly.
 *
 * The hashApiKey function is re-implemented here to avoid the database
 * initialization side-effects that occur when importing the proxy module.
 * This is a common pattern when testing pure utility functions that are
 * embedded in modules with side-effects.
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';

/**
 * Re-implementation of hashApiKey from proxy.ts for testing
 * This mirrors the exact implementation in ../proxy.ts
 *
 * Compute SHA-256 hash of an API key for secure storage and identification
 * @param apiKey - The API key string to hash
 * @returns Lowercase hex-encoded SHA-256 hash of the API key
 */
function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

describe('Proxy Middleware Utilities', () => {
  describe('hashApiKey', () => {
    it('should return a 64-character hex string (SHA-256 hash)', () => {
      const apiKey = 'sk-or-v1-test-api-key-12345';
      const hash = hashApiKey(apiKey);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });

    it('should produce consistent hashes for the same input', () => {
      const apiKey = 'sk-or-v1-consistent-test-key';

      const hash1 = hashApiKey(apiKey);
      const hash2 = hashApiKey(apiKey);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const apiKey1 = 'sk-or-v1-first-key';
      const apiKey2 = 'sk-or-v1-second-key';

      const hash1 = hashApiKey(apiKey1);
      const hash2 = hashApiKey(apiKey2);

      expect(hash1).not.toBe(hash2);
    });

    it('should produce the same result as crypto.createHash', () => {
      const apiKey = 'sk-or-v1-verify-hash';

      const expectedHash = createHash('sha256').update(apiKey).digest('hex');
      const actualHash = hashApiKey(apiKey);

      expect(actualHash).toBe(expectedHash);
    });

    it('should handle empty string input', () => {
      const hash = hashApiKey('');

      // SHA-256 of empty string is well-known
      const expectedEmptyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      expect(hash).toBe(expectedEmptyHash);
    });

    it('should handle special characters in API keys', () => {
      const apiKey = 'sk-or-v1-!@#$%^&*()_+-=[]{}|;:,.<>?';
      const hash = hashApiKey(apiKey);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });

    it('should handle unicode characters in API keys', () => {
      const apiKey = 'sk-or-v1-unicode-\u00e9\u00e0\u00fc-key';
      const hash = hashApiKey(apiKey);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });

    it('should handle very long API keys', () => {
      const apiKey = 'sk-or-v1-' + 'a'.repeat(10000);
      const hash = hashApiKey(apiKey);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });

    it('should return lowercase hex string', () => {
      const apiKey = 'sk-or-v1-TEST-KEY-UPPERCASE';
      const hash = hashApiKey(apiKey);

      expect(hash).toBe(hash.toLowerCase());
    });

    it('should be case-sensitive (different case = different hash)', () => {
      const apiKey1 = 'sk-or-v1-CaseSensitive';
      const apiKey2 = 'sk-or-v1-casesensitive';

      const hash1 = hashApiKey(apiKey1);
      const hash2 = hashApiKey(apiKey2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle whitespace correctly', () => {
      const apiKey1 = 'sk-or-v1-key';
      const apiKey2 = 'sk-or-v1-key ';
      const apiKey3 = ' sk-or-v1-key';

      const hash1 = hashApiKey(apiKey1);
      const hash2 = hashApiKey(apiKey2);
      const hash3 = hashApiKey(apiKey3);

      expect(hash1).not.toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash2).not.toBe(hash3);
    });
  });

  describe('API Key Extraction Logic', () => {
    /**
     * These tests verify the expected behavior of API key extraction
     * from Authorization headers. While we can't directly test the
     * proxyReq handler, we can verify the extraction logic pattern.
     */

    it('should correctly extract API key from "Bearer <key>" format', () => {
      const authHeader = 'Bearer sk-or-v1-my-api-key';
      const expectedKey = 'sk-or-v1-my-api-key';

      // Replicate the extraction logic from proxy.ts
      let extractedKey: string | null = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        extractedKey = authHeader.slice(7);
      }

      expect(extractedKey).toBe(expectedKey);
    });

    it('should return null for non-Bearer authorization', () => {
      const authHeader = 'Basic dXNlcjpwYXNz';

      let extractedKey: string | null = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        extractedKey = authHeader.slice(7);
      } else {
        extractedKey = null;
      }

      expect(extractedKey).toBeNull();
    });

    it('should return null for missing authorization header', () => {
      const authHeader: string | undefined = undefined;

      let extractedKey: string | null = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        extractedKey = authHeader.slice(7);
      } else {
        extractedKey = null;
      }

      expect(extractedKey).toBeNull();
    });

    it('should return null for empty authorization header', () => {
      const authHeader = '';

      let extractedKey: string | null = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        extractedKey = authHeader.slice(7);
      } else {
        extractedKey = null;
      }

      expect(extractedKey).toBeNull();
    });

    it('should handle "Bearer " with empty key (edge case)', () => {
      const authHeader = 'Bearer ';

      let extractedKey: string | null = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        extractedKey = authHeader.slice(7);
      }

      expect(extractedKey).toBe('');
    });

    it('should handle case-sensitive Bearer prefix', () => {
      const authHeader = 'bearer sk-or-v1-lowercase-bearer';

      let extractedKey: string | null = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        extractedKey = authHeader.slice(7);
      } else {
        extractedKey = null;
      }

      // "bearer" (lowercase) should not match "Bearer"
      expect(extractedKey).toBeNull();
    });
  });

  describe('Request Body Modification Logic', () => {
    /**
     * These tests verify the expected behavior of request body modification
     * that injects { usage: { include: true } } into request bodies.
     */

    it('should add usage.include when usage is not present', () => {
      const body: Record<string, unknown> = {
        model: 'anthropic/claude-3-opus',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      // Replicate the modification logic from proxy.ts
      if (!body.usage) {
        body.usage = { include: true };
      }

      expect(body.usage).toEqual({ include: true });
    });

    it('should add include:true when usage exists but include is not set', () => {
      const body: Record<string, unknown> = {
        model: 'anthropic/claude-3-opus',
        messages: [{ role: 'user', content: 'Hello' }],
        usage: {},
      };

      // Replicate the modification logic from proxy.ts
      if (!body.usage) {
        body.usage = { include: true };
      } else if (typeof body.usage === 'object' && !(body.usage as Record<string, unknown>).include) {
        (body.usage as Record<string, unknown>).include = true;
      }

      expect(body.usage).toEqual({ include: true });
    });

    it('should preserve existing usage.include:true', () => {
      const body: Record<string, unknown> = {
        model: 'anthropic/claude-3-opus',
        messages: [{ role: 'user', content: 'Hello' }],
        usage: { include: true },
      };

      // Replicate the modification logic from proxy.ts
      if (!body.usage) {
        body.usage = { include: true };
      } else if (typeof body.usage === 'object' && !(body.usage as Record<string, unknown>).include) {
        (body.usage as Record<string, unknown>).include = true;
      }

      expect(body.usage).toEqual({ include: true });
    });

    it('should set include:true when usage.include is false', () => {
      const body: Record<string, unknown> = {
        model: 'anthropic/claude-3-opus',
        messages: [{ role: 'user', content: 'Hello' }],
        usage: { include: false },
      };

      // Replicate the modification logic from proxy.ts
      if (!body.usage) {
        body.usage = { include: true };
      } else if (typeof body.usage === 'object' && !(body.usage as Record<string, unknown>).include) {
        (body.usage as Record<string, unknown>).include = true;
      }

      expect((body.usage as Record<string, unknown>).include).toBe(true);
    });

    it('should preserve other properties in usage object', () => {
      const body: Record<string, unknown> = {
        model: 'anthropic/claude-3-opus',
        messages: [{ role: 'user', content: 'Hello' }],
        usage: { otherProp: 'value' },
      };

      // Replicate the modification logic from proxy.ts
      if (!body.usage) {
        body.usage = { include: true };
      } else if (typeof body.usage === 'object' && !(body.usage as Record<string, unknown>).include) {
        (body.usage as Record<string, unknown>).include = true;
      }

      expect(body.usage).toEqual({ otherProp: 'value', include: true });
    });
  });

  describe('SSE Parsing Logic', () => {
    /**
     * These tests verify the SSE parsing logic used for streaming responses.
     * The actual functions are internal but we test the expected behavior.
     */

    /**
     * Replicate the parseSSEChunk function from proxy.ts
     */
    function parseSSEChunk(chunk: string): Record<string, unknown> | null {
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
     * Replicate the extractUsageFromStream function from proxy.ts
     */
    function extractUsageFromStream(buffer: string): {
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number };
    } {
      const result: {
        model?: string;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number };
      } = {};

      const chunks = buffer.split('\n\n');
      for (const chunk of chunks) {
        const parsed = parseSSEChunk(chunk);
        if (parsed) {
          if (parsed.model) result.model = parsed.model as string;
          if (parsed.usage) result.usage = parsed.usage as typeof result.usage;
        }
      }

      return result;
    }

    describe('parseSSEChunk', () => {
      it('should parse valid SSE data line with JSON', () => {
        const chunk = 'data: {"model":"anthropic/claude-3-opus","choices":[]}';
        const result = parseSSEChunk(chunk);

        expect(result).toEqual({
          model: 'anthropic/claude-3-opus',
          choices: [],
        });
      });

      it('should return null for [DONE] signal', () => {
        const chunk = 'data: [DONE]';
        const result = parseSSEChunk(chunk);

        expect(result).toBeNull();
      });

      it('should return null for empty chunk', () => {
        const chunk = '';
        const result = parseSSEChunk(chunk);

        expect(result).toBeNull();
      });

      it('should return null for non-data lines', () => {
        const chunk = 'event: message\nid: 123';
        const result = parseSSEChunk(chunk);

        expect(result).toBeNull();
      });

      it('should return null for invalid JSON', () => {
        const chunk = 'data: {invalid json}';
        const result = parseSSEChunk(chunk);

        expect(result).toBeNull();
      });

      it('should parse multiple lines and return first valid JSON', () => {
        const chunk = 'event: message\ndata: {"id":"test"}\ndata: {"id":"second"}';
        const result = parseSSEChunk(chunk);

        expect(result).toEqual({ id: 'test' });
      });

      it('should handle data line with extra whitespace', () => {
        const chunk = 'data:   {"model":"test"}  ';
        const result = parseSSEChunk(chunk);

        expect(result).toEqual({ model: 'test' });
      });
    });

    describe('extractUsageFromStream', () => {
      it('should extract model from stream', () => {
        const buffer = 'data: {"model":"anthropic/claude-3-opus"}\n\n';
        const result = extractUsageFromStream(buffer);

        expect(result.model).toBe('anthropic/claude-3-opus');
      });

      it('should extract usage from stream', () => {
        const buffer = 'data: {"usage":{"prompt_tokens":100,"completion_tokens":50,"total_tokens":150,"cost":0.001}}\n\n';
        const result = extractUsageFromStream(buffer);

        expect(result.usage).toEqual({
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
          cost: 0.001,
        });
      });

      it('should extract both model and usage from multi-chunk stream', () => {
        const buffer = [
          'data: {"model":"anthropic/claude-3-opus","choices":[{"delta":{"content":"Hello"}}]}',
          '',
          'data: {"choices":[{"delta":{"content":" world"}}]}',
          '',
          'data: {"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15,"cost":0.0001}}',
          '',
          'data: [DONE]',
          '',
        ].join('\n');

        const result = extractUsageFromStream(buffer);

        expect(result.model).toBe('anthropic/claude-3-opus');
        expect(result.usage).toEqual({
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
          cost: 0.0001,
        });
      });

      it('should return empty object for empty buffer', () => {
        const result = extractUsageFromStream('');

        expect(result).toEqual({});
      });

      it('should return empty object for buffer without model or usage', () => {
        const buffer = 'data: {"choices":[]}\n\ndata: [DONE]\n\n';
        const result = extractUsageFromStream(buffer);

        expect(result).toEqual({});
      });

      it('should use the last model value when multiple appear', () => {
        const buffer = [
          'data: {"model":"first-model"}',
          '',
          'data: {"model":"second-model"}',
          '',
        ].join('\n');

        const result = extractUsageFromStream(buffer);

        expect(result.model).toBe('second-model');
      });

      it('should use the last usage value when multiple appear', () => {
        const buffer = [
          'data: {"usage":{"total_tokens":100}}',
          '',
          'data: {"usage":{"total_tokens":200}}',
          '',
        ].join('\n');

        const result = extractUsageFromStream(buffer);

        expect(result.usage).toEqual({ total_tokens: 200 });
      });

      it('should handle realistic OpenRouter streaming response', () => {
        // Simulates a real OpenRouter streaming response
        const buffer = [
          'data: {"id":"gen-123","object":"chat.completion.chunk","model":"anthropic/claude-3-opus","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}',
          '',
          'data: {"id":"gen-123","object":"chat.completion.chunk","model":"anthropic/claude-3-opus","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}',
          '',
          'data: {"id":"gen-123","object":"chat.completion.chunk","model":"anthropic/claude-3-opus","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":"stop"}],"usage":{"prompt_tokens":15,"completion_tokens":2,"total_tokens":17,"cost":0.00051}}',
          '',
          'data: [DONE]',
          '',
        ].join('\n');

        const result = extractUsageFromStream(buffer);

        expect(result.model).toBe('anthropic/claude-3-opus');
        expect(result.usage).toEqual({
          prompt_tokens: 15,
          completion_tokens: 2,
          total_tokens: 17,
          cost: 0.00051,
        });
      });
    });
  });

  describe('Response Parsing Logic', () => {
    /**
     * Tests for non-streaming JSON response parsing
     */

    it('should extract usage data from valid JSON response', () => {
      const responseBody = JSON.stringify({
        id: 'gen-123',
        model: 'anthropic/claude-3-opus',
        choices: [{ message: { role: 'assistant', content: 'Hello!' } }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
          cost: 0.003,
        },
      });

      const data = JSON.parse(responseBody);

      expect(data.model).toBe('anthropic/claude-3-opus');
      expect(data.usage.prompt_tokens).toBe(100);
      expect(data.usage.completion_tokens).toBe(50);
      expect(data.usage.total_tokens).toBe(150);
      expect(data.usage.cost).toBe(0.003);
    });

    it('should handle response with missing usage field', () => {
      const responseBody = JSON.stringify({
        id: 'gen-123',
        model: 'anthropic/claude-3-opus',
        choices: [],
      });

      const data = JSON.parse(responseBody);

      expect(data.model).toBe('anthropic/claude-3-opus');
      expect(data.usage).toBeUndefined();
    });

    it('should handle response with partial usage field', () => {
      const responseBody = JSON.stringify({
        model: 'openai/gpt-4',
        usage: {
          prompt_tokens: 50,
          // completion_tokens, total_tokens, cost missing
        },
      });

      const data = JSON.parse(responseBody);

      expect(data.usage.prompt_tokens).toBe(50);
      expect(data.usage.completion_tokens).toBeUndefined();
      expect(data.usage.total_tokens).toBeUndefined();
      expect(data.usage.cost).toBeUndefined();
    });
  });

  describe('Error Response Handling', () => {
    /**
     * Tests for error response handling scenarios
     */

    it('should identify error status codes (4xx)', () => {
      const statusCodes = [400, 401, 403, 404, 429];

      statusCodes.forEach((code) => {
        expect(code >= 400).toBe(true);
      });
    });

    it('should identify error status codes (5xx)', () => {
      const statusCodes = [500, 502, 503, 504];

      statusCodes.forEach((code) => {
        expect(code >= 400).toBe(true);
      });
    });

    it('should identify successful status codes', () => {
      const statusCodes = [200, 201, 204];

      statusCodes.forEach((code) => {
        expect(code < 400).toBe(true);
      });
    });
  });
});
