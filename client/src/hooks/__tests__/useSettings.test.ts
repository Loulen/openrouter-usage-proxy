/**
 * Tests for useSettings hook
 * Validates settings fetching, updating, and error handling
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSettings } from '../useSettings';
import { mockFetchResponse, resetFetchMocks } from '../../__tests__/test-utils';
import type { Settings } from '../../types';

/**
 * Create a mock Settings object with default values
 */
function createMockSettings(overrides?: Partial<Settings>): Settings {
  return {
    apiKeyTrackingEnabled: false,
    apiKeys: [],
    lastUpdated: '2024-01-15T10:30:00.000Z',
    ...overrides,
  };
}

describe('useSettings', () => {
  beforeEach(() => {
    resetFetchMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetFetchMocks();
  });

  describe('initial loading state', () => {
    it('starts with loading: true and null settings', () => {
      mockFetchResponse(/^\/api\/settings$/, createMockSettings());

      const { result } = renderHook(() => useSettings());

      expect(result.current.loading).toBe(true);
      expect(result.current.settings).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('successful fetch', () => {
    it('populates settings and sets loading to false', async () => {
      const mockSettings = createMockSettings({
        apiKeyTrackingEnabled: true,
        apiKeys: [
          { id: '1', label: 'Production', key: 'sk-or-xxx', createdAt: '2024-01-01T00:00:00Z' },
        ],
      });

      mockFetchResponse(/^\/api\/settings$/, mockSettings);

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.settings).toEqual(mockSettings);
      expect(result.current.settings?.apiKeyTrackingEnabled).toBe(true);
      expect(result.current.settings?.apiKeys).toHaveLength(1);
      expect(result.current.error).toBeNull();
    });

    it('handles empty apiKeys array', async () => {
      const mockSettings = createMockSettings({ apiKeys: [] });

      mockFetchResponse(/^\/api\/settings$/, mockSettings);

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.settings?.apiKeys).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  describe('error handling', () => {
    it('sets error state on fetch failure', async () => {
      mockFetchResponse(
        /^\/api\/settings$/,
        { error: 'Server error' },
        { ok: false, status: 500 }
      );

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('Failed to fetch settings');
      expect(result.current.error?.message).toContain('500');
      expect(result.current.settings).toBeNull();
    });

    it('sets error state on 403 forbidden response', async () => {
      mockFetchResponse(
        /^\/api\/settings$/,
        { error: 'Forbidden' },
        { ok: false, status: 403 }
      );

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('Failed to fetch settings');
    });
  });

  describe('updateSettings function', () => {
    it('makes PUT request with partial updates', async () => {
      const initialSettings = createMockSettings({ apiKeyTrackingEnabled: false });
      const updatedSettings = createMockSettings({ apiKeyTrackingEnabled: true });

      mockFetchResponse(/^\/api\/settings$/, initialSettings);

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.settings?.apiKeyTrackingEnabled).toBe(false);

      // Setup mock for PUT request
      resetFetchMocks();
      mockFetchResponse(/^\/api\/settings$/, updatedSettings);

      // Call updateSettings
      await act(async () => {
        await result.current.updateSettings({ apiKeyTrackingEnabled: true });
      });

      expect(result.current.settings?.apiKeyTrackingEnabled).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('updates local state after successful PUT', async () => {
      const initialSettings = createMockSettings({
        apiKeyTrackingEnabled: false,
        lastUpdated: '2024-01-01T00:00:00Z',
      });
      const updatedSettings = createMockSettings({
        apiKeyTrackingEnabled: true,
        lastUpdated: '2024-01-15T12:00:00Z',
      });

      mockFetchResponse(/^\/api\/settings$/, initialSettings);

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Setup mock for PUT request
      resetFetchMocks();
      mockFetchResponse(/^\/api\/settings$/, updatedSettings);

      await act(async () => {
        await result.current.updateSettings({ apiKeyTrackingEnabled: true });
      });

      expect(result.current.settings?.lastUpdated).toBe('2024-01-15T12:00:00Z');
    });

    it('sets error and throws on PUT failure', async () => {
      const initialSettings = createMockSettings();

      mockFetchResponse(/^\/api\/settings$/, initialSettings);

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Setup mock for failed PUT request
      resetFetchMocks();
      mockFetchResponse(
        /^\/api\/settings$/,
        { error: 'Server error' },
        { ok: false, status: 500 }
      );

      // Call updateSettings and expect it to throw
      let thrownError: Error | null = null;
      await act(async () => {
        try {
          await result.current.updateSettings({ apiKeyTrackingEnabled: true });
        } catch (err) {
          thrownError = err as Error;
        }
      });

      expect(thrownError).toBeInstanceOf(Error);
      expect(thrownError?.message).toContain('Failed to update settings');
      expect(result.current.error).toBeInstanceOf(Error);
    });

    it('clears error before making PUT request', async () => {
      // First make the initial fetch fail
      mockFetchResponse(
        /^\/api\/settings$/,
        { error: 'Server error' },
        { ok: false, status: 500 }
      );

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      // Reset and setup successful PUT response
      resetFetchMocks();
      mockFetchResponse(/^\/api\/settings$/, createMockSettings({ apiKeyTrackingEnabled: true }));

      // Call updateSettings
      await act(async () => {
        await result.current.updateSettings({ apiKeyTrackingEnabled: true });
      });

      // Error should be cleared after successful update
      expect(result.current.error).toBeNull();
    });
  });

  describe('refetch function', () => {
    it('triggers new fetch when called', async () => {
      const initialSettings = createMockSettings({ apiKeyTrackingEnabled: false });
      const refreshedSettings = createMockSettings({ apiKeyTrackingEnabled: true });

      mockFetchResponse(/^\/api\/settings$/, initialSettings);

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.settings?.apiKeyTrackingEnabled).toBe(false);

      // Reset and setup new mock for refetch
      resetFetchMocks();
      mockFetchResponse(/^\/api\/settings$/, refreshedSettings);

      // Call refetch
      await act(async () => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.settings?.apiKeyTrackingEnabled).toBe(true);
      });
    });

    it('sets loading to true during refetch', async () => {
      const mockSettings = createMockSettings();

      mockFetchResponse(/^\/api\/settings$/, mockSettings);

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Reset and setup new mock
      resetFetchMocks();
      mockFetchResponse(/^\/api\/settings$/, mockSettings);

      // Start refetch and check loading state
      act(() => {
        result.current.refetch();
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });
});
