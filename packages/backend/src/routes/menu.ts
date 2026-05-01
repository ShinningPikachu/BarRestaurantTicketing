import { Router, Request, Response, NextFunction } from 'express';
import { menuService } from '../services/menu.service';
import { errorResponse, successResponse } from '../types/api';
import { logger } from '../utils/logger.js';

const router = Router();

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
