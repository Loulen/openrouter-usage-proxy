import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type {
  LineChartCardProps,
  TimeSeriesDataPoint,
  LineChartDataPoint,
  AggregationPeriod,
} from '../types';

/**
 * Default color palette for line chart series
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
 * Transform flat time-series data into recharts-compatible format
 * Groups data by period with each model as a separate key
 * @param data - Raw time-series data from API
 * @param metric - The metric to extract
 * @returns Transformed data for LineChart
 */
function transformToLineChartData(
  data: TimeSeriesDataPoint[],
  metric: 'request_count' | 'total_tokens' | 'total_cost'
): { chartData: LineChartDataPoint[]; models: string[] } {
  const periodMap = new Map<string, LineChartDataPoint>();
  const modelSet = new Set<string>();

  // Group data by period and collect unique models
  for (const point of data) {
    modelSet.add(point.model);

    if (!periodMap.has(point.period)) {
      periodMap.set(point.period, { period: point.period });
    }

    const periodData = periodMap.get(point.period)!;
    periodData[point.model] = point[metric];
  }

  // Sort periods chronologically
  const sortedPeriods = Array.from(periodMap.keys()).sort();
  const chartData = sortedPeriods.map((period) => periodMap.get(period)!);

  // Sort models alphabetically
  const models = Array.from(modelSet).sort();

  return { chartData, models };
}

/**
 * Truncate model name for legend display
 * @param model - Full model name
 * @param maxLength - Maximum length before truncation
 * @returns Truncated model name
 */
function truncateModelName(model: string, maxLength: number = 30): string {
  if (model.length <= maxLength) return model;
  return `${model.substring(0, maxLength - 3)}...`;
}

/**
 * Custom tooltip component for the line chart
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

  return (
    <div className="line-chart-tooltip">
      <p className="line-chart-tooltip-label">
        {label ? formatPeriodLabel(label, aggregation) : ''}
      </p>
      <ul className="line-chart-tooltip-list">
        {payload.map((entry, index) => (
          <li
            key={`tooltip-${index}`}
            className="line-chart-tooltip-item"
            style={{ color: entry.color }}
          >
            <span className="line-chart-tooltip-name" title={entry.name}>
              {truncateModelName(entry.name, 25)}:
            </span>
            <span className="line-chart-tooltip-value">
              {formatMetricValue(entry.value, metric)}
            </span>
          </li>
        ))}
      </ul>
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
 * LineChartCard component for displaying time-series consumption data
 * Uses recharts for rendering with neumorphism styling
 * Supports aggregation period selection (hour, day, week)
 */
export function LineChartCard({
  title,
  data,
  metric,
  loading = false,
  aggregation,
  onAggregationChange,
}: LineChartCardProps): JSX.Element {
  // Transform data for recharts
  const { chartData, models } = useMemo(
    () => transformToLineChartData(data, metric),
    [data, metric]
  );

  // Check if we have data to display
  const hasData = chartData.length > 0 && models.length > 0;

  return (
    <div className="line-chart-card neu-card">
      <div className="line-chart-header">
        <h3 className="line-chart-title">{title}</h3>
        <div className="line-chart-controls">
          <label className="line-chart-aggregation-label" htmlFor="aggregation-select">
            Group by:
          </label>
          <select
            id="aggregation-select"
            className="neu-select line-chart-aggregation-select"
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
        <div className="line-chart-loading">
          <div className="spinner" />
          <span className="line-chart-loading-text">Loading chart data...</span>
        </div>
      ) : !hasData ? (
        <div className="line-chart-empty">
          <span className="line-chart-empty-text">No data available</span>
        </div>
      ) : (
        <div className="line-chart-container">
          <ResponsiveContainer width="100%" height={350}>
            <LineChart
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
                formatter={(value) => truncateModelName(value, 20)}
                wrapperStyle={{ paddingTop: 10 }}
              />
              {models.map((model, index) => (
                <Line
                  key={model}
                  type="monotone"
                  dataKey={model}
                  name={model}
                  stroke={DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
