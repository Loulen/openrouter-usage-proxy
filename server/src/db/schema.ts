/**
 * Database schema definitions for OpenRouter Usage Proxy
 * Contains SQL statements for creating and managing database tables
 */

/**
 * SQL statement to create the usage_logs table
 *
 * Table structure matches the UsageLog interface from types/index.ts
 * - id: Auto-incrementing primary key
 * - timestamp: ISO 8601 timestamp of the API request
 * - model: Model identifier (e.g., "anthropic/claude-3-opus") - supports up to 256 characters
 * - prompt_tokens: Number of input tokens (nullable for responses without usage data)
 * - completion_tokens: Number of output tokens (nullable)
 * - total_tokens: Sum of prompt + completion tokens (nullable)
 * - cost: Cost in USD as REAL/float (nullable, from OpenRouter response)
 * - request_path: API endpoint path (nullable)
 * - status_code: HTTP response status code (nullable)
 * - created_at: Record creation timestamp (auto-set to current time)
 */
export const CREATE_USAGE_LOGS_TABLE = `
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
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`;

/**
 * SQL statement to create an index on timestamp for faster date-range queries
 */
export const CREATE_TIMESTAMP_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_usage_logs_timestamp
  ON usage_logs (timestamp)
`;

/**
 * SQL statement to create an index on model for faster model-based filtering
 */
export const CREATE_MODEL_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_usage_logs_model
  ON usage_logs (model)
`;

/**
 * Initialize database schema
 * Executes all CREATE TABLE and CREATE INDEX statements
 *
 * @param db - better-sqlite3 Database instance
 */
export function initializeSchema(db: { exec: (sql: string) => void }): void {
  db.exec(CREATE_USAGE_LOGS_TABLE);
  db.exec(CREATE_TIMESTAMP_INDEX);
  db.exec(CREATE_MODEL_INDEX);
}

/**
 * SQL statement to insert a new usage log entry
 * Uses named parameters for better readability
 */
export const INSERT_USAGE_LOG = `
  INSERT INTO usage_logs (
    timestamp,
    model,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    cost,
    request_path,
    status_code
  ) VALUES (
    @timestamp,
    @model,
    @prompt_tokens,
    @completion_tokens,
    @total_tokens,
    @cost,
    @request_path,
    @status_code
  )
`;

/**
 * SQL statement to select all usage logs, ordered by most recent first
 */
export const SELECT_ALL_LOGS = `
  SELECT * FROM usage_logs ORDER BY timestamp DESC
`;

/**
 * SQL statement to get usage statistics
 * Returns total request count, sum of tokens, and sum of costs
 */
export const SELECT_USAGE_STATS = `
  SELECT
    COUNT(*) as request_count,
    COALESCE(SUM(total_tokens), 0) as total_tokens,
    COALESCE(SUM(cost), 0) as total_cost
  FROM usage_logs
`;

/**
 * SQL statement to get distinct model names from usage logs
 * Used for populating the model filter dropdown
 * Returns models ordered alphabetically
 */
export const SELECT_DISTINCT_MODELS = `
  SELECT DISTINCT model FROM usage_logs ORDER BY model ASC
`;

/**
 * Base SQL for selecting logs filtered by model and/or date range
 * Parameters need to be dynamically added based on filter presence
 * Uses idx_usage_logs_timestamp and idx_usage_logs_model indexes
 */
export const SELECT_LOGS_BASE = `
  SELECT * FROM usage_logs
`;

/**
 * SQL WHERE clause fragment for model filtering
 * Uses exact match on model name
 */
export const WHERE_MODEL = `model = ?`;

/**
 * SQL WHERE clause fragment for date range filtering (from)
 * Uses >= for inclusive start date
 */
export const WHERE_FROM = `timestamp >= ?`;

/**
 * SQL WHERE clause fragment for date range filtering (to)
 * Uses <= for inclusive end date
 */
export const WHERE_TO = `timestamp <= ?`;

/**
 * SQL ORDER BY clause for logs
 * Most recent first
 */
