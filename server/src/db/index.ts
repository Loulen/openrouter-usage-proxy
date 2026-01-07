/**
 * Database connection module for OpenRouter Usage Proxy
 * Initializes SQLite database with better-sqlite3, enables WAL mode,
 * and provides CRUD operations for usage logs
 */

import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import {
  initializeSchema,
  migrateApiKeyHash,
  INSERT_USAGE_LOG,
  SELECT_ALL_LOGS,
  SELECT_USAGE_STATS,
  SELECT_DISTINCT_MODELS,
  buildFilteredLogsQuery,
  buildFilteredStatsQuery,
  buildFilteredModelStatsQuery,
  buildTimeSeriesQuery,
} from './schema.js';
import type {
  UsageLog,
  UsageLogInput,
  UsageStats,
  FilterParams,
  ModelStats,
  ModelsResponse,
  TimeSeriesDataPoint,
  AggregationPeriod,
} from '../types/index.js';

/**
 * Database file path - stored in user's home directory
 * Creates ~/.openrouter-proxy/ directory to store the database
 */
const DATA_DIR = path.join(os.homedir(), '.openrouter-proxy');
const DB_PATH = path.join(DATA_DIR, 'usage.db');

/**
 * Ensure the data directory exists before initializing the database
 */
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Database instance
 * Uses better-sqlite3 for synchronous, fast SQLite operations
 */
export const db: DatabaseType = new Database(DB_PATH);

/**
 * Enable WAL (Write-Ahead Logging) mode for better concurrency
 * WAL mode allows concurrent reads while writing, which is ideal
 * for our use case of logging requests while querying the dashboard
 */
db.pragma('journal_mode = WAL');

/**
 * Initialize database schema (creates tables and indexes if not exist)
 */
initializeSchema(db);

/**
 * Run migrations for existing databases
 * Adds api_key_hash column if it doesn't exist
 */
migrateApiKeyHash(db);

/**
 * Prepared statement for inserting usage logs
 * Prepared statements are more efficient for repeated operations
 */
const insertStatement = db.prepare(INSERT_USAGE_LOG);

/**
 * Prepared statement for selecting all logs
 */
const selectAllStatement = db.prepare(SELECT_ALL_LOGS);

/**
 * Prepared statement for getting usage statistics
 */
const selectStatsStatement = db.prepare(SELECT_USAGE_STATS);

/**
 * Prepared statement for getting distinct model names
 */
const selectModelsStatement = db.prepare(SELECT_DISTINCT_MODELS);

/**
 * Insert a new usage log entry into the database
 *
 * @param logInput - Usage log data to insert
 * @returns The inserted log entry with generated id and created_at
 */
export function insertLog(logInput: UsageLogInput): UsageLog {
  const result = insertStatement.run({
    timestamp: logInput.timestamp,
    model: logInput.model,
    prompt_tokens: logInput.prompt_tokens ?? null,
    completion_tokens: logInput.completion_tokens ?? null,
    total_tokens: logInput.total_tokens ?? null,
    cost: logInput.cost ?? null,
    request_path: logInput.request_path ?? null,
    status_code: logInput.status_code ?? null,
    api_key_hash: logInput.api_key_hash ?? null,
  });

  // Return the inserted row by querying it back
  const insertedRow = db
    .prepare('SELECT * FROM usage_logs WHERE id = ?')
    .get(result.lastInsertRowid) as UsageLog;

  return insertedRow;
}

/**
 * Get all usage logs from the database
 * Returns logs ordered by timestamp descending (most recent first)
 *
 * @returns Array of usage log entries
 */
export function getLogs(): UsageLog[] {
  return selectAllStatement.all() as UsageLog[];
}

/**
 * Get usage statistics from the database
 * Returns total request count, total tokens, and total cost
 *
 * @returns Usage statistics object
 */
export function getStats(): UsageStats {
  return selectStatsStatement.get() as UsageStats;
}

/**
 * Close the database connection
 * Should be called when the application is shutting down
 */
export function closeDatabase(): void {
  db.close();
}

/**
 * Get all distinct model names from the database
 * Used to populate the model filter dropdown
 *
 * @returns Array of model name strings
 */
export function getModels(): ModelsResponse {
  const rows = selectModelsStatement.all() as { model: string }[];
  return rows.map((row) => row.model);
}

/**
 * Get usage logs with optional filtering
 * Supports filtering by model name and/or date range
 * Returns logs ordered by timestamp descending (most recent first)
 *
 * @param filters - Optional filter parameters (model, from, to)
 * @returns Array of filtered usage log entries
 */
export function getFilteredLogs(filters: FilterParams = {}): UsageLog[] {
  // If no filters provided, use the prepared statement for better performance
  if (!filters.model && !filters.from && !filters.to) {
    return selectAllStatement.all() as UsageLog[];
  }

  // Build dynamic query based on provided filters
  const { sql, params } = buildFilteredLogsQuery(filters);
  const statement = db.prepare(sql);
  return statement.all(...params) as UsageLog[];
}

/**
 * Get usage statistics with optional filtering
 * Supports filtering by model name and/or date range
 * Returns total request count, total tokens, and total cost
 *
 * @param filters - Optional filter parameters (model, from, to)
 * @returns Filtered usage statistics object
 */
export function getFilteredStats(filters: FilterParams = {}): UsageStats {
  // If no filters provided, use the prepared statement for better performance
  if (!filters.model && !filters.from && !filters.to) {
    return selectStatsStatement.get() as UsageStats;
  }

  // Build dynamic query based on provided filters
  const { sql, params } = buildFilteredStatsQuery(filters);
  const statement = db.prepare(sql);
  return statement.get(...params) as UsageStats;
}

/**
 * Get usage statistics grouped by model
 * Used for pie chart visualization showing model usage distribution
 * Supports optional date range filtering
 *
 * @param filters - Optional filter parameters (from, to)
 * @returns Array of per-model statistics
 */
export function getModelStats(filters: { from?: string; to?: string } = {}): ModelStats[] {
  // Build dynamic query based on provided filters
  const { sql, params } = buildFilteredModelStatsQuery(filters);
  const statement = db.prepare(sql);
  return statement.all(...params) as ModelStats[];
}

/**
 * Get time-series usage data grouped by period and model
 * Used for line chart visualization showing consumption over time
 * Supports date range filtering and aggregation period selection
 *
 * @param filters - Optional filter parameters (from, to, aggregation)
 * @returns Array of time-series data points
 */
export function getTimeSeries(filters: {
  from?: string;
  to?: string;
  aggregation?: AggregationPeriod;
} = {}): TimeSeriesDataPoint[] {
  const { sql, params } = buildTimeSeriesQuery(filters);
  const statement = db.prepare(sql);
  return statement.all(...params) as TimeSeriesDataPoint[];
}
