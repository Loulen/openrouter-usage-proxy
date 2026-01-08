import { useState, useEffect, useCallback, useMemo } from 'react';
import { PieChartCard } from './PieChartCard';
import { LineChartCard } from './LineChartCard';
import { BarChartCard } from './BarChartCard';
import { useSettings } from '../hooks/useSettings';
import type {
  StatsPageProps,
  ModelStats,
  ChartDataPoint,
  FilterParams,
  TimeSeriesDataPoint,
  AggregationPeriod,
  ApiKeyStatsData,
  ApiKeyTimeSeriesDataPoint,
  UnifiedStatsResponse,
} from '../types';

/**
 * Builds a query string for the unified stats endpoint
 * Includes filter parameters and aggregation settings
 *
 * @param filters - Filter parameters (model, from, to, apiKeyId)
 * @param aggregation - Aggregation period for model time-series
 * @param apiKeyAggregation - Aggregation period for API key time-series
 * @returns Query string starting with '?' or empty string if no params
 */
function buildUnifiedStatsQueryString(
  filters?: FilterParams,
  aggregation?: AggregationPeriod,
  apiKeyAggregation?: AggregationPeriod
): string {
  const params = new URLSearchParams();

  if (filters?.model) {
    params.append('model', filters.model);
  }
  if (filters?.from) {
    params.append('from', filters.from);
  }
  if (filters?.to) {
    params.append('to', filters.to);
  }
  if (filters?.apiKeyId) {
    params.append('apiKeyId', filters.apiKeyId);
  }
  if (aggregation) {
    params.append('aggregation', aggregation);
  }
  if (apiKeyAggregation) {
    params.append('apiKeyAggregation', apiKeyAggregation);
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Format a number to a USD currency string
 * @param value - The cost value in USD
 * @returns Formatted currency string
 */
function formatCost(value: number): string {
  if (value < 0.01 && value > 0) {
    return `$${value.toFixed(6)}`;
  }
  return `$${value.toFixed(2)}`;
}

/**
 * Format a number with thousands separator
 * @param value - The number to format
 * @returns Formatted number string
 */
function formatNumber(value: number): string {
  return value.toLocaleString();
}

/**
 * Transform ModelStats array into ChartDataPoint array for pie charts
 * @param modelStats - Array of per-model statistics
 * @param valueKey - Which property to use as the chart value
 * @returns Array of chart data points
 */
function transformToChartData(
  modelStats: ModelStats[],
  valueKey: keyof Pick<ModelStats, 'request_count' | 'total_tokens' | 'total_cost'>
): ChartDataPoint[] {
  return modelStats.map((stat) => ({
    name: stat.model,
    value: stat[valueKey],
  }));
}

/**
 * StatsPage component for displaying model usage statistics with pie charts and line charts
 * Shows breakdown of requests, tokens, and costs by model
 * Includes time-series visualization with aggregation options
 * Supports filtering by model and date range
 * When API key tracking is enabled, shows additional charts for API key distribution
 */
export function StatsPage({ filters, loading: filtersLoading = false }: StatsPageProps): JSX.Element {
  // State for unified stats data
  const [modelStats, setModelStats] = useState<ModelStats[]>([]);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesDataPoint[]>([]);
  const [apiKeyStats, setApiKeyStats] = useState<ApiKeyStatsData[]>([]);
  const [apiKeyTimeSeries, setApiKeyTimeSeries] = useState<ApiKeyTimeSeriesDataPoint[]>([]);

  // Aggregation controls
  const [aggregation, setAggregation] = useState<AggregationPeriod>('day');
  const [apiKeyAggregation, setApiKeyAggregation] = useState<AggregationPeriod>('day');

  // Single loading state for unified stats fetch
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch settings for API key tracking configuration
  const { settings, loading: settingsLoading } = useSettings();

  // Hash-to-label map for API key display (separate fetch, not part of unified stats)
  const [hashLabelMap, setHashLabelMap] = useState<Record<string, string>>({});

  /**
   * Fetches all statistics from the unified endpoint
   * Sets all state variables from a single response, ensuring consistency
   */
  const fetchUnifiedStats = useCallback(async () => {
    setStatsLoading(true);
    setError(null);

    try {
      const queryString = buildUnifiedStatsQueryString(filters, aggregation, apiKeyAggregation);
      const response = await fetch(`/api/logs/unified-stats${queryString}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch statistics: ${response.status} ${response.statusText}`);
      }

      const data: UnifiedStatsResponse = await response.json();

      // Update all state variables from the unified response
      setModelStats(data.modelStats);
      setTimeSeries(data.timeSeries);
      setApiKeyStats(data.apiKeyStats);
      setApiKeyTimeSeries(data.apiKeyTimeSeries);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setStatsLoading(false);
    }
  }, [filters?.model, filters?.from, filters?.to, filters?.apiKeyId, aggregation, apiKeyAggregation]);

  /**
   * Fetches the hash-to-label mapping for API keys
   * This is kept separate as it's not part of the unified stats endpoint
   */
  const fetchHashLabelMap = useCallback(async () => {
    try {
      const response = await fetch('/api/api-keys/hash-map');

      if (!response.ok) {
        throw new Error(`Failed to fetch hash map: ${response.status} ${response.statusText}`);
      }

      const data: Record<string, string> = await response.json();
      setHashLabelMap(data);
    } catch {
      // Silently handle hash map fetch errors - will display truncated hashes instead
    }
  }, []);

  // Fetch unified stats when filters or aggregation settings change
  useEffect(() => {
    fetchUnifiedStats();
  }, [fetchUnifiedStats]);

  // Fetch hash label map once on mount
  useEffect(() => {
    fetchHashLabelMap();
  }, [fetchHashLabelMap]);

  // Calculate summary statistics
  const totalRequests = modelStats.reduce((sum, stat) => sum + stat.request_count, 0);
  const totalTokens = modelStats.reduce((sum, stat) => sum + stat.total_tokens, 0);
  const totalCost = modelStats.reduce((sum, stat) => sum + stat.total_cost, 0);

  // Transform data for each chart
  const requestsData = transformToChartData(modelStats, 'request_count');
  const tokensData = transformToChartData(modelStats, 'total_tokens');
  const costData = transformToChartData(modelStats, 'total_cost');

  // Check if API key tracking is enabled
  const apiKeyTrackingEnabled = settings?.apiKeyTrackingEnabled ?? false;
  const hasApiKeyData = apiKeyStats.length > 0;

  /**
   * Maps an api_key_hash to a display label
   * - 'unknown' -> "Unknown"
   * - hash found in hashLabelMap -> label
   * - hash not found -> first 8 characters of hash
   */
  const getApiKeyLabel = useCallback((hash: string): string => {
    if (hash === 'unknown') {
      return 'Unknown';
    }
    return hashLabelMap[hash] ?? hash.substring(0, 8);
  }, [hashLabelMap]);

  // Transform API key stats to pie chart data for requests
  const apiKeyRequestsData = useMemo<ChartDataPoint[]>(() => {
    if (!apiKeyTrackingEnabled || apiKeyStats.length === 0) {
      return [];
    }
    return apiKeyStats.map((stat) => ({
      name: getApiKeyLabel(stat.api_key_hash),
      value: stat.request_count,
    }));
  }, [apiKeyTrackingEnabled, apiKeyStats, getApiKeyLabel]);

  // Transform API key stats to pie chart data for tokens
  const apiKeyTokensData = useMemo<ChartDataPoint[]>(() => {
    if (!apiKeyTrackingEnabled || apiKeyStats.length === 0) {
      return [];
    }
    return apiKeyStats.map((stat) => ({
      name: getApiKeyLabel(stat.api_key_hash),
      value: stat.total_tokens,
    }));
  }, [apiKeyTrackingEnabled, apiKeyStats, getApiKeyLabel]);

  // Transform API key stats to pie chart data for cost
  const apiKeyCostData = useMemo<ChartDataPoint[]>(() => {
    if (!apiKeyTrackingEnabled || apiKeyStats.length === 0) {
      return [];
    }
    return apiKeyStats.map((stat) => ({
      name: getApiKeyLabel(stat.api_key_hash),
      value: stat.total_cost,
    }));
  }, [apiKeyTrackingEnabled, apiKeyStats, getApiKeyLabel]);

  // Transform API key time-series data to bar chart format
  // BarChartCard expects TimeSeriesDataPoint[] with 'model' field for the series key
  const apiKeyBarChartData = useMemo<TimeSeriesDataPoint[]>(() => {
    if (!apiKeyTrackingEnabled || apiKeyTimeSeries.length === 0) {
      return [];
    }
    return apiKeyTimeSeries.map((point) => ({
      period: point.period,
      model: getApiKeyLabel(point.api_key_hash), // Using 'model' field for API key label (compatible with BarChartCard)
      request_count: point.request_count,
      total_tokens: point.total_tokens,
      total_cost: point.total_cost,
    }));
  }, [apiKeyTrackingEnabled, apiKeyTimeSeries, getApiKeyLabel]);

  // Unified loading state - all stats come from single fetch
  const isLoading = statsLoading || filtersLoading;
  // API key charts loading includes settings check (for tracking enabled status)
  const isApiKeyChartsLoading = settingsLoading || statsLoading || filtersLoading;

  return (
    <div className="stats-page">
      {error ? (
        <div className="stats-page-error neu-card">
          <span className="stats-page-error-icon">!</span>
          <p className="stats-page-error-message">{error.message}</p>
          <button
            type="button"
            className="stats-page-retry-button neu-button"
            onClick={fetchUnifiedStats}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Summary Stats Row */}
          <div className="stats-page-summary">
            <div className="stats-page-summary-card neu-card">
              <span className="stats-page-summary-label">Total Requests</span>
              <span className="stats-page-summary-value">
                {isLoading ? '-' : formatNumber(totalRequests)}
              </span>
            </div>
            <div className="stats-page-summary-card neu-card">
              <span className="stats-page-summary-label">Total Tokens</span>
              <span className="stats-page-summary-value">
                {isLoading ? '-' : formatNumber(totalTokens)}
              </span>
            </div>
            <div className="stats-page-summary-card neu-card">
              <span className="stats-page-summary-label">Total Cost</span>
              <span className="stats-page-summary-value">
                {isLoading ? '-' : formatCost(totalCost)}
              </span>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="stats-page-charts">
            <PieChartCard
              title="Requests by Model"
              data={requestsData}
              loading={isLoading}
            />
            <PieChartCard
              title="Tokens by Model"
              data={tokensData}
              loading={isLoading}
            />
            <PieChartCard
              title="Cost by Model"
              data={costData}
              loading={isLoading}
            />
          </div>

          {/* Time Series Line Chart */}
          <LineChartCard
            title="Cost Over Time by Model"
            data={timeSeries}
            metric="total_cost"
            loading={isLoading}
            aggregation={aggregation}
            onAggregationChange={setAggregation}
          />

          {/* API Key Charts Section - Only shown when API key tracking is enabled */}
          {apiKeyTrackingEnabled && (
            <>
              <h2 className="stats-page-section-title">API Key Statistics</h2>
              <div className="stats-page-charts stats-page-charts-api-keys">
                <PieChartCard
                  title="Requests by API Key"
                  data={apiKeyRequestsData}
                  loading={isApiKeyChartsLoading}
                />
                <PieChartCard
                  title="Tokens by API Key"
                  data={apiKeyTokensData}
                  loading={isApiKeyChartsLoading}
                />
                <PieChartCard
                  title="Cost by API Key"
                  data={apiKeyCostData}
                  loading={isApiKeyChartsLoading}
                />
              </div>
              <BarChartCard
                title="Cost Over Time by API Key"
                data={apiKeyBarChartData}
                metric="total_cost"
                loading={isApiKeyChartsLoading}
                aggregation={apiKeyAggregation}
                onAggregationChange={setApiKeyAggregation}
              />
              {!isApiKeyChartsLoading && !hasApiKeyData && (
                <div className="stats-page-empty-api-keys neu-card">
                  <span className="stats-page-empty-icon">i</span>
                  <p className="stats-page-empty-message">
                    No API key data available for the selected filters.
                  </p>
                  <p className="stats-page-empty-hint">
                    Make API requests through the proxy with API key tracking enabled to see usage data here.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Model Breakdown Table */}
          {!isLoading && modelStats.length > 0 && (
            <div className="stats-page-table-container neu-card">
              <h3 className="stats-page-table-title">Model Breakdown</h3>
              <table className="stats-page-table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Requests</th>
                    <th>Tokens</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {modelStats.map((stat) => (
                    <tr key={stat.model}>
                      <td title={stat.model} className="stats-page-table-model">
                        {stat.model.length > 40
                          ? `${stat.model.substring(0, 37)}...`
                          : stat.model}
                      </td>
                      <td>{formatNumber(stat.request_count)}</td>
                      <td>{formatNumber(stat.total_tokens)}</td>
                      <td>{formatCost(stat.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && modelStats.length === 0 && (
            <div className="stats-page-empty neu-card">
              <span className="stats-page-empty-icon">i</span>
              <p className="stats-page-empty-message">
                No data available for the selected filters.
              </p>
              <p className="stats-page-empty-hint">
                Try adjusting your filter criteria or clearing filters to see all data.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
