import { Router, Request, Response } from 'express';
import { menuService } from '../services/menu.service';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const items = await menuService.getAllMenuItems();
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await menuService.getMenuItemById(parseInt(id));
    if (!item) return res.status(404).json({ error: 'Menu item not found' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get('/category/:category', async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const items = await menuService.getMenuItemsByCategory(category);
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
