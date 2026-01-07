/**
 * Settings persistence module for OpenRouter Usage Proxy
 * Handles JSON file read/write operations for application settings
 * Settings stored at ~/.openrouter-proxy/settings.json
 */

import path from 'path';
import os from 'os';
import fs from 'fs';
import { randomUUID } from 'crypto';
import type {
  Settings,
  ApiKeyConfig,
  ApiKeyInput,
  ApiKeyUpdateInput,
} from '../types/settings.js';
import { DEFAULT_SETTINGS } from '../types/settings.js';

/**
 * Settings file path - stored in user's home directory
 * Uses same directory as the database (~/.openrouter-proxy/)
 */
const DATA_DIR = path.join(os.homedir(), '.openrouter-proxy');
const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json');

/**
 * Ensure the data directory exists before any file operations
 */
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Get current settings from the settings file
 * Returns default settings if file doesn't exist or is invalid
 *
 * @returns Current application settings
 */
export function getSettings(): Settings {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) {
      // Create default settings file if it doesn't exist
      saveSettings(DEFAULT_SETTINGS);
      return { ...DEFAULT_SETTINGS };
    }

    const fileContent = fs.readFileSync(SETTINGS_PATH, 'utf-8');
    const settings = JSON.parse(fileContent) as Settings;

    // Validate required fields exist
    if (
      typeof settings.apiKeyTrackingEnabled !== 'boolean' ||
      !Array.isArray(settings.apiKeys) ||
      typeof settings.lastUpdated !== 'string'
    ) {
      // File is corrupted or has invalid structure, return defaults
      saveSettings(DEFAULT_SETTINGS);
      return { ...DEFAULT_SETTINGS };
    }

    return settings;
  } catch {
    // Error reading or parsing file, return defaults
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Save settings to the settings file
 * Writes atomically by writing to temp file first, then renaming
 *
 * @param settings - Settings object to save
 */
export function saveSettings(settings: Settings): void {
  const updatedSettings: Settings = {
    ...settings,
    lastUpdated: new Date().toISOString(),
  };

  const tempPath = `${SETTINGS_PATH}.tmp`;

  try {
    // Write to temp file first for atomic operation
    fs.writeFileSync(tempPath, JSON.stringify(updatedSettings, null, 2), 'utf-8');
    // Rename temp file to actual settings file (atomic on most filesystems)
    fs.renameSync(tempPath, SETTINGS_PATH);
  } catch (error) {
    // Clean up temp file if it exists
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    throw error;
  }
}

/**
 * Get an API key configuration by ID
 *
 * @param id - API key configuration ID
 * @returns API key configuration or undefined if not found
 */
export function getApiKeyById(id: string): ApiKeyConfig | undefined {
  const settings = getSettings();
  return settings.apiKeys.find((key) => key.id === id);
}

/**
 * Add a new API key configuration
 *
 * @param input - API key input data (label and key)
 * @returns The newly created API key configuration
 */
export function addApiKey(input: ApiKeyInput): ApiKeyConfig {
  const settings = getSettings();

  const newApiKey: ApiKeyConfig = {
    id: randomUUID(),
    label: input.label,
    key: input.key,
    createdAt: new Date().toISOString(),
  };

  settings.apiKeys.push(newApiKey);
  saveSettings(settings);

  return newApiKey;
}

/**
 * Update an existing API key configuration
 *
 * @param id - API key configuration ID to update
 * @param updates - Fields to update (label and/or key)
 * @returns Updated API key configuration or undefined if not found
 */
export function updateApiKey(
  id: string,
  updates: ApiKeyUpdateInput
): ApiKeyConfig | undefined {
  const settings = getSettings();
  const keyIndex = settings.apiKeys.findIndex((key) => key.id === id);

  if (keyIndex === -1) {
    return undefined;
  }

  const existingKey = settings.apiKeys[keyIndex];
  const updatedKey: ApiKeyConfig = {
    ...existingKey,
    ...(updates.label !== undefined && { label: updates.label }),
    ...(updates.key !== undefined && { key: updates.key }),
  };

  settings.apiKeys[keyIndex] = updatedKey;
  saveSettings(settings);

  return updatedKey;
}

/**
 * Delete an API key configuration
 *
 * @param id - API key configuration ID to delete
 * @returns True if key was deleted, false if not found
 */
export function deleteApiKey(id: string): boolean {
  const settings = getSettings();
  const initialLength = settings.apiKeys.length;

  settings.apiKeys = settings.apiKeys.filter((key) => key.id !== id);

  if (settings.apiKeys.length === initialLength) {
    return false;
  }

  saveSettings(settings);
  return true;
}

/**
 * Get all API key configurations
 *
 * @returns Array of all API key configurations
 */
export function getAllApiKeys(): ApiKeyConfig[] {
  const settings = getSettings();
  return settings.apiKeys;
}

/**
 * Update the API key tracking enabled setting
 *
 * @param enabled - Whether API key tracking should be enabled
 */
export function setApiKeyTrackingEnabled(enabled: boolean): void {
  const settings = getSettings();
  settings.apiKeyTrackingEnabled = enabled;
  saveSettings(settings);
}
