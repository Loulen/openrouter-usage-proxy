/**
 * Integration tests for settings API routes
 * Tests all endpoints under /api/settings with mocked database
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Settings } from '../../types/settings.js';

// Mock the settings module
vi.mock('../../db/settings.js', () => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

// Import mocked functions and router after mocking
import { getSettings, saveSettings } from '../../db/settings.js';
import settingsRouter from '../settings.js';

/**
 * Create a test Express app with the settings router mounted
 */
function createTestApp(): express.Application {
  const app = express();
  app.use(express.json());
  app.use('/api/settings', settingsRouter);
  return app;
}

/**
 * Sample settings for testing
 */
function createSampleSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    apiKeyTrackingEnabled: false,
    apiKeys: [],
    lastUpdated: '2024-06-15T10:00:00.000Z',
    ...overrides,
  };
}

describe('Settings API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  describe('GET /api/settings', () => {
    it('should return current settings as JSON', async () => {
      const mockSettings = createSampleSettings();
      vi.mocked(getSettings).mockReturnValue(mockSettings);

      const response = await request(app).get('/api/settings');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toEqual(mockSettings);
      expect(getSettings).toHaveBeenCalled();
    });

    it('should return settings with apiKeyTrackingEnabled true', async () => {
      const mockSettings = createSampleSettings({ apiKeyTrackingEnabled: true });
      vi.mocked(getSettings).mockReturnValue(mockSettings);

      const response = await request(app).get('/api/settings');

      expect(response.status).toBe(200);
      expect(response.body.apiKeyTrackingEnabled).toBe(true);
    });

    it('should return settings with API keys', async () => {
      const mockSettings = createSampleSettings({
        apiKeys: [
          { id: 'key-1', label: 'My Key', key: 'sk-or-v1-abc123', createdAt: '2024-06-15T10:00:00.000Z' },
        ],
      });
      vi.mocked(getSettings).mockReturnValue(mockSettings);

      const response = await request(app).get('/api/settings');

      expect(response.status).toBe(200);
      expect(response.body.apiKeys).toHaveLength(1);
      expect(response.body.apiKeys[0].label).toBe('My Key');
    });

    it('should return settings with lastUpdated timestamp', async () => {
      const timestamp = '2024-12-25T12:30:00.000Z';
      const mockSettings = createSampleSettings({ lastUpdated: timestamp });
      vi.mocked(getSettings).mockReturnValue(mockSettings);

      const response = await request(app).get('/api/settings');

      expect(response.status).toBe(200);
      expect(response.body.lastUpdated).toBe(timestamp);
    });
  });

  describe('PUT /api/settings', () => {
    it('should update apiKeyTrackingEnabled setting', async () => {
      const currentSettings = createSampleSettings({ apiKeyTrackingEnabled: false });
      const updatedSettings = createSampleSettings({ apiKeyTrackingEnabled: true });
      
      vi.mocked(getSettings)
        .mockReturnValueOnce(currentSettings) // First call in PUT handler
        .mockReturnValueOnce(updatedSettings); // Second call after save
      vi.mocked(saveSettings).mockImplementation(() => {});

      const response = await request(app)
        .put('/api/settings')
        .send({ apiKeyTrackingEnabled: true });

      expect(response.status).toBe(200);
      expect(response.body.apiKeyTrackingEnabled).toBe(true);
      expect(saveSettings).toHaveBeenCalled();
    });

    it('should update apiKeys array', async () => {
      const currentSettings = createSampleSettings({ apiKeys: [] });
      const newApiKeys = [
        { id: 'key-1', label: 'New Key', key: 'sk-or-v1-xyz789', createdAt: '2024-06-15T10:00:00.000Z' },
      ];
      const updatedSettings = createSampleSettings({ apiKeys: newApiKeys });
      
      vi.mocked(getSettings)
        .mockReturnValueOnce(currentSettings)
        .mockReturnValueOnce(updatedSettings);
      vi.mocked(saveSettings).mockImplementation(() => {});

      const response = await request(app)
        .put('/api/settings')
        .send({ apiKeys: newApiKeys });

      expect(response.status).toBe(200);
      expect(response.body.apiKeys).toHaveLength(1);
      expect(response.body.apiKeys[0].label).toBe('New Key');
    });

    it('should merge updates with current settings (partial update)', async () => {
      const currentSettings = createSampleSettings({
        apiKeyTrackingEnabled: false,
        apiKeys: [
          { id: 'key-1', label: 'Existing Key', key: 'sk-or-v1-existing', createdAt: '2024-06-15T10:00:00.000Z' },
        ],
      });
      const updatedSettings = createSampleSettings({
        apiKeyTrackingEnabled: true,
        apiKeys: currentSettings.apiKeys,
      });
      
      vi.mocked(getSettings)
        .mockReturnValueOnce(currentSettings)
        .mockReturnValueOnce(updatedSettings);
      vi.mocked(saveSettings).mockImplementation(() => {});

      const response = await request(app)
        .put('/api/settings')
        .send({ apiKeyTrackingEnabled: true }); // Only updating apiKeyTrackingEnabled

      expect(response.status).toBe(200);
      expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({
        apiKeyTrackingEnabled: true,
        apiKeys: currentSettings.apiKeys, // Preserved from current settings
      }));
    });

    it('should return updated settings after save', async () => {
      const currentSettings = createSampleSettings();
      const savedTimestamp = '2024-06-15T12:00:00.000Z';
      const updatedSettings = createSampleSettings({
        apiKeyTrackingEnabled: true,
        lastUpdated: savedTimestamp,
      });
      
      vi.mocked(getSettings)
        .mockReturnValueOnce(currentSettings)
        .mockReturnValueOnce(updatedSettings);
      vi.mocked(saveSettings).mockImplementation(() => {});

      const response = await request(app)
        .put('/api/settings')
        .send({ apiKeyTrackingEnabled: true });

      expect(response.status).toBe(200);
      expect(response.body.lastUpdated).toBe(savedTimestamp);
    });

    it('should ignore invalid fields in request body', async () => {
      const currentSettings = createSampleSettings();
      
      vi.mocked(getSettings)
        .mockReturnValueOnce(currentSettings)
        .mockReturnValueOnce(currentSettings);
      vi.mocked(saveSettings).mockImplementation(() => {});

      const response = await request(app)
        .put('/api/settings')
        .send({ 
          apiKeyTrackingEnabled: true,
          invalidField: 'should be ignored',
          anotherInvalid: 123,
        });

      expect(response.status).toBe(200);
      expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({
        apiKeyTrackingEnabled: true,
      }));
      expect(saveSettings).not.toHaveBeenCalledWith(expect.objectContaining({
        invalidField: expect.anything(),
      }));
    });

    it('should not update apiKeyTrackingEnabled if value is not boolean', async () => {
      const currentSettings = createSampleSettings({ apiKeyTrackingEnabled: false });
      
      vi.mocked(getSettings)
        .mockReturnValueOnce(currentSettings)
        .mockReturnValueOnce(currentSettings);
      vi.mocked(saveSettings).mockImplementation(() => {});

      const response = await request(app)
        .put('/api/settings')
        .send({ apiKeyTrackingEnabled: 'true' }); // String instead of boolean

      expect(response.status).toBe(200);
      // Should keep the original value since 'true' string is not boolean
      expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({
        apiKeyTrackingEnabled: false,
      }));
    });

    it('should not update apiKeys if value is not an array', async () => {
      const currentSettings = createSampleSettings({ apiKeys: [] });
      
      vi.mocked(getSettings)
        .mockReturnValueOnce(currentSettings)
        .mockReturnValueOnce(currentSettings);
      vi.mocked(saveSettings).mockImplementation(() => {});

      const response = await request(app)
        .put('/api/settings')
        .send({ apiKeys: 'not an array' }); // String instead of array

      expect(response.status).toBe(200);
      // Should keep the original empty array
      expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({
        apiKeys: [],
      }));
    });

    it('should handle empty request body', async () => {
      const currentSettings = createSampleSettings();
      
      vi.mocked(getSettings)
        .mockReturnValueOnce(currentSettings)
        .mockReturnValueOnce(currentSettings);
      vi.mocked(saveSettings).mockImplementation(() => {});

      const response = await request(app)
        .put('/api/settings')
        .send({});

      expect(response.status).toBe(200);
      expect(saveSettings).toHaveBeenCalled();
    });

    it('should handle Content-Type application/json', async () => {
      const currentSettings = createSampleSettings();
      
      vi.mocked(getSettings)
        .mockReturnValueOnce(currentSettings)
        .mockReturnValueOnce(currentSettings);
      vi.mocked(saveSettings).mockImplementation(() => {});

      const response = await request(app)
        .put('/api/settings')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ apiKeyTrackingEnabled: true }));

      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle GET error gracefully', async () => {
      vi.mocked(getSettings).mockImplementation(() => {
        throw new Error('Database read error');
      });

      // Add error handler to test app
      const testApp = createTestApp();
      testApp.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
        res.status(500).json({ error: true, message: err.message });
      });

      const response = await request(testApp).get('/api/settings');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe(true);
    });

    it('should handle PUT/saveSettings error gracefully', async () => {
      const currentSettings = createSampleSettings();
      vi.mocked(getSettings).mockReturnValue(currentSettings);
      vi.mocked(saveSettings).mockImplementation(() => {
        throw new Error('Database write error');
      });

      // Add error handler to test app
      const testApp = createTestApp();
      testApp.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
        res.status(500).json({ error: true, message: err.message });
      });

      const response = await request(testApp)
        .put('/api/settings')
        .send({ apiKeyTrackingEnabled: true });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe(true);
    });
  });
});
