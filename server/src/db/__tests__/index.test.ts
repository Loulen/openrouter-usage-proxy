/**
 * Tests for database CRUD operations
 * Tests the database functions against an in-memory SQLite database
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  createTestDb,
  cleanupTestDb,
  createMockUsageLog,
  insertTestLog,
  resetMockCounter,
} from '../../__tests__/test-utils.js';
import {
  buildFilteredLogsQuery,
  buildFilteredStatsQuery,
  buildFilteredModelStatsQuery,
  buildTimeSeriesQuery,
  SELECT_ALL_LOGS,
  SELECT_USAGE_STATS,
  SELECT_DISTINCT_MODELS,
} from '../schema.js';
import type {
  UsageLog,
  UsageLogInput,
  UsageStats,
  FilterParams,
  ModelStats,
  TimeSeriesDataPoint,
} from '../../types/index.js';

/**
 * Helper functions that replicate the db/index.ts functions
 * but work with a provided database instance instead of the global one
 *
 * We use insertTestLog from test-utils for insert operations as it's
 * already proven to work correctly with the test database schema.
 */

function getLogs(db: Database.Database): UsageLog[] {
  const selectAllStatement = db.prepare(SELECT_ALL_LOGS);
  return selectAllStatement.all() as UsageLog[];
}

function getStats(db: Database.Database): UsageStats {
  const selectStatsStatement = db.prepare(SELECT_USAGE_STATS);
  return selectStatsStatement.get() as UsageStats;
}

function getModels(db: Database.Database): string[] {
  const selectModelsStatement = db.prepare(SELECT_DISTINCT_MODELS);
  const rows = selectModelsStatement.all() as { model: string }[];
  return rows.map((row) => row.model);
}

function getFilteredLogs(db: Database.Database, filters: FilterParams = {}): UsageLog[] {
  if (!filters.model && !filters.from && !filters.to) {
    return db.prepare(SELECT_ALL_LOGS).all() as UsageLog[];
  }
  const { sql, params } = buildFilteredLogsQuery(filters);
  const statement = db.prepare(sql);
  return statement.all(...params) as UsageLog[];
}

function getFilteredStats(db: Database.Database, filters: FilterParams = {}): UsageStats {
  if (!filters.model && !filters.from && !filters.to) {
    return db.prepare(SELECT_USAGE_STATS).get() as UsageStats;
  }
  const { sql, params } = buildFilteredStatsQuery(filters);
  const statement = db.prepare(sql);
  return statement.get(...params) as UsageStats;
}

function getModelStats(db: Database.Database, filters: { from?: string; to?: string } = {}): ModelStats[] {
  const { sql, params } = buildFilteredModelStatsQuery(filters);
  const statement = db.prepare(sql);
  return statement.all(...params) as ModelStats[];
}

function getTimeSeries(
  db: Database.Database,
  filters: { from?: string; to?: string; aggregation?: 'hour' | 'day' | 'week' } = {}
): TimeSeriesDataPoint[] {
  const { sql, params } = buildTimeSeriesQuery(filters);
  const statement = db.prepare(sql);
  return statement.all(...params) as TimeSeriesDataPoint[];
}

