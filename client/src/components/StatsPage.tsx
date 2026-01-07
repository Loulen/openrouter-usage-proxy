import { useState, useEffect, useCallback, useMemo } from 'react';
import { PieChartCard } from './PieChartCard';
import { LineChartCard } from './LineChartCard';
import { BarChartCard } from './BarChartCard';
import { useSettings } from '../hooks/useSettings';
import { useApiKeys } from '../hooks/useApiKeys';
import type {
  StatsPageProps,
  ModelStats,
  ChartDataPoint,
  FilterParams,
  TimeSeriesDataPoint,
  AggregationPeriod,
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

  // Fetch settings and API key balances for API key charts
  const { settings, loading: settingsLoading } = useSettings();
  const { balances: apiKeyBalances, loading: apiKeysLoading } = useApiKeys();

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
      // Don't override main error state, just log
      console.error('Failed to fetch time series:', err);
    } finally {
      setTimeSeriesLoading(false);
    }
  }, [filters?.from, filters?.to, aggregation]);

  useEffect(() => {
    fetchModelStats();
  }, [fetchModelStats]);

  useEffect(() => {
    fetchTimeSeries();
  }, [fetchTimeSeries]);

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
  const hasApiKeyData = apiKeyBalances.length > 0 && !apiKeyBalances.every((b) => b.error);

  // Transform API key balances to pie chart data (cost distribution by monthly usage)
  const apiKeyCostData = useMemo<ChartDataPoint[]>(() => {
    if (!apiKeyTrackingEnabled || apiKeyBalances.length === 0) {
      return [];
    }
    return apiKeyBalances
      .filter((balance) => !balance.error && balance.usageMonthly > 0)
      .map((balance) => ({
        name: balance.label,
        value: balance.usageMonthly,
      }));
  }, [apiKeyTrackingEnabled, apiKeyBalances]);

  // Transform API key balances to time-series-like data for bar chart
  // Since we have daily, weekly, monthly usage from OpenRouter, we simulate periods
  const apiKeyBarChartData = useMemo<TimeSeriesDataPoint[]>(() => {
    if (!apiKeyTrackingEnabled || apiKeyBalances.length === 0) {
      return [];
    }

    const validBalances = apiKeyBalances.filter((balance) => !balance.error);

    // Create time-series-like data based on aggregation selection
    // Since OpenRouter provides daily/weekly/monthly totals, we create period-based data
    const data: TimeSeriesDataPoint[] = [];

    if (apiKeyAggregation === 'day') {
      // Use daily usage - show as "Today"
      const today = new Date().toISOString().split('T')[0];
      validBalances.forEach((balance) => {
        if (balance.usageDaily > 0) {
          data.push({
            period: today,
            model: balance.label, // Using 'model' field for API key label (compatible with BarChartCard)
            request_count: 0,
            total_tokens: 0,
            total_cost: balance.usageDaily,
          });
        }
      });
    } else if (apiKeyAggregation === 'week') {
      // Use weekly usage - show as current week
      const now = new Date();
      const weekNum = Math.ceil((now.getDate() + new Date(now.getFullYear(), now.getMonth(), 1).getDay()) / 7);
      const weekPeriod = `${now.getFullYear()}-${String(weekNum).padStart(2, '0')}`;
      validBalances.forEach((balance) => {
        if (balance.usageWeekly > 0) {
          data.push({
            period: weekPeriod,
            model: balance.label,
            request_count: 0,
            total_tokens: 0,
            total_cost: balance.usageWeekly,
          });
        }
      });
    } else {
      // Use monthly usage - default/fallback
      const now = new Date();
      const monthPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      validBalances.forEach((balance) => {
        if (balance.usageMonthly > 0) {
          data.push({
            period: monthPeriod,
            model: balance.label,
            request_count: 0,
            total_tokens: 0,
            total_cost: balance.usageMonthly,
          });
        }
      });
    }

    return data;
  }, [apiKeyTrackingEnabled, apiKeyBalances, apiKeyAggregation]);

  const isLoading = loading || filtersLoading;
  const isApiKeyChartsLoading = settingsLoading || apiKeysLoading;

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
                  title="Cost by API Key"
                  data={apiKeyCostData}
                  loading={isApiKeyChartsLoading}
                />
                <BarChartCard
                  title="API Key Consumption"
                  data={apiKeyBarChartData}
                  metric="total_cost"
                  loading={isApiKeyChartsLoading}
                  aggregation={apiKeyAggregation}
                  onAggregationChange={setApiKeyAggregation}
                />
              </div>
              {!isApiKeyChartsLoading && !hasApiKeyData && (
                <div className="stats-page-empty-api-keys neu-card">
                  <span className="stats-page-empty-icon">🔑</span>
                  <p className="stats-page-empty-message">
                    No API key data available.
                  </p>
                  <p className="stats-page-empty-hint">
                    Add API keys in Settings to see consumption data here.
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
