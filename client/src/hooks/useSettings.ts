import { useState, useEffect, useCallback } from 'react';
import type { Settings, UseSettingsState } from '../types';

/**
 * Custom hook for fetching and updating application settings
 * Fetches from /api/settings endpoint and provides update functionality
 *
 * @returns {UseSettingsState & { updateSettings: (updates: Partial<Settings>) => Promise<void>, refetch: () => void }}
 * - settings: Current application settings
 * - loading: Whether data is currently loading
 * - error: Error that occurred during fetch/update
 * - updateSettings: Function to update settings (partial updates supported)
 * - refetch: Function to manually refresh settings
 */
export function useSettings(): UseSettingsState & {
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  refetch: () => void;
} {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/settings');

      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.status} ${response.statusText}`);
      }

      const data: Settings = await response.json();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Updates application settings with partial updates
   * Merges the provided updates with existing settings on the server
   *
   * @param updates - Partial settings object to merge with current settings
   * @throws Error if the update request fails
   */
  const updateSettings = useCallback(async (updates: Partial<Settings>): Promise<void> => {
    setError(null);

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update settings: ${response.status} ${response.statusText}`);
      }

      const data: Settings = await response.json();
      setSettings(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    error,
    updateSettings,
    refetch: fetchSettings,
  };
}
