/**
 * Tests for the LogsTable component
 * Verifies table rendering, empty state, and data display
 */
import { describe, it, expect } from 'vitest';
import { renderWithProviders, createMockUsageLog, screen } from '../../__tests__/test-utils';
import { LogsTable } from '../LogsTable';

describe('LogsTable', () => {
  describe('Table headers', () => {
    it('renders all table headers', () => {
      const logs = [createMockUsageLog()];

      renderWithProviders(<LogsTable logs={logs} loading={false} />);

      expect(screen.getByText('Timestamp')).toBeInTheDocument();
      expect(screen.getByText('API Key')).toBeInTheDocument();
      expect(screen.getByText('Model')).toBeInTheDocument();
      expect(screen.getByText('Prompt Tokens')).toBeInTheDocument();
      expect(screen.getByText('Completion Tokens')).toBeInTheDocument();
      expect(screen.getByText('Total Tokens')).toBeInTheDocument();
      expect(screen.getByText('Cost')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('renders table element with proper structure', () => {
      const logs = [createMockUsageLog()];

      renderWithProviders(<LogsTable logs={logs} loading={false} />);

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader').length).toBe(8);
    });
  });

  describe('Empty state', () => {
    it('renders empty state when no logs and not loading', () => {
      renderWithProviders(<LogsTable logs={[]} loading={false} />);

      expect(screen.getByText('No logs yet')).toBeInTheDocument();
      expect(
        screen.getByText('Make an API request through the proxy to see usage data here.')
      ).toBeInTheDocument();
    });

    it('does not render table in empty state', () => {
      renderWithProviders(<LogsTable logs={[]} loading={false} />);

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('Populated rows', () => {
    it('renders populated rows with data', () => {
      const logs = [
        createMockUsageLog({
          id: 1,
          model: 'anthropic/claude-3-opus',
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
          cost: 0.0045,
          status_code: 200,
        }),
        createMockUsageLog({
          id: 2,
          model: 'openai/gpt-4',
          prompt_tokens: 200,
          completion_tokens: 100,
          total_tokens: 300,
          cost: 0.009,
          status_code: 200,
        }),
      ];

      renderWithProviders(<LogsTable logs={logs} loading={false} />);

      // Check that rows are rendered
      const rows = screen.getAllByRole('row');
      // 1 header row + 2 data rows
      expect(rows.length).toBe(3);
    });

    it('displays model names correctly (extracts name from full identifier)', () => {
      const logs = [
        createMockUsageLog({
          id: 1,
          model: 'anthropic/claude-3-opus',
        }),
      ];

      renderWithProviders(<LogsTable logs={logs} loading={false} />);

      // Model name should be extracted (after the slash)
      expect(screen.getByText('claude-3-opus')).toBeInTheDocument();
    });

    it('displays tokens formatted with locale separators', () => {
      const logs = [
        createMockUsageLog({
          id: 1,
          prompt_tokens: 1234,
          completion_tokens: 5678,
          total_tokens: 6912,
        }),
      ];

      renderWithProviders(<LogsTable logs={logs} loading={false} />);

      expect(screen.getByText('1,234')).toBeInTheDocument();
      expect(screen.getByText('5,678')).toBeInTheDocument();
      expect(screen.getByText('6,912')).toBeInTheDocument();
    });

    it('displays costs with 6 decimal places', () => {
      const logs = [
        createMockUsageLog({
          id: 1,
          cost: 0.004567,
        }),
      ];

      renderWithProviders(<LogsTable logs={logs} loading={false} />);

      expect(screen.getByText('$0.004567')).toBeInTheDocument();
    });

    it('displays status codes', () => {
      const logs = [
        createMockUsageLog({
          id: 1,
          status_code: 200,
        }),
        createMockUsageLog({
          id: 2,
          status_code: 400,
        }),
      ];

      renderWithProviders(<LogsTable logs={logs} loading={false} />);

      expect(screen.getByText('200')).toBeInTheDocument();
      expect(screen.getByText('400')).toBeInTheDocument();
    });

    it('displays API key label when available', () => {
      const logs = [
        createMockUsageLog({
          id: 1,
          api_key_label: 'production-key',
        }),
      ];

      renderWithProviders(<LogsTable logs={logs} loading={false} />);

      expect(screen.getByText('production-key')).toBeInTheDocument();
    });

    it('displays "unknown" when API key label is not available', () => {
      const logs = [
        createMockUsageLog({
          id: 1,
          api_key_label: undefined,
        }),
      ];

      renderWithProviders(<LogsTable logs={logs} loading={false} />);

      expect(screen.getByText('unknown')).toBeInTheDocument();
    });
  });

  describe('Null value handling', () => {
    it('displays "-" for null token values', () => {
      const logs = [
        createMockUsageLog({
          id: 1,
          prompt_tokens: null,
          completion_tokens: null,
          total_tokens: null,
        }),
      ];

      renderWithProviders(<LogsTable logs={logs} loading={false} />);

      // Should display '-' for null values (3 token columns)
      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThanOrEqual(3);
    });

    it('displays "-" for null cost', () => {
      const logs = [
        createMockUsageLog({
          id: 1,
          cost: null,
        }),
      ];

      renderWithProviders(<LogsTable logs={logs} loading={false} />);

      // Cost cell should show '-'
      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });

    it('displays "-" for null status code', () => {
      const logs = [
        createMockUsageLog({
          id: 1,
          status_code: null,
        }),
      ];

      renderWithProviders(<LogsTable logs={logs} loading={false} />);

      // Status cell should show '-'
      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Error status styling', () => {
    it('applies error class for status codes >= 400', () => {
      const logs = [
        createMockUsageLog({
          id: 1,
          status_code: 500,
        }),
      ];

      renderWithProviders(<LogsTable logs={logs} loading={false} />);

      const statusElement = screen.getByText('500');
      expect(statusElement).toHaveClass('status-error');
    });

    it('applies ok class for status codes < 400', () => {
      const logs = [
        createMockUsageLog({
          id: 1,
          status_code: 200,
        }),
      ];

      renderWithProviders(<LogsTable logs={logs} loading={false} />);

      const statusElement = screen.getByText('200');
      expect(statusElement).toHaveClass('status-ok');
    });
  });

  describe('Multiple logs', () => {
    it('renders multiple log entries correctly', () => {
      const logs = [
        createMockUsageLog({ id: 1, model: 'anthropic/claude-3-opus' }),
        createMockUsageLog({ id: 2, model: 'openai/gpt-4' }),
        createMockUsageLog({ id: 3, model: 'google/gemini-pro' }),
      ];

      renderWithProviders(<LogsTable logs={logs} loading={false} />);

      expect(screen.getByText('claude-3-opus')).toBeInTheDocument();
      expect(screen.getByText('gpt-4')).toBeInTheDocument();
      expect(screen.getByText('gemini-pro')).toBeInTheDocument();

      // Should have 4 rows total (1 header + 3 data)
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBe(4);
    });
  });
});
