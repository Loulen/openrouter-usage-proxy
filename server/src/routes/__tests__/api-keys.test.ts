/**
 * Integration tests for API keys routes
 * Tests all endpoints under /api/api-keys with mocked database
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { ApiKeyConfig } from '../../types/settings.js';

// Mock the settings module
vi.mock('../../db/settings.js', () => ({
  getApiKeyById: vi.fn(),
  addApiKey: vi.fn(),
  updateApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
  getAllApiKeys: vi.fn(),
}));

// Mock the proxy module for hashApiKey function
vi.mock('../../middleware/proxy.js', () => ({
  hashApiKey: vi.fn(),
}));

// Import mocked functions and router after mocking
import {
  getApiKeyById,
  addApiKey,
  updateApiKey,
  deleteApiKey,
  getAllApiKeys,
} from '../../db/settings.js';
import { hashApiKey } from '../../middleware/proxy.js';
import apiKeysRouter from '../api-keys.js';

/**
 * Create a test Express app with the api-keys router mounted
 */
function createTestApp(): express.Application {
  const app = express();
  app.use(express.json());
  app.use('/api/api-keys', apiKeysRouter);
  // Add error handler
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.status(500).json({ error: true, message: err.message, code: 'INTERNAL_ERROR' });
  });
  return app;
}

/**
 * Sample API key configuration for testing
 */
function createSampleApiKey(overrides: Partial<ApiKeyConfig> = {}): ApiKeyConfig {
  return {
    id: 'uuid-123',
    label: 'Test API Key',
    key: 'sk-or-v1-test1234567890',
    createdAt: '2024-06-15T10:00:00.000Z',
    ...overrides,
  };
}

