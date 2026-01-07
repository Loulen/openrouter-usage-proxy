import { useState, useCallback } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useApiKeys } from '../hooks/useApiKeys';
import type { SettingsPageProps } from '../types';

/**
 * Mask an API key for display (show prefix and last 4 characters)
 * @param key - The API key masked value (e.g., "sk-or-...xxxx")
 * @returns Masked key string for display
 */
function maskApiKey(maskedKey: string): string {
  return maskedKey;
}

/**
 * Format a date to a human-readable relative or absolute string
 * @param dateString - ISO 8601 date string
 * @returns Formatted date string
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  }
  if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  }
  return date.toLocaleDateString();
}

/**
 * SettingsPage component for managing API key tracking settings
 * Provides a toggle for the feature and CRUD operations for API keys
 * Displays API keys with masked values and provides edit/delete functionality
 */
export function SettingsPage({ onNavigate: _onNavigate }: SettingsPageProps): JSX.Element {
  const {
    settings,
    loading: settingsLoading,
    error: settingsError,
    updateSettings,
  } = useSettings();

  const {
    apiKeys,
    loading: apiKeysLoading,
    error: apiKeysError,
    addApiKey,
    updateApiKey,
    deleteApiKey,
    refreshApiKeys,
  } = useApiKeys();

  // Form state for adding a new API key
  const [newLabel, setNewLabel] = useState('');
  const [newKey, setNewKey] = useState('');
  const [isAddingKey, setIsAddingKey] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit mode state
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editKey, setEditKey] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Delete confirmation state
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  /**
   * Handle feature toggle change
   */
  const handleToggleChange = useCallback(async (enabled: boolean) => {
    try {
      await updateSettings({ apiKeyTrackingEnabled: enabled });
    } catch {
      // Error is handled by the hook
    }
  }, [updateSettings]);

  /**
   * Handle adding a new API key
   */
  const handleAddKey = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();

    if (!newLabel.trim() || !newKey.trim()) {
      setAddError('Both label and API key are required');
      return;
    }

    if (!newKey.startsWith('sk-or-')) {
      setAddError('API key must start with "sk-or-"');
      return;
    }

    setIsAddingKey(true);
    setAddError(null);

    try {
      await addApiKey(newLabel.trim(), newKey.trim());
      setNewLabel('');
      setNewKey('');
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add API key');
    } finally {
      setIsAddingKey(false);
    }
  }, [newLabel, newKey, addApiKey]);

  /**
   * Start editing an API key
   */
  const handleStartEdit = useCallback((keyId: string, currentLabel: string) => {
    setEditingKeyId(keyId);
    setEditLabel(currentLabel);
    setEditKey('');
    setUpdateError(null);
  }, []);

  /**
   * Cancel editing
   */
  const handleCancelEdit = useCallback(() => {
    setEditingKeyId(null);
    setEditLabel('');
    setEditKey('');
    setUpdateError(null);
  }, []);

  /**
   * Save edited API key
   */
  const handleSaveEdit = useCallback(async () => {
    if (!editingKeyId) return;

    if (!editLabel.trim()) {
      setUpdateError('Label is required');
      return;
    }

    // If a new key is provided, validate it
    if (editKey && !editKey.startsWith('sk-or-')) {
      setUpdateError('API key must start with "sk-or-"');
      return;
    }

    setIsUpdating(true);
    setUpdateError(null);

    try {
      const updates: { label?: string; key?: string } = { label: editLabel.trim() };
      if (editKey.trim()) {
        updates.key = editKey.trim();
      }
      await updateApiKey(editingKeyId, updates);
      handleCancelEdit();
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Failed to update API key');
    } finally {
      setIsUpdating(false);
    }
  }, [editingKeyId, editLabel, editKey, updateApiKey, handleCancelEdit]);

  /**
   * Handle delete confirmation
   */
  const handleConfirmDelete = useCallback(async () => {
    if (!deletingKeyId) return;

    setIsDeleting(true);

    try {
      await deleteApiKey(deletingKeyId);
      setDeletingKeyId(null);
    } catch {
      // Error is handled by the hook
    } finally {
      setIsDeleting(false);
    }
  }, [deletingKeyId, deleteApiKey]);

  const isLoading = settingsLoading || apiKeysLoading;
  const error = settingsError || apiKeysError;

  return (
    <div className="settings-page">
      {/* Page Title */}
      <div className="settings-page-header">
        <h2 className="settings-page-title">Settings</h2>
        <p className="settings-page-subtitle">
          Manage your OpenRouter API keys and tracking preferences
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="settings-page-error neu-card">
          <span className="settings-page-error-icon">!</span>
          <p className="settings-page-error-message">{error.message}</p>
          <button
            type="button"
            className="settings-page-retry-button neu-button"
            onClick={refreshApiKeys}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && !settings && (
        <div className="loading-overlay">
          <div className="spinner" />
          <p>Loading settings...</p>
        </div>
      )}

      {/* Main Settings Content */}
      {settings && (
        <>
          {/* Feature Toggle Section */}
          <div className="settings-section neu-card">
            <h3 className="settings-section-title">API Key Tracking</h3>
            <div className="settings-toggle-row">
              <div className="settings-toggle-info">
                <span className="settings-toggle-label">Enable API Key Tracking</span>
                <span className="settings-toggle-description">
                  Track balance and usage for each OpenRouter API key. When enabled,
                  displays balance information on the Dashboard and adds API key filters to Statistics.
                </span>
              </div>
              <label className="settings-toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.apiKeyTrackingEnabled}
                  onChange={(e) => handleToggleChange(e.target.checked)}
                  disabled={settingsLoading}
                />
                <span className="settings-toggle-slider" />
              </label>
            </div>
          </div>

          {/* API Keys Management Section */}
          {settings.apiKeyTrackingEnabled && (
            <div className="settings-section neu-card">
              <div className="settings-section-header">
                <h3 className="settings-section-title">API Keys</h3>
                <span className="settings-section-count">
                  {apiKeys.length} key{apiKeys.length !== 1 ? 's' : ''} configured
                </span>
              </div>

              {/* Add New API Key Form */}
              <form className="settings-add-key-form" onSubmit={handleAddKey}>
                <div className="settings-add-key-fields">
                  <div className="settings-input-group">
                    <label className="settings-input-label" htmlFor="new-key-label">
                      Label
                    </label>
                    <input
                      id="new-key-label"
                      type="text"
                      className="neu-input settings-input"
                      placeholder="e.g., Production Key"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      disabled={isAddingKey}
                    />
                  </div>
                  <div className="settings-input-group settings-input-group-key">
                    <label className="settings-input-label" htmlFor="new-key-value">
                      API Key
                    </label>
                    <input
                      id="new-key-value"
                      type="password"
                      className="neu-input settings-input"
                      placeholder="sk-or-..."
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      disabled={isAddingKey}
                    />
                  </div>
                  <div className="settings-input-group settings-input-group-action">
                    <label className="settings-input-label settings-input-label-spacer">&nbsp;</label>
                    <button
                      type="submit"
                      className="neu-button neu-button-primary settings-add-button"
                      disabled={isAddingKey || !newLabel.trim() || !newKey.trim()}
                    >
                      {isAddingKey ? 'Adding...' : 'Add Key'}
                    </button>
                  </div>
                </div>
                {addError && (
                  <p className="settings-form-error">{addError}</p>
                )}
              </form>

              {/* API Keys List */}
              {apiKeys.length > 0 ? (
                <div className="settings-keys-list">
                  {apiKeys.map((apiKey) => (
                    <div key={apiKey.id} className="settings-key-item">
                      {editingKeyId === apiKey.id ? (
                        // Edit Mode
                        <div className="settings-key-edit">
                          <div className="settings-key-edit-fields">
                            <div className="settings-input-group">
                              <label className="settings-input-label" htmlFor={`edit-label-${apiKey.id}`}>
                                Label
                              </label>
                              <input
                                id={`edit-label-${apiKey.id}`}
                                type="text"
                                className="neu-input settings-input"
                                value={editLabel}
                                onChange={(e) => setEditLabel(e.target.value)}
                                disabled={isUpdating}
                              />
                            </div>
                            <div className="settings-input-group settings-input-group-key">
                              <label className="settings-input-label" htmlFor={`edit-key-${apiKey.id}`}>
                                New API Key (optional)
                              </label>
                              <input
                                id={`edit-key-${apiKey.id}`}
                                type="password"
                                className="neu-input settings-input"
                                placeholder="Leave empty to keep current"
                                value={editKey}
                                onChange={(e) => setEditKey(e.target.value)}
                                disabled={isUpdating}
                              />
                            </div>
                          </div>
                          {updateError && (
                            <p className="settings-form-error">{updateError}</p>
                          )}
                          <div className="settings-key-edit-actions">
                            <button
                              type="button"
                              className="neu-button neu-button-primary neu-button-sm"
                              onClick={handleSaveEdit}
                              disabled={isUpdating}
                            >
                              {isUpdating ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              type="button"
                              className="neu-button neu-button-sm"
                              onClick={handleCancelEdit}
                              disabled={isUpdating}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : deletingKeyId === apiKey.id ? (
                        // Delete Confirmation Mode
                        <div className="settings-key-delete-confirm">
                          <p className="settings-key-delete-message">
                            Delete &quot;{apiKey.label}&quot;? This action cannot be undone.
                          </p>
                          <div className="settings-key-delete-actions">
                            <button
                              type="button"
                              className="neu-button settings-delete-confirm-button"
                              onClick={handleConfirmDelete}
                              disabled={isDeleting}
                            >
                              {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                            <button
                              type="button"
                              className="neu-button neu-button-sm"
                              onClick={() => setDeletingKeyId(null)}
                              disabled={isDeleting}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        // View Mode
                        <>
                          <div className="settings-key-info">
                            <span className="settings-key-label">{apiKey.label}</span>
                            <span className="settings-key-masked">{maskApiKey(apiKey.maskedKey)}</span>
                            <span className="settings-key-date">
                              Added {formatDate(apiKey.createdAt)}
                            </span>
                          </div>
                          <div className="settings-key-actions">
                            <button
                              type="button"
                              className="neu-button neu-button-sm"
                              onClick={() => handleStartEdit(apiKey.id, apiKey.label)}
                              title="Edit API key"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="neu-button neu-button-sm settings-delete-button"
                              onClick={() => setDeletingKeyId(apiKey.id)}
                              title="Delete API key"
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                // Empty State
                <div className="settings-keys-empty">
                  <span className="settings-keys-empty-icon">🔑</span>
                  <p className="settings-keys-empty-message">
                    No API keys configured yet
                  </p>
                  <p className="settings-keys-empty-hint">
                    Add your OpenRouter API key above to start tracking usage and balance.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Info Section when tracking is disabled */}
          {!settings.apiKeyTrackingEnabled && (
            <div className="settings-info-card neu-card">
              <span className="settings-info-icon">ℹ️</span>
              <p className="settings-info-message">
                Enable API Key Tracking to manage your OpenRouter API keys and view balance
                information on the Dashboard.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
