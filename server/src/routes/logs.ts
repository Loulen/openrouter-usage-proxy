/**
 * API routes for querying usage logs
 * Provides endpoints for retrieving logged API usage data
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getLogs, getStats } from '../db/index.js';
import type { UsageLog, UsageStats, ApiErrorResponse } from '../types/index.js';

/**
 * Express router for log-related endpoints
 */
const router = Router();

/**
 * GET /api/logs
 * Returns all usage logs ordered by timestamp (most recent first)
 *
 * @returns Array of UsageLog objects
 */
router.get('/', (req: Request, res: Response<UsageLog[] | ApiErrorResponse>, next: NextFunction) => {
  try {
    const logs = getLogs();
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/logs/stats
 * Returns aggregated usage statistics
 *
 * @returns UsageStats object with request_count, total_tokens, total_cost
 */
router.get('/stats', (req: Request, res: Response<UsageStats | ApiErrorResponse>, next: NextFunction) => {
  try {
    const stats = getStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

export default router;
