/**
 * Tests for database schema query builders
 * Verifies SQL generation for filtering and aggregation queries
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
// Import directly from .ts file to ensure we get the latest version
// This avoids any ESM resolution caching issues with .js extensions
import {
  buildFilteredLogsQuery,
  buildFilteredStatsQuery,
  buildFilteredModelStatsQuery,
  buildTimeSeriesQuery,
  buildApiKeyStatsQuery,
  buildApiKeyTimeSeriesQuery,
  buildUnifiedStatsQuery,
  AGGREGATION_FORMATS,
  initializeSchema,
  CREATE_USAGE_LOGS_TABLE,
  CREATE_TIMESTAMP_INDEX,
  CREATE_MODEL_INDEX,
} from '../schema.ts';

// Note: migrateApiKeyHash and CREATE_API_KEY_HASH_INDEX are tested via
// the createTestDb function in test-utils which creates the full schema

describe('Query Builders', () => {
  describe('buildFilteredLogsQuery', () => {
    it('should build a simple SELECT query when no filters provided', () => {
      const { sql, params } = buildFilteredLogsQuery({});

      expect(sql).toContain('SELECT * FROM usage_logs');
      expect(sql).toContain('ORDER BY timestamp DESC');
      expect(sql).not.toContain('WHERE');
      expect(params).toHaveLength(0);
    });

    it('should add model filter when model is provided', () => {
      const { sql, params } = buildFilteredLogsQuery({ model: 'anthropic/claude-3-opus' });

      expect(sql).toContain('WHERE');
      expect(sql).toContain('model = ?');
      expect(params).toEqual(['anthropic/claude-3-opus']);
    });

    it('should add from date filter when from is provided', () => {
      const fromDate = '2024-01-01T00:00:00Z';
      const { sql, params } = buildFilteredLogsQuery({ from: fromDate });

      expect(sql).toContain('WHERE');
      expect(sql).toContain('timestamp >= ?');
      expect(params).toEqual([fromDate]);
    });

    it('should add to date filter when to is provided', () => {
      const toDate = '2024-12-31T23:59:59Z';
      const { sql, params } = buildFilteredLogsQuery({ to: toDate });

      expect(sql).toContain('WHERE');
      expect(sql).toContain('timestamp <= ?');
      expect(params).toEqual([toDate]);
    });

    it('should combine all filters with AND when all provided', () => {
      const filters = {
        model: 'openai/gpt-4',
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
      };
      const { sql, params } = buildFilteredLogsQuery(filters);

      expect(sql).toContain('WHERE');
      expect(sql).toContain('model = ?');
      expect(sql).toContain('timestamp >= ?');
      expect(sql).toContain('timestamp <= ?');
      expect(sql).toContain(' AND ');
      expect(params).toEqual([filters.model, filters.from, filters.to]);
    });

    it('should handle model filter with special characters', () => {
      const modelWithSlash = 'anthropic/claude-3.5-sonnet';
      const { sql, params } = buildFilteredLogsQuery({ model: modelWithSlash });

      expect(params).toEqual([modelWithSlash]);
    });

    it('should always include ORDER BY timestamp DESC', () => {
      const queries = [
        buildFilteredLogsQuery({}),
        buildFilteredLogsQuery({ model: 'test' }),
        buildFilteredLogsQuery({ from: '2024-01-01' }),
        buildFilteredLogsQuery({ model: 'test', from: '2024-01-01', to: '2024-12-31' }),
      ];

      queries.forEach(({ sql }) => {
        expect(sql).toContain('ORDER BY timestamp DESC');
      });
    });
  });

  describe('buildFilteredStatsQuery', () => {
    it('should build aggregation query without filters', () => {
      const { sql, params } = buildFilteredStatsQuery({});

      expect(sql).toContain('SELECT');
      expect(sql).toContain('COUNT(*) as request_count');
      expect(sql).toContain('SUM(total_tokens)');
      expect(sql).toContain('SUM(cost)');
      expect(sql).toContain('COALESCE');
      expect(sql).not.toContain('WHERE');
      expect(params).toHaveLength(0);
    });

    it('should add model filter for stats query', () => {
      const { sql, params } = buildFilteredStatsQuery({ model: 'test-model' });

      expect(sql).toContain('WHERE');
      expect(sql).toContain('model = ?');
      expect(params).toEqual(['test-model']);
    });

    it('should add date range filters for stats query', () => {
      const filters = {
        from: '2024-01-01T00:00:00Z',
        to: '2024-06-30T23:59:59Z',
      };
      const { sql, params } = buildFilteredStatsQuery(filters);

      expect(sql).toContain('WHERE');
      expect(sql).toContain('timestamp >= ?');
      expect(sql).toContain('timestamp <= ?');
      expect(params).toEqual([filters.from, filters.to]);
    });

    it('should combine all filters for stats query', () => {
      const filters = {
        model: 'openai/gpt-4-turbo',
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
      };
      const { sql, params } = buildFilteredStatsQuery(filters);

      expect(sql).toContain(' AND ');
      expect(params).toHaveLength(3);
    });

    it('should use COALESCE to handle null values', () => {
      const { sql } = buildFilteredStatsQuery({});

      expect(sql).toContain('COALESCE(SUM(total_tokens), 0)');
      expect(sql).toContain('COALESCE(SUM(cost), 0)');
    });
  });

  describe('buildFilteredModelStatsQuery', () => {
    it('should build model stats query without filters', () => {
      const { sql, params } = buildFilteredModelStatsQuery({});

      expect(sql).toContain('SELECT');
      expect(sql).toContain('model');
      expect(sql).toContain('COUNT(*) as request_count');
      expect(sql).toContain('GROUP BY model');
      expect(sql).toContain('ORDER BY total_cost DESC');
      expect(sql).not.toContain('WHERE');
      expect(params).toHaveLength(0);
    });

    it('should add from date filter for model stats', () => {
      const fromDate = '2024-01-01T00:00:00Z';
      const { sql, params } = buildFilteredModelStatsQuery({ from: fromDate });

      expect(sql).toContain('WHERE');
      expect(sql).toContain('timestamp >= ?');
      expect(params).toEqual([fromDate]);
    });

    it('should add to date filter for model stats', () => {
      const toDate = '2024-12-31T23:59:59Z';
      const { sql, params } = buildFilteredModelStatsQuery({ to: toDate });

      expect(sql).toContain('WHERE');
      expect(sql).toContain('timestamp <= ?');
      expect(params).toEqual([toDate]);
    });

    it('should combine from and to filters with AND', () => {
      const filters = {
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
      };
      const { sql, params } = buildFilteredModelStatsQuery(filters);

      expect(sql).toContain(' AND ');
      expect(params).toEqual([filters.from, filters.to]);
    });

    it('should always include GROUP BY model', () => {
      const queries = [
        buildFilteredModelStatsQuery({}),
        buildFilteredModelStatsQuery({ from: '2024-01-01' }),
        buildFilteredModelStatsQuery({ to: '2024-12-31' }),
      ];

      queries.forEach(({ sql }) => {
        expect(sql).toContain('GROUP BY model');
      });
    });
  });

  describe('buildTimeSeriesQuery', () => {
    it('should build time series query with default day aggregation', () => {
      const { sql, params } = buildTimeSeriesQuery({});

      expect(sql).toContain('strftime');
      expect(sql).toContain(AGGREGATION_FORMATS.day);
      expect(sql).toContain('as period');
      expect(sql).toContain('model');
      expect(sql).toContain('GROUP BY period, model');
      expect(sql).toContain('ORDER BY period ASC, model ASC');
      expect(params).toHaveLength(0);
    });

    it('should use hour aggregation format when specified', () => {
      const { sql } = buildTimeSeriesQuery({ aggregation: 'hour' });

      expect(sql).toContain(AGGREGATION_FORMATS.hour);
    });

    it('should use day aggregation format when specified', () => {
      const { sql } = buildTimeSeriesQuery({ aggregation: 'day' });

      expect(sql).toContain(AGGREGATION_FORMATS.day);
    });

    it('should use week aggregation format when specified', () => {
      const { sql } = buildTimeSeriesQuery({ aggregation: 'week' });

      expect(sql).toContain(AGGREGATION_FORMATS.week);
    });

    it('should add date range filters', () => {
      const filters = {
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
        aggregation: 'day' as const,
      };
      const { sql, params } = buildTimeSeriesQuery(filters);

      expect(sql).toContain('WHERE');
      expect(sql).toContain('timestamp >= ?');
      expect(sql).toContain('timestamp <= ?');
      expect(params).toEqual([filters.from, filters.to]);
    });

    it('should include all required aggregation columns', () => {
      const { sql } = buildTimeSeriesQuery({});

      expect(sql).toContain('request_count');
      expect(sql).toContain('total_tokens');
      expect(sql).toContain('total_cost');
    });

    it('should handle empty filters with default aggregation', () => {
      const { sql, params } = buildTimeSeriesQuery({});

      expect(sql).not.toContain('WHERE');
      expect(params).toHaveLength(0);
      expect(sql).toContain(AGGREGATION_FORMATS.day);
    });
  });

  describe('AGGREGATION_FORMATS', () => {
    it('should have hour format for hourly aggregation', () => {
      expect(AGGREGATION_FORMATS.hour).toBe('%Y-%m-%dT%H:00:00');
    });

    it('should have day format for daily aggregation', () => {
      expect(AGGREGATION_FORMATS.day).toBe('%Y-%m-%d');
    });

    it('should have week format for weekly aggregation', () => {
      expect(AGGREGATION_FORMATS.week).toBe('%Y-%W');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined values in filters', () => {
      const { sql, params } = buildFilteredLogsQuery({
        model: undefined,
        from: undefined,
        to: undefined,
      });

      expect(sql).not.toContain('WHERE');
      expect(params).toHaveLength(0);
    });

    it('should handle empty string model gracefully', () => {
      // Empty string is falsy, so should be treated as no filter
      const { sql, params } = buildFilteredLogsQuery({ model: '' });

      expect(sql).not.toContain('WHERE');
      expect(params).toHaveLength(0);
    });

    it('should preserve filter order in params array', () => {
      const filters = {
        model: 'model-a',
        from: 'date-from',
        to: 'date-to',
      };
      const { params } = buildFilteredLogsQuery(filters);

      // Order should be: model, from, to (based on the implementation)
      expect(params[0]).toBe('model-a');
      expect(params[1]).toBe('date-from');
      expect(params[2]).toBe('date-to');
    });
  });

  describe('buildApiKeyStatsQuery', () => {
    it('should build API key stats query without filters', () => {
      const { sql, params } = buildApiKeyStatsQuery({});

      expect(sql).toContain('SELECT');
      expect(sql).toContain("COALESCE(api_key_hash, 'unknown') as api_key_hash");
      expect(sql).toContain('COUNT(*) as request_count');
      expect(sql).toContain('COALESCE(SUM(total_tokens), 0)');
      expect(sql).toContain('COALESCE(SUM(cost), 0)');
      expect(sql).toContain('GROUP BY api_key_hash');
      expect(sql).toContain('ORDER BY total_cost DESC');
      expect(sql).not.toContain('WHERE');
      expect(params).toHaveLength(0);
    });

    it('should add from date filter for API key stats', () => {
      const fromDate = '2024-01-01T00:00:00Z';
      const { sql, params } = buildApiKeyStatsQuery({ from: fromDate });

      expect(sql).toContain('WHERE');
      expect(sql).toContain('timestamp >= ?');
      expect(params).toEqual([fromDate]);
    });

    it('should add to date filter for API key stats', () => {
      const toDate = '2024-12-31T23:59:59Z';
      const { sql, params } = buildApiKeyStatsQuery({ to: toDate });

      expect(sql).toContain('WHERE');
      expect(sql).toContain('timestamp <= ?');
      expect(params).toEqual([toDate]);
    });

    it('should combine from and to filters with AND', () => {
      const filters = {
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
      };
      const { sql, params } = buildApiKeyStatsQuery(filters);

      expect(sql).toContain(' AND ');
      expect(params).toEqual([filters.from, filters.to]);
    });

    it('should handle NULL api_key_hash with COALESCE to unknown', () => {
      const { sql } = buildApiKeyStatsQuery({});

      // The query should use COALESCE to convert NULL to 'unknown'
      expect(sql).toContain("COALESCE(api_key_hash, 'unknown')");
    });

    it('should always include GROUP BY api_key_hash', () => {
      const queries = [
        buildApiKeyStatsQuery({}),
        buildApiKeyStatsQuery({ from: '2024-01-01' }),
        buildApiKeyStatsQuery({ to: '2024-12-31' }),
      ];

      queries.forEach(({ sql }) => {
        expect(sql).toContain('GROUP BY api_key_hash');
      });
    });

    it('should add apiKeyHash filter when provided', () => {
      const { sql, params } = buildApiKeyStatsQuery({ apiKeyHash: 'hash_abc123' });

      expect(sql).toContain('WHERE');
      expect(sql).toContain('api_key_hash = ?');
      expect(params).toEqual(['hash_abc123']);
    });

    it('should combine apiKeyHash with date range filters', () => {
      const filters = {
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
        apiKeyHash: 'hash_abc123',
      };
      const { sql, params } = buildApiKeyStatsQuery(filters);

      expect(sql).toContain('WHERE');
      expect(sql).toContain('timestamp >= ?');
      expect(sql).toContain('timestamp <= ?');
      expect(sql).toContain('api_key_hash = ?');
      expect(sql).toContain(' AND ');
      expect(params).toEqual([filters.from, filters.to, filters.apiKeyHash]);
    });
  });

  describe('buildApiKeyTimeSeriesQuery', () => {
    it('should build API key time-series query with default day aggregation', () => {
      const { sql, params } = buildApiKeyTimeSeriesQuery({});

      expect(sql).toContain('strftime');
      expect(sql).toContain(AGGREGATION_FORMATS.day);
      expect(sql).toContain('as period');
      expect(sql).toContain("COALESCE(api_key_hash, 'unknown') as api_key_hash");
      expect(sql).toContain('GROUP BY period, api_key_hash');
      expect(sql).toContain('ORDER BY period ASC, api_key_hash ASC');
      expect(params).toHaveLength(0);
    });

    it('should use hour aggregation format when specified', () => {
      const { sql } = buildApiKeyTimeSeriesQuery({ aggregation: 'hour' });

      expect(sql).toContain(AGGREGATION_FORMATS.hour);
    });

    it('should use day aggregation format when specified', () => {
      const { sql } = buildApiKeyTimeSeriesQuery({ aggregation: 'day' });

      expect(sql).toContain(AGGREGATION_FORMATS.day);
    });

    it('should use week aggregation format when specified', () => {
      const { sql } = buildApiKeyTimeSeriesQuery({ aggregation: 'week' });

      expect(sql).toContain(AGGREGATION_FORMATS.week);
    });

    it('should add date range filters', () => {
      const filters = {
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
        aggregation: 'day' as const,
      };
      const { sql, params } = buildApiKeyTimeSeriesQuery(filters);

      expect(sql).toContain('WHERE');
      expect(sql).toContain('timestamp >= ?');
      expect(sql).toContain('timestamp <= ?');
      expect(params).toEqual([filters.from, filters.to]);
    });

    it('should include all required aggregation columns', () => {
      const { sql } = buildApiKeyTimeSeriesQuery({});

      expect(sql).toContain('request_count');
      expect(sql).toContain('total_tokens');
      expect(sql).toContain('total_cost');
    });

    it('should handle empty filters with default aggregation', () => {
      const { sql, params } = buildApiKeyTimeSeriesQuery({});

      expect(sql).not.toContain('WHERE');
      expect(params).toHaveLength(0);
      expect(sql).toContain(AGGREGATION_FORMATS.day);
    });

    it('should handle NULL api_key_hash with COALESCE to unknown', () => {
      const { sql } = buildApiKeyTimeSeriesQuery({});

      // The query should use COALESCE to convert NULL to 'unknown'
      expect(sql).toContain("COALESCE(api_key_hash, 'unknown')");
    });

    it('should add apiKeyHash filter when provided', () => {
      const { sql, params } = buildApiKeyTimeSeriesQuery({ apiKeyHash: 'hash_abc123' });

      expect(sql).toContain('WHERE');
      expect(sql).toContain('api_key_hash = ?');
      expect(params).toEqual(['hash_abc123']);
    });

    it('should combine apiKeyHash with date range and aggregation filters', () => {
      const filters = {
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
        aggregation: 'week' as const,
        apiKeyHash: 'hash_abc123',
      };
      const { sql, params } = buildApiKeyTimeSeriesQuery(filters);

      expect(sql).toContain('WHERE');
      expect(sql).toContain('timestamp >= ?');
      expect(sql).toContain('timestamp <= ?');
      expect(sql).toContain('api_key_hash = ?');
      expect(sql).toContain(' AND ');
      expect(sql).toContain(AGGREGATION_FORMATS.week);
      expect(params).toEqual([filters.from, filters.to, filters.apiKeyHash]);
    });
  });

  describe('apiKeyHash filter in existing query builders', () => {
    it('buildFilteredLogsQuery should support apiKeyHash filter', () => {
      const { sql, params } = buildFilteredLogsQuery({ apiKeyHash: 'hash_abc123' });

      expect(sql).toContain('WHERE');
      expect(sql).toContain('api_key_hash = ?');
      expect(params).toEqual(['hash_abc123']);
    });

    it('buildFilteredLogsQuery should combine apiKeyHash with other filters', () => {
      const filters = {
        model: 'openai/gpt-4',
        from: '2024-01-01T00:00:00Z',
        apiKeyHash: 'hash_abc123',
      };
      const { sql, params } = buildFilteredLogsQuery(filters);

      expect(sql).toContain('model = ?');
      expect(sql).toContain('timestamp >= ?');
      expect(sql).toContain('api_key_hash = ?');
      expect(params).toEqual([filters.model, filters.from, filters.apiKeyHash]);
    });

    it('buildFilteredStatsQuery should support apiKeyHash filter', () => {
      const { sql, params } = buildFilteredStatsQuery({ apiKeyHash: 'hash_abc123' });

      expect(sql).toContain('WHERE');
      expect(sql).toContain('api_key_hash = ?');
      expect(params).toEqual(['hash_abc123']);
    });

    it('buildFilteredModelStatsQuery should support apiKeyHash filter', () => {
      const { sql, params } = buildFilteredModelStatsQuery({ apiKeyHash: 'hash_abc123' });

      expect(sql).toContain('WHERE');
      expect(sql).toContain('api_key_hash = ?');
      expect(params).toEqual(['hash_abc123']);
    });

    it('buildTimeSeriesQuery should support apiKeyHash filter', () => {
      const { sql, params } = buildTimeSeriesQuery({ apiKeyHash: 'hash_abc123' });

      expect(sql).toContain('WHERE');
      expect(sql).toContain('api_key_hash = ?');
      expect(params).toEqual(['hash_abc123']);
    });
  });

  describe('buildUnifiedStatsQuery', () => {
    it('should build query with CTE structure when no filters provided', () => {
      const { sql, params } = buildUnifiedStatsQuery({});

      // Verify CTE structure
      expect(sql).toContain('WITH filtered_logs AS');
      expect(sql).toContain('SELECT * FROM usage_logs');
      expect(sql).not.toContain('WHERE');
      expect(params).toHaveLength(0);
    });

    it('should include all 5 aggregation CTEs', () => {
      const { sql } = buildUnifiedStatsQuery({});

      // Verify all CTEs are present
      expect(sql).toContain('overall_stats AS');
      expect(sql).toContain('model_stats AS');
      expect(sql).toContain('time_series AS');
      expect(sql).toContain('api_key_stats AS');
      expect(sql).toContain('api_key_time_series AS');
    });

    it('should include JSON output for all statistics', () => {
      const { sql } = buildUnifiedStatsQuery({});

      // Verify JSON functions are used
      expect(sql).toContain('json_object');
      expect(sql).toContain('json_group_array');
      expect(sql).toContain('as stats');
      expect(sql).toContain('as modelStats');
      expect(sql).toContain('as timeSeries');
      expect(sql).toContain('as apiKeyStats');
      expect(sql).toContain('as apiKeyTimeSeries');
    });

    it('should add model filter when model is provided', () => {
      const { sql, params } = buildUnifiedStatsQuery({ model: 'anthropic/claude-3-opus' });

      expect(sql).toContain('WHERE');
      expect(sql).toContain('model = ?');
      expect(params).toEqual(['anthropic/claude-3-opus']);
    });

    it('should add from date filter when from is provided', () => {
      const fromDate = '2024-01-01T00:00:00Z';
      const { sql, params } = buildUnifiedStatsQuery({ from: fromDate });

      expect(sql).toContain('WHERE');
      expect(sql).toContain('timestamp >= ?');
      expect(params).toEqual([fromDate]);
    });

    it('should add to date filter when to is provided', () => {
      const toDate = '2024-12-31T23:59:59Z';
      const { sql, params } = buildUnifiedStatsQuery({ to: toDate });

      expect(sql).toContain('WHERE');
      expect(sql).toContain('timestamp <= ?');
      expect(params).toEqual([toDate]);
    });

    it('should add apiKeyHash filter when provided', () => {
      const { sql, params } = buildUnifiedStatsQuery({ apiKeyHash: 'hash_abc123' });

      expect(sql).toContain('WHERE');
      expect(sql).toContain('api_key_hash = ?');
      expect(params).toEqual(['hash_abc123']);
    });

    it('should combine all filters with AND when all provided', () => {
      const filters = {
        model: 'openai/gpt-4',
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
        apiKeyHash: 'hash_abc123',
      };
      const { sql, params } = buildUnifiedStatsQuery(filters);

      expect(sql).toContain('WHERE');
      expect(sql).toContain('model = ?');
      expect(sql).toContain('timestamp >= ?');
      expect(sql).toContain('timestamp <= ?');
      expect(sql).toContain('api_key_hash = ?');
      expect(sql).toContain(' AND ');
      expect(params).toEqual([filters.model, filters.from, filters.to, filters.apiKeyHash]);
    });

    it('should use default day aggregation for time series', () => {
      const { sql } = buildUnifiedStatsQuery({});

      // time_series CTE should use day format
      expect(sql).toContain(AGGREGATION_FORMATS.day);
    });

    it('should use specified aggregation for model time series', () => {
      const { sql } = buildUnifiedStatsQuery({ aggregation: 'hour' });

      expect(sql).toContain(AGGREGATION_FORMATS.hour);
    });

    it('should use specified aggregation for API key time series', () => {
      const { sql } = buildUnifiedStatsQuery({ apiKeyAggregation: 'week' });

      // api_key_time_series CTE should use week format
      expect(sql).toContain(AGGREGATION_FORMATS.week);
    });

    it('should support different aggregations for model and API key time series', () => {
      const { sql } = buildUnifiedStatsQuery({
        aggregation: 'hour',
        apiKeyAggregation: 'week',
      });

      // Both formats should be present
      expect(sql).toContain(AGGREGATION_FORMATS.hour);
      expect(sql).toContain(AGGREGATION_FORMATS.week);
    });

    it('should include COALESCE for null handling in all aggregations', () => {
      const { sql } = buildUnifiedStatsQuery({});

      // Overall stats
      expect(sql).toContain('COALESCE(SUM(total_tokens), 0)');
      expect(sql).toContain('COALESCE(SUM(cost), 0)');

      // API key stats should handle null api_key_hash
      expect(sql).toContain("COALESCE(api_key_hash, 'unknown')");
    });

    it('should include proper GROUP BY clauses for each aggregation', () => {
      const { sql } = buildUnifiedStatsQuery({});

      expect(sql).toContain('GROUP BY model');
      expect(sql).toContain('GROUP BY period, model');
      expect(sql).toContain('GROUP BY api_key_hash');
      expect(sql).toContain('GROUP BY period, api_key_hash');
    });

    it('should include proper ORDER BY clauses for each aggregation', () => {
      const { sql } = buildUnifiedStatsQuery({});

      // Model stats ordered by cost DESC
      expect(sql).toContain('ORDER BY total_cost DESC');

      // Time series ordered by period ASC
      expect(sql).toContain('ORDER BY period ASC');
    });

    it('should place WHERE clause in filtered_logs CTE only', () => {
      const { sql } = buildUnifiedStatsQuery({ model: 'test-model' });

      // The WHERE should only appear once, in the filtered_logs CTE
      const whereMatches = sql.match(/WHERE/g);
      expect(whereMatches).toHaveLength(1);

      // All other CTEs should query FROM filtered_logs
      expect(sql).toContain('FROM filtered_logs');
    });

    it('should handle empty string filters gracefully', () => {
      const { sql, params } = buildUnifiedStatsQuery({
        model: '',
        from: '',
        to: '',
        apiKeyHash: '',
      });

      // Empty strings are falsy, so should be treated as no filter
      expect(sql).not.toMatch(/WHERE\s+model/);
      expect(params).toHaveLength(0);
    });

    it('should preserve filter order in params array', () => {
      const filters = {
        model: 'model-a',
        from: 'date-from',
        to: 'date-to',
        apiKeyHash: 'hash-123',
      };
      const { params } = buildUnifiedStatsQuery(filters);

      // Order should be: model, from, to, apiKeyHash (based on buildFilterConditions implementation)
      expect(params[0]).toBe('model-a');
      expect(params[1]).toBe('date-from');
      expect(params[2]).toBe('date-to');
      expect(params[3]).toBe('hash-123');
    });
  });
});

describe('Schema Initialization', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
  });

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
  });

  describe('initializeSchema', () => {
    it('should create the usage_logs table', () => {
      initializeSchema(db);

      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='usage_logs'")
        .all() as Array<{ name: string }>;

      expect(tables).toHaveLength(1);
      expect(tables[0].name).toBe('usage_logs');
    });

    it('should create timestamp and model indexes', () => {
      initializeSchema(db);

      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='usage_logs'")
        .all() as Array<{ name: string }>;

      const indexNames = indexes.map((idx) => idx.name);

      expect(indexNames).toContain('idx_usage_logs_timestamp');
      expect(indexNames).toContain('idx_usage_logs_model');
    });

    it('should create table with core columns', () => {
      initializeSchema(db);

      const columns = db
        .prepare("SELECT name FROM pragma_table_info('usage_logs')")
        .all() as Array<{ name: string }>;

      const columnNames = columns.map((col) => col.name);

      // Core columns that must exist
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('timestamp');
      expect(columnNames).toContain('model');
      expect(columnNames).toContain('prompt_tokens');
      expect(columnNames).toContain('completion_tokens');
      expect(columnNames).toContain('total_tokens');
      expect(columnNames).toContain('cost');
      expect(columnNames).toContain('request_path');
      expect(columnNames).toContain('status_code');
      expect(columnNames).toContain('created_at');
    });

    it('should be idempotent (can run multiple times)', () => {
      // Run twice - should not throw
      initializeSchema(db);
      expect(() => initializeSchema(db)).not.toThrow();

      // Table should still exist
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='usage_logs'")
        .all();

      expect(tables).toHaveLength(1);
    });
  });

  describe('SQL Constants', () => {
    it('should have valid CREATE_USAGE_LOGS_TABLE SQL', () => {
      expect(CREATE_USAGE_LOGS_TABLE).toContain('CREATE TABLE IF NOT EXISTS usage_logs');
      expect(CREATE_USAGE_LOGS_TABLE).toContain('id INTEGER PRIMARY KEY AUTOINCREMENT');
      expect(CREATE_USAGE_LOGS_TABLE).toContain('timestamp TEXT NOT NULL');
      expect(CREATE_USAGE_LOGS_TABLE).toContain('model TEXT NOT NULL');
    });

    it('should have valid CREATE_TIMESTAMP_INDEX SQL', () => {
      expect(CREATE_TIMESTAMP_INDEX).toContain('CREATE INDEX IF NOT EXISTS');
      expect(CREATE_TIMESTAMP_INDEX).toContain('idx_usage_logs_timestamp');
      expect(CREATE_TIMESTAMP_INDEX).toContain('ON usage_logs (timestamp)');
    });

    it('should have valid CREATE_MODEL_INDEX SQL', () => {
      expect(CREATE_MODEL_INDEX).toContain('CREATE INDEX IF NOT EXISTS');
      expect(CREATE_MODEL_INDEX).toContain('idx_usage_logs_model');
      expect(CREATE_MODEL_INDEX).toContain('ON usage_logs (model)');
    });
  });
});
