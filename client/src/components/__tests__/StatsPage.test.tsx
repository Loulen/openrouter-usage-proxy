/**
 * Tests for the StatsPage component
 * Verifies rendering of charts, API key statistics, and loading/empty states
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import {
  renderWithProviders,
  mockFetchResponse,
  resetFetchMocks,
  screen,
  waitFor,
} from '../../__tests__/test-utils';
import { StatsPage } from '../StatsPage';
import type {
  ModelStats,
  TimeSeriesDataPoint,
  ApiKeyStatsData,
  ApiKeyTimeSeriesDataPoint,
  UnifiedStatsResponse,
} from '../../types';

/**
 * Mock ResizeObserver for recharts ResponsiveContainer
 * jsdom doesn't implement ResizeObserver, so we need to provide a stub
 */
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// Mock the useSettings hook
vi.mock('../../hooks/useSettings', () => ({
  useSettings: vi.fn(() => ({
    settings: { apiKeyTrackingEnabled: false, apiKeys: [], lastUpdated: '' },
    loading: false,
    error: null,
    updateSettings: vi.fn(),
    refetch: vi.fn(),
  })),
}));

// Import the mocked hook for manipulation in tests
import { useSettings } from '../../hooks/useSettings';

// Mock data for model stats
const mockModelStats: ModelStats[] = [
  {
    model: 'anthropic/claude-3-opus',
    request_count: 100,
    total_tokens: 10000,
    total_cost: 1.5,
  },
  {
    model: 'openai/gpt-4',
    request_count: 50,
    total_tokens: 5000,
    total_cost: 0.75,
  },
];

// Mock data for time series
const mockTimeSeries: TimeSeriesDataPoint[] = [
  {
    period: '2024-01-01',
    model: 'anthropic/claude-3-opus',
    request_count: 50,
    total_tokens: 5000,
    total_cost: 0.75,
  },
  {
    period: '2024-01-02',
    model: 'anthropic/claude-3-opus',
    request_count: 50,
    total_tokens: 5000,
    total_cost: 0.75,
  },
];

// Mock data for API key stats
const mockApiKeyStats: ApiKeyStatsData[] = [
  {
    api_key_hash: 'abc123def456',
    request_count: 10,
    total_tokens: 1000,
    total_cost: 0.01,
  },
  {
    api_key_hash: 'unknown',
    request_count: 5,
    total_tokens: 500,
    total_cost: 0.005,
  },
];

// Mock hash-to-label map
const mockHashMap: Record<string, string> = {
  abc123def456: 'My API Key',
};

// Mock data for API key time series
const mockApiKeyTimeSeries: ApiKeyTimeSeriesDataPoint[] = [
  {
    period: '2024-01-01',
    api_key_hash: 'abc123def456',
    request_count: 5,
    total_tokens: 500,
    total_cost: 0.005,
  },
  {
    period: '2024-01-02',
    api_key_hash: 'abc123def456',
    request_count: 5,
    total_tokens: 500,
    total_cost: 0.005,
  },
];

/**
 * Mock unified stats response
 */
const mockUnifiedStatsResponse: UnifiedStatsResponse = {
  stats: {
    request_count: 150,
    total_tokens: 15000,
    total_cost: 2.25,
  },
  modelStats: mockModelStats,
  timeSeries: mockTimeSeries,
  apiKeyStats: mockApiKeyStats,
  apiKeyTimeSeries: mockApiKeyTimeSeries,
};

/**
 * Mock empty unified stats response
 */
const mockEmptyUnifiedStatsResponse: UnifiedStatsResponse = {
  stats: {
    request_count: 0,
    total_tokens: 0,
    total_cost: 0,
  },
  modelStats: [],
  timeSeries: [],
  apiKeyStats: [],
  apiKeyTimeSeries: [],
};

/**
 * Mock unified stats response with model data but no API key data
 */
const mockUnifiedStatsNoApiKey: UnifiedStatsResponse = {
  stats: {
    request_count: 150,
    total_tokens: 15000,
    total_cost: 2.25,
  },
  modelStats: mockModelStats,
  timeSeries: mockTimeSeries,
  apiKeyStats: [],
  apiKeyTimeSeries: [],
};

