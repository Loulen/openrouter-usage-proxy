import { useState } from 'react';
import './App.css';
import { useLogs } from './hooks/useLogs';
import { useModels } from './hooks/useModels';
import { useSettings } from './hooks/useSettings';
import { useApiKeys } from './hooks/useApiKeys';
import { Dashboard } from './components/Dashboard';
import { LogsTable } from './components/LogsTable';
import { NavBar } from './components/NavBar';
import { Filters } from './components/Filters';
import { StatsPage } from './components/StatsPage';
import { SettingsPage } from './components/SettingsPage';
import type { FilterParams, PageType } from './types';

/**
 * Main application component for the OpenRouter Usage Dashboard
 * Combines Dashboard stats, LogsTable, and StatsPage with navigation and filtering
 * Handles loading, error, and empty states at the top level
 * Uses simple page state for navigation (no React Router)
 */
function App(): JSX.Element {
  // Page navigation state
  const [activePage, setActivePage] = useState<PageType>('dashboard');

  // Filter state shared across all views
  const [filters, setFilters] = useState<FilterParams>({});

  // Fetch logs and stats with current filters
  const { logs, stats, loading, error, refetch } = useLogs(filters);

  // Fetch available models for filter dropdown
  const { models, loading: modelsLoading } = useModels();

  // Fetch settings for API key tracking feature
  const { settings } = useSettings();

  // Fetch API keys for filter dropdown
  const { apiKeys } = useApiKeys();

  /**
   * Handle filter changes from the Filters component
   */
  const handleFiltersChange = (newFilters: FilterParams) => {
    setFilters(newFilters);
  };

  /**
   * Handle page navigation
   */
  const handlePageChange = (page: PageType) => {
    setActivePage(page);
  };

  return (
    <div className="container app">
      <header className="app-header">
        <h1>OpenRouter Usage Dashboard</h1>
        <button
          onClick={refetch}
          disabled={loading}
          className="refresh-button"
          aria-label="Refresh data"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </header>

      {/* Navigation */}
      <NavBar activePage={activePage} onPageChange={handlePageChange} />

      {/* Filters */}
      <section className="app-filters">
        <Filters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          models={models}
          modelsLoading={modelsLoading}
          apiKeys={apiKeys}
          apiKeyTrackingEnabled={settings?.apiKeyTrackingEnabled ?? false}
        />
      </section>

      {error && (
        <div className="error app-error" role="alert">
          <strong>Error:</strong> {error.message}
          <button onClick={refetch} className="retry-button">
            Try Again
          </button>
        </div>
      )}

      <main className="app-main">
        {activePage === 'dashboard' && (
          <>
            <Dashboard
              stats={stats}
              loading={loading}
              onGoToSettings={() => handlePageChange('settings')}
            />
            <LogsTable logs={logs} loading={loading} />
          </>
        )}
        {activePage === 'stats' && (
          <StatsPage filters={filters} loading={loading} />
        )}
        {activePage === 'settings' && (
          <SettingsPage onNavigate={handlePageChange} />
        )}
      </main>

      {loading && logs.length === 0 && activePage === 'dashboard' && (
        <div className="loading-overlay">
          <div className="spinner" aria-label="Loading data"></div>
          <p className="text-muted">Loading usage data...</p>
        </div>
      )}
    </div>
  );
}

export default App;
