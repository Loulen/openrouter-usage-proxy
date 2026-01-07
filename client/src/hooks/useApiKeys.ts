import { useState, useEffect, useCallback } from 'react';
import type {
  ApiKeyStats,
  ApiKeyInput,
  ApiKeyUpdateInput,
  UseApiKeysState,
  MaskedApiKey,
} from '../types';

/**
 * Custom hook for managing API keys and fetching balance information
 * Provides CRUD operations for API keys and balance fetching from OpenRouter
 *
 * @returns {UseApiKeysState & {
 *   apiKeys: MaskedApiKey[],
 *   addApiKey: (label: string, key: string) => Promise<void>,
 *   updateApiKey: (id: string, updates: ApiKeyUpdateInput) => Promise<void>,
 *   deleteApiKey: (id: string) => Promise<void>,
 *   refreshBalances: () => void,
 *   refreshApiKeys: () => void
 * }}
 * - balances: Array of API key statistics/balances from OpenRouter
 * - apiKeys: Array of configured API keys (with masked key values)
 * - loading: Whether data is currently loading
 * - error: Error that occurred during fetch/update
 * - addApiKey: Function to create a new API key
 * - updateApiKey: Function to update an existing API key
 * - deleteApiKey: Function to delete an API key
 * - refreshBalances: Function to manually refresh balance data
 * - refreshApiKeys: Function to manually refresh API key list
 */
export function useApiKeys(): UseApiKeysState & {
  apiKeys: MaskedApiKey[];
  addApiKey: (label: string, key: string) => Promise<void>;
  updateApiKey: (id: string, updates: ApiKeyUpdateInput) => Promise<void>;
  deleteApiKey: (id: string) => Promise<void>;
  refreshBalances: () => void;
  refreshApiKeys: () => void;
} {
  const [balances, setBalances] = useState<ApiKeyStats[]>([]);
  const [apiKeys, setApiKeys] = useState<MaskedApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetches the list of configured API keys (with masked key values)
   */
  const fetchApiKeys = useCallback(async () => {
    try {
      const response = await fetch('/api/api-keys');

      if (!response.ok) {
        throw new Error(`Failed to fetch API keys: ${response.status} ${response.statusText}`);
      }

      const data: MaskedApiKey[] = await response.json();
      setApiKeys(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    }
  }, []);

  /**
   * Fetches balance information for all configured API keys from OpenRouter
   */
  const fetchBalances = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/api-keys/balances');

      if (!response.ok) {
        throw new Error(`Failed to fetch balances: ${response.status} ${response.statusText}`);
      }

      const data: ApiKeyStats[] = await response.json();
      setBalances(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Creates a new API key configuration
   *
   * @param label - User-friendly name for the API key
   * @param key - OpenRouter API key (sk-or-...)
   * @throws Error if the creation request fails
   */
  const addApiKey = useCallback(async (label: string, key: string): Promise<void> => {
    setError(null);

    try {
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ label, key } as ApiKeyInput),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.message || `Failed to add API key: ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
      }

      // Refresh both API keys list and balances after adding
      await fetchApiKeys();
      await fetchBalances();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    }
  }, [fetchApiKeys, fetchBalances]);

  /**
   * Updates an existing API key configuration
   *
   * @param id - The ID of the API key to update
   * @param updates - Object containing the fields to update (label, key)
   * @throws Error if the update request fails
   */
  const updateApiKey = useCallback(async (id: string, updates: ApiKeyUpdateInput): Promise<void> => {
    setError(null);

    try {
      const response = await fetch(`/api/api-keys/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.message || `Failed to update API key: ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
      }

      // Refresh both API keys list and balances after updating
      await fetchApiKeys();
      await fetchBalances();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    }
  }, [fetchApiKeys, fetchBalances]);

  /**
   * Deletes an API key configuration
   *
   * @param id - The ID of the API key to delete
   * @throws Error if the delete request fails
   */
  const deleteApiKey = useCallback(async (id: string): Promise<void> => {
    setError(null);

    try {
      const response = await fetch(`/api/api-keys/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.message || `Failed to delete API key: ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
      }

      // Refresh both API keys list and balances after deleting
      await fetchApiKeys();
      await fetchBalances();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    }
  }, [fetchApiKeys, fetchBalances]);

  // Initial fetch of API keys and balances
  useEffect(() => {
    const initFetch = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch both API keys and balances in parallel
        await Promise.all([fetchApiKeys(), fetchBalances()]);
      } catch {
        // Errors are already handled in individual fetch functions
      } finally {
        setLoading(false);
      }
    };

    initFetch();
  }, [fetchApiKeys, fetchBalances]);

  return {
    balances,
    apiKeys,
    loading,
    error,
    addApiKey,
    updateApiKey,
    deleteApiKey,
    refreshBalances: fetchBalances,
    refreshApiKeys: fetchApiKeys,
  };
}
