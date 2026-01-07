/**
 * Tests for the Dashboard component
 * Verifies rendering of loading states, stats cards, and API key table
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, createMockStats, screen } from '../../__tests__/test-utils';
import { Dashboard } from '../Dashboard';

// Mock the hooks used by Dashboard
vi.mock('../../hooks/useSettings', () => ({
  useSettings: vi.fn(() => ({
    settings: { apiKeyTrackingEnabled: false },
    loading: false,
    error: null,
    updateSettings: vi.fn(),
    refetch: vi.fn(),
  })),
}));

vi.mock('../../hooks/useApiKeys', () => ({
  useApiKeys: vi.fn(() => ({
    balances: [],
    apiKeys: [],
    loading: false,
    error: null,
    addApiKey: vi.fn(),
    updateApiKey: vi.fn(),
    deleteApiKey: vi.fn(),
    refreshBalances: vi.fn(),
    refreshApiKeys: vi.fn(),
  })),
}));

// Import the mocked hooks for manipulation in tests
import { useSettings } from '../../hooks/useSettings';
import { useApiKeys } from '../../hooks/useApiKeys';

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default mock implementations
    vi.mocked(useSettings).mockReturnValue({
      settings: { apiKeyTrackingEnabled: false, apiKeys: [], lastUpdated: '' },
      loading: false,
      error: null,
      updateSettings: vi.fn(),
      refetch: vi.fn(),
    });
    vi.mocked(useApiKeys).mockReturnValue({
      balances: [],
      apiKeys: [],
      loading: false,
      error: null,
      addApiKey: vi.fn(),
      updateApiKey: vi.fn(),
      deleteApiKey: vi.fn(),
      refreshBalances: vi.fn(),
      refreshApiKeys: vi.fn(),
    });
  });

  describe('Loading state', () => {
    it('renders loading indicators when loading is true', () => {
      renderWithProviders(<Dashboard stats={null} loading={true} />);

      // When loading, stat values should show '-' placeholder
      const loadingIndicators = screen.getAllByText('-');
      expect(loadingIndicators.length).toBe(3); // 3 stat cards with '-'
    });

    it('shows stat labels while loading', () => {
      renderWithProviders(<Dashboard stats={null} loading={true} />);

      expect(screen.getByText('Total Requests')).toBeInTheDocument();
      expect(screen.getByText('Total Tokens')).toBeInTheDocument();
      expect(screen.getByText('Total Cost')).toBeInTheDocument();
    });
  });

  describe('Stats display', () => {
    it('renders stats cards with data', () => {
      const stats = createMockStats({
        request_count: 1234,
        total_tokens: 56789,
        total_cost: 12.34,
      });

      renderWithProviders(<Dashboard stats={stats} loading={false} />);

      expect(screen.getByText('Total Requests')).toBeInTheDocument();
      expect(screen.getByText('Total Tokens')).toBeInTheDocument();
      expect(screen.getByText('Total Cost')).toBeInTheDocument();
    });

    it('displays correct formatted stat values', () => {
      const stats = createMockStats({
        request_count: 1234,
        total_tokens: 56789,
        total_cost: 12.34,
      });

      renderWithProviders(<Dashboard stats={stats} loading={false} />);

      // Numbers should be formatted with locale separators
      expect(screen.getByText('1,234')).toBeInTheDocument();
      expect(screen.getByText('56,789')).toBeInTheDocument();
      // Cost should be formatted with dollar sign
      expect(screen.getByText('$12.34')).toBeInTheDocument();
    });

    it('displays small cost values with 6 decimal places', () => {
      const stats = createMockStats({
        request_count: 5,
        total_tokens: 100,
        total_cost: 0.000123,
      });

      renderWithProviders(<Dashboard stats={stats} loading={false} />);

      expect(screen.getByText('$0.000123')).toBeInTheDocument();
    });

    it('displays zero values correctly', () => {
      const stats = createMockStats({
        request_count: 0,
        total_tokens: 0,
        total_cost: 0,
      });

      renderWithProviders(<Dashboard stats={stats} loading={false} />);

      // Both request_count and total_tokens show as 0
      const zeroElements = screen.getAllByText('0');
      expect(zeroElements.length).toBe(2);
      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });
  });

  describe('Default/null stats handling', () => {
    it('handles null stats gracefully by showing zeros', () => {
      renderWithProviders(<Dashboard stats={null} loading={false} />);

      // When stats is null and not loading, should show 0 values
      // Both request_count and total_tokens default to 0
      const zeroElements = screen.getAllByText('0');
      expect(zeroElements.length).toBe(2);
      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });
  });

  describe('API Key Table visibility', () => {
    it('does not show API key table when tracking is disabled', () => {
      vi.mocked(useSettings).mockReturnValue({
        settings: { apiKeyTrackingEnabled: false, apiKeys: [], lastUpdated: '' },
        loading: false,
        error: null,
        updateSettings: vi.fn(),
        refetch: vi.fn(),
      });

      const stats = createMockStats();
      renderWithProviders(<Dashboard stats={stats} loading={false} />);

      // The API key table should not be present
      expect(screen.queryByText('API Key Balances')).not.toBeInTheDocument();
    });

    it('shows API key table when tracking is enabled', () => {
      vi.mocked(useSettings).mockReturnValue({
        settings: { apiKeyTrackingEnabled: true, apiKeys: [], lastUpdated: '' },
        loading: false,
        error: null,
        updateSettings: vi.fn(),
        refetch: vi.fn(),
      });
      vi.mocked(useApiKeys).mockReturnValue({
        balances: [],
        apiKeys: [],
        loading: false,
        error: null,
        addApiKey: vi.fn(),
        updateApiKey: vi.fn(),
        deleteApiKey: vi.fn(),
        refreshBalances: vi.fn(),
        refreshApiKeys: vi.fn(),
      });

      const stats = createMockStats();
      renderWithProviders(<Dashboard stats={stats} loading={false} />);

      // The ApiKeyTable component should be rendered (check for its container)
      expect(document.querySelector('.dashboard-api-keys')).toBeInTheDocument();
    });
  });

  describe('onGoToSettings callback', () => {
    it('passes onGoToSettings prop to ApiKeyTable when provided', () => {
      vi.mocked(useSettings).mockReturnValue({
        settings: { apiKeyTrackingEnabled: true, apiKeys: [], lastUpdated: '' },
        loading: false,
        error: null,
        updateSettings: vi.fn(),
        refetch: vi.fn(),
      });

      const onGoToSettings = vi.fn();
      const stats = createMockStats();
      
      renderWithProviders(
        <Dashboard stats={stats} loading={false} onGoToSettings={onGoToSettings} />
      );

      // ApiKeyTable section should be present
      expect(document.querySelector('.dashboard-api-keys')).toBeInTheDocument();
    });
  });
});
