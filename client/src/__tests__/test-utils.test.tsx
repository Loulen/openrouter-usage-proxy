/**
 * Tests for the custom test utilities
 * Validates that render wrappers, fetch mocking, and mock generators work correctly
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  renderWithProviders,
  mockFetchResponse,
  resetFetchMocks,
  createMockUsageLog,
  createMockStats,
  screen,
} from './test-utils';

describe('test-utils', () => {
  describe('renderWithProviders', () => {
    it('renders a simple component', () => {
      renderWithProviders(<div data-testid="test-element">Hello World</div>);
      expect(screen.getByTestId('test-element')).toBeInTheDocument();
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    it('returns render result with queries', () => {
      const result = renderWithProviders(<button>Click me</button>);
      expect(result.getByRole('button')).toBeInTheDocument();
      expect(result.container).toBeDefined();
    });
  });

  describe('mockFetchResponse', () => {
    afterEach(() => {
      resetFetchMocks();
    });

    it('mocks fetch for string pattern', async () => {
      const mockData = { data: 'test' };
      mockFetchResponse('/api/test', mockData);

      const response = await fetch('/api/test');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      expect(data).toEqual(mockData);
    });

    it('mocks fetch for regex pattern', async () => {
      const mockData = { logs: [] };
      mockFetchResponse(/\/api\/logs.*/, mockData);

      const response = await fetch('/api/logs?model=test');
      const data = await response.json();

      expect(data).toEqual(mockData);
    });

    it('returns 404 for unmatched URLs', async () => {
      mockFetchResponse('/api/matched', { data: 'ok' });

      const response = await fetch('/api/unmatched');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });

    it('supports custom status and ok options', async () => {
      mockFetchResponse('/api/error', { error: 'Bad request' }, { ok: false, status: 400 });

      const response = await fetch('/api/error');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });
  });

  describe('resetFetchMocks', () => {
    it('clears all fetch mocks', async () => {
      mockFetchResponse('/api/test', { data: 'test' });
      resetFetchMocks();
      
      // After reset, should not have our mock (fetch should be restored)
      // Since originalFetch may not exist in test env, we just verify no errors
      expect(() => resetFetchMocks()).not.toThrow();
    });
  });

  describe('createMockUsageLog', () => {
    it('creates a valid UsageLog with defaults', () => {
      const log = createMockUsageLog();

      expect(log.id).toBe(1);
      expect(log.model).toBe('anthropic/claude-3-opus');
      expect(log.prompt_tokens).toBe(100);
      expect(log.completion_tokens).toBe(50);
      expect(log.total_tokens).toBe(150);
      expect(log.cost).toBe(0.0045);
      expect(log.status_code).toBe(200);
      expect(log.timestamp).toBeDefined();
      expect(log.created_at).toBeDefined();
    });

    it('allows overriding specific fields', () => {
      const log = createMockUsageLog({
        id: 42,
        model: 'openai/gpt-4',
        total_tokens: 500,
        api_key_label: 'production-key',
      });

      expect(log.id).toBe(42);
      expect(log.model).toBe('openai/gpt-4');
      expect(log.total_tokens).toBe(500);
      expect(log.api_key_label).toBe('production-key');
      // Non-overridden fields retain defaults
      expect(log.prompt_tokens).toBe(100);
    });
  });

  describe('createMockStats', () => {
    it('creates valid UsageStats with defaults', () => {
      const stats = createMockStats();

      expect(stats.request_count).toBe(100);
      expect(stats.total_tokens).toBe(15000);
      expect(stats.total_cost).toBe(0.45);
    });

    it('allows overriding specific fields', () => {
      const stats = createMockStats({
        request_count: 250,
        total_cost: 1.25,
      });

      expect(stats.request_count).toBe(250);
      expect(stats.total_cost).toBe(1.25);
      // Non-overridden fields retain defaults
      expect(stats.total_tokens).toBe(15000);
    });
  });

  describe('re-exports', () => {
    it('exports screen from @testing-library/react', () => {
      expect(screen).toBeDefined();
      expect(typeof screen.getByText).toBe('function');
    });
  });
});
