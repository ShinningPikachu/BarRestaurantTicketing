import { Router, Request, Response } from 'express';
import { orderService } from '../services/order.service';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const orders = await orderService.getAllOrders();
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { tableNumber, tableZone, items } = req.body;
    const created = await orderService.createOrder(tableNumber, tableZone, items);
    res.json(created);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await orderService.deleteOrder(id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.delete('/:id/items/:itemId', async (req: Request, res: Response) => {
  try {
    const { id, itemId } = req.params;
    const parsedItemId = Number(itemId);

    if (!Number.isInteger(parsedItemId)) {
      res.status(400).json({ error: 'Invalid item id' });
      return;
    }

    const result = await orderService.deleteOrderItem(id, parsedItemId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
