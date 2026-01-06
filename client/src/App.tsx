import './App.css';
import { useLogs } from './hooks/useLogs';
import { Dashboard } from './components/Dashboard';
import { LogsTable } from './components/LogsTable';

/**
 * Main application component for the OpenRouter Usage Dashboard
 * Combines Dashboard stats and LogsTable into a unified view
 * Handles loading, error, and empty states at the top level
 */
function App(): JSX.Element {
  const { logs, stats, loading, error, refetch } = useLogs();

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

      {error && (
        <div className="error app-error" role="alert">
          <strong>Error:</strong> {error.message}
          <button onClick={refetch} className="retry-button">
            Try Again
          </button>
        </div>
      )}

      <main className="app-main">
        <Dashboard stats={stats} loading={loading} />
        <LogsTable logs={logs} loading={loading} />
      </main>

      {loading && logs.length === 0 && (
        <div className="loading-overlay">
          <div className="spinner" aria-label="Loading data"></div>
          <p className="text-muted">Loading usage data...</p>
        </div>
      )}
    </div>
  );
}

export default App;
