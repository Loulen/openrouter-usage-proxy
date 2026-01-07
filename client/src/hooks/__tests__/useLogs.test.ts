/**
 * Tests for useLogs hook
 * Validates log fetching, filtering, and error handling
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useLogs } from '../useLogs';
import {
  mockFetchResponse,
  resetFetchMocks,
  createMockUsageLog,
  createMockStats,
} from '../../__tests__/test-utils';

describe('useLogs', () => {
  beforeEach(() => {
    resetFetchMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetFetchMocks();
  });

  describe('initial loading state', () => {
    it('starts with loading: true and empty logs', () => {
      // Use regex to match exact endpoints (avoid /api/logs matching /api/logs/stats)
      mockFetchResponse(/^\/api\/logs$/, []);
      mockFetchResponse(/^\/api\/logs\/stats$/, { request_count: 0, total_tokens: 0, total_cost: 0 });
      mockFetchResponse(/^\/api\/api-keys\/hash-map$/, {});

      const { result } = renderHook(() => useLogs());

      // Initial state should show loading
      expect(result.current.loading).toBe(true);
      expect(result.current.logs).toEqual([]);
      expect(result.current.stats).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('successful fetch', () => {
    it('populates logs and stats, sets loading to false', async () => {
      const mockLogs = [
        createMockUsageLog({ id: 1, model: 'anthropic/claude-3-opus', api_key_hash: 'hash1' }),
        createMockUsageLog({ id: 2, model: 'openai/gpt-4', api_key_hash: 'hash2' }),
      ];
      const mockStats = createMockStats({ request_count: 2, total_tokens: 300, total_cost: 0.01 });
      const mockHashMap = { hash1: 'Production Key', hash2: 'Dev Key' };

      mockFetchResponse(/^\/api\/logs$/, mockLogs);
      mockFetchResponse(/^\/api\/logs\/stats$/, mockStats);
      mockFetchResponse(/^\/api\/api-keys\/hash-map$/, mockHashMap);

      const { result } = renderHook(() => useLogs());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.logs).toHaveLength(2);
      expect(result.current.logs[0].api_key_label).toBe('Production Key');
      expect(result.current.logs[1].api_key_label).toBe('Dev Key');
      expect(result.current.stats).toEqual(mockStats);
      expect(result.current.error).toBeNull();
    });

    it('assigns "unknown" label for null api_key_hash', async () => {
      const mockLogs = [
        createMockUsageLog({ id: 1, api_key_hash: null }),
      ];
      const mockStats = createMockStats();

      mockFetchResponse(/^\/api\/logs$/, mockLogs);
      mockFetchResponse(/^\/api\/logs\/stats$/, mockStats);
      mockFetchResponse(/^\/api\/api-keys\/hash-map$/, {});

      const { result } = renderHook(() => useLogs());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.logs[0].api_key_label).toBe('unknown');
    });

    it('assigns "unknown" label for unmatched hash', async () => {
      const mockLogs = [
        createMockUsageLog({ id: 1, api_key_hash: 'unmatchedHash' }),
      ];
      const mockStats = createMockStats();

      mockFetchResponse(/^\/api\/logs$/, mockLogs);
      mockFetchResponse(/^\/api\/logs\/stats$/, mockStats);
      mockFetchResponse(/^\/api\/api-keys\/hash-map$/, { differentHash: 'Some Key' });

      const { result } = renderHook(() => useLogs());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.logs[0].api_key_label).toBe('unknown');
    });
  });

  describe('error handling', () => {
    it('sets error state on logs fetch failure', async () => {
      mockFetchResponse(/^\/api\/logs$/, { error: 'Server error' }, { ok: false, status: 500 });
      mockFetchResponse(/^\/api\/logs\/stats$/, createMockStats());
      mockFetchResponse(/^\/api\/api-keys\/hash-map$/, {});

      const { result } = renderHook(() => useLogs());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('Failed to fetch logs');
      expect(result.current.logs).toEqual([]);
    });

    it('sets error state on stats fetch failure', async () => {
      mockFetchResponse(/^\/api\/logs$/, [createMockUsageLog()]);
      mockFetchResponse(/^\/api\/logs\/stats$/, { error: 'Server error' }, { ok: false, status: 500 });
      mockFetchResponse(/^\/api\/api-keys\/hash-map$/, {});

      const { result } = renderHook(() => useLogs());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('Failed to fetch stats');
    });

    it('continues successfully when hash-map fetch fails', async () => {
      const mockLogs = [createMockUsageLog({ id: 1, api_key_hash: 'hash1' })];
      const mockStats = createMockStats();

      mockFetchResponse(/^\/api\/logs$/, mockLogs);
      mockFetchResponse(/^\/api\/logs\/stats$/, mockStats);
      mockFetchResponse(/^\/api\/api-keys\/hash-map$/, { error: 'Not found' }, { ok: false, status: 404 });

      const { result } = renderHook(() => useLogs());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should not error - hash map failure is gracefully handled
      expect(result.current.error).toBeNull();
      expect(result.current.logs).toHaveLength(1);
      expect(result.current.logs[0].api_key_label).toBe('unknown');
    });
  });

  describe('filter changes', () => {
    it('re-fetches when filters change', async () => {
      const initialLogs = [createMockUsageLog({ id: 1, model: 'model-a' })];
      const filteredLogs = [createMockUsageLog({ id: 2, model: 'model-b' })];
      const mockStats = createMockStats();

      mockFetchResponse(/^\/api\/logs$/, initialLogs);
      mockFetchResponse(/^\/api\/logs\/stats$/, mockStats);
      mockFetchResponse(/^\/api\/api-keys\/hash-map$/, {});

      const { result, rerender } = renderHook(
        ({ filters }) => useLogs(filters),
        { initialProps: { filters: undefined } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.logs[0].model).toBe('model-a');

      // Reset and setup new mocks for the filtered response
      resetFetchMocks();
      mockFetchResponse(/^\/api\/logs\?model=model-b$/, filteredLogs);
      mockFetchResponse(/^\/api\/logs\/stats\?model=model-b$/, mockStats);
      mockFetchResponse(/^\/api\/api-keys\/hash-map$/, {});

      // Trigger re-render with new filters
      rerender({ filters: { model: 'model-b' } });

      await waitFor(() => {
        expect(result.current.logs[0]?.model).toBe('model-b');
      });
    });

    it('includes from and to filters in query string', async () => {
      const mockLogs = [createMockUsageLog()];
      const mockStats = createMockStats();

      // Use regex to match query parameters
      mockFetchResponse(/^\/api\/logs\?.*from=2024-01-01.*to=2024-01-31/, mockLogs);
      mockFetchResponse(/^\/api\/logs\/stats\?.*from=2024-01-01.*to=2024-01-31/, mockStats);
      mockFetchResponse(/^\/api\/api-keys\/hash-map$/, {});

      const { result } = renderHook(() => useLogs({ from: '2024-01-01', to: '2024-01-31' }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.logs).toHaveLength(1);
      expect(result.current.error).toBeNull();
    });
  });

  describe('refetch function', () => {
    it('triggers new fetch when called', async () => {
      const initialLogs = [createMockUsageLog({ id: 1 })];
      const updatedLogs = [createMockUsageLog({ id: 1 }), createMockUsageLog({ id: 2 })];
      const mockStats = createMockStats();

      mockFetchResponse(/^\/api\/logs$/, initialLogs);
      mockFetchResponse(/^\/api\/logs\/stats$/, mockStats);
      mockFetchResponse(/^\/api\/api-keys\/hash-map$/, {});

      const { result } = renderHook(() => useLogs());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.logs).toHaveLength(1);

      // Reset and setup new mocks for the refetch
      resetFetchMocks();
      mockFetchResponse(/^\/api\/logs$/, updatedLogs);
      mockFetchResponse(/^\/api\/logs\/stats$/, mockStats);
      mockFetchResponse(/^\/api\/api-keys\/hash-map$/, {});

      // Call refetch
      await act(async () => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.logs).toHaveLength(2);
      });
    });

    it('sets loading to true during refetch', async () => {
      const mockLogs = [createMockUsageLog()];
      const mockStats = createMockStats();

      mockFetchResponse(/^\/api\/logs$/, mockLogs);
      mockFetchResponse(/^\/api\/logs\/stats$/, mockStats);
      mockFetchResponse(/^\/api\/api-keys\/hash-map$/, {});

      const { result } = renderHook(() => useLogs());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Reset and setup new mocks
      resetFetchMocks();
      mockFetchResponse(/^\/api\/logs$/, mockLogs);
      mockFetchResponse(/^\/api\/logs\/stats$/, mockStats);
      mockFetchResponse(/^\/api\/api-keys\/hash-map$/, {});

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
