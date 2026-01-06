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
