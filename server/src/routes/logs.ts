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
} from '../db/index.js';
import type {
  UsageLog,
  UsageStats,
  ApiErrorResponse,
  FilterParams,
  ModelStats,
  ModelsResponse,
  TimeSeriesDataPoint,
  AggregationPeriod,
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

  return filters;
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
 *
 * @returns Array of UsageLog objects
 */
router.get('/', (req: Request, res: Response<UsageLog[] | ApiErrorResponse>, next: NextFunction) => {
  try {
    const filters = parseFilterParams(req.query);
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
 *
 * @returns UsageStats object with request_count, total_tokens, total_cost
 */
router.get('/stats', (req: Request, res: Response<UsageStats | ApiErrorResponse>, next: NextFunction) => {
  try {
    const filters = parseFilterParams(req.query);
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
 *
 * @returns Array of ModelStats objects with per-model breakdown
 */
router.get('/model-stats', (req: Request, res: Response<ModelStats[] | ApiErrorResponse>, next: NextFunction) => {
  try {
    const filters = parseFilterParams(req.query);
    // model-stats doesn't use model filter (it returns all models)
    const modelStats = getModelStats({ from: filters.from, to: filters.to });
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
 *
 * @returns Array of TimeSeriesDataPoint objects with period, model, and stats
 */
router.get('/time-series', (req: Request, res: Response<TimeSeriesDataPoint[] | ApiErrorResponse>, next: NextFunction) => {
  try {
    const filters = parseFilterParams(req.query);

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
    });
    res.json(timeSeries);
  } catch (err) {
    next(err);
  }
});

export default router;
