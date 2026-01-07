import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type {
  BarChartCardProps,
  TimeSeriesDataPoint,
  AggregationPeriod,
} from '../types';

/**
 * Default color palette for bar chart segments
 * Uses a visually distinct and accessible color scheme
 */
const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#ec4899', // pink
  '#6366f1', // indigo
];

/**
 * Bar chart data structure for recharts
 * Each data point represents a time period with values per model/API key
 */
interface BarChartDataPoint {
  /** Period label for x-axis */
  period: string;
  /** Dynamic keys for each model/key's value */
  [key: string]: string | number;
}

/**
 * Format a period label for display on the x-axis
 * @param period - The period string from the API
 * @param aggregation - The aggregation type
 * @returns Formatted period label
 */
function formatPeriodLabel(period: string, aggregation: AggregationPeriod): string {
  if (aggregation === 'hour') {
    // Format: 2025-01-06T14:00:00 -> Jan 6, 2pm
    const date = new Date(period);
    if (isNaN(date.getTime())) return period;
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
    });
  }
  if (aggregation === 'day') {
    // Format: 2025-01-06 -> Jan 6
    const date = new Date(period + 'T00:00:00');
    if (isNaN(date.getTime())) return period;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
  if (aggregation === 'week') {
    // Format: 2025-02 -> Week 2, 2025
    const parts = period.split('-');
    if (parts.length === 2) {
      return `W${parts[1]} ${parts[0]}`;
    }
    return period;
  }
  return period;
}

/**
 * Format a metric value for display
 * @param value - The numeric value
 * @param metric - The metric type
 * @returns Formatted string
 */
function formatMetricValue(
  value: number,
  metric: 'request_count' | 'total_tokens' | 'total_cost'
): string {
  if (metric === 'total_cost') {
    return `$${value.toFixed(4)}`;
  }
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

/**
 * Transform flat time-series data into recharts-compatible format for bar charts
 * Groups data by period with each model/API key as a separate key
 * @param data - Raw time-series data from API
 * @param metric - The metric to extract
 * @returns Transformed data for BarChart
 */
function transformToBarChartData(
  data: TimeSeriesDataPoint[],
  metric: 'request_count' | 'total_tokens' | 'total_cost'
): { chartData: BarChartDataPoint[]; keys: string[] } {
  const periodMap = new Map<string, BarChartDataPoint>();
  const keySet = new Set<string>();

  // Group data by period and collect unique models/keys
  for (const point of data) {
    keySet.add(point.model);

    if (!periodMap.has(point.period)) {
      periodMap.set(point.period, { period: point.period });
    }

    const periodData = periodMap.get(point.period)!;
    periodData[point.model] = point[metric];
  }

  // Sort periods chronologically
  const sortedPeriods = Array.from(periodMap.keys()).sort();
  const chartData = sortedPeriods.map((period) => periodMap.get(period)!);

  // Sort keys alphabetically
  const keys = Array.from(keySet).sort();

  return { chartData, keys };
}

/**
 * Truncate key name for legend display
 * @param key - Full key name
 * @param maxLength - Maximum length before truncation
 * @returns Truncated key name
 */
function truncateKeyName(key: string, maxLength: number = 30): string {
  if (key.length <= maxLength) return key;
  return `${key.substring(0, maxLength - 3)}...`;
}

/**
 * Custom tooltip component for the bar chart
 */
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
  metric: 'request_count' | 'total_tokens' | 'total_cost';
  aggregation: AggregationPeriod;
}

function CustomTooltip({
  active,
  payload,
  label,
  metric,
  aggregation,
}: CustomTooltipProps): JSX.Element | null {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  // Calculate total for this period
  const total = payload.reduce((sum, entry) => sum + (entry.value || 0), 0);

  return (
    <div className="bar-chart-tooltip">
      <p className="bar-chart-tooltip-label">
        {label ? formatPeriodLabel(label, aggregation) : ''}
      </p>
      <ul className="bar-chart-tooltip-list">
        {payload.map((entry, index) => (
          <li
            key={`tooltip-${index}`}
            className="bar-chart-tooltip-item"
            style={{ color: entry.color }}
          >
            <span className="bar-chart-tooltip-name" title={entry.name}>
              {truncateKeyName(entry.name, 25)}:
            </span>
            <span className="bar-chart-tooltip-value">
              {formatMetricValue(entry.value, metric)}
            </span>
          </li>
        ))}
      </ul>
      <div className="bar-chart-tooltip-total">
        <span className="bar-chart-tooltip-total-label">Total:</span>
        <span className="bar-chart-tooltip-total-value">
          {formatMetricValue(total, metric)}
        </span>
      </div>
    </div>
  );
}

/**
 * Get metric display label
 * @param metric - The metric type
 * @returns Human-readable label
 */
function getMetricLabel(metric: 'request_count' | 'total_tokens' | 'total_cost'): string {
  switch (metric) {
    case 'request_count':
      return 'Requests';
    case 'total_tokens':
      return 'Tokens';
    case 'total_cost':
      return 'Cost ($)';
  }
}

/**
 * BarChartCard component for displaying stacked/grouped bar chart consumption data
 * Uses recharts for rendering with neumorphism styling
 * Supports aggregation period selection (hour, day, week)
 * Shows consumption per API key over time with stacked bars
 */
export function BarChartCard({
  title,
  data,
  metric,
  loading = false,
  aggregation,
  onAggregationChange,
  colors = DEFAULT_COLORS,
}: BarChartCardProps): JSX.Element {
  // Transform data for recharts
  const { chartData, keys } = useMemo(
    () => transformToBarChartData(data, metric),
    [data, metric]
  );

  // Check if we have data to display
  const hasData = chartData.length > 0 && keys.length > 0;

  return (
    <div className="bar-chart-card neu-card">
      <div className="bar-chart-header">
        <h3 className="bar-chart-title">{title}</h3>
        <div className="bar-chart-controls">
          <label className="bar-chart-aggregation-label" htmlFor="bar-aggregation-select">
            Group by:
          </label>
          <select
            id="bar-aggregation-select"
            className="neu-select bar-chart-aggregation-select"
            value={aggregation}
            onChange={(e) => onAggregationChange(e.target.value as AggregationPeriod)}
          >
            <option value="hour">Hour</option>
            <option value="day">Day</option>
            <option value="week">Week</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="bar-chart-loading">
          <div className="spinner" />
          <span className="bar-chart-loading-text">Loading chart data...</span>
        </div>
      ) : !hasData ? (
        <div className="bar-chart-empty">
          <span className="bar-chart-empty-text">No data available</span>
        </div>
      ) : (
        <div className="bar-chart-container">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--neu-shadow-dark)" opacity={0.3} />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => formatPeriodLabel(value, aggregation)}
                stroke="var(--text-muted)"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => formatMetricValue(value, metric)}
                stroke="var(--text-muted)"
                label={{
                  value: getMetricLabel(metric),
                  angle: -90,
                  position: 'insideLeft',
                  style: { textAnchor: 'middle', fill: 'var(--text-muted)', fontSize: 12 },
                }}
              />
              <Tooltip
                content={<CustomTooltip metric={metric} aggregation={aggregation} />}
              />
              <Legend
                formatter={(value) => truncateKeyName(value, 20)}
                wrapperStyle={{ paddingTop: 10 }}
              />
              {keys.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={key}
                  stackId="consumption"
                  fill={colors[index % colors.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
