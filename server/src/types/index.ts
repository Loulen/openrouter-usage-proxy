/**
 * TypeScript type definitions for OpenRouter Usage Proxy
 */

/**
 * Usage log entry as stored in the database
 */
export interface UsageLog {
  /** Auto-incrementing primary key */
  id: number;
  /** ISO 8601 timestamp of the request */
  timestamp: string;
  /** Model identifier (e.g., "anthropic/claude-3-opus") */
  model: string;
  /** Number of input tokens */
  prompt_tokens: number | null;
  /** Number of output tokens */
  completion_tokens: number | null;
  /** Sum of prompt + completion tokens */
  total_tokens: number | null;
  /** Cost in USD (from OpenRouter response) */
  cost: number | null;
  /** API endpoint path */
  request_path: string | null;
  /** HTTP response status code */
  status_code: number | null;
  /** SHA-256 hash of the API key used (nullable for backward compatibility) */
  api_key_hash: string | null;
  /** Record creation timestamp */
  created_at: string;
}

/**
 * Input data for creating a new usage log entry
 * Excludes auto-generated fields (id, created_at)
 */
export interface UsageLogInput {
  /** ISO 8601 timestamp of the request */
  timestamp: string;
  /** Model identifier (e.g., "anthropic/claude-3-opus") */
  model: string;
  /** Number of input tokens */
  prompt_tokens?: number | null;
  /** Number of output tokens */
  completion_tokens?: number | null;
  /** Sum of prompt + completion tokens */
  total_tokens?: number | null;
  /** Cost in USD (from OpenRouter response) */
  cost?: number | null;
  /** API endpoint path */
  request_path?: string | null;
  /** HTTP response status code */
  status_code?: number | null;
  /** SHA-256 hash of the API key used (nullable for backward compatibility) */
  api_key_hash?: string | null;
}

/**
 * Summary statistics for the dashboard
 */
export interface UsageStats {
  /** Total number of API requests */
  request_count: number;
  /** Total tokens used across all requests */
  total_tokens: number;
  /** Total cost in USD across all requests */
  total_cost: number;
}

/**
 * OpenRouter API chat completion response structure
 * Used for extracting usage data from proxied responses
 */
export interface OpenRouterChatResponse {
  /** Response identifier */
  id?: string;
  /** Object type (usually "chat.completion") */
  object?: string;
  /** Unix timestamp of when the response was created */
  created?: number;
  /** Model used for the completion */
  model?: string;
  /** Array of completion choices */
  choices?: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  /** Usage information including token counts and cost */
  usage?: {
    /** Number of tokens in the prompt */
    prompt_tokens?: number;
    /** Number of tokens in the completion */
    completion_tokens?: number;
    /** Total tokens (prompt + completion) */
    total_tokens?: number;
    /** Cost of the request in USD (OpenRouter-specific) */
    cost?: number;
  };
}

/**
 * OpenRouter API chat completion request structure
 * Used for typing incoming proxy requests
 */
export interface OpenRouterChatRequest {
  /** Model identifier to use */
  model: string;
  /** Array of messages in the conversation */
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  /** Maximum tokens to generate */
  max_tokens?: number;
  /** Temperature for sampling */
  temperature?: number;
  /** Top-p sampling parameter */
  top_p?: number;
  /** Whether to stream the response */
  stream?: boolean;
  /** Request usage data to be included in response */
  usage?: {
    include: boolean;
  };
}

/**
 * API error response structure
 */
export interface ApiErrorResponse {
  /** Error indicator */
  error: true;
  /** Error message */
  message: string;
  /** Optional error code */
  code?: string;
}

/**
 * Query parameters for filtering logs
 */
export interface LogsQueryParams {
  /** Filter by model name */
  model?: string;
  /** Filter logs from this date (ISO 8601) */
  from?: string;
  /** Filter logs to this date (ISO 8601) */
  to?: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Number of results to skip (for pagination) */
  offset?: number;
}

/**
 * Filter parameters for logs and stats API endpoints
 * Used for model and time-window filtering
 */
export interface FilterParams {
  /** Filter by model name (exact match) */
  model?: string;
  /** Filter logs from this date (ISO 8601) */
  from?: string;
  /** Filter logs to this date (ISO 8601) */
  to?: string;
  /** API key UUID from client filter selection */
  apiKeyId?: string;
  /** Internal: SHA-256 hashed key for database query (derived from apiKeyId lookup) */
  apiKeyHash?: string;
}

/**
 * Statistics breakdown for a single model
 * Used for pie chart visualization and model comparison
 */
export interface ModelStats {
  /** Model identifier (e.g., "anthropic/claude-3-opus") */
  model: string;
  /** Number of requests for this model */
  request_count: number;
  /** Total tokens used by this model */
  total_tokens: number;
  /** Total cost in USD for this model */
  total_cost: number;
}

/**
 * Response from the /api/logs/models endpoint
 * Returns a list of distinct model names used in the logs
 */
export type ModelsResponse = string[];

/**
 * Aggregation period for time-series data
 * Controls how data points are grouped in time
 */
export type AggregationPeriod = 'hour' | 'day' | 'week';

/**
 * Time-series data point for consumption over time
 * Used for line chart visualization
 */
export interface TimeSeriesDataPoint {
  /** Period start timestamp (ISO 8601) */
  period: string;
  /** Model identifier */
  model: string;
  /** Number of requests in this period */
  request_count: number;
  /** Total tokens used in this period */
  total_tokens: number;
  /** Total cost in USD for this period */
  total_cost: number;
}

/**
 * Filter parameters for time-series endpoint
 * Extends FilterParams with aggregation period
 */
export interface TimeSeriesFilterParams extends FilterParams {
  /** Aggregation period (hour, day, week) */
  aggregation?: AggregationPeriod;
}

/**
 * Statistics breakdown for a single API key
 * Used for pie chart visualization of API key usage distribution
 */
export interface ApiKeyStats {
  /** SHA-256 hash of the API key, or 'unknown' for NULL values */
  api_key_hash: string;
  /** Number of requests made with this API key */
  request_count: number;
  /** Total tokens used by this API key */
  total_tokens: number;
  /** Total cost in USD for this API key */
  total_cost: number;
}

/**
 * Time-series data point for API key consumption over time
 * Used for bar chart visualization of API key usage over time
 */
export interface ApiKeyTimeSeriesDataPoint {
  /** Period start timestamp (ISO 8601 or formatted date string) */
  period: string;
  /** SHA-256 hash of the API key, or 'unknown' for NULL values */
  api_key_hash: string;
  /** Number of requests in this period for this API key */
  request_count: number;
  /** Total tokens used in this period for this API key */
  total_tokens: number;
  /** Total cost in USD for this period for this API key */
  total_cost: number;
}
