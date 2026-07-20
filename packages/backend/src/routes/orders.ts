import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { workflowService } from '../domain/workflow/workflow.service.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { signalDataChange } from '../services/sync.service.js';
import { successResponse } from '../types/api.js';
import { logger } from '../utils/logger.js';

const router = Router();
const MAX_DATABASE_ID = 2_147_483_647;
const tableNumberSchema = z.number().int().min(1).max(10_000);
const tableZoneSchema = z.string().trim().min(1).max(32);
const idempotencyKeySchema = z.string().trim().min(8).max(128);

const paymentMethodSchema = z.enum(['cash', 'card']);

const payTableSchema = z.object({
  tableNumber: tableNumberSchema,
  tableZone: tableZoneSchema,
  method: paymentMethodSchema,
  splitPeople: z.number().int().min(1).max(1_000).optional(),
  idempotencyKey: idempotencyKeySchema,
});

const paySelectedItemsSchema = z.object({
  tableNumber: tableNumberSchema,
  tableZone: tableZoneSchema,
  method: paymentMethodSchema,
  items: z.array(z.object({
    orderId: z.string().trim().min(1).max(128),
    itemId: z.number().int().min(1).max(MAX_DATABASE_ID),
    qty: z.number().int().min(1).max(10_000),
  })).min(1).max(500),
  idempotencyKey: idempotencyKeySchema,
});

const removeSelectedItemsSchema = paySelectedItemsSchema.omit({ method: true });

export const moveToPreorderParamSchema = z.object({
  id: z.string().trim().min(1, 'Order ID is required').max(128),
  itemId: z.coerce.number().int().min(1).max(MAX_DATABASE_ID),
});

const orderIdParamSchema = z.object({ id: z.string().trim().min(1).max(128) });

router.post(
  '/pay-table',
  validateBody(payTableSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tableNumber, tableZone, method, splitPeople, idempotencyKey } = req.body;
      logger.info({ tableNumber, tableZone, method, splitPeople }, 'Paying table ticket');

      const result = await workflowService.payTable(tableNumber, tableZone, method, idempotencyKey, splitPeople);
      const workflow = await workflowService.getTableWorkflow(result.tableNumber, result.tableZone);
      signalDataChange('orders');
      res.json(successResponse({ paidTicket: result.paidTicket, workflow }));
    } catch (error) {
      logger.error({ error }, 'Failed to pay table ticket');
      next(error);
    }
  }
);

router.post(
  '/pay-items',
  validateBody(paySelectedItemsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tableNumber, tableZone, method, items, idempotencyKey } = req.body;
      logger.info({ tableNumber, tableZone, method, itemCount: items.length }, 'Paying selected ticket items');

      const result = await workflowService.paySelectedItems(tableNumber, tableZone, method, items, idempotencyKey);
      const workflow = await workflowService.getTableWorkflow(result.tableNumber, result.tableZone);
      signalDataChange('orders');
      res.json(successResponse({ paidTicket: result.paidTicket, workflow }));
    } catch (error) {
      logger.error({ error }, 'Failed to pay selected ticket items');
      next(error);
    }
  }
);

router.post(
  '/remove-items',
  validateBody(removeSelectedItemsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tableNumber, tableZone, items, idempotencyKey } = req.body;
      logger.info({ tableNumber, tableZone, itemCount: items.length }, 'Removing selected ticket items');

      const result = await workflowService.removeSelectedItems(tableNumber, tableZone, items, idempotencyKey);
      const workflow = await workflowService.getTableWorkflow(result.tableNumber, result.tableZone);
      signalDataChange('orders');
      res.json(successResponse(workflow));
    } catch (error) {
      logger.error({ error }, 'Failed to remove selected ticket items');
      next(error);
    }
  }
);

router.delete('/:id', validateParams(orderIdParamSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    logger.info({ orderId: id }, 'Deleting order');
    await workflowService.deleteOrder(id);
    signalDataChange('orders');
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
      signalDataChange('orders');
      res.json(successResponse(workflow));
    } catch (error) {
      logger.error({ error }, 'Failed to move item to pre-order');
      next(error);
    }
  }
);

export default router;
