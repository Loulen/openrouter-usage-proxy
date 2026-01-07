/**
 * Integration tests for logs API routes
 * Tests all endpoints under /api/logs with mocked database
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { UsageLog, UsageStats, ModelStats, TimeSeriesDataPoint } from '../../types/index.js';

// Mock the database module
vi.mock('../../db/index.js', () => ({
  getModels: vi.fn(),
  getFilteredLogs: vi.fn(),
  getFilteredStats: vi.fn(),
  getModelStats: vi.fn(),
  getTimeSeries: vi.fn(),
}));

// Import mocked functions and router after mocking
import {
  getModels,
  getFilteredLogs,
  getFilteredStats,
  getModelStats,
  getTimeSeries,
} from '../../db/index.js';
import logsRouter from '../logs.js';

/**
 * Create a test Express app with the logs router mounted
 */
function createTestApp(): express.Application {
  const app = express();
  app.use(express.json());
  app.use('/api/logs', logsRouter);
  return app;
}

/**
 * Sample usage log for testing
 */
function createSampleLog(overrides: Partial<UsageLog> = {}): UsageLog {
  return {
    id: 1,
    timestamp: '2024-06-15T10:00:00.000Z',
    model: 'anthropic/claude-3-opus',
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150,
    cost: 0.0015,
    request_path: '/api/v1/chat/completions',
    status_code: 200,
    api_key_hash: 'hash_abc123',
    created_at: '2024-06-15T10:00:00.000Z',
    ...overrides,
  };
}

