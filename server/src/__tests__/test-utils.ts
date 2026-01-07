/**
 * Test utilities for OpenRouter Usage Proxy server tests
 * Provides helpers for in-memory database setup, fixtures, and cleanup
 */

import Database from 'better-sqlite3';
import type { UsageLogInput, UsageLog } from '../types/index.js';

/**
 * SQL schema for test database - matches production schema from db/schema.ts
 * Defined inline to avoid any module caching issues during testing
 */
const CREATE_USAGE_LOGS_TABLE = `
  CREATE TABLE IF NOT EXISTS usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    cost REAL,
    request_path TEXT,
    status_code INTEGER,
    api_key_hash TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`;

const CREATE_TIMESTAMP_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_usage_logs_timestamp
  ON usage_logs (timestamp)
`;

const CREATE_MODEL_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_usage_logs_model
  ON usage_logs (model)
`;

const CREATE_API_KEY_HASH_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_usage_logs_api_key_hash
  ON usage_logs (api_key_hash)
`;

const INSERT_USAGE_LOG = `
  INSERT INTO usage_logs (
    timestamp,
    model,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    cost,
    request_path,
    status_code,
    api_key_hash
  ) VALUES (
    @timestamp,
    @model,
    @prompt_tokens,
    @completion_tokens,
    @total_tokens,
    @cost,
    @request_path,
    @status_code,
    @api_key_hash
  )
`;

/**
 * Sample model names for generating realistic test data
 */
const SAMPLE_MODELS = [
  'anthropic/claude-3-opus',
  'anthropic/claude-3-sonnet',
  'anthropic/claude-3-haiku',
  'openai/gpt-4-turbo',
  'openai/gpt-4o',
  'openai/gpt-3.5-turbo',
  'google/gemini-pro',
  'meta-llama/llama-3-70b-instruct',
];

/**
 * Sample request paths for generating realistic test data
 */
const SAMPLE_PATHS = [
  '/api/v1/chat/completions',
  '/v1/chat/completions',
  '/api/chat',
];

/**
 * Counter for generating unique mock data
 */
let mockCounter = 0;

/**
 * Create an in-memory SQLite database with the usage_logs schema for testing
 *
 * @returns A new better-sqlite3 Database instance with initialized schema
 */
export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(CREATE_USAGE_LOGS_TABLE);
  db.exec(CREATE_TIMESTAMP_INDEX);
  db.exec(CREATE_MODEL_INDEX);
  db.exec(CREATE_API_KEY_HASH_INDEX);
  return db;
}

/**
 * Cleanup and close a test database connection
 * Should be called in afterEach/afterAll hooks to prevent resource leaks
 *
 * @param db - The database instance to cleanup
 */
export function cleanupTestDb(db: Database.Database): void {
  if (db && !db.open) {
    return; // Already closed
  }
  db.close();
}

/**
 * Generate a single mock usage log with realistic default values
 * All fields have sensible defaults but can be overridden
 *
 * @param overrides - Optional partial UsageLogInput to override defaults
 * @returns A complete UsageLogInput object
 */
export function createMockUsageLog(overrides?: Partial<UsageLogInput>): UsageLogInput {
  mockCounter++;

  // Generate a timestamp within the last 30 days
  const daysAgo = Math.floor(Math.random() * 30);
  const hoursAgo = Math.floor(Math.random() * 24);
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(date.getHours() - hoursAgo);

  // Generate realistic token counts
  const promptTokens = Math.floor(Math.random() * 2000) + 100;
  const completionTokens = Math.floor(Math.random() * 1000) + 50;
  const totalTokens = promptTokens + completionTokens;

  // Calculate realistic cost (roughly $0.01 per 1K tokens for average model)
  const cost = totalTokens * 0.00001 * (1 + Math.random());

  const defaults: UsageLogInput = {
    timestamp: date.toISOString(),
    model: SAMPLE_MODELS[mockCounter % SAMPLE_MODELS.length],
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    cost: Math.round(cost * 1000000) / 1000000, // Round to 6 decimal places
    request_path: SAMPLE_PATHS[mockCounter % SAMPLE_PATHS.length],
    status_code: 200,
    api_key_hash: `hash_${mockCounter.toString().padStart(4, '0')}`,
  };

  return {
    ...defaults,
    ...overrides,
  };
}

/**
 * Generate multiple mock usage logs
 *
 * @param count - Number of mock logs to generate
 * @returns Array of UsageLogInput objects
 */
export function createMockUsageLogs(count: number): UsageLogInput[] {
  const logs: UsageLogInput[] = [];
  for (let i = 0; i < count; i++) {
    logs.push(createMockUsageLog());
  }
  return logs;
}

/**
 * Insert a usage log into the test database and return the inserted row
 * with the auto-generated id and created_at fields
 *
 * @param db - The test database instance
 * @param log - The usage log input to insert
 * @returns The complete UsageLog with id and created_at
 */
export function insertTestLog(db: Database.Database, log: UsageLogInput): UsageLog {
  const stmt = db.prepare(INSERT_USAGE_LOG);

  const result = stmt.run({
    timestamp: log.timestamp,
    model: log.model,
    prompt_tokens: log.prompt_tokens ?? null,
    completion_tokens: log.completion_tokens ?? null,
    total_tokens: log.total_tokens ?? null,
    cost: log.cost ?? null,
    request_path: log.request_path ?? null,
    status_code: log.status_code ?? null,
    api_key_hash: log.api_key_hash ?? null,
  });

  // Fetch the inserted row to get id and created_at
  const insertedRow = db
    .prepare('SELECT * FROM usage_logs WHERE id = ?')
    .get(result.lastInsertRowid) as UsageLog;

  return insertedRow;
}

/**
 * Reset the mock counter (useful for deterministic tests)
 */
export function resetMockCounter(): void {
  mockCounter = 0;
}
