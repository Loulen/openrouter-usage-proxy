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
 * Props for NavBar component
 */
export interface NavBarProps {
  /** Currently active page */
  activePage: 'dashboard' | 'stats';
  /** Callback when page changes */
  onPageChange: (page: 'dashboard' | 'stats') => void;
}
