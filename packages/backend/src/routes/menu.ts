import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { menuService } from '../services/menu.service';
import { errorResponse, successResponse } from '../types/api';
import { validateBody, validateParams } from '../middleware/validation';
import { logger } from '../utils/logger.js';

const router = Router();

const menuItemBodySchema = z.object({
  name: z.string().trim().min(1),
  priceCents: z.number().int().min(0),
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
  '/',
  validateBody(menuItemBodySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await menuService.createMenuItem(req.body);
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
      res.json(successResponse(item));
    } catch (error) {
      logger.error({ error }, 'Failed to update menu item');
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
