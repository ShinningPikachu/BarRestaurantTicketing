import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { requireManager } from '../middleware/auth.js';
import { reconcileRecordedTickets } from '../services/reconciliation.service.js';
import { successResponse } from '../types/api.js';

const router = Router();
const querySchema = z.object({
  maxTickets: z.coerce.number().int().min(1).max(50_000).optional(),
});

router.get('/reconciliation', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = querySchema.parse(req.query);
    res.json(successResponse(await reconcileRecordedTickets(undefined, query.maxTickets ?? 10_000)));
  } catch (error) {
    next(error);
  }
});

export default router;
