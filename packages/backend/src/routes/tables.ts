import { Request, Response, Router, NextFunction } from 'express';
import { z } from 'zod';
import { workflowService } from '../domain/workflow/workflow.service';
import { validateParams, validateBody } from '../middleware/validation';
import { successResponse } from '../types/api';
import { logger } from '../utils/logger.js';

const router = Router();

// Validation schemas
const tableParamsSchema = z.object({
  zone: z.string().min(1, 'Zone is required'),
  number: z.coerce.number().positive('Table number must be positive'),
});

const tableNumberParamSchema = z.object({
  number: z.coerce.number().positive('Table number must be positive'),
});

const createTableSchema = z.object({
  zone: z.string().min(1, 'Zone is required'),
});

const addPreOrderItemSchema = z.object({
  menuItemId: z.number().positive('Menu item ID must be positive'),
});

const updatePreOrderItemSchema = z.object({
  qty: z.number().int().min(0, 'Qty must be >= 0').optional(),
  unitPriceCents: z.number().int().min(0, 'Unit price must be >= 0').optional(),
});

// Routes
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({}, 'Fetching all tables');
    const tables = await workflowService.listTables();
    logger.debug({ count: tables.length }, 'Tables fetched');
    res.json(successResponse(tables));
  } catch (error) {
    logger.error({ error }, 'Failed to fetch tables');
    next(error);
  }
});

router.post(
  '/',
  validateBody(createTableSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { zone } = req.body;
      logger.info({ zone }, 'Creating new table in zone');

      const table = await workflowService.addTable(zone);
      res.status(201).json(successResponse(table));
    } catch (error) {
      logger.error({ error }, 'Failed to create table');
      next(error);
    }
  }
);

router.get(
  '/:zone/:number/workflow',
  validateParams(tableParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const zone = req.params.zone;
      const number = Number(req.params.number);
      logger.info({ zone, number }, 'Fetching table workflow');

      const workflow = await workflowService.getTableWorkflow(number, zone);
      res.json(successResponse(workflow));
    } catch (error) {
      logger.error({ error }, 'Failed to fetch table workflow');
      next(error);
    }
  }
);

router.post(
  '/:zone/:number/preorder/items',
  validateParams(tableParamsSchema),
  validateBody(addPreOrderItemSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const zone = req.params.zone;
      const number = Number(req.params.number);
      const { menuItemId } = req.body;

      logger.info({ zone, number, menuItemId }, 'Adding menu item to pre-order');

      await workflowService.addPreOrderMenuItem(number, zone, menuItemId);
      const workflow = await workflowService.getTableWorkflow(number, zone);
      res.json(successResponse(workflow));
    } catch (error) {
      logger.error({ error }, 'Failed to add pre-order item');
      next(error);
    }
  }
);

router.patch(
  '/:zone/:number/preorder/items/:itemId',
  validateParams(tableParamsSchema.extend({ itemId: z.coerce.number().positive() })),
  validateBody(updatePreOrderItemSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const zone = req.params.zone;
      const number = Number(req.params.number);
      const itemId = Number(req.params.itemId);
      const { qty, unitPriceCents } = req.body;

      logger.info({ zone, number, itemId, qty, unitPriceCents }, 'Updating pre-order item');

      await workflowService.updatePreOrderItem(number, zone, itemId, { qty, unitPriceCents });
      const workflow = await workflowService.getTableWorkflow(number, zone);
      res.json(successResponse(workflow));
    } catch (error) {
      logger.error({ error }, 'Failed to update pre-order item');
      next(error);
    }
  }
);

router.post(
  '/:zone/:number/preorder/clear',
  validateParams(tableParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const zone = req.params.zone;
      const number = Number(req.params.number);

      logger.info({ zone, number }, 'Clearing pre-order');

      await workflowService.clearPreOrder(number, zone);
      const workflow = await workflowService.getTableWorkflow(number, zone);
      res.json(successResponse(workflow));
    } catch (error) {
      logger.error({ error }, 'Failed to clear pre-order');
      next(error);
    }
  }
);

router.post(
  '/:zone/:number/send-to-kitchen',
  validateParams(tableParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const zone = req.params.zone;
      const number = Number(req.params.number);

      logger.info({ zone, number }, 'Sending pre-order to kitchen');

      await workflowService.sendToKitchen(number, zone);
      const workflow = await workflowService.getTableWorkflow(number, zone);
      res.json(successResponse(workflow));
    } catch (error) {
      logger.error({ error }, 'Failed to send to kitchen');
      next(error);
    }
  }
);

export default router;
