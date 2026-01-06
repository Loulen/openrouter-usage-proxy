import { useState, useEffect, useCallback } from 'react';
import { PieChartCard } from './PieChartCard';
import type { StatsPageProps, ModelStats, ChartDataPoint, FilterParams } from '../types';

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
 * StatsPage component for displaying model usage statistics with pie charts
 * Shows breakdown of requests, tokens, and costs by model
 * Supports filtering by model and date range
 */
export function StatsPage({ filters, loading: filtersLoading = false }: StatsPageProps): JSX.Element {
  const [modelStats, setModelStats] = useState<ModelStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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

  useEffect(() => {
    fetchModelStats();
  }, [fetchModelStats]);

  // Calculate summary statistics
  const totalRequests = modelStats.reduce((sum, stat) => sum + stat.request_count, 0);
  const totalTokens = modelStats.reduce((sum, stat) => sum + stat.total_tokens, 0);
  const totalCost = modelStats.reduce((sum, stat) => sum + stat.total_cost, 0);

  // Transform data for each chart
  const requestsData = transformToChartData(modelStats, 'request_count');
  const tokensData = transformToChartData(modelStats, 'total_tokens');
  const costData = transformToChartData(modelStats, 'total_cost');

  const isLoading = loading || filtersLoading;

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
