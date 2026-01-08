/**
 * API routes for querying usage logs
 * Provides endpoints for retrieving logged API usage data
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  getModels,
  getFilteredLogs,
  getFilteredStats,
  getModelStats,
  getTimeSeries,
  getApiKeyStats,
  getApiKeyTimeSeries,
  getUnifiedStats,
} from '../db/index.js';
import { getApiKeyById } from '../db/settings.js';
import { hashApiKey } from '../middleware/proxy.js';
import type {
  UsageLog,
  UsageStats,
  ApiErrorResponse,
  FilterParams,
  ModelStats,
  ModelsResponse,
  TimeSeriesDataPoint,
  AggregationPeriod,
  ApiKeyStats,
  ApiKeyTimeSeriesDataPoint,
  UnifiedStatsResponse,
} from '../types/index.js';

/**
 * Extract filter parameters from Express query object
 * Validates and converts query strings to FilterParams
 *
 * @param query - Express request query object
 * @returns FilterParams object with validated parameters
 */
function parseFilterParams(query: Request['query']): FilterParams {
  const filters: FilterParams = {};

  if (typeof query.model === 'string' && query.model.trim()) {
    filters.model = query.model.trim();
  }

  if (typeof query.from === 'string' && query.from.trim()) {
    filters.from = query.from.trim();
  }

  if (typeof query.to === 'string' && query.to.trim()) {
    filters.to = query.to.trim();
  }

  if (typeof query.apiKeyId === 'string' && query.apiKeyId.trim()) {
    filters.apiKeyId = query.apiKeyId.trim();
  }

  return filters;
}

/**
 * Convert apiKeyId filter to apiKeyHash for database queries
 * Looks up the API key by ID, hashes it, and sets apiKeyHash on the filters
 *
 * @param filters - FilterParams object that may contain apiKeyId
 * @returns Object with resolved filters and optional error message
 */
function resolveApiKeyFilter(filters: FilterParams): { filters: FilterParams; error?: string } {
  if (!filters.apiKeyId) {
    return { filters };
  }

  const apiKeyConfig = getApiKeyById(filters.apiKeyId);
  if (!apiKeyConfig) {
    return { filters, error: 'API key not found' };
  }

  // Create a new filters object with apiKeyHash instead of apiKeyId
  const resolvedFilters: FilterParams = {
    ...filters,
    apiKeyHash: hashApiKey(apiKeyConfig.key),
  };
  // Remove apiKeyId as it's not needed for database queries
  delete resolvedFilters.apiKeyId;

  return { filters: resolvedFilters };
}

/**
 * Express router for log-related endpoints
 */
const router = Router();

/**
 * GET /api/logs
 * Returns usage logs ordered by timestamp (most recent first)
 * Supports optional query parameters for filtering:
 *   - model: Filter by model name (exact match)
 *   - from: Filter logs from this date (ISO 8601)
 *   - to: Filter logs to this date (ISO 8601)
 *   - apiKeyId: Filter by API key ID (UUID, resolved to hash internally)
 *
 * @returns Array of UsageLog objects
 */
