/**
 * API routes for settings management
 * Provides endpoints for retrieving and updating application settings
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getSettings, saveSettings } from '../db/settings.js';
import type { Settings } from '../types/settings.js';
import type { ApiErrorResponse } from '../types/index.js';

/**
 * Express router for settings-related endpoints
 */
const router = Router();

/**
 * GET /api/settings
 * Returns current application settings
 *
 * @returns Settings object with apiKeyTrackingEnabled, apiKeys, lastUpdated
 */
router.get('/', (req: Request, res: Response<Settings | ApiErrorResponse>, next: NextFunction) => {
  try {
    const settings = getSettings();
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/settings
 * Updates application settings
 * Expects a partial or full Settings object in the request body
 *
 * Request body can include:
 *   - apiKeyTrackingEnabled: boolean - Toggle API key tracking feature
 *   - apiKeys: ApiKeyConfig[] - Full list of API keys (replaces existing)
 *
 * @returns Updated Settings object
 */
router.put('/', (req: Request, res: Response<Settings | ApiErrorResponse>, next: NextFunction) => {
  try {
    const currentSettings = getSettings();

    // Merge incoming updates with current settings
    const updatedSettings: Settings = {
      ...currentSettings,
      // Only update fields that are provided
      ...(typeof req.body.apiKeyTrackingEnabled === 'boolean' && {
        apiKeyTrackingEnabled: req.body.apiKeyTrackingEnabled,
      }),
      ...(Array.isArray(req.body.apiKeys) && {
        apiKeys: req.body.apiKeys,
      }),
      // lastUpdated is set automatically by saveSettings
      lastUpdated: currentSettings.lastUpdated,
    };

    saveSettings(updatedSettings);

    // Return the newly saved settings (with updated lastUpdated)
    const savedSettings = getSettings();
    res.json(savedSettings);
  } catch (err) {
    next(err);
  }
});

export default router;
