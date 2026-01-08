/**
 * TypeScript type definitions for OpenRouter Usage Proxy Web Dashboard
 * Mirrors backend types needed for frontend display
 */

/**
 * Usage log entry as returned from the API
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
  /** Record creation timestamp */
  created_at: string;
  /** SHA-256 hash of the API key used for this request (null if tracking disabled) */
  api_key_hash?: string | null;
  /** Resolved label for the API key (enriched client-side from hash map) */
  api_key_label?: string;
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
 * State for the useLogs hook
 */
export interface UseLogsState {
  /** Array of usage log entries */
  logs: UsageLog[];
  /** Summary statistics */
  stats: UsageStats | null;
  /** Loading state indicator */
  loading: boolean;
  /** Error state */
  error: Error | null;
}

/**
 * Props for LogsTable component
 */
export interface LogsTableProps {
  /** Array of usage log entries to display */
  logs: UsageLog[];
  /** Whether data is currently loading */
  loading?: boolean;
}

/**
 * Props for Dashboard component
 */
export interface DashboardProps {
  /** Summary statistics to display */
  stats: UsageStats | null;
  /** Whether data is currently loading */
  loading?: boolean;
  /** Callback to navigate to settings page (used when ApiKeyTable shows empty state) */
  onGoToSettings?: () => void;
}

/**
 * Filter parameters for logs and stats API requests
 * Used for model and time-window filtering
 */
