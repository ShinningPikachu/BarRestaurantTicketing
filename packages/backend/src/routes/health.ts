import { Router, NextFunction, Request, Response } from 'express';
import prisma from '../db';
import { successResponse } from '../types/api';
import { logger } from '../utils/logger.js';

const router = Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json(successResponse({ status: 'ok' }));
  } catch (error) {
    logger.error({ error }, 'Health check failed');
    next(error);
  }
});

export default router;
