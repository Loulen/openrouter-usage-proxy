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
} from '../types';

/**
 * Builds a query string from filter parameters
 * Only includes non-empty filter values
 *
 * @param filters - Filter parameters (model, from, to)
 * @returns Query string starting with '?' or empty string if no filters
 */
function buildQueryString(filters?: FilterParams): string {
  if (!filters) {
    return '';
  }

  const params = new URLSearchParams();

  if (filters.model) {
    params.append('model', filters.model);
  }
  if (filters.from) {
    params.append('from', filters.from);
  }
  if (filters.to) {
    params.append('to', filters.to);
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
  const [modelStats, setModelStats] = useState<ModelStats[]>([]);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesDataPoint[]>([]);
  const [aggregation, setAggregation] = useState<AggregationPeriod>('day');
  const [apiKeyAggregation, setApiKeyAggregation] = useState<AggregationPeriod>('day');
  const [loading, setLoading] = useState(true);
  const [timeSeriesLoading, setTimeSeriesLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch settings for API key tracking configuration
  const { settings, loading: settingsLoading } = useSettings();

  // State for API key statistics from local logs
  const [apiKeyStats, setApiKeyStats] = useState<ApiKeyStatsData[]>([]);
  const [apiKeyTimeSeries, setApiKeyTimeSeries] = useState<ApiKeyTimeSeriesDataPoint[]>([]);
  const [apiKeyStatsLoading, setApiKeyStatsLoading] = useState(true);
  const [apiKeyTimeSeriesLoading, setApiKeyTimeSeriesLoading] = useState(true);
  const [hashLabelMap, setHashLabelMap] = useState<Record<string, string>>({});

  const fetchModelStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const queryString = buildQueryString(filters);
      const response = await fetch(`/api/logs/model-stats${queryString}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch model stats: ${response.status} ${response.statusText}`);
      }

      const data: ModelStats[] = await response.json();
      setModelStats(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [filters?.model, filters?.from, filters?.to]);

  const fetchTimeSeries = useCallback(async () => {
    setTimeSeriesLoading(true);

    try {
      const params = new URLSearchParams();
      if (filters?.from) params.append('from', filters.from);
      if (filters?.to) params.append('to', filters.to);
      params.append('aggregation', aggregation);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(`/api/logs/time-series${queryString}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch time series: ${response.status} ${response.statusText}`);
      }

      const data: TimeSeriesDataPoint[] = await response.json();
      setTimeSeries(data);
    } catch (err) {
      // Don't override main error state, silently handle time series fetch errors
      // The main model stats error state already covers critical failures
      void err;
    } finally {
      setTimeSeriesLoading(false);
    }
  }, [filters?.from, filters?.to, aggregation]);

  /**
   * Fetches the hash-to-label mapping for API keys
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

  /**
   * Fetches API key statistics from local logs
   */
  const fetchApiKeyStats = useCallback(async () => {
    setApiKeyStatsLoading(true);

    try {
      const params = new URLSearchParams();
      if (filters?.from) params.append('from', filters.from);
      if (filters?.to) params.append('to', filters.to);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(`/api/logs/api-key-stats${queryString}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch API key stats: ${response.status} ${response.statusText}`);
      }

      const data: ApiKeyStatsData[] = await response.json();
      setApiKeyStats(data);
    } catch {
      // Silently handle API key stats fetch errors
    } finally {
      setApiKeyStatsLoading(false);
    }
  }, [filters?.from, filters?.to]);

  /**
   * Fetches API key time-series data from local logs
   */
  const fetchApiKeyTimeSeries = useCallback(async () => {
    setApiKeyTimeSeriesLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters?.from) params.append('from', filters.from);
      if (filters?.to) params.append('to', filters.to);
      params.append('aggregation', apiKeyAggregation);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(`/api/logs/api-key-time-series${queryString}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch API key time series: ${response.status} ${response.statusText}`);
      }

      const data: ApiKeyTimeSeriesDataPoint[] = await response.json();
      setApiKeyTimeSeries(data);
    } catch {
      // Silently handle API key time series fetch errors
    } finally {
      setApiKeyTimeSeriesLoading(false);
    }
  }, [filters?.from, filters?.to, apiKeyAggregation]);

  useEffect(() => {
    fetchModelStats();
  }, [fetchModelStats]);

  useEffect(() => {
    fetchTimeSeries();
  }, [fetchTimeSeries]);

  useEffect(() => {
    fetchHashLabelMap();
  }, [fetchHashLabelMap]);

  useEffect(() => {
    fetchApiKeyStats();
  }, [fetchApiKeyStats]);

  useEffect(() => {
    fetchApiKeyTimeSeries();
  }, [fetchApiKeyTimeSeries]);

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

  const isLoading = loading || filtersLoading;
  const isApiKeyChartsLoading = settingsLoading || apiKeyStatsLoading || apiKeyTimeSeriesLoading;

  return (
    <div className="stats-page">
      {error ? (
        <div className="stats-page-error neu-card">
          <span className="stats-page-error-icon">!</span>
          <p className="stats-page-error-message">{error.message}</p>
          <button
            type="button"
            className="stats-page-retry-button neu-button"
            onClick={fetchModelStats}
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
            loading={timeSeriesLoading || filtersLoading}
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
