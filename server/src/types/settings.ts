/**
 * TypeScript type definitions for Settings and API Key management
 */

/**
 * Configuration for a single OpenRouter API key
 */
export interface ApiKeyConfig {
  /** Unique identifier (UUID) */
  id: string;
  /** User-friendly name for the API key */
  label: string;
  /** OpenRouter API key (sk-or-...) */
  key: string;
  /** ISO 8601 timestamp of when the key was added */
  createdAt: string;
}

/**
 * Application settings persisted to settings.json
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
 * Balance and usage information for an API key
 * Matches OpenRouter API /api/v1/key response structure
 */
export interface ApiKeyBalance {
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
 * Response structure from OpenRouter /api/v1/key endpoint
 */
export interface OpenRouterKeyResponse {
  data: {
    /** API key label set in OpenRouter */
    label: string;
    /** Credit limit (null if unlimited) */
    limit: number | null;
    /** Remaining credits */
    limit_remaining: number | null;
    /** Total usage in USD */
    usage: number;
    /** Today's usage in USD */
    usage_daily: number;
    /** This week's usage in USD */
    usage_weekly: number;
    /** This month's usage in USD */
    usage_monthly: number;
    /** Whether on free tier */
    is_free_tier: boolean;
  };
}

/**
 * Input for creating a new API key configuration
 * Excludes auto-generated fields (id, createdAt)
 */
export interface ApiKeyInput {
  /** User-friendly name for the API key */
  label: string;
  /** OpenRouter API key (sk-or-...) */
  key: string;
}

/**
 * Input for updating an existing API key configuration
 * All fields optional except id which is in path
 */
export interface ApiKeyUpdateInput {
  /** Updated label for the API key */
  label?: string;
  /** Updated OpenRouter API key */
  key?: string;
}

/**
 * Default settings when no settings file exists
 */
export const DEFAULT_SETTINGS: Settings = {
  apiKeyTrackingEnabled: false,
  apiKeys: [],
  lastUpdated: new Date().toISOString(),
};
