import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { menuService } from '../services/menu.service';
import { signalDataChange } from '../services/sync.service.js';
import { errorResponse, successResponse } from '../types/api';
import { validateBody, validateParams } from '../middleware/validation';
import { logger } from '../utils/logger.js';
import { parseCsvObjects } from '../utils/csv.js';

const router = Router();

const menuItemBodySchema = z.object({
  name: z.string().trim().min(1),
  primaryName: z.string().trim().optional().nullable(),
  secondaryName: z.string().trim().optional().nullable(),
  priceCents: z.number().int().min(0),
  costCents: z.number().int().min(0).optional().nullable(),
  category: z.string().trim().min(1),
  sku: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  imageDataUrl: z.string().trim().max(1_500_000).startsWith('data:image/').optional().nullable(),
  available: z.boolean().optional(),
});

const updateMenuItemBodySchema = menuItemBodySchema.partial().refine((payload) => Object.keys(payload).length > 0, {
  message: 'At least one field is required',
});

const menuItemParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const importCsvBodySchema = z.object({
  csv: z.string().min(1),
});

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  return ['true', '1', 'yes', 'si', 'sí'].includes(value.trim().toLowerCase());
}

function parseCents(record: Record<string, string>, centsKey: string, euroKey: string): number | null {
  const centsValue = record[centsKey]?.trim();
  if (centsValue) {
    const parsed = Number(centsValue);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  }

  const euroValue = record[euroKey]?.replace(',', '.').trim();
  if (!euroValue) return null;
  const parsed = Number(euroValue);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
}

function parseMenuImportCsv(csv: string) {
  return parseCsvObjects(csv).map((record, index) => {
    const name = record.name?.trim();
    const category = record.category?.trim();
    const priceCents = parseCents(record, 'priceCents', 'price');
    const costCents = parseCents(record, 'costCents', 'cost');

    if (!name || !category || priceCents === null) {
      throw new Error(`Invalid CSV row ${index + 2}: name, category and price are required`);
    }

    return {
      name,
      primaryName: record.primaryName?.trim() || null,
      secondaryName: record.secondaryName?.trim() || null,
      category,
      priceCents,
      costCents,
      sku: record.sku?.trim() || null,
      description: record.description?.trim() || null,
      imageDataUrl: record.imageDataUrl?.trim() || null,
      available: parseBoolean(record.available),
    };
  });
}

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
      next(error);
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
