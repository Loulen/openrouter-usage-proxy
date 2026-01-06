import { useState, useEffect, useCallback } from 'react';
import type { UsageLog, UsageStats, UseLogsState, FilterParams } from '../types';

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
 * Custom hook for fetching usage logs and statistics from the API
 * Fetches both /api/logs and /api/logs/stats endpoints
 * Supports optional filter parameters for model and date range filtering
 *
 * @param filters - Optional filter parameters (model, from, to)
 * @returns {UseLogsState & { refetch: () => void }} - Logs, stats, loading state, error, and refetch function
 */
export function useLogs(filters?: FilterParams): UseLogsState & { refetch: () => void } {
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const queryString = buildQueryString(filters);

      // Fetch logs and stats in parallel for better performance
      const [logsResponse, statsResponse] = await Promise.all([
        fetch(`/api/logs${queryString}`),
        fetch(`/api/logs/stats${queryString}`),
      ]);

      // Check for HTTP errors
      if (!logsResponse.ok) {
        throw new Error(`Failed to fetch logs: ${logsResponse.status} ${logsResponse.statusText}`);
      }
      if (!statsResponse.ok) {
        throw new Error(`Failed to fetch stats: ${statsResponse.status} ${statsResponse.statusText}`);
      }

      // Parse JSON responses
      const logsData: UsageLog[] = await logsResponse.json();
      const statsData: UsageStats = await statsResponse.json();

      setLogs(logsData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [filters?.model, filters?.from, filters?.to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { logs, stats, loading, error, refetch: fetchData };
}
