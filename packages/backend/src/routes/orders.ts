import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { workflowService } from '../domain/workflow/workflow.service';
import { validateBody, validateParams } from '../middleware/validation';
import { signalDataChange } from '../services/sync.service.js';
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

const paymentMethodSchema = z.enum(['cash', 'card']);

const payTableSchema = z.object({
  tableNumber: z.number().positive('Table number must be positive'),
  tableZone: z.string().min(1, 'Table zone is required'),
  method: paymentMethodSchema,
  splitPeople: z.number().int().positive().optional(),
});

const paySelectedItemsSchema = z.object({
  tableNumber: z.number().positive('Table number must be positive'),
  tableZone: z.string().min(1, 'Table zone is required'),
  method: paymentMethodSchema,
  items: z.array(z.object({
    orderId: z.string().min(1),
    itemId: z.number().int().positive(),
    qty: z.number().int().positive(),
  })).min(1),
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
      signalDataChange('orders');
      res.status(201).json(successResponse(workflow));
    } catch (error) {
      logger.error({ error }, 'Failed to send order to kitchen');
      next(error);
    }
  }
);

router.post(
  '/pay-table',
  validateBody(payTableSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tableNumber, tableZone, method, splitPeople } = req.body;
      logger.info({ tableNumber, tableZone, method, splitPeople }, 'Paying table ticket');

      const result = await workflowService.payTable(tableNumber, tableZone, method, splitPeople);
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
      const { tableNumber, tableZone, method, items } = req.body;
      logger.info({ tableNumber, tableZone, method, itemCount: items.length }, 'Paying selected ticket items');

      const result = await workflowService.paySelectedItems(tableNumber, tableZone, method, items);
      const workflow = await workflowService.getTableWorkflow(result.tableNumber, result.tableZone);
      signalDataChange('orders');
      res.json(successResponse({ paidTicket: result.paidTicket, workflow }));
    } catch (error) {
      logger.error({ error }, 'Failed to pay selected ticket items');
      next(error);
    }
  }
);

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
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
