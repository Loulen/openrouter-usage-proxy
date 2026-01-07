import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import type { PieChartCardProps, ChartDataPoint } from '../types';

/**
 * Default color palette for pie chart segments
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
 * Format a number for display in the pie chart
 * Handles both small decimals and large numbers
 * @param value - The numeric value to format
 * @returns Formatted string
 */
function formatValue(value: number): string {
  if (value < 0.01 && value > 0) {
    return value.toFixed(6);
  }
  if (value >= 1000) {
    return value.toLocaleString();
  }
  return value.toFixed(2);
}

/**
 * Calculate percentage of a value relative to total
 * @param value - The value to calculate percentage for
 * @param total - The total sum of all values
 * @returns Percentage string with 1 decimal place
 */
function calculatePercentage(value: number, total: number): string {
  if (total === 0) return '0.0';
  return ((value / total) * 100).toFixed(1);
}

/**
 * Custom tooltip component for the pie chart
 * Shows segment name, value, and percentage on hover
 */
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: ChartDataPoint;
  }>;
  total: number;
}

function CustomTooltip({ active, payload, total }: CustomTooltipProps): JSX.Element | null {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const { name, value } = payload[0];
  const percentage = calculatePercentage(value, total);

  return (
    <div className="pie-chart-tooltip">
      <p className="pie-chart-tooltip-name">{name}</p>
      <p className="pie-chart-tooltip-value">
        {formatValue(value)} ({percentage}%)
      </p>
    </div>
  );
}

/**
 * Custom legend component with truncated names and hover tooltips
 */
interface CustomLegendProps {
  payload?: Array<{
    value: string;
    color: string;
    payload: ChartDataPoint;
  }>;
}

function CustomLegend({ payload }: CustomLegendProps): JSX.Element | null {
  if (!payload || payload.length === 0) {
    return null;
  }

  return (
    <ul className="pie-chart-legend">
      {payload.map((entry, index) => (
        <li key={`legend-${index}`} className="pie-chart-legend-item" title={entry.value}>
          <span
            className="pie-chart-legend-color"
            style={{ backgroundColor: entry.color }}
          />
          <span className="pie-chart-legend-text">
            {entry.value.length > 25 ? `${entry.value.substring(0, 22)}...` : entry.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * PieChartCard component for displaying data distribution in a pie chart
 * Uses recharts for rendering with neumorphism styling
 * Handles loading states and empty data gracefully
 */
export function PieChartCard({
  title,
  data,
  loading = false,
  colors = DEFAULT_COLORS,
}: PieChartCardProps): JSX.Element {
  // Calculate total for percentage calculations
  const total = data.reduce((sum, item) => sum + item.value, 0);

  // Filter out zero values for cleaner chart display
  const filteredData = data.filter(item => item.value > 0);

  // Check if we have data to display
  const hasData = filteredData.length > 0 && total > 0;

  return (
    <div className="pie-chart-card neu-card">
      <h3 className="pie-chart-title">{title}</h3>

      {loading ? (
        <div className="pie-chart-loading">
          <div className="spinner" />
          <span className="pie-chart-loading-text">Loading chart data...</span>
        </div>
      ) : !hasData ? (
        <div className="pie-chart-empty">
          <span className="pie-chart-empty-text">No data available</span>
        </div>
      ) : (
        <div className="pie-chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={filteredData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                animationBegin={0}
                animationDuration={500}
              >
                {filteredData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.fill || colors[index % colors.length]}
                    stroke="none"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip total={total} />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