router.get('/', (req: Request, res: Response<UsageLog[] | ApiErrorResponse>, next: NextFunction) => {
  try {
    const parsedFilters = parseFilterParams(req.query);
    const { filters, error } = resolveApiKeyFilter(parsedFilters);

    if (error) {
      res.status(400).json({
        error: true,
        message: error,
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const logs = getFilteredLogs(filters);
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/logs/stats
 * Returns aggregated usage statistics
 * Supports optional query parameters for filtering:
 *   - model: Filter by model name (exact match)
 *   - from: Filter stats from this date (ISO 8601)
 *   - to: Filter stats to this date (ISO 8601)
 *   - apiKeyId: Filter by API key ID (UUID, resolved to hash internally)
 *
 * @returns UsageStats object with request_count, total_tokens, total_cost
 */
router.get('/stats', (req: Request, res: Response<UsageStats | ApiErrorResponse>, next: NextFunction) => {
  try {
    const parsedFilters = parseFilterParams(req.query);
    const { filters, error } = resolveApiKeyFilter(parsedFilters);

    if (error) {
      res.status(400).json({
        error: true,
        message: error,
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const stats = getFilteredStats(filters);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/logs/models
 * Returns a list of distinct model names from the logs
 * Used to populate the model filter dropdown
 *
 * @returns Array of model name strings
 */
router.get('/models', (req: Request, res: Response<ModelsResponse | ApiErrorResponse>, next: NextFunction) => {
  try {
    const models = getModels();
    res.json(models);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/logs/model-stats
 * Returns usage statistics grouped by model
 * Used for pie chart visualization of model usage distribution
 * Supports optional query parameters for date filtering:
 *   - from: Filter stats from this date (ISO 8601)
 *   - to: Filter stats to this date (ISO 8601)
 *   - apiKeyId: Filter by API key ID (UUID, resolved to hash internally)
 *
 * @returns Array of ModelStats objects with per-model breakdown
 */
router.get('/model-stats', (req: Request, res: Response<ModelStats[] | ApiErrorResponse>, next: NextFunction) => {
  try {
    const parsedFilters = parseFilterParams(req.query);
    const { filters, error } = resolveApiKeyFilter(parsedFilters);

    if (error) {
      res.status(400).json({
        error: true,
        message: error,
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    // model-stats doesn't use model filter (it returns all models)
    const modelStats = getModelStats({ from: filters.from, to: filters.to, apiKeyHash: filters.apiKeyHash });
    res.json(modelStats);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/logs/time-series
 * Returns usage statistics grouped by time period and model
 * Used for line chart visualization of consumption over time
 * Supports optional query parameters:
 *   - from: Filter stats from this date (ISO 8601)
 *   - to: Filter stats to this date (ISO 8601)
 *   - aggregation: Time period aggregation (hour, day, week) - defaults to 'day'
 *   - apiKeyId: Filter by API key ID (UUID, resolved to hash internally)
 *
 * @returns Array of TimeSeriesDataPoint objects with period, model, and stats
 */
router.get('/time-series', (req: Request, res: Response<TimeSeriesDataPoint[] | ApiErrorResponse>, next: NextFunction) => {
  try {
    const parsedFilters = parseFilterParams(req.query);
    const { filters, error } = resolveApiKeyFilter(parsedFilters);

    if (error) {
      res.status(400).json({
        error: true,
        message: error,
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    // Parse aggregation parameter with validation
    let aggregation: AggregationPeriod = 'day';
    if (typeof req.query.aggregation === 'string') {
      const agg = req.query.aggregation.trim().toLowerCase();
      if (agg === 'hour' || agg === 'day' || agg === 'week') {
        aggregation = agg;
      }
    }

    const timeSeries = getTimeSeries({
      from: filters.from,
      to: filters.to,
      aggregation,
      apiKeyHash: filters.apiKeyHash,
    });
    res.json(timeSeries);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/logs/api-key-stats
 * Returns usage statistics grouped by API key
 * Used for pie chart visualization of API key usage distribution
 * Supports optional query parameters for date filtering:
 *   - from: Filter stats from this date (ISO 8601)
 *   - to: Filter stats to this date (ISO 8601)
 *   - apiKeyId: Filter by API key ID (UUID, resolved to hash internally)
 *
 * @returns Array of ApiKeyStats objects with per-API-key breakdown
 */
router.get('/api-key-stats', (req: Request, res: Response<ApiKeyStats[] | ApiErrorResponse>, next: NextFunction) => {
  try {
    const parsedFilters = parseFilterParams(req.query);
    const { filters, error } = resolveApiKeyFilter(parsedFilters);

    if (error) {
      res.status(400).json({
        error: true,
        message: error,
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const apiKeyStats = getApiKeyStats({ from: filters.from, to: filters.to, apiKeyHash: filters.apiKeyHash });
    res.json(apiKeyStats);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/logs/api-key-time-series
 * Returns usage statistics grouped by time period and API key
 * Used for bar chart visualization of API key consumption over time
 * Supports optional query parameters:
 *   - from: Filter stats from this date (ISO 8601)
 *   - to: Filter stats to this date (ISO 8601)
 *   - aggregation: Time period aggregation (hour, day, week) - defaults to 'day'
 *   - apiKeyId: Filter by API key ID (UUID, resolved to hash internally)
 *
 * @returns Array of ApiKeyTimeSeriesDataPoint objects with period, api_key_hash, and stats
 */
router.get('/api-key-time-series', (req: Request, res: Response<ApiKeyTimeSeriesDataPoint[] | ApiErrorResponse>, next: NextFunction) => {
  try {
    const parsedFilters = parseFilterParams(req.query);
    const { filters, error } = resolveApiKeyFilter(parsedFilters);

    if (error) {
      res.status(400).json({
        error: true,
        message: error,
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    // Parse aggregation parameter with validation
    let aggregation: AggregationPeriod = 'day';
    if (typeof req.query.aggregation === 'string') {
      const agg = req.query.aggregation.trim().toLowerCase();
      if (agg === 'hour' || agg === 'day' || agg === 'week') {
        aggregation = agg;
      }
    }

    const apiKeyTimeSeries = getApiKeyTimeSeries({
      from: filters.from,
      to: filters.to,
      aggregation,
      apiKeyHash: filters.apiKeyHash,
    });
    res.json(apiKeyTimeSeries);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/logs/unified-stats
 * Returns all statistics (aggregated stats, model stats, time-series, API key stats)
 * computed from a single unified SQL query with consistent filtering
 * Supports optional query parameters:
 *   - model: Filter by model name (exact match)
 *   - from: Filter stats from this date (ISO 8601)
 *   - to: Filter stats to this date (ISO 8601)
 *   - apiKeyId: Filter by API key ID (UUID, resolved to hash internally)
 *   - aggregation: Time period aggregation for model time-series (hour, day, week) - defaults to 'day'
 *   - apiKeyAggregation: Time period aggregation for API key time-series (hour, day, week) - defaults to 'day'
 *
 * @returns UnifiedStatsResponse with all statistics computed from the same filtered dataset
 */
router.get('/unified-stats', (req: Request, res: Response<UnifiedStatsResponse | ApiErrorResponse>, next: NextFunction) => {
  try {
    const parsedFilters = parseFilterParams(req.query);
    const { filters, error } = resolveApiKeyFilter(parsedFilters);

    if (error) {
      res.status(400).json({
        error: true,
        message: error,
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    // Parse aggregation parameter for model time-series with validation
    let aggregation: AggregationPeriod = 'day';
    if (typeof req.query.aggregation === 'string') {
      const agg = req.query.aggregation.trim().toLowerCase();
      if (agg === 'hour' || agg === 'day' || agg === 'week') {
        aggregation = agg;
      }
    }

    // Parse apiKeyAggregation parameter for API key time-series with validation
    let apiKeyAggregation: AggregationPeriod = 'day';
    if (typeof req.query.apiKeyAggregation === 'string') {
      const agg = req.query.apiKeyAggregation.trim().toLowerCase();
      if (agg === 'hour' || agg === 'day' || agg === 'week') {
        apiKeyAggregation = agg;
      }
    }

    const unifiedStats = getUnifiedStats({
      model: filters.model,
      from: filters.from,
      to: filters.to,
      apiKeyHash: filters.apiKeyHash,
      aggregation,
      apiKeyAggregation,
    });
    res.json(unifiedStats);
  } catch (err) {
    next(err);
  }
});

export default router;
