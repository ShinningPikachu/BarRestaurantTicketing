import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApiError } from '../middleware/errorHandler.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { imageDataUrlSchema, MenuImportValidationError, parseMenuImportCsv } from '../services/menu-import.js';
import { menuService } from '../services/menu.service.js';
import { signalDataChange } from '../services/sync.service.js';
import { errorResponse, successResponse } from '../types/api.js';
import { CsvParseError } from '../utils/csv.js';
import { logger } from '../utils/logger.js';

const router = Router();
const MAX_CENTS = 2_000_000_000;

const menuItemBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  primaryName: z.string().trim().max(200).optional().nullable(),
  secondaryName: z.string().trim().max(200).optional().nullable(),
  priceCents: z.number().int().min(0).max(MAX_CENTS),
  costCents: z.number().int().min(0).max(MAX_CENTS).optional().nullable(),
  category: z.string().trim().min(1).max(100),
  sku: z.string().trim().max(100).optional().nullable(),
  description: z.string().trim().max(2_000).optional().nullable(),
  imageDataUrl: imageDataUrlSchema.optional().nullable(),
  available: z.boolean().optional(),
});

const updateMenuItemBodySchema = menuItemBodySchema.partial().refine((payload) => Object.keys(payload).length > 0, {
  message: 'At least one field is required',
});

const menuItemParamsSchema = z.object({
  id: z.coerce.number().int().min(1).max(2_147_483_647),
});

const importCsvBodySchema = z.object({
  csv: z.string().min(1).max(2_000_000),
});

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({}, 'Fetching all menu items');
    const items = await menuService.getAllMenuItems();
    logger.debug({ count: items.length }, 'Menu items fetched');
    res.json(successResponse(items));
  } catch (error) {
    logger.error({ error }, 'Failed to fetch menu items');
    next(error);
  }
});

router.get('/manage/all', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({}, 'Fetching all menu items for management');
    const items = await menuService.getAllMenuItemsForManagement();
    res.json(successResponse(items));
  } catch (error) {
    logger.error({ error }, 'Failed to fetch menu items for management');
    next(error);
  }
});

router.post(
  '/import/csv',
  validateBody(importCsvBodySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const items = parseMenuImportCsv(req.body.csv);
      const result = await menuService.importMenuItems(items);
      signalDataChange('menu');
      res.json(successResponse(result));
    } catch (error) {
      logger.error({ error }, 'Failed to import menu CSV');
      if (error instanceof MenuImportValidationError || error instanceof CsvParseError) {
        next(new ApiError(400, error.message, 'INVALID_MENU_CSV'));
      } else {
        next(error);
      }
    }
  }
);

router.post(
  '/',
  validateBody(menuItemBodySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await menuService.createMenuItem(req.body);
      signalDataChange('menu');
      res.status(201).json(successResponse(item));
    } catch (error) {
      logger.error({ error }, 'Failed to create menu item');
      next(error);
    }
  }
);

router.patch(
  '/:id',
  validateParams(menuItemParamsSchema),
  validateBody(updateMenuItemBodySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await menuService.updateMenuItem(Number(req.params.id), req.body);
      signalDataChange('menu');
      res.json(successResponse(item));
    } catch (error) {
      logger.error({ error }, 'Failed to update menu item');
      next(error);
    }
  }
);

router.delete(
  '/:id',
  validateParams(menuItemParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await menuService.deleteMenuItem(Number(req.params.id));
      signalDataChange('menu');
      res.json(successResponse({ ok: true }));
    } catch (error) {
      logger.error({ error }, 'Failed to delete menu item');
      next(error);
    }
  }
);

router.get('/category/:category', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category } = req.params;
    logger.info({ category }, 'Fetching menu items by category');
    const items = await menuService.getMenuItemsByCategory(category);
    res.json(successResponse(items));
  } catch (error) {
    logger.error({ error }, 'Failed to fetch menu items by category');
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'Menu item ID must be a positive integer'));
      return;
    }

    logger.info({ menuItemId: id }, 'Fetching menu item');
    const item = await menuService.getMenuItemById(id);
    if (!item) {
      res.status(404).json(errorResponse('MENU_ITEM_NOT_FOUND', 'Menu item not found'));
      return;
    }
    res.json(successResponse(item));
  } catch (error) {
    logger.error({ error }, 'Failed to fetch menu item');
    next(error);
  }
});

export default router;
