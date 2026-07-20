import { Request, Response, Router, NextFunction } from 'express';
import { z } from 'zod';
import { workflowService } from '../domain/workflow/workflow.service.js';
import { validateParams, validateBody } from '../middleware/validation.js';
import { signalDataChange } from '../services/sync.service.js';
import { successResponse } from '../types/api.js';
import { logger } from '../utils/logger.js';

const router = Router();
const MAX_DATABASE_ID = 2_147_483_647;
const tableNumberParam = z.coerce.number().int().min(1).max(10_000);
const tableZoneParam = z.string().trim().min(1).max(32);

// Validation schemas
const tableParamsSchema = z.object({
  zone: tableZoneParam,
  number: tableNumberParam,
});

const createTableSchema = z.object({
  zone: tableZoneParam,
});

const addPreOrderItemSchema = z.object({
  menuItemId: z.number().int().min(1).max(MAX_DATABASE_ID),
});

const updatePreOrderItemSchema = z.object({
  qty: z.number().int().min(0).max(10_000).optional(),
  unitPriceCents: z.number().int().min(0).max(2_000_000_000).optional(),
}).refine((payload) => payload.qty !== undefined || payload.unitPriceCents !== undefined, {
  message: 'At least one field is required',
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
  '/ensure-zone',
  validateBody(createTableSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const table = await workflowService.ensureTableInZone(req.body.zone);
      signalDataChange('tables');
      res.json(successResponse(table));
    } catch (error) {
      logger.error({ error }, 'Failed to ensure a table in zone');
      next(error);
    }
  }
);

router.post(
  '/',
  validateBody(createTableSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { zone } = req.body;
      logger.info({ zone }, 'Creating new table in zone');

      const table = await workflowService.addTable(zone);
      signalDataChange('tables');
      res.status(201).json(successResponse(table));
    } catch (error) {
      logger.error({ error }, 'Failed to create table');
      next(error);
    }
  }
);

router.delete(
  '/:zone/:number',
  validateParams(tableParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const zone = req.params.zone;
      const number = Number(req.params.number);

      logger.info({ zone, number }, 'Deleting table');

      await workflowService.deleteTable(number, zone);
      signalDataChange('tables');
      res.json(successResponse({ ok: true }));
    } catch (error) {
      logger.error({ error }, 'Failed to delete table');
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
      signalDataChange('orders');
      res.json(successResponse(workflow));
    } catch (error) {
      logger.error({ error }, 'Failed to add pre-order item');
      next(error);
    }
  }
);

router.patch(
  '/:zone/:number/preorder/items/:itemId',
  validateParams(tableParamsSchema.extend({ itemId: z.coerce.number().int().min(1).max(MAX_DATABASE_ID) })),
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
      signalDataChange('orders');
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
      signalDataChange('orders');
      res.json(successResponse(workflow));
    } catch (error) {
      logger.error({ error }, 'Failed to clear pre-order');
      next(error);
    }
  }
);

router.post(
  '/:zone/:number/ticket-printed',
  validateParams(tableParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const zone = req.params.zone;
      const number = Number(req.params.number);

      logger.info({ zone, number }, 'Marking table ticket as printed');

      const table = await workflowService.markTableTicketPrinted(number, zone);
      signalDataChange('orders');
      res.json(successResponse(table));
    } catch (error) {
      logger.error({ error }, 'Failed to mark table ticket as printed');
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
      signalDataChange('orders');
      res.json(successResponse(workflow));
    } catch (error) {
      logger.error({ error }, 'Failed to send to kitchen');
      next(error);
    }
  }
);

export default router;
