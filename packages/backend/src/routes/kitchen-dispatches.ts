import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import prisma from '../db.js';
import { ApiError } from '../middleware/errorHandler.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { acknowledgeKitchenDispatch, printKitchenDispatch } from '../services/kitchen-dispatch.service.js';
import { PrinterTransportError } from '../services/printer-adapter.js';
import { signalDataChange } from '../services/sync.service.js';
import { successResponse } from '../types/api.js';

const router = Router();
const idParams = z.object({ id: z.string().trim().min(1).max(128) });
const printBody = z.object({ confirmedNoOutput: z.boolean().optional() });
const acknowledgeBody = z.object({ manualHandoff: z.boolean().optional() });

function asResponse(job: { linesJson: string }) {
  const { linesJson, ...rest } = job as typeof job & Record<string, unknown>;
  return { ...rest, items: JSON.parse(linesJson) };
}

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Unresolved handoffs must remain visible even after hundreds of routine
    // acknowledged deliveries; newest-first alone can bury a lost order.
    const [unresolved, recentAcknowledged, unresolvedCount] = await Promise.all([
      prisma.kitchenDispatch.findMany({
        where: { status: { not: 'acknowledged' } },
        take: 500,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      prisma.kitchenDispatch.findMany({
        where: { status: 'acknowledged' },
        take: 20,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      prisma.kitchenDispatch.count({ where: { status: { not: 'acknowledged' } } }),
    ]);
    // UI handles a bounded list. Signal excess unresolved items instead of
    // incorrectly suggesting every order is accounted for.
    res.json(successResponse({
      jobs: [...unresolved, ...recentAcknowledged].map(asResponse),
      unresolvedCount,
      truncated: unresolvedCount > unresolved.length,
    }));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/print', validateParams(idParams), validateBody(printBody),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await printKitchenDispatch(req.params.id, req.body.confirmedNoOutput === true);
      signalDataChange('orders');
      res.json(successResponse(result));
    } catch (error) {
      if (error instanceof PrinterTransportError) {
        next(new ApiError(503, error.message, error.code));
        return;
      }
      next(error);
    }
  });

router.post('/:id/acknowledge', validateParams(idParams), validateBody(acknowledgeBody),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dispatch = await acknowledgeKitchenDispatch(req.params.id, req.body.manualHandoff === true);
      signalDataChange('orders');
      res.json(successResponse(asResponse(dispatch)));
    } catch (error) {
      next(error);
    }
  });

export default router;
