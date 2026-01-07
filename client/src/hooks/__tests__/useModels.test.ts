/**
 * Tests for useModels hook
 * Validates model list fetching and error handling
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useModels } from '../useModels';
import { mockFetchResponse, resetFetchMocks } from '../../__tests__/test-utils';

describe('useModels', () => {
  beforeEach(() => {
    resetFetchMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetFetchMocks();
  });

  describe('initial loading state', () => {
    it('starts with loading: true and empty models array', () => {
      mockFetchResponse(/^\/api\/logs\/models$/, []);

      const { result } = renderHook(() => useModels());

      expect(result.current.loading).toBe(true);
      expect(result.current.models).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  describe('successful fetch', () => {
    it('populates models array and sets loading to false', async () => {
      const mockModels = ['anthropic/claude-3-opus', 'openai/gpt-4', 'meta/llama-3'];

      mockFetchResponse(/^\/api\/logs\/models$/, mockModels);

      const { result } = renderHook(() => useModels());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.models).toEqual(mockModels);
      expect(result.current.models).toHaveLength(3);
      expect(result.current.error).toBeNull();
    });

    it('handles empty models array', async () => {
      mockFetchResponse(/^\/api\/logs\/models$/, []);

      const { result } = renderHook(() => useModels());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.models).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  describe('error handling', () => {
    it('sets error state on fetch failure', async () => {
      mockFetchResponse(
        /^\/api\/logs\/models$/,
        { error: 'Server error' },
        { ok: false, status: 500 }
      );

      const { result } = renderHook(() => useModels());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('Failed to fetch models');
      expect(result.current.error?.message).toContain('500');
      expect(result.current.models).toEqual([]);
    });

    it('sets error state on 404 response', async () => {
      mockFetchResponse(
        /^\/api\/logs\/models$/,
        { error: 'Not found' },
        { ok: false, status: 404 }
      );

      const { result } = renderHook(() => useModels());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('Failed to fetch models');
    });
  });

  describe('refetch function', () => {
    it('triggers new fetch when called', async () => {
      const initialModels = ['model-a', 'model-b'];
      const updatedModels = ['model-a', 'model-b', 'model-c'];

      mockFetchResponse(/^\/api\/logs\/models$/, initialModels);

      const { result } = renderHook(() => useModels());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.models).toHaveLength(2);

      // Reset and setup new mock for refetch
      resetFetchMocks();
      mockFetchResponse(/^\/api\/logs\/models$/, updatedModels);

      // Call refetch
      await act(async () => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.models).toHaveLength(3);
      });

      expect(result.current.models).toContain('model-c');
    });

    it('sets loading to true during refetch', async () => {
      const mockModels = ['model-a'];

      mockFetchResponse(/^\/api\/logs\/models$/, mockModels);

      const { result } = renderHook(() => useModels());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Reset and setup new mock
      resetFetchMocks();
      mockFetchResponse(/^\/api\/logs\/models$/, mockModels);

      // Start refetch and check loading state
      act(() => {
        result.current.refetch();
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('clears previous error on successful refetch', async () => {
      // First fetch fails
      mockFetchResponse(
        /^\/api\/logs\/models$/,
        { error: 'Server error' },
        { ok: false, status: 500 }
      );

      const { result } = renderHook(() => useModels());

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      // Reset and setup successful response for refetch
      resetFetchMocks();
      mockFetchResponse(/^\/api\/logs\/models$/, ['model-a']);

      // Call refetch
      await act(async () => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeNull();
      expect(result.current.models).toEqual(['model-a']);
    });
  });
});
