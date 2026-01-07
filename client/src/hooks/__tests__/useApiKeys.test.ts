/**
 * Tests for useApiKeys hook
 * Validates API key management, balance fetching, and CRUD operations
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useApiKeys } from '../useApiKeys';
import { mockFetchResponse, resetFetchMocks } from '../../__tests__/test-utils';
import type { ApiKeyStats, MaskedApiKey } from '../../types';

/**
 * Create a mock ApiKeyStats object with default values
 */
function createMockApiKeyStats(overrides?: Partial<ApiKeyStats>): ApiKeyStats {
  return {
    id: '1',
    label: 'Test Key',
    openRouterLabel: 'OpenRouter Label',
    limit: 100,
    limitRemaining: 50,
    usage: 50,
    usageDaily: 5,
    usageWeekly: 20,
    usageMonthly: 50,
    isFreeTier: false,
    lastUpdated: '2024-01-15T10:30:00.000Z',
    ...overrides,
  };
}

/**
 * Create a mock MaskedApiKey object with default values
 */
function createMockMaskedApiKey(overrides?: Partial<MaskedApiKey>): MaskedApiKey {
  return {
    id: '1',
    label: 'Test Key',
    createdAt: '2024-01-15T10:30:00.000Z',
    maskedKey: 'sk-or-...xxxx',
    ...overrides,
  };
}