describe('Database CRUD Operations', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    resetMockCounter();
  });

  afterEach(() => {
    cleanupTestDb(db);
  });

  describe('insertTestLog', () => {
    it('should insert a log with all fields and return inserted row with id', () => {
      const input = createMockUsageLog({
        model: 'anthropic/claude-3-opus',
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        cost: 0.0015,
        request_path: '/api/v1/chat/completions',
        status_code: 200,
        api_key_hash: 'hash_test_123',
      });

      const result = insertTestLog(db, input);

      expect(result.id).toBe(1);
      expect(result.model).toBe('anthropic/claude-3-opus');
      expect(result.prompt_tokens).toBe(100);
      expect(result.completion_tokens).toBe(50);
      expect(result.total_tokens).toBe(150);
      expect(result.cost).toBe(0.0015);
      expect(result.request_path).toBe('/api/v1/chat/completions');
      expect(result.status_code).toBe(200);
      expect(result.api_key_hash).toBe('hash_test_123');
      expect(result.created_at).toBeDefined();
    });

    it('should insert a log with only required fields (partial fields)', () => {
      const input: UsageLogInput = {
        timestamp: new Date().toISOString(),
        model: 'openai/gpt-4',
      };

      const result = insertTestLog(db, input);

      expect(result.id).toBe(1);
      expect(result.model).toBe('openai/gpt-4');
      expect(result.prompt_tokens).toBeNull();
      expect(result.completion_tokens).toBeNull();
      expect(result.total_tokens).toBeNull();
      expect(result.cost).toBeNull();
      expect(result.request_path).toBeNull();
      expect(result.status_code).toBeNull();
      expect(result.api_key_hash).toBeNull();
    });

    it('should auto-increment id for multiple inserts', () => {
      const log1 = insertTestLog(db, createMockUsageLog());
      const log2 = insertTestLog(db, createMockUsageLog());
      const log3 = insertTestLog(db, createMockUsageLog());

      expect(log1.id).toBe(1);
      expect(log2.id).toBe(2);
      expect(log3.id).toBe(3);
    });

    it('should preserve timestamp exactly as provided', () => {
      const timestamp = '2024-06-15T10:30:00.000Z';
      const input = createMockUsageLog({ timestamp });

      const result = insertTestLog(db, input);

      expect(result.timestamp).toBe(timestamp);
    });

    it('should handle zero values for token counts', () => {
      const input = createMockUsageLog({
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        cost: 0,
      });

      const result = insertTestLog(db, input);

      expect(result.prompt_tokens).toBe(0);
      expect(result.completion_tokens).toBe(0);
      expect(result.total_tokens).toBe(0);
      expect(result.cost).toBe(0);
    });
  });

  describe('getLogs', () => {
    it('should return empty array when no logs exist', () => {
      const logs = getLogs(db);

      expect(logs).toEqual([]);
    });

    it('should return all inserted logs', () => {
      insertTestLog(db, createMockUsageLog({ model: 'model-1' }));
      insertTestLog(db, createMockUsageLog({ model: 'model-2' }));
      insertTestLog(db, createMockUsageLog({ model: 'model-3' }));

      const logs = getLogs(db);

      expect(logs).toHaveLength(3);
    });

    it('should return logs ordered by timestamp DESC (most recent first)', () => {
      insertTestLog(db, createMockUsageLog({ timestamp: '2024-01-01T00:00:00Z', model: 'oldest' }));
      insertTestLog(db, createMockUsageLog({ timestamp: '2024-06-15T00:00:00Z', model: 'middle' }));
      insertTestLog(db, createMockUsageLog({ timestamp: '2024-12-31T00:00:00Z', model: 'newest' }));

      const logs = getLogs(db);

      expect(logs[0].model).toBe('newest');
      expect(logs[1].model).toBe('middle');
      expect(logs[2].model).toBe('oldest');
    });

    it('should return complete log objects with all fields', () => {
      insertTestLog(db, createMockUsageLog({
        model: 'test-model',
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        cost: 0.001,
        request_path: '/test',
        status_code: 200,
        api_key_hash: 'hash123',
      }));

      const logs = getLogs(db);
      const log = logs[0];

      expect(log).toHaveProperty('id');
      expect(log).toHaveProperty('timestamp');
      expect(log).toHaveProperty('model');
      expect(log).toHaveProperty('prompt_tokens');
      expect(log).toHaveProperty('completion_tokens');
      expect(log).toHaveProperty('total_tokens');
      expect(log).toHaveProperty('cost');
      expect(log).toHaveProperty('request_path');
      expect(log).toHaveProperty('status_code');
      expect(log).toHaveProperty('api_key_hash');
      expect(log).toHaveProperty('created_at');
    });
  });

  describe('getFilteredLogs', () => {
    beforeEach(() => {
      // Insert test data with different models and timestamps
      insertTestLog(db, createMockUsageLog({
        timestamp: '2024-01-15T10:00:00Z',
        model: 'anthropic/claude-3-opus',
      }));
      insertTestLog(db, createMockUsageLog({
        timestamp: '2024-06-15T10:00:00Z',
        model: 'openai/gpt-4',
      }));
      insertTestLog(db, createMockUsageLog({
        timestamp: '2024-12-15T10:00:00Z',
        model: 'anthropic/claude-3-opus',
      }));
    });

    it('should return all logs when no filters provided', () => {
      const logs = getFilteredLogs(db, {});

      expect(logs).toHaveLength(3);
    });

    it('should filter by model', () => {
      const logs = getFilteredLogs(db, { model: 'anthropic/claude-3-opus' });

      expect(logs).toHaveLength(2);
      logs.forEach(log => {
        expect(log.model).toBe('anthropic/claude-3-opus');
      });
    });

    it('should filter by date range (from)', () => {
      const logs = getFilteredLogs(db, { from: '2024-06-01T00:00:00Z' });

      expect(logs).toHaveLength(2);
      logs.forEach(log => {
        expect(new Date(log.timestamp).getTime()).toBeGreaterThanOrEqual(
          new Date('2024-06-01T00:00:00Z').getTime()
        );
      });
    });

    it('should filter by date range (to)', () => {
      const logs = getFilteredLogs(db, { to: '2024-06-30T23:59:59Z' });

      expect(logs).toHaveLength(2);
      logs.forEach(log => {
        expect(new Date(log.timestamp).getTime()).toBeLessThanOrEqual(
          new Date('2024-06-30T23:59:59Z').getTime()
        );
      });
    });

    it('should filter by combined filters (model + date range)', () => {
      const logs = getFilteredLogs(db, {
        model: 'anthropic/claude-3-opus',
        from: '2024-06-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
      });

      expect(logs).toHaveLength(1);
      expect(logs[0].model).toBe('anthropic/claude-3-opus');
      expect(logs[0].timestamp).toBe('2024-12-15T10:00:00Z');
    });

    it('should return empty array when no matches', () => {
      const logs = getFilteredLogs(db, { model: 'nonexistent/model' });

      expect(logs).toEqual([]);
    });

    it('should return logs ordered by timestamp DESC', () => {
      const logs = getFilteredLogs(db, { model: 'anthropic/claude-3-opus' });

      expect(logs[0].timestamp).toBe('2024-12-15T10:00:00Z');
      expect(logs[1].timestamp).toBe('2024-01-15T10:00:00Z');
    });
  });

  describe('getStats', () => {
    it('should return zero stats when no logs exist', () => {
      const stats = getStats(db);

      expect(stats.request_count).toBe(0);
      expect(stats.total_tokens).toBe(0);
      expect(stats.total_cost).toBe(0);
    });

    it('should aggregate total tokens correctly', () => {
      insertTestLog(db, createMockUsageLog({ total_tokens: 100 }));
      insertTestLog(db, createMockUsageLog({ total_tokens: 200 }));
      insertTestLog(db, createMockUsageLog({ total_tokens: 300 }));

      const stats = getStats(db);

      expect(stats.total_tokens).toBe(600);
    });

    it('should aggregate total cost correctly', () => {
      insertTestLog(db, createMockUsageLog({ cost: 0.001 }));
      insertTestLog(db, createMockUsageLog({ cost: 0.002 }));
      insertTestLog(db, createMockUsageLog({ cost: 0.003 }));

      const stats = getStats(db);

      expect(stats.total_cost).toBeCloseTo(0.006, 6);
    });

    it('should count requests correctly', () => {
      insertTestLog(db, createMockUsageLog());
      insertTestLog(db, createMockUsageLog());
      insertTestLog(db, createMockUsageLog());
      insertTestLog(db, createMockUsageLog());
      insertTestLog(db, createMockUsageLog());

      const stats = getStats(db);

      expect(stats.request_count).toBe(5);
    });

    it('should handle null token values (treat as 0)', () => {
      insertTestLog(db, createMockUsageLog({ total_tokens: 100 }));
      insertTestLog(db, createMockUsageLog({ total_tokens: null }));
      insertTestLog(db, createMockUsageLog({ total_tokens: 200 }));

      const stats = getStats(db);

      expect(stats.total_tokens).toBe(300);
    });

    it('should handle null cost values (treat as 0)', () => {
      insertTestLog(db, createMockUsageLog({ cost: 0.001 }));
      insertTestLog(db, createMockUsageLog({ cost: null }));
      insertTestLog(db, createMockUsageLog({ cost: 0.002 }));

      const stats = getStats(db);

      expect(stats.total_cost).toBeCloseTo(0.003, 6);
    });
  });

  describe('getFilteredStats', () => {
    beforeEach(() => {
      insertTestLog(db, createMockUsageLog({
        timestamp: '2024-01-15T10:00:00Z',
        model: 'anthropic/claude-3-opus',
        total_tokens: 100,
        cost: 0.001,
      }));
      insertTestLog(db, createMockUsageLog({
        timestamp: '2024-06-15T10:00:00Z',
        model: 'openai/gpt-4',
        total_tokens: 200,
        cost: 0.002,
      }));
      insertTestLog(db, createMockUsageLog({
        timestamp: '2024-12-15T10:00:00Z',
        model: 'anthropic/claude-3-opus',
        total_tokens: 300,
        cost: 0.003,
      }));
    });

    it('should return all stats when no filters provided', () => {
      const stats = getFilteredStats(db, {});

      expect(stats.request_count).toBe(3);
      expect(stats.total_tokens).toBe(600);
      expect(stats.total_cost).toBeCloseTo(0.006, 6);
    });

    it('should filter stats by model', () => {
      const stats = getFilteredStats(db, { model: 'anthropic/claude-3-opus' });

      expect(stats.request_count).toBe(2);
      expect(stats.total_tokens).toBe(400);
      expect(stats.total_cost).toBeCloseTo(0.004, 6);
    });

    it('should filter stats by date range', () => {
      const stats = getFilteredStats(db, {
        from: '2024-06-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
      });

      expect(stats.request_count).toBe(2);
      expect(stats.total_tokens).toBe(500);
      expect(stats.total_cost).toBeCloseTo(0.005, 6);
    });

    it('should apply combined filters', () => {
      const stats = getFilteredStats(db, {
        model: 'anthropic/claude-3-opus',
        from: '2024-06-01T00:00:00Z',
      });

      expect(stats.request_count).toBe(1);
      expect(stats.total_tokens).toBe(300);
      expect(stats.total_cost).toBeCloseTo(0.003, 6);
    });

    it('should return zero stats when no matches', () => {
      const stats = getFilteredStats(db, { model: 'nonexistent/model' });

      expect(stats.request_count).toBe(0);
      expect(stats.total_tokens).toBe(0);
      expect(stats.total_cost).toBe(0);
    });
  });

  describe('getModels', () => {
    it('should return empty array when no logs exist', () => {
      const models = getModels(db);

      expect(models).toEqual([]);
    });

    it('should return distinct model names', () => {
      insertTestLog(db, createMockUsageLog({ model: 'anthropic/claude-3-opus' }));
      insertTestLog(db, createMockUsageLog({ model: 'openai/gpt-4' }));
      insertTestLog(db, createMockUsageLog({ model: 'anthropic/claude-3-opus' })); // duplicate

      const models = getModels(db);

      expect(models).toHaveLength(2);
      expect(models).toContain('anthropic/claude-3-opus');
      expect(models).toContain('openai/gpt-4');
    });

    it('should return models sorted alphabetically', () => {
      insertTestLog(db, createMockUsageLog({ model: 'openai/gpt-4' }));
      insertTestLog(db, createMockUsageLog({ model: 'anthropic/claude-3-opus' }));
      insertTestLog(db, createMockUsageLog({ model: 'google/gemini-pro' }));

      const models = getModels(db);

      expect(models).toEqual([
        'anthropic/claude-3-opus',
        'google/gemini-pro',
        'openai/gpt-4',
      ]);
    });
  });

  describe('getModelStats', () => {
    beforeEach(() => {
      insertTestLog(db, createMockUsageLog({
        timestamp: '2024-01-15T10:00:00Z',
        model: 'anthropic/claude-3-opus',
        total_tokens: 100,
        cost: 0.003,
      }));
      insertTestLog(db, createMockUsageLog({
        timestamp: '2024-06-15T10:00:00Z',
        model: 'openai/gpt-4',
        total_tokens: 200,
        cost: 0.002,
      }));
      insertTestLog(db, createMockUsageLog({
        timestamp: '2024-12-15T10:00:00Z',
        model: 'anthropic/claude-3-opus',
        total_tokens: 300,
        cost: 0.004,
      }));
    });

    it('should return empty array when no logs exist', () => {
      const emptyDb = createTestDb();
      const stats = getModelStats(emptyDb);
      cleanupTestDb(emptyDb);

      expect(stats).toEqual([]);
    });

    it('should group statistics by model', () => {
      const stats = getModelStats(db);

      expect(stats).toHaveLength(2);
    });

    it('should aggregate stats per model correctly', () => {
      const stats = getModelStats(db);

      const claudeStats = stats.find(s => s.model === 'anthropic/claude-3-opus');
      expect(claudeStats).toBeDefined();
      expect(claudeStats!.request_count).toBe(2);
      expect(claudeStats!.total_tokens).toBe(400);
      expect(claudeStats!.total_cost).toBeCloseTo(0.007, 6);

      const gptStats = stats.find(s => s.model === 'openai/gpt-4');
      expect(gptStats).toBeDefined();
      expect(gptStats!.request_count).toBe(1);
      expect(gptStats!.total_tokens).toBe(200);
      expect(gptStats!.total_cost).toBeCloseTo(0.002, 6);
    });

    it('should order by total_cost DESC', () => {
      const stats = getModelStats(db);

      // Claude has higher total cost (0.007) than GPT (0.002)
      expect(stats[0].model).toBe('anthropic/claude-3-opus');
      expect(stats[1].model).toBe('openai/gpt-4');
    });

    it('should filter by date range', () => {
      const stats = getModelStats(db, {
        from: '2024-06-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
      });

      expect(stats).toHaveLength(2);

      const claudeStats = stats.find(s => s.model === 'anthropic/claude-3-opus');
      expect(claudeStats!.request_count).toBe(1);
      expect(claudeStats!.total_tokens).toBe(300);
    });
  });

  describe('getTimeSeries', () => {
    beforeEach(() => {
      // Insert logs on different days
      insertTestLog(db, createMockUsageLog({
        timestamp: '2024-06-01T10:00:00Z',
        model: 'anthropic/claude-3-opus',
        total_tokens: 100,
        cost: 0.001,
      }));
      insertTestLog(db, createMockUsageLog({
        timestamp: '2024-06-01T14:00:00Z',
        model: 'openai/gpt-4',
        total_tokens: 200,
        cost: 0.002,
      }));
      insertTestLog(db, createMockUsageLog({
        timestamp: '2024-06-02T10:00:00Z',
        model: 'anthropic/claude-3-opus',
        total_tokens: 150,
        cost: 0.0015,
      }));
    });

    it('should return empty array when no logs exist', () => {
      const emptyDb = createTestDb();
      const timeSeries = getTimeSeries(emptyDb);
      cleanupTestDb(emptyDb);

      expect(timeSeries).toEqual([]);
    });

    it('should aggregate by day by default', () => {
      const timeSeries = getTimeSeries(db);

      // Should have data points for each day/model combination
      expect(timeSeries.length).toBeGreaterThan(0);

      // Check that periods are in day format
      timeSeries.forEach(point => {
        expect(point.period).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    it('should aggregate by hour when specified', () => {
      const timeSeries = getTimeSeries(db, { aggregation: 'hour' });

      expect(timeSeries.length).toBeGreaterThan(0);

      // Check that periods are in hour format
      timeSeries.forEach(point => {
        expect(point.period).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00$/);
      });
    });

    it('should aggregate by week when specified', () => {
      const timeSeries = getTimeSeries(db, { aggregation: 'week' });

      expect(timeSeries.length).toBeGreaterThan(0);

      // Check that periods are in week format (YYYY-WW)
      timeSeries.forEach(point => {
        expect(point.period).toMatch(/^\d{4}-\d{2}$/);
      });
    });

    it('should include model in each data point', () => {
      const timeSeries = getTimeSeries(db);

      timeSeries.forEach(point => {
        expect(point.model).toBeDefined();
        expect(typeof point.model).toBe('string');
      });
    });

    it('should include aggregated stats in each data point', () => {
      const timeSeries = getTimeSeries(db);

      timeSeries.forEach(point => {
        expect(point.request_count).toBeDefined();
        expect(point.total_tokens).toBeDefined();
        expect(point.total_cost).toBeDefined();
        expect(typeof point.request_count).toBe('number');
        expect(typeof point.total_tokens).toBe('number');
        expect(typeof point.total_cost).toBe('number');
      });
    });

    it('should filter by date range', () => {
      const timeSeries = getTimeSeries(db, {
        from: '2024-06-02T00:00:00Z',
        to: '2024-06-02T23:59:59Z',
      });

      // Should only include data from June 2nd
      expect(timeSeries).toHaveLength(1);
      expect(timeSeries[0].model).toBe('anthropic/claude-3-opus');
    });

    it('should order by period ASC', () => {
      const timeSeries = getTimeSeries(db);

      for (let i = 1; i < timeSeries.length; i++) {
        const prevPeriod = timeSeries[i - 1].period;
        const currPeriod = timeSeries[i].period;
        // Same period with different model, or later period
        expect(prevPeriod <= currPeriod).toBe(true);
      }
    });

    it('should order by model ASC within same period', () => {
      const timeSeries = getTimeSeries(db);

      // Find data points with same period
      const june1Points = timeSeries.filter(p => p.period === '2024-06-01');
      if (june1Points.length > 1) {
        for (let i = 1; i < june1Points.length; i++) {
          expect(june1Points[i - 1].model <= june1Points[i].model).toBe(true);
        }
      }
    });
  });

  describe('Database Isolation', () => {
    it('should have isolated data between test databases', () => {
      // Insert in first db
      insertTestLog(db, createMockUsageLog({ model: 'first-db-model' }));

      // Create second db
      const db2 = createTestDb();
      insertTestLog(db2, createMockUsageLog({ model: 'second-db-model' }));

      // Verify isolation
      const logsDb1 = getLogs(db);
      const logsDb2 = getLogs(db2);

      expect(logsDb1).toHaveLength(1);
      expect(logsDb1[0].model).toBe('first-db-model');

      expect(logsDb2).toHaveLength(1);
      expect(logsDb2[0].model).toBe('second-db-model');

      cleanupTestDb(db2);
    });
  });
});
