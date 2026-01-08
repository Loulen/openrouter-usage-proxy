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
 * - api_key_hash: SHA-256 hash of the API key used (nullable for backward compatibility)
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
    api_key_hash TEXT,
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
 * SQL statement to create an index on api_key_hash for efficient filtering by API key
 */
export const CREATE_API_KEY_HASH_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_usage_logs_api_key_hash
  ON usage_logs (api_key_hash)
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
  db.exec(CREATE_API_KEY_HASH_INDEX);
}

/**
 * Database interface for migration operations
 * Extends the basic exec interface with prepare for querying
 */
interface MigrationDatabase {
  exec: (sql: string) => void;
  prepare: (sql: string) => { get: () => { count: number } | undefined };
}

/**
 * Migration function to add api_key_hash column to existing databases
 * Checks if column exists before adding to ensure idempotency
 * Creates index on the new column for efficient filtering
 *
 * @param db - better-sqlite3 Database instance
 */
export function migrateApiKeyHash(db: MigrationDatabase): void {
  // Check if column already exists using pragma_table_info
  const result = db.prepare(`
    SELECT COUNT(*) as count
    FROM pragma_table_info('usage_logs')
    WHERE name = 'api_key_hash'
  `).get();

  const hasColumn = result?.count ?? 0;

  if (hasColumn === 0) {
    // Add the new column
    db.exec(`ALTER TABLE usage_logs ADD COLUMN api_key_hash TEXT`);
    // Create index for efficient filtering
    db.exec(CREATE_API_KEY_HASH_INDEX);
  }
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
 * SQL WHERE clause fragment for API key hash filtering
 * Uses exact match on api_key_hash
 */
export const WHERE_API_KEY_HASH = `api_key_hash = ?`;

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
 * @param filters - Object containing optional model, from, to, and apiKeyHash filters
 * @returns Object with sql query string and params array
 */
export function buildFilteredLogsQuery(filters: {
  model?: string;
  from?: string;
  to?: string;
  apiKeyHash?: string;
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

  if (filters.apiKeyHash) {
    conditions.push(WHERE_API_KEY_HASH);
    params.push(filters.apiKeyHash);
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
 * @param filters - Object containing optional model, from, to, and apiKeyHash filters
 * @returns Object with sql query string and params array
 */
export function buildFilteredStatsQuery(filters: {
  model?: string;
  from?: string;
  to?: string;
  apiKeyHash?: string;
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

  if (filters.apiKeyHash) {
    conditions.push(WHERE_API_KEY_HASH);
    params.push(filters.apiKeyHash);
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
 * @param filters - Object containing optional from, to, and apiKeyHash filters
 * @returns Object with sql query string and params array
 */
export function buildFilteredModelStatsQuery(filters: {
  from?: string;
  to?: string;
  apiKeyHash?: string;
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

  if (filters.apiKeyHash) {
    conditions.push(WHERE_API_KEY_HASH);
    params.push(filters.apiKeyHash);
  }

  let sql = SELECT_MODEL_STATS_BASE;
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }
  sql += GROUP_BY_MODEL_ORDER_BY_COST;

  return { sql, params };
}

/**
 * SQL format strings for different aggregation periods
 * Uses SQLite strftime for date truncation
 */
export const AGGREGATION_FORMATS: Record<string, string> = {
  hour: '%Y-%m-%dT%H:00:00',
  day: '%Y-%m-%d',
  week: '%Y-%W', // ISO week number
};

/**
 * Helper function to build a time-series query with aggregation
 * Groups data by time period and model for line chart visualization
 *
 * @param filters - Object containing optional from, to, aggregation, and apiKeyHash filters
 * @returns Object with sql query string and params array
 */
export function buildTimeSeriesQuery(filters: {
  from?: string;
  to?: string;
  aggregation?: 'hour' | 'day' | 'week';
  apiKeyHash?: string;
}): { sql: string; params: (string | undefined)[] } {
  const conditions: string[] = [];
  const params: (string | undefined)[] = [];
  const aggregation = filters.aggregation || 'day';
  const dateFormat = AGGREGATION_FORMATS[aggregation] || AGGREGATION_FORMATS.day;

  if (filters.from) {
    conditions.push(WHERE_FROM);
    params.push(filters.from);
  }

  if (filters.to) {
    conditions.push(WHERE_TO);
    params.push(filters.to);
  }

  if (filters.apiKeyHash) {
    conditions.push(WHERE_API_KEY_HASH);
    params.push(filters.apiKeyHash);
  }

  let sql = `
  SELECT
    strftime('${dateFormat}', timestamp) as period,
    model,
    COUNT(*) as request_count,
    COALESCE(SUM(total_tokens), 0) as total_tokens,
    COALESCE(SUM(cost), 0) as total_cost
  FROM usage_logs`;

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  sql += `
  GROUP BY period, model
  ORDER BY period ASC, model ASC`;

  return { sql, params };
}

/**
 * Helper function to build an API key statistics query
 * Groups data by api_key_hash for pie chart visualization of API key usage distribution
 * NULL api_key_hash values are coalesced to 'unknown' for backward compatibility
 *
 * @param filters - Object containing optional from and to date filters
 * @returns Object with sql query string and params array
 */
export function buildApiKeyStatsQuery(filters: {
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

  let sql = `
  SELECT
    COALESCE(api_key_hash, 'unknown') as api_key_hash,
    COUNT(*) as request_count,
    COALESCE(SUM(total_tokens), 0) as total_tokens,
    COALESCE(SUM(cost), 0) as total_cost
  FROM usage_logs`;

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  sql += `
  GROUP BY api_key_hash
  ORDER BY total_cost DESC`;

  return { sql, params };
}

/**
 * Helper function to build an API key time-series query with aggregation
 * Groups data by time period and api_key_hash for bar chart visualization
 * NULL api_key_hash values are coalesced to 'unknown' for backward compatibility
 *
 * @param filters - Object containing optional from, to, and aggregation filters
 * @returns Object with sql query string and params array
 */
export function buildApiKeyTimeSeriesQuery(filters: {
  from?: string;
  to?: string;
  aggregation?: 'hour' | 'day' | 'week';
}): { sql: string; params: (string | undefined)[] } {
  const conditions: string[] = [];
  const params: (string | undefined)[] = [];
  const aggregation = filters.aggregation || 'day';
  const dateFormat = AGGREGATION_FORMATS[aggregation] || AGGREGATION_FORMATS.day;

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
    strftime('${dateFormat}', timestamp) as period,
    COALESCE(api_key_hash, 'unknown') as api_key_hash,
    COUNT(*) as request_count,
    COALESCE(SUM(total_tokens), 0) as total_tokens,
    COALESCE(SUM(cost), 0) as total_cost
  FROM usage_logs`;

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  sql += `
  GROUP BY period, api_key_hash
  ORDER BY period ASC, api_key_hash ASC`;

  return { sql, params };
}