export const ORDER_BY_TIMESTAMP_DESC = `ORDER BY timestamp DESC`;

/**
 * SQL statement to get usage statistics grouped by model
 * Used for pie chart visualization
 * Returns statistics breakdown per model, ordered by total cost descending
 */
export const SELECT_MODEL_STATS = `
  SELECT
    model,
    COUNT(*) as request_count,
    COALESCE(SUM(total_tokens), 0) as total_tokens,
    COALESCE(SUM(cost), 0) as total_cost
  FROM usage_logs
  GROUP BY model
  ORDER BY total_cost DESC
`;

/**
 * SQL statement to get model statistics with optional date range filtering
 * Base query for building dynamic filtered model stats
 */
export const SELECT_MODEL_STATS_BASE = `
  SELECT
    model,
    COUNT(*) as request_count,
    COALESCE(SUM(total_tokens), 0) as total_tokens,
    COALESCE(SUM(cost), 0) as total_cost
  FROM usage_logs
`;

/**
 * SQL GROUP BY and ORDER BY clause for model statistics
 */
export const GROUP_BY_MODEL_ORDER_BY_COST = `
  GROUP BY model
  ORDER BY total_cost DESC
`;

/**
 * Helper function to build a filtered logs query dynamically
 * Constructs WHERE clause based on which filter parameters are provided
 *
 * @param filters - Object containing optional model, from, and to filters
 * @returns Object with sql query string and params array
 */
export function buildFilteredLogsQuery(filters: {
  model?: string;
  from?: string;
  to?: string;
}): { sql: string; params: (string | undefined)[] } {
  const conditions: string[] = [];
  const params: (string | undefined)[] = [];

  if (filters.model) {
    conditions.push(WHERE_MODEL);
    params.push(filters.model);
  }

  if (filters.from) {
    conditions.push(WHERE_FROM);
    params.push(filters.from);
  }

  if (filters.to) {
    conditions.push(WHERE_TO);
    params.push(filters.to);
  }

  let sql = SELECT_LOGS_BASE;
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }
  sql += ` ${ORDER_BY_TIMESTAMP_DESC}`;

  return { sql, params };
}

/**
 * Helper function to build a filtered stats query dynamically
 * Constructs WHERE clause based on which filter parameters are provided
 *
 * @param filters - Object containing optional model, from, and to filters
 * @returns Object with sql query string and params array
 */
export function buildFilteredStatsQuery(filters: {
  model?: string;
  from?: string;
  to?: string;
}): { sql: string; params: (string | undefined)[] } {
  const conditions: string[] = [];
  const params: (string | undefined)[] = [];

  if (filters.model) {
    conditions.push(WHERE_MODEL);
    params.push(filters.model);
  }

  if (filters.from) {
    conditions.push(WHERE_FROM);
    params.push(filters.from);
  }

  if (filters.to) {
    conditions.push(WHERE_TO);
    params.push(filters.to);
  }

  let sql = `
  SELECT
    COUNT(*) as request_count,
    COALESCE(SUM(total_tokens), 0) as total_tokens,
    COALESCE(SUM(cost), 0) as total_cost
  FROM usage_logs`;

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  return { sql, params };
}

/**
 * Helper function to build a filtered model stats query dynamically
 * Constructs WHERE clause for date range filtering on model statistics
 *
 * @param filters - Object containing optional from and to filters
 * @returns Object with sql query string and params array
 */
export function buildFilteredModelStatsQuery(filters: {
  from?: string;
  to?: string;
}): { sql: string; params: (string | undefined)[] } {
  const conditions: string[] = [];
  const params: (string | undefined)[] = [];

  if (filters.from) {
    conditions.push(WHERE_FROM);
    params.push(filters.from);
  }

  if (filters.to) {
    conditions.push(WHERE_TO);
    params.push(filters.to);
  }

  let sql = SELECT_MODEL_STATS_BASE;
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }
  sql += GROUP_BY_MODEL_ORDER_BY_COST;

  return { sql, params };
}
