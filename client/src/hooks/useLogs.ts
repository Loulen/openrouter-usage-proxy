import { useState, useEffect, useCallback } from 'react';
import type { UsageLog, UsageStats, UseLogsState, FilterParams } from '../types';

/**
 * Hash map type for API key hash to label mapping
 * Key is the SHA-256 hash, value is the user-friendly label
 */
type ApiKeyHashMap = Record<string, string>;

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
  if (filters.apiKeyId) {
    params.append('apiKeyId', filters.apiKeyId);
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Enriches usage logs with API key labels by looking up hashes in the hash map
 * Assigns "unknown" for null hashes or unmatched hashes
 *
 * @param logs - Array of usage logs from the API
 * @param hashMap - Mapping of API key hashes to labels
 * @returns Logs enriched with api_key_label property
 */
function enrichLogsWithLabels(logs: UsageLog[], hashMap: ApiKeyHashMap): UsageLog[] {
  return logs.map((log) => ({
    ...log,
    api_key_label: log.api_key_hash ? (hashMap[log.api_key_hash] ?? 'unknown') : 'unknown',
  }));
}

/**
 * Custom hook for fetching usage logs and statistics from the API
 * Fetches both /api/logs and /api/logs/stats endpoints
 * Also fetches API key hash map and enriches logs with labels
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

      // Fetch logs, stats, and hash map in parallel for better performance
      const [logsResponse, statsResponse, hashMapResponse] = await Promise.all([
        fetch(`/api/logs${queryString}`),
        fetch(`/api/logs/stats${queryString}`),
        fetch('/api/api-keys/hash-map'),
      ]);

      // Check for HTTP errors on logs and stats (required endpoints)
      if (!logsResponse.ok) {
        throw new Error(`Failed to fetch logs: ${logsResponse.status} ${logsResponse.statusText}`);
      }
      if (!statsResponse.ok) {
        throw new Error(`Failed to fetch stats: ${statsResponse.status} ${statsResponse.statusText}`);
      }

      // Parse JSON responses
      const logsData: UsageLog[] = await logsResponse.json();
      const statsData: UsageStats = await statsResponse.json();

      // Parse hash map response - don't fail if hash map fetch fails
      // This allows logs display to work even if API key tracking is unavailable
      let hashMap: ApiKeyHashMap = {};
      if (hashMapResponse.ok) {
        try {
          hashMap = await hashMapResponse.json();
        } catch {
          // Silently ignore JSON parse errors for hash map
        }
      }

      // Enrich logs with API key labels
      const enrichedLogs = enrichLogsWithLabels(logsData, hashMap);

      setLogs(enrichedLogs);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [filters?.model, filters?.from, filters?.to, filters?.apiKeyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { logs, stats, loading, error, refetch: fetchData };
}
