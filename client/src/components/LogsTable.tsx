import type { LogsTableProps } from '../types';

/**
 * Format a number to a USD currency string
 * @param value - The cost value in USD
 * @returns Formatted currency string or '-' if null
 */
function formatCost(value: number | null): string {
  if (value === null) {
    return '-';
  }
  // Format with up to 6 decimal places for small costs
  return `$${value.toFixed(6)}`;
}

/**
 * Format a number with thousands separator
 * @param value - The number to format
 * @returns Formatted number string or '-' if null
 */
function formatNumber(value: number | null): string {
  if (value === null) {
    return '-';
  }
  return value.toLocaleString();
}

/**
 * Format an ISO timestamp to a readable local date/time string
 * @param timestamp - ISO 8601 timestamp string
 * @returns Formatted date/time string
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * Extract the model name from the full model identifier
 * @param model - Full model identifier (e.g., "anthropic/claude-3-opus")
 * @returns Just the model name portion or full string if no slash
 */
function formatModel(model: string): string {
  // If model contains a slash, show the part after it
  const parts = model.split('/');
  return parts.length > 1 ? parts[parts.length - 1] : model;
}

/**
 * LogsTable component for displaying usage logs in a table format
 * Shows timestamp, model, token counts, and cost for each API call
 * Handles empty state with 'No logs yet' message
 */
export function LogsTable({ logs, loading }: LogsTableProps): JSX.Element {
  // Show empty state when no logs and not loading
  if (!loading && logs.length === 0) {
    return (
      <div className="neu-card">
        <div className="empty-state">
          <h3>No logs yet</h3>
          <p>Make an API request through the proxy to see usage data here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="neu-card logs-table-container">
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Model</th>
            <th className="text-right">Prompt Tokens</th>
            <th className="text-right">Completion Tokens</th>
            <th className="text-right">Total Tokens</th>
            <th className="text-right">Cost</th>
            <th className="text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{formatTimestamp(log.timestamp)}</td>
              <td title={log.model}>{formatModel(log.model)}</td>
              <td className="text-right">{formatNumber(log.prompt_tokens)}</td>
              <td className="text-right">{formatNumber(log.completion_tokens)}</td>
              <td className="text-right">{formatNumber(log.total_tokens)}</td>
              <td className="text-right">{formatCost(log.cost)}</td>
              <td className="text-right">
                <span className={log.status_code && log.status_code >= 400 ? 'status-error' : 'status-ok'}>
                  {log.status_code ?? '-'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