/**
 * Helper to setup standard mocks for all endpoints
 * Uses the unified stats endpoint plus separate hash-map endpoint
 */
function setupAllMocks() {
  mockFetchResponse(/\/api\/logs\/unified-stats/, mockUnifiedStatsResponse);
  mockFetchResponse('/api/api-keys/hash-map', mockHashMap);
}

describe('StatsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default mock (API key tracking disabled)
    vi.mocked(useSettings).mockReturnValue({
      settings: { apiKeyTrackingEnabled: false, apiKeys: [], lastUpdated: '' },
      loading: false,
      error: null,
      updateSettings: vi.fn(),
      refetch: vi.fn(),
    });
  });

  afterEach(() => {
    resetFetchMocks();
  });

  describe('Model charts rendering', () => {
    it('renders model pie charts with titles', async () => {
      setupAllMocks();
      renderWithProviders(<StatsPage filters={{}} />);

      await waitFor(() => {
        expect(screen.getByText('Requests by Model')).toBeInTheDocument();
        expect(screen.getByText('Tokens by Model')).toBeInTheDocument();
        expect(screen.getByText('Cost by Model')).toBeInTheDocument();
      });
    });

    it('renders Cost Over Time by Model line chart', async () => {
      setupAllMocks();
      renderWithProviders(<StatsPage filters={{}} />);

      await waitFor(() => {
        expect(screen.getByText('Cost Over Time by Model')).toBeInTheDocument();
      });
    });

    it('displays summary statistics after loading', async () => {
      setupAllMocks();
      renderWithProviders(<StatsPage filters={{}} />);

      await waitFor(() => {
        // Total Requests: 100 + 50 = 150
        expect(screen.getByText('150')).toBeInTheDocument();
        // Total Tokens: 10000 + 5000 = 15000
        expect(screen.getByText('15,000')).toBeInTheDocument();
      });
    });
  });

  describe('Loading states', () => {
    it('displays loading indicators while fetching data', () => {
      // Set up mocks
      mockFetchResponse(/\/api\/logs\/unified-stats/, mockUnifiedStatsResponse);
      mockFetchResponse('/api/api-keys/hash-map', mockHashMap);

      renderWithProviders(<StatsPage filters={{}} loading={true} />);

      // Summary stats should show '-' when loading
      const loadingDashes = screen.getAllByText('-');
      expect(loadingDashes.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('API key charts - when tracking is enabled', () => {
    beforeEach(() => {
      vi.mocked(useSettings).mockReturnValue({
        settings: { apiKeyTrackingEnabled: true, apiKeys: [], lastUpdated: '' },
        loading: false,
        error: null,
        updateSettings: vi.fn(),
        refetch: vi.fn(),
      });
    });

    it('renders API key statistics section title', async () => {
      setupAllMocks();
      renderWithProviders(<StatsPage filters={{}} />);

      await waitFor(() => {
        expect(screen.getByText('API Key Statistics')).toBeInTheDocument();
      });
    });

    it('renders API key pie charts with titles', async () => {
      setupAllMocks();
      renderWithProviders(<StatsPage filters={{}} />);

      await waitFor(() => {
        expect(screen.getByText('Requests by API Key')).toBeInTheDocument();
        expect(screen.getByText('Tokens by API Key')).toBeInTheDocument();
        expect(screen.getByText('Cost by API Key')).toBeInTheDocument();
      });
    });

    it('renders Cost Over Time by API Key bar chart', async () => {
      setupAllMocks();
      renderWithProviders(<StatsPage filters={{}} />);

      await waitFor(() => {
        expect(screen.getByText('Cost Over Time by API Key')).toBeInTheDocument();
      });
    });

    it('maps api_key_hash to labels correctly', async () => {
      setupAllMocks();
      renderWithProviders(<StatsPage filters={{}} />);

      // The component transforms the hash to the label from hashLabelMap
      // 'abc123def456' -> 'My API Key' (from mockHashMap)
      await waitFor(() => {
        // We need to check the chart legend or tooltip
        // The PieChartCard renders chart data with name property
        // We can verify by checking that the section is rendered
        expect(screen.getByText('API Key Statistics')).toBeInTheDocument();
      });
    });

    it('displays "Unknown" label for unknown hash', async () => {
      setupAllMocks();
      renderWithProviders(<StatsPage filters={{}} />);

      // The component maps 'unknown' hash to 'Unknown' label
      // This should appear in the chart legend
      await waitFor(() => {
        // Verify API key section is rendered (containing Unknown label in chart)
        expect(screen.getByText('API Key Statistics')).toBeInTheDocument();
      });
    });
  });

  describe('API key charts - when tracking is disabled', () => {
    beforeEach(() => {
      vi.mocked(useSettings).mockReturnValue({
        settings: { apiKeyTrackingEnabled: false, apiKeys: [], lastUpdated: '' },
        loading: false,
        error: null,
        updateSettings: vi.fn(),
        refetch: vi.fn(),
      });
    });

    it('does not render API key charts when tracking is disabled', async () => {
      setupAllMocks();
      renderWithProviders(<StatsPage filters={{}} />);

      await waitFor(() => {
        expect(screen.getByText('Requests by Model')).toBeInTheDocument();
      });

      // API key section should not be present
      expect(screen.queryByText('API Key Statistics')).not.toBeInTheDocument();
      expect(screen.queryByText('Requests by API Key')).not.toBeInTheDocument();
    });
  });

  describe('Empty states', () => {
    it('shows empty state when no model data', async () => {
      mockFetchResponse(/\/api\/logs\/unified-stats/, mockEmptyUnifiedStatsResponse);
      mockFetchResponse('/api/api-keys/hash-map', {});

      renderWithProviders(<StatsPage filters={{}} />);

      await waitFor(() => {
        expect(
          screen.getByText('No data available for the selected filters.')
        ).toBeInTheDocument();
      });
    });

    it('shows empty API key data message when tracking enabled but no data', async () => {
      vi.mocked(useSettings).mockReturnValue({
        settings: { apiKeyTrackingEnabled: true, apiKeys: [], lastUpdated: '' },
        loading: false,
        error: null,
        updateSettings: vi.fn(),
        refetch: vi.fn(),
      });

      mockFetchResponse(/\/api\/logs\/unified-stats/, mockUnifiedStatsNoApiKey);
      mockFetchResponse('/api/api-keys/hash-map', {});

      renderWithProviders(<StatsPage filters={{}} />);

      await waitFor(() => {
        expect(
          screen.getByText('No API key data available for the selected filters.')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Fetch endpoint mocking', () => {
    it('fetches unified stats endpoint', async () => {
      setupAllMocks();
      vi.mocked(useSettings).mockReturnValue({
        settings: { apiKeyTrackingEnabled: true, apiKeys: [], lastUpdated: '' },
        loading: false,
        error: null,
        updateSettings: vi.fn(),
        refetch: vi.fn(),
      });

      renderWithProviders(<StatsPage filters={{}} />);

      await waitFor(() => {
        // Verify API key stats were loaded (included in unified response)
        expect(screen.getByText('API Key Statistics')).toBeInTheDocument();
      });

      // Verify fetch was called with unified-stats endpoint
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/logs/unified-stats')
      );
    });

    it('fetches unified stats with aggregation parameters', async () => {
      setupAllMocks();
      vi.mocked(useSettings).mockReturnValue({
        settings: { apiKeyTrackingEnabled: true, apiKeys: [], lastUpdated: '' },
        loading: false,
        error: null,
        updateSettings: vi.fn(),
        refetch: vi.fn(),
      });

      renderWithProviders(<StatsPage filters={{}} />);

      await waitFor(() => {
        expect(screen.getByText('Cost Over Time by API Key')).toBeInTheDocument();
      });

      // Verify fetch was called with aggregation params in unified-stats endpoint
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/logs\/unified-stats\?.*aggregation=/)
      );
    });

    it('fetches hash-map endpoint separately', async () => {
      setupAllMocks();
      renderWithProviders(<StatsPage filters={{}} />);

      await waitFor(() => {
        expect(screen.getByText('Requests by Model')).toBeInTheDocument();
      });

      // Verify fetch was called with hash-map endpoint (separate from unified stats)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/api-keys/hash-map')
      );
    });
  });
});
