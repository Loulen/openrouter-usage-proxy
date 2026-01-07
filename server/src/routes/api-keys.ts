/**
 * API routes for API key management
 * Provides endpoints for CRUD operations on API keys and fetching OpenRouter balances
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  getApiKeyById,
  addApiKey,
  updateApiKey,
  deleteApiKey,
  getAllApiKeys,
} from '../db/settings.js';
import { hashApiKey } from '../middleware/proxy.js';
import type {
  ApiKeyConfig,
  ApiKeyBalance,
  ApiKeyInput,
  ApiKeyUpdateInput,
  OpenRouterKeyResponse,
} from '../types/settings.js';
import type { ApiErrorResponse } from '../types/index.js';

/**
 * OpenRouter API base URL for key information
 */
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';

/**
 * Express router for API key-related endpoints
 */
const router = Router();

/**
 * Fetch balance information from OpenRouter API for a given API key
 *
 * @param apiKeyConfig - The API key configuration to fetch balance for
 * @returns ApiKeyBalance object with balance data or error information
 */
async function fetchOpenRouterBalance(apiKeyConfig: ApiKeyConfig): Promise<ApiKeyBalance> {
  const now = new Date().toISOString();

  try {
    const response = await fetch(`${OPENROUTER_API_URL}/key`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKeyConfig.key}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Handle specific error codes
      if (response.status === 401 || response.status === 403) {
        return {
          id: apiKeyConfig.id,
          label: apiKeyConfig.label,
          openRouterLabel: null,
          limit: null,
          limitRemaining: null,
          usage: 0,
          usageDaily: 0,
          usageWeekly: 0,
          usageMonthly: 0,
          isFreeTier: false,
          lastUpdated: now,
          error: 'Invalid or unauthorized API key',
        };
      }

      if (response.status === 402) {
        return {
          id: apiKeyConfig.id,
          label: apiKeyConfig.label,
          openRouterLabel: null,
          limit: null,
          limitRemaining: 0,
          usage: 0,
          usageDaily: 0,
          usageWeekly: 0,
          usageMonthly: 0,
          isFreeTier: false,
          lastUpdated: now,
          error: 'Insufficient credits',
        };
      }

      return {
        id: apiKeyConfig.id,
        label: apiKeyConfig.label,
        openRouterLabel: null,
        limit: null,
        limitRemaining: null,
        usage: 0,
        usageDaily: 0,
        usageWeekly: 0,
        usageMonthly: 0,
        isFreeTier: false,
        lastUpdated: now,
        error: `OpenRouter API error: ${response.status} ${response.statusText}`,
      };
    }

    const data = (await response.json()) as OpenRouterKeyResponse;

    return {
      id: apiKeyConfig.id,
      label: apiKeyConfig.label,
      openRouterLabel: data.data.label || null,
      limit: data.data.limit,
      limitRemaining: data.data.limit_remaining,
      usage: data.data.usage,
      usageDaily: data.data.usage_daily,
      usageWeekly: data.data.usage_weekly,
      usageMonthly: data.data.usage_monthly,
      isFreeTier: data.data.is_free_tier,
      lastUpdated: now,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      id: apiKeyConfig.id,
      label: apiKeyConfig.label,
      openRouterLabel: null,
      limit: null,
      limitRemaining: null,
      usage: 0,
      usageDaily: 0,
      usageWeekly: 0,
      usageMonthly: 0,
      isFreeTier: false,
      lastUpdated: now,
      error: `Failed to fetch balance: ${errorMessage}`,
    };
  }
}

/**
 * GET /api/api-keys
 * Returns all API key configurations (without exposing full key values)
 *
 * @returns Array of API key configurations with masked keys
 */