describe('useApiKeys', () => {
  beforeEach(() => {
    resetFetchMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetFetchMocks();
  });

  describe('initial loading state', () => {
    it('starts with loading: true and empty arrays', () => {
      // Use regex to match exact endpoints (avoid /api/api-keys matching /api/api-keys/balances)
      mockFetchResponse(/^\/api\/api-keys$/, []);
      mockFetchResponse(/^\/api\/api-keys\/balances$/, []);

      const { result } = renderHook(() => useApiKeys());

      expect(result.current.loading).toBe(true);
      expect(result.current.apiKeys).toEqual([]);
      expect(result.current.balances).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  describe('successful fetch', () => {
    it('populates apiKeys and balances arrays', async () => {
      const mockApiKeys = [
        createMockMaskedApiKey({ id: '1', label: 'Production' }),
        createMockMaskedApiKey({ id: '2', label: 'Development' }),
      ];
      const mockBalances = [
        createMockApiKeyStats({ id: '1', label: 'Production' }),
        createMockApiKeyStats({ id: '2', label: 'Development' }),
      ];

      mockFetchResponse(/^\/api\/api-keys$/, mockApiKeys);
      mockFetchResponse(/^\/api\/api-keys\/balances$/, mockBalances);

      const { result } = renderHook(() => useApiKeys());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.apiKeys).toHaveLength(2);
      expect(result.current.apiKeys[0].label).toBe('Production');
      expect(result.current.balances).toHaveLength(2);
      expect(result.current.error).toBeNull();
    });

    it('handles empty API keys list', async () => {
      mockFetchResponse(/^\/api\/api-keys$/, []);
      mockFetchResponse(/^\/api\/api-keys\/balances$/, []);

      const { result } = renderHook(() => useApiKeys());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.apiKeys).toEqual([]);
      expect(result.current.balances).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  describe('error handling', () => {
    it('sets error state on API keys fetch failure', async () => {
      mockFetchResponse(
        /^\/api\/api-keys$/,
        { error: 'Server error' },
        { ok: false, status: 500 }
      );
      mockFetchResponse(/^\/api\/api-keys\/balances$/, []);

      const { result } = renderHook(() => useApiKeys());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('Failed to fetch API keys');
    });

    it('sets error state on balances fetch failure', async () => {
      mockFetchResponse(/^\/api\/api-keys$/, []);
      mockFetchResponse(
        /^\/api\/api-keys\/balances$/,
        { error: 'Server error' },
        { ok: false, status: 500 }
      );

      const { result } = renderHook(() => useApiKeys());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('Failed to fetch balances');
    });
  });

  describe('CRUD operations', () => {
    describe('addApiKey', () => {
      it('creates new API key and refreshes data', async () => {
        const initialApiKeys: MaskedApiKey[] = [];
        const updatedApiKeys = [createMockMaskedApiKey({ id: '1', label: 'New Key' })];
        const updatedBalances = [createMockApiKeyStats({ id: '1', label: 'New Key' })];

        mockFetchResponse(/^\/api\/api-keys$/, initialApiKeys);
        mockFetchResponse(/^\/api\/api-keys\/balances$/, []);

        const { result } = renderHook(() => useApiKeys());

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.apiKeys).toHaveLength(0);

        // Setup mocks for POST and subsequent refetches
        resetFetchMocks();
        mockFetchResponse(/^\/api\/api-keys$/, updatedApiKeys);
        mockFetchResponse(/^\/api\/api-keys\/balances$/, updatedBalances);

        await act(async () => {
          await result.current.addApiKey('New Key', 'sk-or-test-key');
        });

        await waitFor(() => {
          expect(result.current.apiKeys).toHaveLength(1);
        });

        expect(result.current.apiKeys[0].label).toBe('New Key');
      });

      it('sets error and throws on POST failure', async () => {
        mockFetchResponse(/^\/api\/api-keys$/, []);
        mockFetchResponse(/^\/api\/api-keys\/balances$/, []);

        const { result } = renderHook(() => useApiKeys());

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        // Setup mock for failed POST request
        resetFetchMocks();
        mockFetchResponse(
          /^\/api\/api-keys$/,
          { message: 'Invalid API key' },
          { ok: false, status: 400 }
        );

        let thrownError: Error | null = null;
        await act(async () => {
          try {
            await result.current.addApiKey('Test', 'invalid-key');
          } catch (err) {
            thrownError = err as Error;
          }
        });

        expect(thrownError).toBeInstanceOf(Error);
        expect(thrownError?.message).toContain('Invalid API key');
        expect(result.current.error).toBeInstanceOf(Error);
      });
    });

    describe('updateApiKey', () => {
      it('updates existing API key and refreshes data', async () => {
        const initialApiKeys = [createMockMaskedApiKey({ id: '1', label: 'Old Label' })];
        const updatedApiKeys = [createMockMaskedApiKey({ id: '1', label: 'New Label' })];
        const balances = [createMockApiKeyStats({ id: '1' })];

        mockFetchResponse(/^\/api\/api-keys$/, initialApiKeys);
        mockFetchResponse(/^\/api\/api-keys\/balances$/, balances);

        const { result } = renderHook(() => useApiKeys());

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.apiKeys[0].label).toBe('Old Label');

        // Setup mocks for PUT and subsequent refetches
        resetFetchMocks();
        mockFetchResponse(/^\/api\/api-keys\/1$/, { success: true });
        mockFetchResponse(/^\/api\/api-keys$/, updatedApiKeys);
        mockFetchResponse(/^\/api\/api-keys\/balances$/, balances);

        await act(async () => {
          await result.current.updateApiKey('1', { label: 'New Label' });
        });

        await waitFor(() => {
          expect(result.current.apiKeys[0].label).toBe('New Label');
        });
      });

      it('sets error and throws on PUT failure', async () => {
        const apiKeys = [createMockMaskedApiKey({ id: '1' })];
        const balances = [createMockApiKeyStats({ id: '1' })];

        mockFetchResponse(/^\/api\/api-keys$/, apiKeys);
        mockFetchResponse(/^\/api\/api-keys\/balances$/, balances);

        const { result } = renderHook(() => useApiKeys());

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        // Setup mock for failed PUT request
        resetFetchMocks();
        mockFetchResponse(
          /^\/api\/api-keys\/1$/,
          { message: 'Not found' },
          { ok: false, status: 404 }
        );

        let thrownError: Error | null = null;
        await act(async () => {
          try {
            await result.current.updateApiKey('1', { label: 'Updated' });
          } catch (err) {
            thrownError = err as Error;
          }
        });

        expect(thrownError).toBeInstanceOf(Error);
        expect(result.current.error).toBeInstanceOf(Error);
      });
    });

    describe('deleteApiKey', () => {
      it('deletes API key and refreshes data', async () => {
        const initialApiKeys = [
          createMockMaskedApiKey({ id: '1', label: 'Key 1' }),
          createMockMaskedApiKey({ id: '2', label: 'Key 2' }),
        ];
        const updatedApiKeys = [createMockMaskedApiKey({ id: '2', label: 'Key 2' })];
        const initialBalances = [
          createMockApiKeyStats({ id: '1' }),
          createMockApiKeyStats({ id: '2' }),
        ];
        const updatedBalances = [createMockApiKeyStats({ id: '2' })];

        mockFetchResponse(/^\/api\/api-keys$/, initialApiKeys);
        mockFetchResponse(/^\/api\/api-keys\/balances$/, initialBalances);

        const { result } = renderHook(() => useApiKeys());

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.apiKeys).toHaveLength(2);

        // Setup mocks for DELETE and subsequent refetches
        resetFetchMocks();
        mockFetchResponse(/^\/api\/api-keys\/1$/, { success: true });
        mockFetchResponse(/^\/api\/api-keys$/, updatedApiKeys);
        mockFetchResponse(/^\/api\/api-keys\/balances$/, updatedBalances);

        await act(async () => {
          await result.current.deleteApiKey('1');
        });

        await waitFor(() => {
          expect(result.current.apiKeys).toHaveLength(1);
        });

        expect(result.current.apiKeys[0].label).toBe('Key 2');
      });

      it('sets error and throws on DELETE failure', async () => {
        const apiKeys = [createMockMaskedApiKey({ id: '1' })];
        const balances = [createMockApiKeyStats({ id: '1' })];

        mockFetchResponse(/^\/api\/api-keys$/, apiKeys);
        mockFetchResponse(/^\/api\/api-keys\/balances$/, balances);

        const { result } = renderHook(() => useApiKeys());

        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        // Setup mock for failed DELETE request
        resetFetchMocks();
        mockFetchResponse(
          /^\/api\/api-keys\/1$/,
          { message: 'Cannot delete' },
          { ok: false, status: 403 }
        );

        let thrownError: Error | null = null;
        await act(async () => {
          try {
            await result.current.deleteApiKey('1');
          } catch (err) {
            thrownError = err as Error;
          }
        });

        expect(thrownError).toBeInstanceOf(Error);
        expect(result.current.error).toBeInstanceOf(Error);
      });
    });
  });

  describe('refresh functions', () => {
    it('refreshBalances triggers new balance fetch', async () => {
      const apiKeys = [createMockMaskedApiKey({ id: '1' })];
      const initialBalances = [createMockApiKeyStats({ id: '1', usage: 10 })];
      const updatedBalances = [createMockApiKeyStats({ id: '1', usage: 20 })];

      mockFetchResponse(/^\/api\/api-keys$/, apiKeys);
      mockFetchResponse(/^\/api\/api-keys\/balances$/, initialBalances);

      const { result } = renderHook(() => useApiKeys());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.balances[0].usage).toBe(10);

      // Setup mock for refresh
      resetFetchMocks();
      mockFetchResponse(/^\/api\/api-keys\/balances$/, updatedBalances);

      await act(async () => {
        result.current.refreshBalances();
      });

      await waitFor(() => {
        expect(result.current.balances[0].usage).toBe(20);
      });
    });

    it('refreshApiKeys triggers new API keys fetch', async () => {
      const initialApiKeys = [createMockMaskedApiKey({ id: '1', label: 'Old' })];
      const updatedApiKeys = [createMockMaskedApiKey({ id: '1', label: 'Updated' })];
      const balances = [createMockApiKeyStats({ id: '1' })];

      mockFetchResponse(/^\/api\/api-keys$/, initialApiKeys);
      mockFetchResponse(/^\/api\/api-keys\/balances$/, balances);

      const { result } = renderHook(() => useApiKeys());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.apiKeys[0].label).toBe('Old');

      // Setup mock for refresh
      resetFetchMocks();
      mockFetchResponse(/^\/api\/api-keys$/, updatedApiKeys);

      await act(async () => {
        result.current.refreshApiKeys();
      });

      await waitFor(() => {
        expect(result.current.apiKeys[0].label).toBe('Updated');
      });
    });
  });

  describe('hash map fetching', () => {
    // Note: The useApiKeys hook doesn't directly fetch hash-map, but the useLogs hook does.
    // This test verifies that the hook properly handles the API key data which is used
    // for hash map resolution elsewhere in the application.
    it('provides API keys data that can be used for hash map resolution', async () => {
      const apiKeys = [
        createMockMaskedApiKey({ id: '1', label: 'Production Key' }),
        createMockMaskedApiKey({ id: '2', label: 'Development Key' }),
      ];
      const balances = [
        createMockApiKeyStats({ id: '1', label: 'Production Key' }),
        createMockApiKeyStats({ id: '2', label: 'Development Key' }),
      ];

      mockFetchResponse(/^\/api\/api-keys$/, apiKeys);
      mockFetchResponse(/^\/api\/api-keys\/balances$/, balances);

      const { result } = renderHook(() => useApiKeys());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify the hook returns data structure that supports label lookup
      expect(result.current.apiKeys).toHaveLength(2);
      expect(result.current.apiKeys.find((k) => k.id === '1')?.label).toBe('Production Key');
      expect(result.current.apiKeys.find((k) => k.id === '2')?.label).toBe('Development Key');
    });
  });
});