describe('Logs API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  describe('GET /api/logs', () => {
    it('should return logs as JSON array', async () => {
      const mockLogs: UsageLog[] = [
        createSampleLog({ id: 1 }),
        createSampleLog({ id: 2, model: 'openai/gpt-4' }),
      ];
      vi.mocked(getFilteredLogs).mockReturnValue(mockLogs);

      const response = await request(app).get('/api/logs');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toEqual(mockLogs);
      expect(getFilteredLogs).toHaveBeenCalledWith({});
    });

    it('should return empty array when no logs exist', async () => {
      vi.mocked(getFilteredLogs).mockReturnValue([]);

      const response = await request(app).get('/api/logs');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should filter logs by model query parameter', async () => {
      const mockLogs: UsageLog[] = [createSampleLog({ model: 'anthropic/claude-3-opus' })];
      vi.mocked(getFilteredLogs).mockReturnValue(mockLogs);

      const response = await request(app).get('/api/logs?model=anthropic/claude-3-opus');

      expect(response.status).toBe(200);
      expect(getFilteredLogs).toHaveBeenCalledWith({ model: 'anthropic/claude-3-opus' });
    });

    it('should filter logs by from date query parameter', async () => {
      const mockLogs: UsageLog[] = [createSampleLog()];
      vi.mocked(getFilteredLogs).mockReturnValue(mockLogs);

      const response = await request(app).get('/api/logs?from=2024-01-01T00:00:00Z');

      expect(response.status).toBe(200);
      expect(getFilteredLogs).toHaveBeenCalledWith({ from: '2024-01-01T00:00:00Z' });
    });

    it('should filter logs by to date query parameter', async () => {
      const mockLogs: UsageLog[] = [createSampleLog()];
      vi.mocked(getFilteredLogs).mockReturnValue(mockLogs);

      const response = await request(app).get('/api/logs?to=2024-12-31T23:59:59Z');

      expect(response.status).toBe(200);
      expect(getFilteredLogs).toHaveBeenCalledWith({ to: '2024-12-31T23:59:59Z' });
    });

    it('should filter logs by multiple query parameters', async () => {
      const mockLogs: UsageLog[] = [createSampleLog()];
      vi.mocked(getFilteredLogs).mockReturnValue(mockLogs);

      const response = await request(app).get(
        '/api/logs?model=anthropic/claude-3-opus&from=2024-01-01T00:00:00Z&to=2024-12-31T23:59:59Z'
      );

      expect(response.status).toBe(200);
      expect(getFilteredLogs).toHaveBeenCalledWith({
        model: 'anthropic/claude-3-opus',
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
      });
    });

    it('should ignore empty query parameters', async () => {
      vi.mocked(getFilteredLogs).mockReturnValue([]);

      const response = await request(app).get('/api/logs?model=&from=&to=');

      expect(response.status).toBe(200);
      expect(getFilteredLogs).toHaveBeenCalledWith({});
    });

    it('should trim whitespace from query parameters', async () => {
      vi.mocked(getFilteredLogs).mockReturnValue([]);

      const response = await request(app).get('/api/logs?model=%20anthropic/claude%20');

      expect(response.status).toBe(200);
      expect(getFilteredLogs).toHaveBeenCalledWith({ model: 'anthropic/claude' });
    });
  });

  describe('GET /api/logs/stats', () => {
    it('should return aggregated stats', async () => {
      const mockStats: UsageStats = {
        request_count: 100,
        total_tokens: 15000,
        total_cost: 0.15,
      };
      vi.mocked(getFilteredStats).mockReturnValue(mockStats);

      const response = await request(app).get('/api/logs/stats');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toEqual(mockStats);
      expect(getFilteredStats).toHaveBeenCalledWith({});
    });

    it('should return zero stats when no logs exist', async () => {
      const mockStats: UsageStats = {
        request_count: 0,
        total_tokens: 0,
        total_cost: 0,
      };
      vi.mocked(getFilteredStats).mockReturnValue(mockStats);

      const response = await request(app).get('/api/logs/stats');

      expect(response.status).toBe(200);
      expect(response.body.request_count).toBe(0);
      expect(response.body.total_tokens).toBe(0);
      expect(response.body.total_cost).toBe(0);
    });

    it('should filter stats by model query parameter', async () => {
      const mockStats: UsageStats = { request_count: 10, total_tokens: 1500, total_cost: 0.015 };
      vi.mocked(getFilteredStats).mockReturnValue(mockStats);

      const response = await request(app).get('/api/logs/stats?model=openai/gpt-4');

      expect(response.status).toBe(200);
      expect(getFilteredStats).toHaveBeenCalledWith({ model: 'openai/gpt-4' });
    });

    it('should filter stats by date range', async () => {
      const mockStats: UsageStats = { request_count: 50, total_tokens: 7500, total_cost: 0.075 };
      vi.mocked(getFilteredStats).mockReturnValue(mockStats);

      const response = await request(app).get(
        '/api/logs/stats?from=2024-01-01T00:00:00Z&to=2024-06-30T23:59:59Z'
      );

      expect(response.status).toBe(200);
      expect(getFilteredStats).toHaveBeenCalledWith({
        from: '2024-01-01T00:00:00Z',
        to: '2024-06-30T23:59:59Z',
      });
    });
  });

  describe('GET /api/logs/models', () => {
    it('should return list of distinct model names', async () => {
      const mockModels = ['anthropic/claude-3-opus', 'openai/gpt-4', 'google/gemini-pro'];
      vi.mocked(getModels).mockReturnValue(mockModels);

      const response = await request(app).get('/api/logs/models');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toEqual(mockModels);
      expect(getModels).toHaveBeenCalled();
    });

    it('should return empty array when no logs exist', async () => {
      vi.mocked(getModels).mockReturnValue([]);

      const response = await request(app).get('/api/logs/models');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('GET /api/logs/model-stats', () => {
    it('should return per-model statistics', async () => {
      const mockModelStats: ModelStats[] = [
        { model: 'anthropic/claude-3-opus', request_count: 50, total_tokens: 7500, total_cost: 0.075 },
        { model: 'openai/gpt-4', request_count: 30, total_tokens: 4500, total_cost: 0.045 },
      ];
      vi.mocked(getModelStats).mockReturnValue(mockModelStats);

      const response = await request(app).get('/api/logs/model-stats');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toEqual(mockModelStats);
      expect(getModelStats).toHaveBeenCalledWith({ from: undefined, to: undefined });
    });

    it('should return empty array when no logs exist', async () => {
      vi.mocked(getModelStats).mockReturnValue([]);

      const response = await request(app).get('/api/logs/model-stats');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should filter model stats by date range', async () => {
      const mockModelStats: ModelStats[] = [
        { model: 'anthropic/claude-3-opus', request_count: 25, total_tokens: 3750, total_cost: 0.0375 },
      ];
      vi.mocked(getModelStats).mockReturnValue(mockModelStats);

      const response = await request(app).get(
        '/api/logs/model-stats?from=2024-01-01T00:00:00Z&to=2024-06-30T23:59:59Z'
      );

      expect(response.status).toBe(200);
      expect(getModelStats).toHaveBeenCalledWith({
        from: '2024-01-01T00:00:00Z',
        to: '2024-06-30T23:59:59Z',
      });
    });

    it('should not pass model filter to getModelStats (returns all models)', async () => {
      vi.mocked(getModelStats).mockReturnValue([]);

      // Even if model param is passed, model-stats should not filter by it
      const response = await request(app).get('/api/logs/model-stats?model=anthropic/claude-3-opus');

      expect(response.status).toBe(200);
      // model should not be included in the filter params
      expect(getModelStats).toHaveBeenCalledWith({ from: undefined, to: undefined });
    });
  });

  describe('GET /api/logs/time-series', () => {
    it('should return time-series data with default day aggregation', async () => {
      const mockTimeSeries: TimeSeriesDataPoint[] = [
        { period: '2024-06-01', model: 'anthropic/claude-3-opus', request_count: 10, total_tokens: 1500, total_cost: 0.015 },
        { period: '2024-06-02', model: 'anthropic/claude-3-opus', request_count: 15, total_tokens: 2250, total_cost: 0.0225 },
      ];
      vi.mocked(getTimeSeries).mockReturnValue(mockTimeSeries);

      const response = await request(app).get('/api/logs/time-series');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toEqual(mockTimeSeries);
      expect(getTimeSeries).toHaveBeenCalledWith({
        from: undefined,
        to: undefined,
        aggregation: 'day',
      });
    });

    it('should return empty array when no logs exist', async () => {
      vi.mocked(getTimeSeries).mockReturnValue([]);

      const response = await request(app).get('/api/logs/time-series');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should accept hour aggregation parameter', async () => {
      vi.mocked(getTimeSeries).mockReturnValue([]);

      const response = await request(app).get('/api/logs/time-series?aggregation=hour');

      expect(response.status).toBe(200);
      expect(getTimeSeries).toHaveBeenCalledWith({
        from: undefined,
        to: undefined,
        aggregation: 'hour',
      });
    });

    it('should accept day aggregation parameter', async () => {
      vi.mocked(getTimeSeries).mockReturnValue([]);

      const response = await request(app).get('/api/logs/time-series?aggregation=day');

      expect(response.status).toBe(200);
      expect(getTimeSeries).toHaveBeenCalledWith({
        from: undefined,
        to: undefined,
        aggregation: 'day',
      });
    });

    it('should accept week aggregation parameter', async () => {
      vi.mocked(getTimeSeries).mockReturnValue([]);

      const response = await request(app).get('/api/logs/time-series?aggregation=week');

      expect(response.status).toBe(200);
      expect(getTimeSeries).toHaveBeenCalledWith({
        from: undefined,
        to: undefined,
        aggregation: 'week',
      });
    });

    it('should default to day for invalid aggregation parameter', async () => {
      vi.mocked(getTimeSeries).mockReturnValue([]);

      const response = await request(app).get('/api/logs/time-series?aggregation=invalid');

      expect(response.status).toBe(200);
      expect(getTimeSeries).toHaveBeenCalledWith({
        from: undefined,
        to: undefined,
        aggregation: 'day',
      });
    });

    it('should filter time-series by date range', async () => {
      vi.mocked(getTimeSeries).mockReturnValue([]);

      const response = await request(app).get(
        '/api/logs/time-series?from=2024-01-01T00:00:00Z&to=2024-06-30T23:59:59Z'
      );

      expect(response.status).toBe(200);
      expect(getTimeSeries).toHaveBeenCalledWith({
        from: '2024-01-01T00:00:00Z',
        to: '2024-06-30T23:59:59Z',
        aggregation: 'day',
      });
    });

    it('should combine date range and aggregation parameters', async () => {
      vi.mocked(getTimeSeries).mockReturnValue([]);

      const response = await request(app).get(
        '/api/logs/time-series?from=2024-01-01T00:00:00Z&to=2024-06-30T23:59:59Z&aggregation=week'
      );

      expect(response.status).toBe(200);
      expect(getTimeSeries).toHaveBeenCalledWith({
        from: '2024-01-01T00:00:00Z',
        to: '2024-06-30T23:59:59Z',
        aggregation: 'week',
      });
    });

    it('should handle case-insensitive aggregation parameter', async () => {
      vi.mocked(getTimeSeries).mockReturnValue([]);

      const response = await request(app).get('/api/logs/time-series?aggregation=HOUR');

      expect(response.status).toBe(200);
      expect(getTimeSeries).toHaveBeenCalledWith({
        from: undefined,
        to: undefined,
        aggregation: 'hour',
      });
    });
  });
});
