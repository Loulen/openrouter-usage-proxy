/**
 * Custom test utilities for the OpenRouter Usage Proxy client
 * Provides render wrappers, fetch mocking, and mock data generators
 */
import { render, RenderOptions } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import type { UsageLog, UsageStats } from '../types/index';

// Store for fetch mock handlers
interface FetchMockHandler {
  pattern: string | RegExp;
  response: unknown;
  options: { ok: boolean; status: number };
}

const fetchMockHandlers: FetchMockHandler[] = [];

// Store original fetch reference
let originalFetch: typeof global.fetch | null = null;

/**
 * Wrapper component that provides necessary context providers
 * Currently a pass-through wrapper, but can be extended with providers as needed
 */
function AllProviders({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/**
 * Custom render function that wraps components with necessary providers
 * @param ui - React element to render
 * @param options - Additional render options
 * @returns Render result with all queries
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): ReturnType<typeof render> {
  return render(ui, { wrapper: AllProviders, ...options });
}

/**
 * Mock fetch response for a specific endpoint pattern
 * @param urlPattern - URL string or regex pattern to match
 * @param response - Response data to return
 * @param options - Optional response settings (ok, status)
 */
export function mockFetchResponse(
  urlPattern: string | RegExp,
  response: unknown,
  options?: { ok?: boolean; status?: number }
): void {
  // Save original fetch on first mock
  if (originalFetch === null) {
    originalFetch = global.fetch;
  }

  const handler: FetchMockHandler = {
    pattern: urlPattern,
    response,
    options: {
      ok: options?.ok ?? true,
      status: options?.status ?? 200,
    },
  };

  fetchMockHandlers.push(handler);

  // Override global fetch with mock implementation
  global.fetch = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();

    // Find matching handler
    const matchedHandler = fetchMockHandlers.find((h) => {
      if (typeof h.pattern === 'string') {
        return url.includes(h.pattern);
      }
      return h.pattern.test(url);
    });

    if (matchedHandler) {
      return Promise.resolve({
        ok: matchedHandler.options.ok,
        status: matchedHandler.options.status,
        json: () => Promise.resolve(matchedHandler.response),
        text: () => Promise.resolve(JSON.stringify(matchedHandler.response)),
        headers: new Headers({ 'Content-Type': 'application/json' }),
      } as Response);
    }

    // No match - return 404
    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: true, message: 'Not found' }),
      text: () => Promise.resolve('Not found'),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    } as Response);
  }) as typeof fetch;
}

/**
 * Reset all fetch mocks and restore original fetch
 */
export function resetFetchMocks(): void {
  fetchMockHandlers.length = 0;
  if (originalFetch !== null) {
    global.fetch = originalFetch;
    originalFetch = null;
  }
}

/**
 * Create a mock UsageLog object with default values
 * @param overrides - Partial UsageLog to override defaults
 * @returns Complete UsageLog object
 */
export function createMockUsageLog(overrides?: Partial<UsageLog>): UsageLog {
  return {
    id: 1,
    timestamp: '2024-01-15T10:30:00.000Z',
    model: 'anthropic/claude-3-opus',
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150,
    cost: 0.0045,
    request_path: '/api/v1/chat/completions',
    status_code: 200,
    created_at: '2024-01-15T10:30:00.000Z',
    api_key_hash: null,
    api_key_label: undefined,
    ...overrides,
  };
}

/**
 * Create a mock UsageStats object with default values
 * @param overrides - Partial UsageStats to override defaults
 * @returns Complete UsageStats object
 */
export function createMockStats(overrides?: Partial<UsageStats>): UsageStats {
  return {
    request_count: 100,
    total_tokens: 15000,
    total_cost: 0.45,
    ...overrides,
  };
}

// Re-export everything from @testing-library/react for convenience
export * from '@testing-library/react';