router.get('/', (req: Request, res: Response<Omit<ApiKeyConfig, 'key'>[] | ApiErrorResponse>, next: NextFunction) => {
  try {
    const apiKeys = getAllApiKeys();
    // Mask the API key values for security - only show last 4 characters
    const maskedKeys = apiKeys.map((key) => ({
      id: key.id,
      label: key.label,
      createdAt: key.createdAt,
      // Mask the key, showing only the prefix and last 4 characters
      maskedKey: key.key.length > 12
        ? `${key.key.substring(0, 8)}...${key.key.substring(key.key.length - 4)}`
        : '***',
    }));
    res.json(maskedKeys);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/api-keys
 * Creates a new API key configuration
 *
 * Request body:
 *   - label: string - User-friendly name for the key
 *   - key: string - OpenRouter API key (sk-or-...)
 *
 * @returns Created API key configuration (with masked key)
 */
router.post('/', (req: Request, res: Response<Omit<ApiKeyConfig, 'key'> & { maskedKey: string } | ApiErrorResponse>, next: NextFunction) => {
  try {
    const { label, key } = req.body as ApiKeyInput;

    // Validate required fields
    if (!label || typeof label !== 'string' || !label.trim()) {
      res.status(400).json({
        error: true,
        message: 'Label is required',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    if (!key || typeof key !== 'string' || !key.trim()) {
      res.status(400).json({
        error: true,
        message: 'API key is required',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    // Validate API key format (should start with sk-or-)
    if (!key.startsWith('sk-or-')) {
      res.status(400).json({
        error: true,
        message: 'Invalid API key format. OpenRouter API keys should start with "sk-or-"',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const newApiKey = addApiKey({ label: label.trim(), key: key.trim() });

    // Return with masked key
    res.status(201).json({
      id: newApiKey.id,
      label: newApiKey.label,
      createdAt: newApiKey.createdAt,
      maskedKey: newApiKey.key.length > 12
        ? `${newApiKey.key.substring(0, 8)}...${newApiKey.key.substring(newApiKey.key.length - 4)}`
        : '***',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/api-keys/hash-map
 * Returns a mapping of API key hashes to their labels for client-side resolution
 *
 * This endpoint allows clients to resolve API key hashes (stored in usage logs)
 * to human-readable labels without exposing the actual API key values.
 *
 * @returns Object mapping hash strings to label strings: { [hash: string]: string }
 */
router.get('/hash-map', (req: Request, res: Response<Record<string, string> | ApiErrorResponse>, next: NextFunction) => {
  try {
    const apiKeys = getAllApiKeys();

    // Build hash-to-label mapping
    const hashMap: Record<string, string> = {};
    for (const apiKey of apiKeys) {
      const hash = hashApiKey(apiKey.key);
      hashMap[hash] = apiKey.label;
    }

    res.json(hashMap);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/api-keys/:id
 * Updates an existing API key configuration
 *
 * Request body (all optional):
 *   - label: string - New label for the key
 *   - key: string - New OpenRouter API key
 *
 * @returns Updated API key configuration (with masked key)
 */
router.put('/:id', (req: Request, res: Response<Omit<ApiKeyConfig, 'key'> & { maskedKey: string } | ApiErrorResponse>, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updates = req.body as ApiKeyUpdateInput;

    // Check if the API key exists
    const existingKey = getApiKeyById(id);
    if (!existingKey) {
      res.status(404).json({
        error: true,
        message: 'API key not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    // Validate updates
    if (updates.label !== undefined && (typeof updates.label !== 'string' || !updates.label.trim())) {
      res.status(400).json({
        error: true,
        message: 'Label cannot be empty',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    if (updates.key !== undefined) {
      if (typeof updates.key !== 'string' || !updates.key.trim()) {
        res.status(400).json({
          error: true,
          message: 'API key cannot be empty',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      // Validate API key format
      if (!updates.key.startsWith('sk-or-')) {
        res.status(400).json({
          error: true,
          message: 'Invalid API key format. OpenRouter API keys should start with "sk-or-"',
          code: 'VALIDATION_ERROR',
        });
        return;
      }
    }

    // Apply updates
    const updatedApiKey = updateApiKey(id, {
      ...(updates.label && { label: updates.label.trim() }),
      ...(updates.key && { key: updates.key.trim() }),
    });

    if (!updatedApiKey) {
      res.status(404).json({
        error: true,
        message: 'API key not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    // Return with masked key
    res.json({
      id: updatedApiKey.id,
      label: updatedApiKey.label,
      createdAt: updatedApiKey.createdAt,
      maskedKey: updatedApiKey.key.length > 12
        ? `${updatedApiKey.key.substring(0, 8)}...${updatedApiKey.key.substring(updatedApiKey.key.length - 4)}`
        : '***',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/api-keys/:id
 * Deletes an API key configuration
 *
 * @returns Success message or error
 */
router.delete('/:id', (req: Request, res: Response<{ success: boolean; message: string } | ApiErrorResponse>, next: NextFunction) => {
  try {
    const { id } = req.params;

    const deleted = deleteApiKey(id);

    if (!deleted) {
      res.status(404).json({
        error: true,
        message: 'API key not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    res.json({
      success: true,
      message: 'API key deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/api-keys/balances
 * Fetches balance information for all configured API keys from OpenRouter
 *
 * @returns Array of ApiKeyBalance objects
 */
router.get('/balances', async (req: Request, res: Response<ApiKeyBalance[] | ApiErrorResponse>, next: NextFunction) => {
  try {
    const apiKeys = getAllApiKeys();

    if (apiKeys.length === 0) {
      res.json([]);
      return;
    }

    // Fetch balances for all keys in parallel
    const balancePromises = apiKeys.map((apiKey) => fetchOpenRouterBalance(apiKey));
    const balances = await Promise.all(balancePromises);

    res.json(balances);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/api-keys/:id/balance
 * Fetches balance information for a specific API key from OpenRouter
 *
 * @returns ApiKeyBalance object with balance information
 */
router.get('/:id/balance', async (req: Request, res: Response<ApiKeyBalance | ApiErrorResponse>, next: NextFunction) => {
  try {
    const { id } = req.params;

    const apiKeyConfig = getApiKeyById(id);

    if (!apiKeyConfig) {
      res.status(404).json({
        error: true,
        message: 'API key not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    const balance = await fetchOpenRouterBalance(apiKeyConfig);
    res.json(balance);
  } catch (err) {
    next(err);
  }
});

export default router;
