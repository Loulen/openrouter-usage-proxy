import { useState, useEffect, useCallback } from 'react';
import type { UseModelsState } from '../types';

/**
 * Custom hook for fetching available models from the API
 * Fetches the /api/logs/models endpoint to get distinct model names
 *
 * @returns {UseModelsState & { refetch: () => void }} - Models array, loading state, error, and refetch function
 */
export function useModels(): UseModelsState & { refetch: () => void } {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/logs/models');

      // Check for HTTP errors
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
      }

      // Parse JSON response
      const modelsData: string[] = await response.json();

      setModels(modelsData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { models, loading, error, refetch: fetchData };
}