export interface FilterParams {
  /** Filter by model name (exact match) */
  model?: string;
  /** Filter logs from this date (ISO 8601) */
  from?: string;
  /** Filter logs to this date (ISO 8601) */
  to?: string;
  /** Filter by API key ID */
  apiKeyId?: string;
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
 * Data point for pie chart visualization
 * Format compatible with recharts PieChart component
 */
export interface ChartDataPoint {
  /** Display name for the segment */
  name: string;
  /** Numeric value for the segment */
  value: number;
  /** Optional color for the segment */
  fill?: string;
}

/**
 * State for the useModels hook
 */
export interface UseModelsState {
  /** Array of available model names */
  models: string[];
  /** Loading state indicator */
  loading: boolean;
  /** Error state */
  error: Error | null;
}

/**
 * Props for Filters component
 */
export interface FiltersProps {
  /** Current filter state */
  filters: FilterParams;
  /** Callback when filters change */
  onFiltersChange: (filters: FilterParams) => void;
  /** Array of available models for dropdown */
  models: string[];
  /** Whether model list is loading */
  modelsLoading?: boolean;
}

/**
 * Props for PieChartCard component
 */
export interface PieChartCardProps {
  /** Title displayed above the chart */
  title: string;
  /** Data points for the pie chart */
  data: ChartDataPoint[];
  /** Whether data is loading */
  loading?: boolean;
  /** Chart color scheme (optional) */
  colors?: string[];
}

/**
 * Props for StatsPage component
 */
export interface StatsPageProps {
  /** Current filter state */
  filters: FilterParams;
  /** Whether model stats data is loading */
  loading?: boolean;
}

/**
 * Page types available in the application
 */
export type PageType = 'dashboard' | 'stats' | 'settings';

/**
 * Props for NavBar component
 */
export interface NavBarProps {
  /** Currently active page */
  activePage: PageType;
  /** Callback when page changes */
  onPageChange: (page: PageType) => void;
}

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
  /** Period start timestamp (ISO 8601 or formatted string) */
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
 * Line chart data structure for recharts
 * Each data point represents a time period with values per model
 */
export interface LineChartDataPoint {
  /** Period label for x-axis */
  period: string;
  /** Dynamic keys for each model's value */
  [model: string]: string | number;
}

/**
 * Props for LineChartCard component
 */
export interface LineChartCardProps {
  /** Title displayed above the chart */
  title: string;
  /** Time-series data points from API */
  data: TimeSeriesDataPoint[];
  /** Metric to display (requests, tokens, or cost) */
  metric: 'request_count' | 'total_tokens' | 'total_cost';
  /** Whether data is loading */
  loading?: boolean;
  /** Current aggregation period */
  aggregation: AggregationPeriod;
  /** Callback when aggregation changes */
  onAggregationChange: (aggregation: AggregationPeriod) => void;
}

// =============================================================================
// API Key and Settings Types
// =============================================================================

/**
 * Configuration for a single OpenRouter API key
 * Mirrors server/src/types/settings.ts ApiKeyConfig
 */
export interface ApiKeyConfig {
  /** Unique identifier (UUID) */
  id: string;
  /** User-friendly name for the API key */
  label: string;
  /** OpenRouter API key (sk-or-...) - masked in responses */
  key: string;
  /** ISO 8601 timestamp of when the key was added */
  createdAt: string;
}

/**
 * API key with masked key value (for display purposes)
 * Returned by GET /api/api-keys endpoint
 */
export interface MaskedApiKey {
  /** Unique identifier (UUID) */
  id: string;
  /** User-friendly name for the API key */
  label: string;
  /** ISO 8601 timestamp of when the key was added */
  createdAt: string;
  /** Masked API key (e.g., "sk-or-...xxxx") */
  maskedKey: string;
}

/**
 * Application settings for API key tracking feature
 * Mirrors server/src/types/settings.ts Settings
 */
export interface Settings {
  /** Whether API key tracking feature is enabled */
  apiKeyTrackingEnabled: boolean;
  /** List of configured OpenRouter API keys */
  apiKeys: ApiKeyConfig[];
  /** ISO 8601 timestamp of last settings update */
  lastUpdated: string;
}

/**
 * Balance and usage statistics for an API key
 * Used for displaying API key status on Dashboard
 */
export interface ApiKeyStats {
  /** API key configuration ID (from local settings) */
  id: string;
  /** User-friendly label for the API key */
  label: string;
  /** API key label from OpenRouter (may differ from local label) */
  openRouterLabel: string | null;
  /** Credit limit set on the key (null if unlimited) */
  limit: number | null;
  /** Remaining credits in USD */
  limitRemaining: number | null;
  /** Total usage in USD */
  usage: number;
  /** Usage in the current day in USD */
  usageDaily: number;
  /** Usage in the current week in USD */
  usageWeekly: number;
  /** Usage in the current month in USD */
  usageMonthly: number;
  /** Whether the key is on the free tier */
  isFreeTier: boolean;
  /** ISO 8601 timestamp of when this balance was fetched */
  lastUpdated: string;
  /** Error message if balance fetch failed */
  error?: string;
}

/**
 * Statistics breakdown for a single API key from local usage logs
 * Used for API key comparison and filtering analytics
 */
export interface ApiKeyStatsData {
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
 * Used for line/bar chart visualization filtered by API key
 */
export interface ApiKeyTimeSeriesDataPoint {
  /** Period start timestamp */
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

/**
 * Input for creating a new API key
 */
export interface ApiKeyInput {
  /** User-friendly name for the API key */
  label: string;
  /** OpenRouter API key (sk-or-...) */
  key: string;
}

/**
 * Input for updating an existing API key
 */
export interface ApiKeyUpdateInput {
  /** Updated label for the API key */
  label?: string;
  /** Updated OpenRouter API key */
  key?: string;
}

/**
 * Props for SettingsPage component
 */
export interface SettingsPageProps {
  /** Callback to navigate to a different page */
  onNavigate?: (page: PageType) => void;
}

/**
 * Props for ApiKeyTable component
 */
export interface ApiKeyTableProps {
  /** Array of API key statistics to display */
  stats: ApiKeyStats[];
  /** Whether data is currently loading */
  loading?: boolean;
  /** Error that occurred during data fetching */
  error?: Error | null;
  /** Callback to refresh the balance data */
  onRefresh?: () => void;
  /** Callback when "Go to Settings" is clicked (when no keys configured) */
  onGoToSettings?: () => void;
}

/**
 * State for the useSettings hook
 */
export interface UseSettingsState {
  /** Current settings */
  settings: Settings | null;
  /** Loading state indicator */
  loading: boolean;
  /** Error state */
  error: Error | null;
}

/**
 * State for the useApiKeys hook
 */
export interface UseApiKeysState {
  /** Array of API key statistics/balances */
  balances: ApiKeyStats[];
  /** Loading state indicator */
  loading: boolean;
  /** Error state */
  error: Error | null;
}

/**
 * Props for FiltersProps extended with API key support
 */
export interface FiltersPropsWithApiKeys extends FiltersProps {
  /** Array of available API keys for dropdown (can be masked or full config) */
  apiKeys?: MaskedApiKey[];
  /** Whether API key tracking is enabled */
  apiKeyTrackingEnabled?: boolean;
}

/**
 * Props for BarChartCard component
 */
export interface BarChartCardProps {
  /** Title displayed above the chart */
  title: string;
  /** Time-series data points for the bar chart */
  data: TimeSeriesDataPoint[];
  /** Metric to display (requests, tokens, or cost) */
  metric: 'request_count' | 'total_tokens' | 'total_cost';
  /** Whether data is loading */
  loading?: boolean;
  /** Current aggregation period */
  aggregation: AggregationPeriod;
  /** Callback when aggregation changes */
  onAggregationChange: (aggregation: AggregationPeriod) => void;
  /** Chart color scheme (optional) */
  colors?: string[];
}
