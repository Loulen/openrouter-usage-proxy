import type { DashboardProps } from '../types';

/**
 * Format a number to a USD currency string
 * @param value - The cost value in USD
 * @returns Formatted currency string
 */
function formatCost(value: number): string {
  // Format with up to 6 decimal places for small costs, or 2 for larger amounts
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
 * Dashboard component for displaying summary statistics
 * Shows total requests, total tokens, and total cost in card format
 * Handles loading and empty states gracefully
 */
export function Dashboard({ stats, loading }: DashboardProps): JSX.Element {
  // Show placeholder values when loading or no stats
  const requestCount = stats?.request_count ?? 0;
  const totalTokens = stats?.total_tokens ?? 0;
  const totalCost = stats?.total_cost ?? 0;

  return (
    <div className="dashboard">
      <div className="dashboard-grid">
        <div className="card stat-card">
          <div className="stat-label">Total Requests</div>
          <div className="stat-value">
            {loading ? (
              <span className="stat-loading">-</span>
            ) : (
              formatNumber(requestCount)
            )}
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">Total Tokens</div>
          <div className="stat-value">
            {loading ? (
              <span className="stat-loading">-</span>
            ) : (
              formatNumber(totalTokens)
            )}
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">Total Cost</div>
          <div className="stat-value">
            {loading ? (
              <span className="stat-loading">-</span>
            ) : (
              formatCost(totalCost)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
