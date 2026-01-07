import type { ApiKeyTableProps, ApiKeyStats } from '../types';

/**
 * Format a number to a USD currency string
 * @param value - The cost value in USD
 * @returns Formatted currency string
 */
function formatCost(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '-';
  }
  // Format with up to 6 decimal places for small costs, or 2 for larger amounts
  if (value < 0.01 && value > 0) {
    return `$${value.toFixed(6)}`;
  }
  return `$${value.toFixed(2)}`;
}

/**
 * Format a timestamp to a relative time string (e.g., "2 minutes ago")
 * @param timestamp - ISO 8601 timestamp
 * @returns Relative time string
 */
function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const updated = new Date(timestamp);
  const diffMs = now.getTime() - updated.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffSeconds < 60) {
    return `${diffSeconds} seconds ago`;
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else {
    return updated.toLocaleDateString();
  }
}

/**
 * Check if an API key has zero or low remaining balance
 * @param stat - API key statistics
 * @returns true if balance is critically low (< $1) or zero
 */
function isLowBalance(stat: ApiKeyStats): boolean {
  if (stat.limitRemaining === null) {
    return false; // Unlimited key
  }
  return stat.limitRemaining < 1;
}

/**
 * Check if an API key has zero balance
 * @param stat - API key statistics
 * @returns true if balance is zero or negative
 */
function isZeroBalance(stat: ApiKeyStats): boolean {
  if (stat.limitRemaining === null) {
    return false; // Unlimited key
  }
  return stat.limitRemaining <= 0;
}

/**
 * ApiKeyTable component for displaying per-API-key balance and consumption data
 * Shows remaining balance, daily/weekly/monthly usage for each configured API key
 * Handles loading, error, and empty states gracefully
 */
export function ApiKeyTable({
  stats,
  loading = false,
  error = null,
  onRefresh,
  onGoToSettings,
}: ApiKeyTableProps): JSX.Element {
  // Get the most recent update timestamp from all stats
  const lastUpdated = stats.length > 0
    ? stats.reduce((latest, stat) => {
        const statTime = new Date(stat.lastUpdated).getTime();
        return statTime > latest ? statTime : latest;
      }, 0)
    : null;

  // Error state
  if (error) {
    return (
      <div className="api-key-table-container neu-card">
        <div className="api-key-table-header">
          <h3 className="api-key-table-title">API Key Balances</h3>
        </div>
        <div className="api-key-table-error">
          <span className="api-key-table-error-icon">!</span>
          <p className="api-key-table-error-message">{error.message}</p>
          {onRefresh && (
            <button
              type="button"
              className="api-key-table-retry-button neu-button"
              onClick={onRefresh}
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="api-key-table-container neu-card">
        <div className="api-key-table-header">
          <h3 className="api-key-table-title">API Key Balances</h3>
        </div>
        <div className="api-key-table-loading">
          <div className="spinner" />
          <span className="api-key-table-loading-text">Loading balances...</span>
        </div>
      </div>
    );
  }

  // Empty state - no API keys configured
  if (stats.length === 0) {
    return (
      <div className="api-key-table-container neu-card">
        <div className="api-key-table-header">
          <h3 className="api-key-table-title">API Key Balances</h3>
        </div>
        <div className="api-key-table-empty">
          <span className="api-key-table-empty-icon">🔑</span>
          <p className="api-key-table-empty-message">
            No API keys configured yet.
          </p>
          <p className="api-key-table-empty-hint">
            Add your OpenRouter API keys in Settings to track their balances and usage.
          </p>
          {onGoToSettings && (
            <button
              type="button"
              className="api-key-table-settings-button neu-button"
              onClick={onGoToSettings}
            >
              Go to Settings
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="api-key-table-container neu-card">
      <div className="api-key-table-header">
        <h3 className="api-key-table-title">API Key Balances</h3>
        <div className="api-key-table-actions">
          {lastUpdated && (
            <span className="api-key-table-updated">
              Updated {formatRelativeTime(new Date(lastUpdated).toISOString())}
            </span>
          )}
          {onRefresh && (
            <button
              type="button"
              className="api-key-table-refresh-button neu-button"
              onClick={onRefresh}
              aria-label="Refresh balances"
            >
              ↻ Refresh
            </button>
          )}
        </div>
      </div>

      <div className="api-key-table-wrapper">
        <table className="api-key-table">
          <thead>
            <tr>
              <th>Label</th>
              <th className="text-right">Remaining Balance</th>
              <th className="text-right">Daily Usage</th>
              <th className="text-right">Weekly Usage</th>
              <th className="text-right">Monthly Usage</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((stat) => (
              <tr
                key={stat.id}
                className={isZeroBalance(stat) ? 'api-key-table-row-warning' : ''}
              >
                <td className="api-key-table-label">
                  <span
                    className="api-key-table-label-text"
                    title={stat.label}
                  >
                    {stat.label.length > 30
                      ? `${stat.label.substring(0, 27)}...`
                      : stat.label}
                  </span>
                  {stat.isFreeTier && (
                    <span className="api-key-table-badge api-key-table-badge-free">
                      Free
                    </span>
                  )}
                  {stat.error && (
                    <span
                      className="api-key-table-badge api-key-table-badge-error"
                      title={stat.error}
                    >
                      Error
                    </span>
                  )}
                </td>
                <td className={`text-right ${isLowBalance(stat) ? 'api-key-table-low-balance' : ''}`}>
                  {isZeroBalance(stat) && (
                    <span className="api-key-table-warning-icon" title="Zero balance">
                      ⚠️
                    </span>
                  )}
                  {stat.limitRemaining !== null
                    ? formatCost(stat.limitRemaining)
                    : <span className="api-key-table-unlimited">Unlimited</span>
                  }
                </td>
                <td className="text-right">{formatCost(stat.usageDaily)}</td>
                <td className="text-right">{formatCost(stat.usageWeekly)}</td>
                <td className="text-right">{formatCost(stat.usageMonthly)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
