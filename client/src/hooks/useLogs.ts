import { useState, useEffect, useCallback } from 'react';
import type { UsageLog, UsageStats, UseLogsState } from '../types';

/**
 * Custom hook for fetching usage logs and statistics from the API
 * Fetches both /api/logs and /api/logs/stats endpoints
 *
 * @returns {UseLogsState & { refetch: () => void }} - Logs, stats, loading state, error, and refetch function
 */
export function useLogs(): UseLogsState & { refetch: () => void } {
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch logs and stats in parallel for better performance
      const [logsResponse, statsResponse] = await Promise.all([
        fetch('/api/logs'),
        fetch('/api/logs/stats'),
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
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { logs, stats, loading, error, refetch: fetchData };
}