describe('API Keys Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
    // Set up hashApiKey mock implementation after clearAllMocks
    vi.mocked(hashApiKey).mockImplementation((key: string) => `hashed_${key.substring(key.length - 8)}`);
  });

  describe('GET /api/api-keys', () => {
    it('should return masked API keys list', async () => {
      const mockApiKeys: ApiKeyConfig[] = [
        createSampleApiKey({ id: 'key-1', label: 'Key One', key: 'sk-or-v1-abcdefghijklmnop' }),
        createSampleApiKey({ id: 'key-2', label: 'Key Two', key: 'sk-or-v1-1234567890abcdef' }),
      ];
      vi.mocked(getAllApiKeys).mockReturnValue(mockApiKeys);

      const response = await request(app).get('/api/api-keys');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toHaveLength(2);
      
      // Verify keys are masked
      expect(response.body[0].maskedKey).toBe('sk-or-v1...mnop');
      expect(response.body[0].label).toBe('Key One');
      expect(response.body[0].id).toBe('key-1');
      
      // Verify full key is NOT exposed
      expect(response.body[0].key).toBeUndefined();
    });

    it('should return empty array when no API keys exist', async () => {
      vi.mocked(getAllApiKeys).mockReturnValue([]);

      const response = await request(app).get('/api/api-keys');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should mask short keys with asterisks', async () => {
      const mockApiKeys: ApiKeyConfig[] = [
        createSampleApiKey({ id: 'key-1', key: 'shortkey' }), // Key <= 12 chars
      ];
      vi.mocked(getAllApiKeys).mockReturnValue(mockApiKeys);

      const response = await request(app).get('/api/api-keys');

      expect(response.status).toBe(200);
      expect(response.body[0].maskedKey).toBe('***');
    });

    it('should include createdAt timestamp for each key', async () => {
      const mockApiKeys: ApiKeyConfig[] = [
        createSampleApiKey({ createdAt: '2024-12-25T12:00:00.000Z' }),
      ];
      vi.mocked(getAllApiKeys).mockReturnValue(mockApiKeys);

      const response = await request(app).get('/api/api-keys');

      expect(response.status).toBe(200);
      expect(response.body[0].createdAt).toBe('2024-12-25T12:00:00.000Z');
    });
  });

  describe('POST /api/api-keys', () => {
    it('should create a new API key and return masked response', async () => {
      const newKey = createSampleApiKey({ id: 'new-key-id', key: 'sk-or-v1-newkeyvalue12345' });
      vi.mocked(addApiKey).mockReturnValue(newKey);

      const response = await request(app)
        .post('/api/api-keys')
        .send({ label: 'New Key', key: 'sk-or-v1-newkeyvalue12345' });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('new-key-id');
      expect(response.body.label).toBe('Test API Key');
      expect(response.body.maskedKey).toBeDefined();
      expect(response.body.key).toBeUndefined(); // Full key should not be exposed
      expect(addApiKey).toHaveBeenCalledWith({ label: 'New Key', key: 'sk-or-v1-newkeyvalue12345' });
    });

    it('should return 400 if label is missing', async () => {
      const response = await request(app)
        .post('/api/api-keys')
        .send({ key: 'sk-or-v1-test123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toBe('Label is required');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if label is empty string', async () => {
      const response = await request(app)
        .post('/api/api-keys')
        .send({ label: '', key: 'sk-or-v1-test123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toBe('Label is required');
    });

    it('should return 400 if label is only whitespace', async () => {
      const response = await request(app)
        .post('/api/api-keys')
        .send({ label: '   ', key: 'sk-or-v1-test123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toBe('Label is required');
    });

    it('should return 400 if key is missing', async () => {
      const response = await request(app)
        .post('/api/api-keys')
        .send({ label: 'My Key' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toBe('API key is required');
    });

    it('should return 400 if key is empty string', async () => {
      const response = await request(app)
        .post('/api/api-keys')
        .send({ label: 'My Key', key: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toBe('API key is required');
    });

    it('should return 400 if key does not start with sk-or-', async () => {
      const response = await request(app)
        .post('/api/api-keys')
        .send({ label: 'My Key', key: 'invalid-key-format' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain('Invalid API key format');
      expect(response.body.message).toContain('sk-or-');
    });

    it('should trim whitespace from label and key', async () => {
      const newKey = createSampleApiKey();
      vi.mocked(addApiKey).mockReturnValue(newKey);

      // Note: key validation happens before trimming, so key must start with sk-or-
      // but can have trailing whitespace
      await request(app)
        .post('/api/api-keys')
        .send({ label: '  Trimmed Label  ', key: 'sk-or-v1-trimmedkey123  ' });

      expect(addApiKey).toHaveBeenCalledWith({ label: 'Trimmed Label', key: 'sk-or-v1-trimmedkey123' });
    });
  });

  describe('DELETE /api/api-keys/:id', () => {
    it('should delete an API key and return success message', async () => {
      vi.mocked(deleteApiKey).mockReturnValue(true);

      const response = await request(app).delete('/api/api-keys/key-to-delete');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('API key deleted successfully');
      expect(deleteApiKey).toHaveBeenCalledWith('key-to-delete');
    });

    it('should return 404 if API key not found', async () => {
      vi.mocked(deleteApiKey).mockReturnValue(false);

      const response = await request(app).delete('/api/api-keys/nonexistent-key');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toBe('API key not found');
      expect(response.body.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/api-keys/hash-map', () => {
    it('should return hash-to-label mapping', async () => {
      const mockApiKeys: ApiKeyConfig[] = [
        createSampleApiKey({ id: 'key-1', label: 'Production Key', key: 'sk-or-v1-prod123' }),
        createSampleApiKey({ id: 'key-2', label: 'Development Key', key: 'sk-or-v1-dev456' }),
      ];
      vi.mocked(getAllApiKeys).mockReturnValue(mockApiKeys);

      const response = await request(app).get('/api/api-keys/hash-map');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);

      // Verify hash map structure
      expect(hashApiKey).toHaveBeenCalledWith('sk-or-v1-prod123');
      expect(hashApiKey).toHaveBeenCalledWith('sk-or-v1-dev456');

      // Verify response contains the hash-label mapping
      // The actual hash values depend on the mock implementation
      const keys = Object.keys(response.body);
      expect(keys).toHaveLength(2);
      expect(Object.values(response.body)).toContain('Production Key');
      expect(Object.values(response.body)).toContain('Development Key');
    });

    it('should return empty object when no API keys exist', async () => {
      vi.mocked(getAllApiKeys).mockReturnValue([]);

      const response = await request(app).get('/api/api-keys/hash-map');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({});
    });

    it('should handle multiple keys with same label', async () => {
      const mockApiKeys: ApiKeyConfig[] = [
        createSampleApiKey({ id: 'key-1', label: 'Same Label', key: 'sk-or-v1-key1abc' }),
        createSampleApiKey({ id: 'key-2', label: 'Same Label', key: 'sk-or-v1-key2xyz' }),
      ];
      vi.mocked(getAllApiKeys).mockReturnValue(mockApiKeys);

      const response = await request(app).get('/api/api-keys/hash-map');

      expect(response.status).toBe(200);
      // Both keys should map to the same label
      const keys = Object.keys(response.body);
      expect(keys).toHaveLength(2);
      // All values should be 'Same Label'
      Object.values(response.body).forEach((label) => {
        expect(label).toBe('Same Label');
      });
    });
  });

  describe('PUT /api/api-keys/:id', () => {
    it('should update API key label', async () => {
      const existingKey = createSampleApiKey({ id: 'key-1', label: 'Old Label' });
      const updatedKey = createSampleApiKey({ id: 'key-1', label: 'New Label' });
      
      vi.mocked(getApiKeyById).mockReturnValue(existingKey);
      vi.mocked(updateApiKey).mockReturnValue(updatedKey);

      const response = await request(app)
        .put('/api/api-keys/key-1')
        .send({ label: 'New Label' });

      expect(response.status).toBe(200);
      expect(response.body.label).toBe('New Label');
      expect(updateApiKey).toHaveBeenCalledWith('key-1', { label: 'New Label' });
    });

    it('should update API key value', async () => {
      const existingKey = createSampleApiKey({ id: 'key-1' });
      const updatedKey = createSampleApiKey({ id: 'key-1', key: 'sk-or-v1-newkeyvalue123' });
      
      vi.mocked(getApiKeyById).mockReturnValue(existingKey);
      vi.mocked(updateApiKey).mockReturnValue(updatedKey);

      const response = await request(app)
        .put('/api/api-keys/key-1')
        .send({ key: 'sk-or-v1-newkeyvalue123' });

      expect(response.status).toBe(200);
      expect(updateApiKey).toHaveBeenCalledWith('key-1', { key: 'sk-or-v1-newkeyvalue123' });
    });

    it('should return 404 if API key not found', async () => {
      vi.mocked(getApiKeyById).mockReturnValue(undefined);

      const response = await request(app)
        .put('/api/api-keys/nonexistent')
        .send({ label: 'New Label' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toBe('API key not found');
      expect(response.body.code).toBe('NOT_FOUND');
    });

    it('should return 400 if label is empty', async () => {
      const existingKey = createSampleApiKey();
      vi.mocked(getApiKeyById).mockReturnValue(existingKey);

      const response = await request(app)
        .put('/api/api-keys/key-1')
        .send({ label: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toBe('Label cannot be empty');
    });

    it('should return 400 if new key is empty', async () => {
      const existingKey = createSampleApiKey();
      vi.mocked(getApiKeyById).mockReturnValue(existingKey);

      const response = await request(app)
        .put('/api/api-keys/key-1')
        .send({ key: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toBe('API key cannot be empty');
    });

    it('should return 400 if new key has invalid format', async () => {
      const existingKey = createSampleApiKey();
      vi.mocked(getApiKeyById).mockReturnValue(existingKey);

      const response = await request(app)
        .put('/api/api-keys/key-1')
        .send({ key: 'invalid-format' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain('Invalid API key format');
    });

    it('should return masked key in response', async () => {
      const existingKey = createSampleApiKey();
      const updatedKey = createSampleApiKey({ key: 'sk-or-v1-updated1234567890' });
      
      vi.mocked(getApiKeyById).mockReturnValue(existingKey);
      vi.mocked(updateApiKey).mockReturnValue(updatedKey);

      const response = await request(app)
        .put('/api/api-keys/key-1')
        .send({ label: 'Updated Label' });

      expect(response.status).toBe(200);
      expect(response.body.maskedKey).toBeDefined();
      expect(response.body.key).toBeUndefined(); // Full key not exposed
    });

    it('should handle updateApiKey returning undefined (race condition)', async () => {
      const existingKey = createSampleApiKey();
      vi.mocked(getApiKeyById).mockReturnValue(existingKey);
      vi.mocked(updateApiKey).mockReturnValue(undefined);

      const response = await request(app)
        .put('/api/api-keys/key-1')
        .send({ label: 'New Label' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toBe('API key not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors in GET /api/api-keys', async () => {
      vi.mocked(getAllApiKeys).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await request(app).get('/api/api-keys');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe(true);
    });

    it('should handle database errors in POST /api/api-keys', async () => {
      vi.mocked(addApiKey).mockImplementation(() => {
        throw new Error('Database write failed');
      });

      const response = await request(app)
        .post('/api/api-keys')
        .send({ label: 'Test', key: 'sk-or-v1-test123' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe(true);
    });

    it('should handle database errors in DELETE /api/api-keys/:id', async () => {
      vi.mocked(deleteApiKey).mockImplementation(() => {
        throw new Error('Database delete failed');
      });

      const response = await request(app).delete('/api/api-keys/key-1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe(true);
    });

    it('should handle database errors in GET /api/api-keys/hash-map', async () => {
      vi.mocked(getAllApiKeys).mockImplementation(() => {
        throw new Error('Database read failed');
      });

      const response = await request(app).get('/api/api-keys/hash-map');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe(true);
    });
  });
});
