/**
 * Tests for test utilities
 * Verifies that the test helper functions work correctly
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  createTestDb,
  cleanupTestDb,
  createMockUsageLog,
  createMockUsageLogs,
  insertTestLog,
  resetMockCounter,
} from './test-utils.js';

describe('Test Utilities', () => {
  describe('createTestDb', () => {
    let db: Database.Database;

    afterEach(() => {
      if (db && db.open) {
        db.close();
      }
    });

    it('should create an in-memory database', () => {
      db = createTestDb();
      expect(db).toBeDefined();
      expect(db.open).toBe(true);
    });

    it('should create the usage_logs table with correct schema', () => {
      db = createTestDb();

      // Query table info
      const tableInfo = db
        .prepare("SELECT name, type FROM pragma_table_info('usage_logs')")
        .all() as Array<{ name: string; type: string }>;

      const columnNames = tableInfo.map((col) => col.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('timestamp');
      expect(columnNames).toContain('model');
      expect(columnNames).toContain('prompt_tokens');
      expect(columnNames).toContain('completion_tokens');
      expect(columnNames).toContain('total_tokens');
      expect(columnNames).toContain('cost');
      expect(columnNames).toContain('request_path');
      expect(columnNames).toContain('status_code');
      expect(columnNames).toContain('api_key_hash');
      expect(columnNames).toContain('created_at');
    });

    it('should create indexes on timestamp, model, and api_key_hash', () => {
      db = createTestDb();

      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='usage_logs'")
        .all() as Array<{ name: string }>;

      const indexNames = indexes.map((idx) => idx.name);

      expect(indexNames).toContain('idx_usage_logs_timestamp');
      expect(indexNames).toContain('idx_usage_logs_model');
      expect(indexNames).toContain('idx_usage_logs_api_key_hash');
    });
  });

  describe('cleanupTestDb', () => {
    it('should close an open database connection', () => {
      const db = createTestDb();
      expect(db.open).toBe(true);

      cleanupTestDb(db);
      expect(db.open).toBe(false);
    });

    it('should handle already closed database gracefully', () => {
      const db = createTestDb();
      db.close();

      // Should not throw
      expect(() => cleanupTestDb(db)).not.toThrow();
    });
  });

  describe('createMockUsageLog', () => {
    beforeEach(() => {
      resetMockCounter();
    });

    it('should create a usage log with all required fields', () => {
      const log = createMockUsageLog();

      expect(log.timestamp).toBeDefined();
      expect(log.model).toBeDefined();
      expect(typeof log.timestamp).toBe('string');
      expect(typeof log.model).toBe('string');
    });

    it('should create a log with all optional fields populated', () => {
      const log = createMockUsageLog();

      expect(log.prompt_tokens).toBeDefined();
      expect(log.completion_tokens).toBeDefined();
      expect(log.total_tokens).toBeDefined();
      expect(log.cost).toBeDefined();
      expect(log.request_path).toBeDefined();
      expect(log.status_code).toBeDefined();
      expect(log.api_key_hash).toBeDefined();
    });

    it('should generate valid ISO 8601 timestamps', () => {
      const log = createMockUsageLog();

      // Should not throw when parsing
      const date = new Date(log.timestamp);
      expect(date.toString()).not.toBe('Invalid Date');
    });

    it('should allow overriding specific fields', () => {
      const customModel = 'custom/test-model';
      const customTokens = 999;

      const log = createMockUsageLog({
        model: customModel,
        prompt_tokens: customTokens,
      });

      expect(log.model).toBe(customModel);
      expect(log.prompt_tokens).toBe(customTokens);
      // Other fields should still have defaults
      expect(log.timestamp).toBeDefined();
      expect(log.completion_tokens).toBeDefined();
    });

    it('should generate different data on subsequent calls', () => {
      const log1 = createMockUsageLog();
      const log2 = createMockUsageLog();

      // api_key_hash should be unique due to counter
      expect(log1.api_key_hash).not.toBe(log2.api_key_hash);
    });
  });

  describe('createMockUsageLogs', () => {
    beforeEach(() => {
      resetMockCounter();
    });

    it('should create the specified number of logs', () => {
      const count = 5;
      const logs = createMockUsageLogs(count);

      expect(logs).toHaveLength(count);
    });

    it('should create valid usage logs', () => {
      const logs = createMockUsageLogs(3);

      logs.forEach((log) => {
        expect(log.timestamp).toBeDefined();
        expect(log.model).toBeDefined();
        expect(log.prompt_tokens).toBeDefined();
      });
    });

    it('should return empty array for count of 0', () => {
      const logs = createMockUsageLogs(0);
      expect(logs).toHaveLength(0);
    });
  });

  describe('insertTestLog', () => {
    let db: Database.Database;

    beforeEach(() => {
      db = createTestDb();
      resetMockCounter();
    });

    afterEach(() => {
      cleanupTestDb(db);
    });

    it('should insert a log and return it with id', () => {
      const input = createMockUsageLog();
      const result = insertTestLog(db, input);

      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('number');
      expect(result.id).toBeGreaterThan(0);
    });

    it('should return the log with created_at timestamp', () => {
      const input = createMockUsageLog();
      const result = insertTestLog(db, input);

      expect(result.created_at).toBeDefined();
      expect(typeof result.created_at).toBe('string');
    });

    it('should persist the correct data', () => {
      const input = createMockUsageLog({
        model: 'test/specific-model',
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        cost: 0.001,
        status_code: 200,
      });

      const result = insertTestLog(db, input);

      expect(result.model).toBe('test/specific-model');
      expect(result.prompt_tokens).toBe(100);
      expect(result.completion_tokens).toBe(50);
      expect(result.total_tokens).toBe(150);
      expect(result.cost).toBe(0.001);
      expect(result.status_code).toBe(200);
    });

    it('should handle null optional fields', () => {
      const input: ReturnType<typeof createMockUsageLog> = {
        timestamp: new Date().toISOString(),
        model: 'test/model',
        prompt_tokens: null,
        completion_tokens: null,
        total_tokens: null,
        cost: null,
        request_path: null,
        status_code: null,
        api_key_hash: null,
      };

      const result = insertTestLog(db, input);

      expect(result.id).toBeDefined();
      expect(result.prompt_tokens).toBeNull();
      expect(result.completion_tokens).toBeNull();
      expect(result.total_tokens).toBeNull();
      expect(result.cost).toBeNull();
      expect(result.request_path).toBeNull();
      expect(result.status_code).toBeNull();
      expect(result.api_key_hash).toBeNull();
    });

    it('should assign sequential ids for multiple inserts', () => {
      const log1 = insertTestLog(db, createMockUsageLog());
      const log2 = insertTestLog(db, createMockUsageLog());
      const log3 = insertTestLog(db, createMockUsageLog());

      expect(log1.id).toBe(1);
      expect(log2.id).toBe(2);
      expect(log3.id).toBe(3);
    });
  });

  describe('resetMockCounter', () => {
    it('should reset the counter for deterministic tests', () => {
      // Generate some logs to increment counter
      createMockUsageLog();
      createMockUsageLog();

      // Reset
      resetMockCounter();

      // First log after reset should have hash_0001
      const log = createMockUsageLog();
      expect(log.api_key_hash).toBe('hash_0001');
    });
  });
});
