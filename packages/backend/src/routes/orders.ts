import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { workflowService } from '../domain/workflow/workflow.service';
import { validateBody, validateParams } from '../middleware/validation';
import { successResponse } from '../types/api';
import { logger } from '../utils/logger.js';

const router = Router();

// Validation schemas
const sendToKitchenSchema = z.object({
  tableNumber: z.number().positive('Table number must be positive'),
  tableZone: z.string().min(1, 'Table zone is required'),
});

const itemIdParamSchema = z.object({
  itemId: z.coerce.number().positive('Item ID must be positive'),
});

export const moveToPreorderParamSchema = z.object({
  id: z.string().min(1, 'Order ID is required'),
  itemId: z.coerce.number().positive('Item ID must be positive'),
});

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({}, 'Fetching all orders');
    const orders = await workflowService.getAllOrders();
    logger.debug({ count: orders.length }, 'Orders fetched');
    res.json(successResponse(orders));
  } catch (error) {
    logger.error({ error }, 'Failed to fetch orders');
    next(error);
  }
});

router.post(
  '/',
  validateBody(sendToKitchenSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tableNumber, tableZone } = req.body;
      logger.info({ tableNumber, tableZone }, 'Sending order to kitchen');

      await workflowService.sendToKitchen(tableNumber, tableZone);
      const workflow = await workflowService.getTableWorkflow(tableNumber, tableZone);
      res.status(201).json(successResponse(workflow));
    } catch (error) {
      logger.error({ error }, 'Failed to send order to kitchen');
      next(error);
    }
  }
);

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    logger.info({ orderId: id }, 'Deleting order');
    await workflowService.deleteOrder(id);
    res.json(successResponse({ ok: true }));
  } catch (error) {
    logger.error({ error }, 'Failed to delete order');
    next(error);
  }
});

router.post(
  '/:id/items/:itemId/move-to-preorder',
  validateParams(moveToPreorderParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, itemId } = req.params;
      const parsedItemId = Number(itemId);

      logger.info({ orderId: id, itemId: parsedItemId }, 'Moving order item to pre-order');

      const targetTable = await workflowService.moveConfirmedOrderItemToPreOrder(id, parsedItemId);
      const workflow = await workflowService.getTableWorkflow(targetTable.tableNumber, targetTable.tableZone);
      res.json(successResponse(workflow));
    } catch (error) {
      logger.error({ error }, 'Failed to move item to pre-order');
      next(error);
    }
  }
);

export default router;
