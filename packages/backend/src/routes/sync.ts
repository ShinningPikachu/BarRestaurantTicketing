import { Router, Request, Response, NextFunction } from 'express';
import { getSyncRevision } from '../services/sync.service.js';
import { successResponse } from '../types/api.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.get('/revision', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(successResponse(getSyncRevision()));
  } catch (error) {
    logger.error({ error }, 'Failed to fetch sync revision');
    next(error);
  }
});

export default router;
